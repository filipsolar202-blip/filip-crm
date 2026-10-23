#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


PORT = int(os.environ.get("FILIP_CRM_STORAGE_PORT", "48730"))
DEFAULT_BASE_DIR = Path.home() / "Library" / "Application Support" / "FILIP CRM" / "data"
BASE_DIR = Path(os.environ.get("FILIP_CRM_DATA_DIR", str(DEFAULT_BASE_DIR))).expanduser()
STATE_FILE = BASE_DIR / "state" / "crm-state.json"
BACKUP_DIR = BASE_DIR / "backups"
ATTACHMENT_DIR = BASE_DIR / "attachments"
LOG_DIR = BASE_DIR / "logs"
MAX_BODY = 250 * 1024 * 1024
ALLOWED_ORIGINS = {"https://filipsolar202-blip.github.io", "http://127.0.0.1:48730", "http://localhost:48730", "null"}


def now_stamp():
    return datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def safe_name(value, fallback="soubor"):
    value = str(value or fallback)
    value = re.sub(r"[^\w.\-() ]+", "_", value, flags=re.UNICODE).strip(" .")
    return value[:120] or fallback


def ensure_dirs():
    for path in (STATE_FILE.parent, BACKUP_DIR, ATTACHMENT_DIR, LOG_DIR):
        path.mkdir(parents=True, exist_ok=True)


def origin_allowed(handler):
    origin = handler.headers.get("Origin")
    return not origin or origin in ALLOWED_ORIGINS


def atomic_write(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)


def read_state():
    if not STATE_FILE.exists():
        return None
    with STATE_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def backup_state_file(reason="auto"):
    if not STATE_FILE.exists():
        return None
    target = BACKUP_DIR / f"{now_stamp()}_{safe_name(reason)}_crm-state.json"
    shutil.copy2(STATE_FILE, target)
    return str(target)


def backup_info(path: Path):
    state = None
    try:
        with path.open("r", encoding="utf-8") as f:
            state = json.load(f)
    except Exception:
        state = None
    return {
        "name": path.name,
        "path": str(path),
        "size": path.stat().st_size,
        "updatedAt": datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds"),
        "counts": counts(state),
    }


