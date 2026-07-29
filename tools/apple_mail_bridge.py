#!/usr/bin/env python3
import json
import os
import secrets
import sqlite3
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone
from email.utils import getaddresses
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from apple_mail_export import export_messages_from_mail_app


HOST = "127.0.0.1"
PORT = int(os.environ.get("FILIP_CRM_MAIL_PORT", "48726"))
SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "FILIP-CRM"
INDEX_PATH = SUPPORT_DIR / "apple-mail-index.sqlite"
TOKEN_PATH = SUPPORT_DIR / "apple-mail-token"
LOG_DIR = Path.home() / "Library" / "Logs" / "FILIP-CRM"
SYNC_LOCK = threading.Lock()
SYNC_STATE = {"running": False, "lastSyncAt": "", "lastError": "", "indexed": 0}
ALLOWED_ORIGINS = {
    "https://filipsolar202-blip.github.io",
    "http://127.0.0.1:48730",
    "http://localhost:48730",
    "http://127.0.0.1:48726",
    "http://localhost:48726",
    "null",
    "",
}


def ensure_dirs():
    SUPPORT_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def log(message):
    ensure_dirs()
    with (LOG_DIR / "apple-mail-sync.log").open("a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().isoformat(timespec='seconds')}] {message}\n")


def token():
    ensure_dirs()
    if TOKEN_PATH.exists():
        value = TOKEN_PATH.read_text(encoding="utf-8").strip()
        if value:
            return value
    value = secrets.token_urlsafe(32)
    TOKEN_PATH.write_text(value, encoding="utf-8")
    os.chmod(TOKEN_PATH, 0o600)
    return value


def db():
    ensure_dirs()
    con = sqlite3.connect(INDEX_PATH)
    con.row_factory = sqlite3.Row
    con.execute("""
        create table if not exists messages (
          id integer primary key autoincrement,
          message_id text not null,
          date text,
          subject text,
          sender text,
          recipients text,
          direction text,
          account text,
          mailbox text,
          mailbox_id text,
          apple_id text,
          updated_at text,
          unique(message_id)
        )
    """)
    con.execute("create index if not exists idx_messages_date on messages(date desc)")
    con.execute("create index if not exists idx_messages_sender on messages(sender)")
    con.execute("create index if not exists idx_messages_recipients on messages(recipients)")
    con.commit()
    return con


def email_addresses(value):
    return sorted({addr.lower().strip() for _, addr in getaddresses([value or ""]) if addr})


def normalize_message_id(value):
    value = str(value or "").strip()
    if not value:
        return ""
    if not (value.startswith("<") and value.endswith(">")):
        value = "<" + value.strip("<>") + ">"
    return value


def row_public(row):
    return {
        "id": row["id"],
        "date": row["date"] or "",
        "subject": row["subject"] or "Bez předmětu",
        "from": row["sender"] or "",
        "to": row["recipients"] or "",
        "direction": row["direction"] or "received",
        "account": row["account"] or "",
        "mailbox": row["mailbox"] or "",
    }


def upsert_messages(rows):
    con = db()
    count = 0
    now = datetime.now(timezone.utc).isoformat()
    for r in rows:
        mid = normalize_message_id(r.get("messageId"))
        if not mid:
            continue
        con.execute(
            """
            insert into messages(message_id,date,subject,sender,recipients,direction,account,mailbox,mailbox_id,apple_id,updated_at)
            values(?,?,?,?,?,?,?,?,?,?,?)
            on conflict(message_id) do update set
              date=excluded.date,
              subject=excluded.subject,
              sender=excluded.sender,
              recipients=excluded.recipients,
              direction=excluded.direction,
              account=excluded.account,
              mailbox=excluded.mailbox,
              mailbox_id=excluded.mailbox_id,
              apple_id=excluded.apple_id,
              updated_at=excluded.updated_at
            """,
            (
                mid,
                str(r.get("date") or ""),
                str(r.get("subject") or "Bez předmětu"),
                str(r.get("from") or ""),
                str(r.get("to") or ""),
                str(r.get("direction") or "received"),
                str(r.get("account") or ""),
                str(r.get("mailbox") or ""),
                str(r.get("mailboxId") or ""),
                str(r.get("appleId") or ""),
                now,
            ),
        )
        count += 1
    con.commit()
    total = con.execute("select count(*) from messages").fetchone()[0]
    con.close()
    SYNC_STATE.update({"indexed": total, "lastSyncAt": datetime.now().isoformat(timespec="seconds"), "lastError": ""})
    return {"indexedNow": count, "total": total}


