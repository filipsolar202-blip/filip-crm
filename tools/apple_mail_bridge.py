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
MAIL_SYNC_LIMIT = int(os.environ.get("FILIP_CRM_MAIL_LIMIT", "600"))
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
          body text,
          updated_at text,
          unique(message_id)
        )
    """)
    cols = {row[1] for row in con.execute("pragma table_info(messages)").fetchall()}
    if "body" not in cols:
        con.execute("alter table messages add column body text")
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
        "hasBody": bool(row["body"] or ""),
    }


def row_detail(row):
    data = row_public(row)
    data.update({
        "body": row["body"] or "",
    })
    return data


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
            insert into messages(message_id,date,subject,sender,recipients,direction,account,mailbox,mailbox_id,apple_id,body,updated_at)
            values(?,?,?,?,?,?,?,?,?,?,?,?)
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
              body=case when excluded.body != '' then excluded.body else messages.body end,
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
                str(r.get("body") or ""),
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
        log(f"sync start: rebuild={rebuild}, since={since.isoformat(timespec='seconds')}, limit={MAIL_SYNC_LIMIT}")
        rows = export_messages_from_mail_app(limit=MAIL_SYNC_LIMIT, since=since)
        log(f"sync export complete: rows={len(rows)}")
        result = upsert_messages(rows)
        log(f"sync indexed: total={result.get('total', 0)}, indexedNow={result.get('indexedNow', 0)}")
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
    if not out:
        live_rows = live_search_messages_for_emails(emails, limit=limit)
        if live_rows:
            upsert_messages(live_rows)
            return find_messages_for_emails(emails, limit=limit)
    return out


LIVE_SEARCH_SCRIPT = r'''
on cleanText(t)
  set s to t as text
  set AppleScript's text item delimiters to tab
  set s to text items of s as text
  set AppleScript's text item delimiters to linefeed
  set s to text items of s as text
  set AppleScript's text item delimiters to return
  set s to text items of s as text
  set AppleScript's text item delimiters to ""
  return s
end cleanText

on pad2(n)
  if n < 10 then return "0" & (n as text)
  return n as text
end pad2

on isoDate(d)
  set y to year of d as integer
  set mo to month of d as integer
  set da to day of d as integer
  set h to hours of d as integer
  set mi to minutes of d as integer
  set se to seconds of d as integer
  return (y as text) & "-" & my pad2(mo) & "-" & my pad2(da) & "T" & my pad2(h) & ":" & my pad2(mi) & ":" & my pad2(se)
end isoDate

on lowerText(t)
  set upperChars to "ABCDEFGHIJKLMNOPQRSTUVWXYZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ"
  set lowerChars to "abcdefghijklmnopqrstuvwxyzáčďéěíňóřšťúůýž"
  set out to ""
  repeat with i from 1 to count of characters of (t as text)
    set ch to character i of (t as text)
    set p to offset of ch in upperChars
    if p > 0 then
      set out to out & character p of lowerChars
    else
      set out to out & ch
    end if
  end repeat
  return out
end lowerText

on mailboxWanted(boxName)
  set n to my lowerText(boxName)
  if n contains "inbox" then return true
  if n contains "doru" then return true
  if n contains "sent" then return true
  if n contains "odes" then return true
  return false
end mailboxWanted

on directionFor(boxName)
  set n to my lowerText(boxName)
  if n contains "sent" then return "sent"
  if n contains "odes" then return "sent"
  return "received"
end directionFor

using terms from application "Mail"
on recipientList(rs)
  set out to ""
  repeat with r in rs
    try
      set nm to name of r as text
    on error
      set nm to ""
    end try
    try
      set ad to address of r as text
    on error
      set ad to ""
    end try
    if out is not "" then set out to out & ", "
    if nm is not "" and ad is not "" then
      set out to out & nm & " <" & ad & ">"
    else
      set out to out & ad
    end if
  end repeat
  return out
end recipientList

on emitMessage(m, accName, boxName, boxId, dirName)
  try
    set msgDate to date received of m
  on error
    try
      set msgDate to date sent of m
    on error
      set msgDate to current date
    end try
  end try
  try
    set rfcId to (message id of m) as text
  on error
    set rfcId to ""
  end try
  try
    set appleId to (id of m) as text
  on error
    set appleId to ""
  end try
  try
    set subj to (subject of m) as text
  on error
    set subj to "Bez předmětu"
  end try
  try
    set senderText to (sender of m) as text
  on error
    set senderText to ""
  end try
  set toText to ""
  try
    set toText to my recipientList(to recipients of m)
  end try
  set bodyText to ""
  try
    set bodyText to content of m as text
  end try
  return my cleanText(rfcId) & tab & my cleanText(appleId) & tab & my cleanText(my isoDate(msgDate)) & tab & my cleanText(subj) & tab & my cleanText(senderText) & tab & my cleanText(toText) & tab & my cleanText(dirName) & tab & my cleanText(accName) & tab & my cleanText(boxName) & tab & my cleanText(boxId) & tab & my cleanText(bodyText)
end emitMessage
end using terms from

on run argv
  set wanted to item 1 of argv as text
  set maxRows to item 2 of argv as integer
  set outputRows to ""
  set exportedCount to 0
  tell application "Mail"
    repeat with acc in accounts
      if exportedCount >= maxRows then exit repeat
      try
        set accName to name of acc as text
      on error
        set accName to ""
      end try
      repeat with mb in mailboxes of acc
        if exportedCount >= maxRows then exit repeat
        try
          set boxName to name of mb as text
          if my mailboxWanted(boxName) then
            try
              set boxId to id of mb as text
            on error
              set boxId to ""
            end try
            set dirName to my directionFor(boxName)
            set messageCount to 0
            try
              set messageCount to count of messages of mb
            end try
            repeat with messageIndex from 1 to messageCount
              if exportedCount >= maxRows then exit repeat
              try
                set m to message messageIndex of mb
                set senderText to ""
                try
                  set senderText to sender of m as text
                end try
                set toText to ""
                try
                  set toText to my recipientList(to recipients of m)
                end try
                if senderText does not contain wanted and toText does not contain wanted then error "skip"
                set rowText to my emitMessage(m, accName, boxName, boxId, dirName)
                if rowText is not "" then
                  set outputRows to outputRows & rowText & linefeed
                  set exportedCount to exportedCount + 1
                end if
              end try
            end repeat
          end if
        end try
      end repeat
    end repeat
  end tell
  return outputRows
end run
'''


def live_search_messages_for_emails(emails, limit=80):
    rows = []
    seen = set()
    per_email_limit = max(1, min(int(limit or 80), 80))
    for email in emails:
        try:
            out = subprocess.check_output(
                ["/usr/bin/osascript", "-e", LIVE_SEARCH_SCRIPT, email, str(per_email_limit)],
                text=True,
                stderr=subprocess.STDOUT,
                timeout=90,
            )
        except Exception as exc:
            log("live search skipped: " + str(exc))
            continue
        for line in out.splitlines():
            cols = line.split("\t")
            if len(cols) < 10:
                continue
            rfc_id, apple_id, date_value, subject, sender, recipients, direction, account, mailbox, mailbox_id = cols[:10]
            body = cols[10] if len(cols) > 10 else ""
            mid = normalize_message_id(rfc_id) or f"apple:{apple_id}"
            if mid in seen:
                continue
            seen.add(mid)
            rows.append({
                "messageId": mid,
                "appleId": apple_id,
                "date": date_value,
                "subject": subject,
                "from": sender,
                "to": recipients,
                "direction": "sent" if direction == "sent" else "received",
                "account": account,
                "mailbox": mailbox,
                "mailboxId": mailbox_id,
                "body": body,
            })
            if len(rows) >= limit:
                return rows
    return rows


def mailbox_messages(folder="inbox", q="", limit=500):
    folder = (folder or "inbox").lower().strip()
    q = (q or "").lower().strip()
    limit = max(1, min(int(limit or 500), 1000))
    con = db()
    rows = con.execute("select * from messages order by date desc").fetchall()
    out = []
    for row in rows:
        mailbox = (row["mailbox"] or "").lower()
        direction = (row["direction"] or "received").lower()
        is_trash = any(x in mailbox for x in ("trash", "deleted", "koš", "kos"))
        is_archive = any(x in mailbox for x in ("archive", "archiv"))
        is_junk = any(x in mailbox for x in ("junk", "spam", "nevyžádan", "nevyzadan"))
        if folder == "inbox" and (direction == "sent" or is_trash or is_archive or is_junk):
            continue
        if folder == "sent" and direction != "sent":
            continue
        if folder == "archive" and not is_archive:
            continue
        if folder == "trash" and not is_trash:
            continue
        if folder == "all" and is_junk:
            continue
        haystack = " ".join(str(row[k] or "") for k in ("subject", "sender", "recipients", "account", "mailbox")).lower()
        if q and q not in haystack:
            continue
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


DETAIL_BY_ID_SCRIPT = r'''
on cleanText(t)
  set s to t as text
  set AppleScript's text item delimiters to tab
  set s to text items of s as text
  set AppleScript's text item delimiters to linefeed
  set s to text items of s as text
  set AppleScript's text item delimiters to return
  set s to text items of s as text
  set AppleScript's text item delimiters to ""
  return s
end cleanText

using terms from application "Mail"
on emitBody(m)
  try
    return my cleanText(content of m as text)
  on error
    return ""
  end try
end emitBody
end using terms from

on run argv
  set wantedMessageId to item 1 of argv
  tell application "Mail"
    repeat with acc in accounts
      repeat with mb in mailboxes of acc
        try
          set foundMessages to messages of mb whose message id is wantedMessageId
          if (count of foundMessages) > 0 then return my emitBody(item 1 of foundMessages)
        end try
      end repeat
    end repeat
  end tell
  return ""
end run
'''

DETAIL_BY_APPLE_ID_SCRIPT = r'''
on cleanText(t)
  set s to t as text
  set AppleScript's text item delimiters to tab
  set s to text items of s as text
  set AppleScript's text item delimiters to linefeed
  set s to text items of s as text
  set AppleScript's text item delimiters to return
  set s to text items of s as text
  set AppleScript's text item delimiters to ""
  return s
end cleanText

using terms from application "Mail"
on emitBody(m)
  try
    return my cleanText(content of m as text)
  on error
    return ""
  end try
end emitBody
end using terms from

on run argv
  set wantedAppleId to item 1 of argv as integer
  set wantedMailboxId to item 2 of argv as text
  tell application "Mail"
    repeat with acc in accounts
      repeat with mb in mailboxes of acc
        try
          if ((id of mb) as text) is wantedMailboxId then
            set foundMessages to messages of mb whose id is wantedAppleId
            if (count of foundMessages) > 0 then return my emitBody(item 1 of foundMessages)
          end if
        end try
      end repeat
    end repeat
  end tell
  return ""
end run
'''


def mail_message_id(value):
    return str(value or "").strip().strip("<>")


def fetch_body_by_apple_id(row):
    apple_id = str(row["apple_id"] or "").strip()
    mailbox_id = str(row["mailbox_id"] or "").strip()
    if not (apple_id and mailbox_id):
        return ""
    try:
        return subprocess.check_output(
            ["/usr/bin/osascript", "-e", DETAIL_BY_APPLE_ID_SCRIPT, apple_id, mailbox_id],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=8,
        ).strip()
    except Exception as exc:
        log("message body fast lookup skipped: " + str(exc))
        return ""


def fetch_body_by_message_id(row):
    body = fetch_body_by_apple_id(row)
    if body:
        return body
    wanted = mail_message_id(row["message_id"])
    if not wanted:
        return ""
    try:
        return subprocess.check_output(
            ["/usr/bin/osascript", "-e", DETAIL_BY_ID_SCRIPT, wanted],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=20,
        ).strip()
    except Exception as exc:
        log("message body lookup skipped: " + str(exc))
        return ""


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
    mid = mail_message_id(row["message_id"])
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


def message_detail(internal_id):
    try:
        internal_id = int(internal_id)
    except Exception:
        return {"ok": False, "error": "Neplatné ID e-mailu."}
    con = db()
    row = con.execute("select * from messages where id=?", (internal_id,)).fetchone()
    con.close()
    if not row:
        return {"ok": False, "error": "E-mail se v lokálním indexu nenašel."}
    if not (row["body"] or ""):
        body = fetch_body_by_message_id(row)
        if body:
            con = db()
            con.execute("update messages set body=?, updated_at=? where id=?", (body, datetime.now(timezone.utc).isoformat(), internal_id))
            con.commit()
            row = con.execute("select * from messages where id=?", (internal_id,)).fetchone() or row
            con.close()
    return {"ok": True, "message": row_detail(row)}


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
            self.send_json(200, {"ok": True, "connected": True, **SYNC_STATE, "running": SYNC_STATE["running"], "indexed": total, "token": token()})
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
        if parsed.path == "/mailbox":
            qs = parse_qs(parsed.query)
            rows = mailbox_messages(
                folder=(qs.get("folder") or ["inbox"])[0],
                q=(qs.get("q") or [""])[0],
                limit=(qs.get("limit") or ["500"])[0],
            )
            return self.send_json(200, {"ok": True, "messages": rows})
        if parsed.path == "/message":
            qs = parse_qs(parsed.query)
            return self.send_json(200, message_detail((qs.get("id") or [""])[0]))
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
    try:
        con = db()
        total = con.execute("select count(*) from messages").fetchone()[0]
        con.close()
        if total:
            SYNC_STATE["indexed"] = total
            log(f"initial sync skipped: existing index total={total}")
            return
    except Exception as exc:
        log("initial sync precheck error: " + str(exc))
    log("initial sync skipped: index is filled on demand from client e-mail lookup")


def main():
    ensure_dirs()
    token()
    print("FILIP CRM - Apple Mail můstek")
    print("Používá lokální index na tomto Macu.")
    print("macOS se může zeptat, zda smí Python/Terminal ovládat aplikaci Mail. Zvolte Povolit.")
    print(f"Kontrola: http://{HOST}:{PORT}/status")
    threading.Thread(target=background_initial_sync, daemon=True).start()
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