def list_backups():
    if not BACKUP_DIR.exists():
        return []
    return [
        backup_info(path)
        for path in sorted(BACKUP_DIR.glob("*_crm-state.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        if path.is_file()
    ]


def backup_path_from_name(name):
    safe = Path(str(name or "")).name
    target = (BACKUP_DIR / safe).resolve()
    root = BACKUP_DIR.resolve()
    if not str(target).startswith(str(root)) or not target.exists() or not target.is_file():
        return None
    return target


def decode_data_url(data_url):
    if not isinstance(data_url, str) or not data_url.startswith("data:") or "," not in data_url:
        return None, None
    meta, raw = data_url.split(",", 1)
    mime = "application/octet-stream"
    m = re.match(r"data:([^;]+)", meta)
    if m:
        mime = m.group(1)
    return mime, base64.b64decode(raw)


def attachment_ref(contract_id, attachment, collection="contracts"):
    att_id = safe_name(attachment.get("id") or now_stamp(), "priloha")
    name = safe_name(attachment.get("name") or "priloha")
    return f"{collection}/{safe_name(contract_id, 'bez-zaznamu')}/{att_id}_{name}"


def externalize_attachments(state):
    changed = 0
    records = [("contracts", row) for row in state.get("contracts", [])] if isinstance(state, dict) else []
    records += [("insuranceClaims", row) for row in state.get("insuranceClaims", [])] if isinstance(state, dict) else []
    for collection, contract in records:
        if not isinstance(contract, dict):
            continue
        contract_id = contract.get("id") or "bez-zaznamu"
        attachments = contract.get("attachments")
        if not isinstance(attachments, list):
            continue
        for attachment in attachments:
            if not isinstance(attachment, dict):
                continue
            data_url = attachment.get("dataUrl")
            if not data_url:
                continue
            mime, payload = decode_data_url(data_url)
            if not payload:
                continue
            if collection == "insuranceClaims":
                owner = safe_name(contract.get("syncId") or contract_id, "udalost")
                digest = hashlib.sha256(payload).hexdigest()[:20]
                ref = f"insuranceClaims/{owner}/{digest}_{safe_name(attachment.get('name'), 'priloha')}"
            else:
                ref = attachment.get("fileRef") or attachment_ref(contract_id, attachment, collection)
            target = (ATTACHMENT_DIR / ref).resolve()
            if ATTACHMENT_DIR.resolve() not in target.parents:
                raise ValueError("Neplatný odkaz na přílohu")
            if collection == "insuranceClaims" and attachment.get("fileRef") == ref and target.is_file() and target.read_bytes() == payload:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with target.open("wb") as f:
                f.write(payload)
            attachment["fileRef"] = ref
            attachment["storage"] = "disk"
            attachment["type"] = attachment.get("type") or mime
            attachment["size"] = attachment.get("size") or len(payload)
            attachment["savedAt"] = datetime.now().isoformat(timespec="seconds")
            # Claims must remain portable in JSON/Google backups, even on another device.
            if collection != "insuranceClaims":
                attachment.pop("dataUrl", None)
            changed += 1
    return changed


def counts(state):
    state = state or {}
    contracts = state.get("contracts") or []
    claims = state.get("insuranceClaims") or []
    attachments = sum(len(c.get("attachments") or []) for c in contracts + claims if isinstance(c, dict))
    return {
        "clients": len(state.get("clients") or []),
        "contracts": len(contracts),
        "deals": len(state.get("deals") or []),
        "opportunities": len(state.get("opportunities") or []),
        "insuranceClaims": len(claims),
        "notes": len(state.get("notes") or []),
        "attachments": attachments,
    }


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    origin = handler.headers.get("Origin")
    if origin in ALLOWED_ORIGINS:
        handler.send_header("Access-Control-Allow-Origin", origin)
        handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
    handler.send_header("Access-Control-Allow-Private-Network", "true")
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "FILIPCRMStorage/1.0"

    def log_message(self, fmt, *args):
        try:
            LOG_DIR.mkdir(parents=True, exist_ok=True)
            with (LOG_DIR / "local-storage.log").open("a", encoding="utf-8") as f:
                f.write("[%s] %s\n" % (datetime.now().isoformat(timespec="seconds"), fmt % args))
        except OSError:
            pass

    def do_OPTIONS(self):
        if not origin_allowed(self):
            self.send_response(403)
            self.end_headers()
            return
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.end_headers()

    def do_GET(self):
        ensure_dirs()
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "baseDir": str(BASE_DIR),
                "stateFile": str(STATE_FILE),
                "hasState": state is not None,
                "updatedAt": datetime.fromtimestamp(STATE_FILE.stat().st_mtime).isoformat(timespec="seconds") if STATE_FILE.exists() else "",
                "counts": counts(state),
            })
            return
        if parsed.path == "/state":
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "hasState": state is not None,
                "updatedAt": datetime.fromtimestamp(STATE_FILE.stat().st_mtime).isoformat(timespec="seconds") if STATE_FILE.exists() else "",
                "counts": counts(state),
            })
            return
        if parsed.path == "/backups":
            json_response(self, 200, {
                "ok": True,
                "backups": list_backups(),
            })
            return
        if parsed.path == "/file":
            qs = parse_qs(parsed.query)
            ref = unquote((qs.get("ref") or [""])[0])
            target = (ATTACHMENT_DIR / ref).resolve()
            root = ATTACHMENT_DIR.resolve()
            if not str(target).startswith(str(root)) or not target.exists():
                json_response(self, 404, {"ok": False, "error": "Soubor nenalezen."})
                return
            mime = "application/octet-stream"
            name = target.name.lower()
            if name.endswith(".pdf"):
                mime = "application/pdf"
            elif name.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
                mime = "image/" + ("jpeg" if name.endswith((".jpg", ".jpeg")) else name.rsplit(".", 1)[-1])
            payload = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(payload)))
            origin = self.headers.get("Origin")
            if origin in ALLOWED_ORIGINS:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Private-Network", "true")
            self.end_headers()
            self.wfile.write(payload)
            return
        json_response(self, 404, {"ok": False, "error": "Neznámá adresa."})

    def do_POST(self):
        ensure_dirs()
        parsed = urlparse(self.path)
        if not origin_allowed(self):
            json_response(self, 403, {"ok": False, "error": "Tento web nemá povolený přístup k lokálnímu CRM pomocníkovi."})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            json_response(self, 413, {"ok": False, "error": "Data jsou moc velká."})
            return
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except Exception as e:
            json_response(self, 400, {"ok": False, "error": "Neplatný JSON: " + str(e)})
            return
        if parsed.path == "/state":
            state = payload.get("state")
            if not isinstance(state, dict):
                json_response(self, 400, {"ok": False, "error": "Chybí CRM data."})
                return
            previous_backup = None
            if STATE_FILE.exists() and payload.get("backup", True):
                previous_backup = backup_state_file(payload.get("reason") or "pred-ulozenim")
            attachment_count = externalize_attachments(state)
            state.setdefault("_diskStorage", {})
            state["_diskStorage"].update({
                "savedAt": datetime.now().isoformat(timespec="seconds"),
                "baseDir": str(BASE_DIR),
                "attachmentsExternalized": attachment_count,
            })
            atomic_write(STATE_FILE, json.dumps(state, ensure_ascii=False, indent=2))
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "stateFile": str(STATE_FILE),
                "backup": previous_backup,
                "counts": counts(state),
                "attachmentsExternalized": attachment_count,
            })
            return
        if parsed.path == "/backup":
            target = backup_state_file(payload.get("reason") or "manual")
            json_response(self, 200, {"ok": True, "backup": target, "backups": list_backups()})
            return
        if parsed.path == "/restore-backup":
            target = backup_path_from_name(payload.get("name"))
            if not target:
                json_response(self, 404, {"ok": False, "error": "Záloha nenalezena."})
                return
            previous_backup = backup_state_file("pred-obnovou-ze-zalohy")
            shutil.copy2(target, STATE_FILE)
            state = read_state()
            json_response(self, 200, {
                "ok": True,
                "state": state,
                "restored": backup_info(target),
                "backup": previous_backup,
                "counts": counts(state),
            })
            return
        json_response(self, 404, {"ok": False, "error": "Neznámá adresa."})


def main():
    ensure_dirs()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"FILIP CRM lokální úložiště běží.")
    print(f"Data: {BASE_DIR}")
    print(f"Kontrola: http://127.0.0.1:{PORT}/status")
    server.serve_forever()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