def sync_mail(rebuild=False):
    if not SYNC_LOCK.acquire(blocking=False):
        return {"ok": False, "error": "Synchronizace už běží."}
    try:
        SYNC_STATE["running"] = True
        SYNC_STATE["lastError"] = ""
        if rebuild and INDEX_PATH.exists():
            INDEX_PATH.unlink()
        since = datetime.now() - timedelta(days=730)
        if not rebuild and INDEX_PATH.exists():
            con = db()
            latest = con.execute("select max(date) from messages").fetchone()[0]
            con.close()
            if latest:
                try:
                    since = datetime.fromisoformat(str(latest).replace("Z", "+00:00")).replace(tzinfo=None) - timedelta(days=2)
                except Exception:
                    since = datetime.now() - timedelta(days=730)
        rows = export_messages_from_mail_app(since=since)
        result = upsert_messages(rows)
        return {"ok": True, **result}
    except PermissionError:
        SYNC_STATE["lastError"] = "Přístup k Apple Mail nebyl povolen."
        return {"ok": False, "error": SYNC_STATE["lastError"]}
    except Exception as exc:
        msg = str(exc) or "Synchronizace Apple Mail se nepovedla."
        SYNC_STATE["lastError"] = msg
        log("sync error: " + msg)
        return {"ok": False, "error": msg}
    finally:
        SYNC_STATE["running"] = False
        SYNC_LOCK.release()


def find_messages_for_emails(emails, limit=80):
    emails = {e.lower().strip() for e in emails if "@" in e}
    if not emails:
        return []
    con = db()
    rows = con.execute("select * from messages order by date desc").fetchall()
    out = []
    for row in rows:
        addresses = set(email_addresses(row["sender"]) + email_addresses(row["recipients"]))
        if emails.intersection(addresses):
            out.append(row_public(row))
            if len(out) >= limit:
                break
    con.close()
    return out


OPEN_SCRIPT = r'''
on run argv
  set wantedMessageId to item 1 of argv
  tell application "Mail"
    activate
    repeat with acc in accounts
      repeat with mb in mailboxes of acc
        try
          set foundMessages to messages of mb whose message id is wantedMessageId
          if (count of foundMessages) > 0 then
            open item 1 of foundMessages
            return "OK"
          end if
        end try
      end repeat
    end repeat
  end tell
  return "NOT_FOUND"
end run
'''


def open_message(internal_id):
    try:
        internal_id = int(internal_id)
    except Exception:
        return {"ok": False, "error": "Neplatné ID e-mailu."}
    con = db()
    row = con.execute("select * from messages where id=?", (internal_id,)).fetchone()
    con.close()
    if not row:
        return {"ok": False, "error": "E-mail se již v Apple Mail nenachází."}
    mid = normalize_message_id(row["message_id"])
    try:
        out = subprocess.check_output(["/usr/bin/osascript", "-e", OPEN_SCRIPT, mid], text=True, stderr=subprocess.STDOUT, timeout=45)
    except subprocess.CalledProcessError as exc:
        msg = exc.output or str(exc)
        if "not authorized" in msg.lower() or "not allowed" in msg.lower():
            return {"ok": False, "error": "Přístup k Apple Mail nebyl povolen."}
        return {"ok": False, "error": "E-mail se v Apple Mail nepodařilo najít. Otevřete Apple Mail, počkejte na dokončení synchronizace a zkuste to znovu."}
    except Exception:
        return {"ok": False, "error": "Apple Mail není spuštěný."}
    if "OK" in out:
        return {"ok": True}
    return {"ok": False, "error": "E-mail se v Apple Mail nepodařilo najít. Otevřete Apple Mail, počkejte na dokončení synchronizace a zkuste to znovu."}


class Handler(BaseHTTPRequestHandler):
    server_version = "FILIPCRMMail/2.0"

    def log_message(self, fmt, *args):
        log(fmt % args)

    def origin_allowed(self):
        return self.headers.get("Origin", "") in ALLOWED_ORIGINS

    def has_token(self):
        cookie = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        cookie_token = cookie.get("filip_mail_token")
        header_token = self.headers.get("X-FILIP-CRM-Token", "")
        expected = token()
        return (cookie_token and secrets.compare_digest(cookie_token.value, expected)) or (
            header_token and secrets.compare_digest(header_token, expected)
        )

    def send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS and origin:
            self.send_header("Access-Control-Allow-Origin", origin)
        elif origin == "null":
            self.send_header("Access-Control-Allow-Origin", "null")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-FILIP-CRM-Token")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Set-Cookie", f"filip_mail_token={token()}; Path=/; SameSite=Lax")
        self.end_headers()
        self.wfile.write(raw)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length > 1024 * 1024:
            raise ValueError("Požadavek je příliš velký.")
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8") or "{}")

    def do_OPTIONS(self):
        if not self.origin_allowed():
            return self.send_json(403, {"ok": False, "error": "Nepovolený původ CRM."})
        self.send_json(204, {"ok": True})

    def do_GET(self):
        if not self.origin_allowed():
            return self.send_json(403, {"ok": False, "error": "Nepovolený původ CRM."})
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            con = db()
            total = con.execute("select count(*) from messages").fetchone()[0]
            con.close()
            self.send_json(200, {"ok": True, "connected": True, "running": SYNC_STATE["running"], "indexed": total, "token": token(), **SYNC_STATE})
            return
        if not self.has_token():
            return self.send_json(401, {"ok": False, "error": "Lokální můstek není ověřený."})
        if parsed.path == "/emails":
            qs = parse_qs(parsed.query)
            emails = []
            for value in qs.get("email", []):
                emails.extend([x.strip() for x in value.split(",")])
            rows = find_messages_for_emails(emails, limit=max(1, min(int((qs.get("limit") or ["80"])[0]), 200)))
            return self.send_json(200, {"ok": True, "messages": rows})
        self.send_json(404, {"ok": False, "error": "Neznámá adresa."})

    def do_POST(self):
        if not self.origin_allowed():
            return self.send_json(403, {"ok": False, "error": "Nepovolený původ CRM."})
        if not self.has_token():
            return self.send_json(401, {"ok": False, "error": "Lokální můstek není ověřený."})
        parsed = urlparse(self.path)
        try:
            payload = self.read_json()
        except Exception as exc:
            return self.send_json(400, {"ok": False, "error": str(exc)})
        if parsed.path == "/sync":
            return self.send_json(200, sync_mail(False))
        if parsed.path == "/rebuild":
            if payload.get("confirm") != "REBUILD":
                return self.send_json(400, {"ok": False, "error": "Znovu vytvořit index lze jen po potvrzení."})
            return self.send_json(200, sync_mail(True))
        if parsed.path == "/open":
            return self.send_json(200, open_message(payload.get("id")))
        self.send_json(404, {"ok": False, "error": "Neznámá adresa."})


def background_initial_sync():
    time.sleep(1)
    sync_mail(False)


def main():
    ensure_dirs()
    token()
    print("FILIP CRM - Apple Mail můstek")
    print("Používá pouze lokální index bez obsahu zpráv.")
    print("macOS se může zeptat, zda smí Python/Terminal ovládat aplikaci Mail. Zvolte Povolit.")
    print(f"Kontrola: http://{HOST}:{PORT}/status")
    threading.Thread(target=background_initial_sync, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
