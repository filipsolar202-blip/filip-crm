#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from apple_mail_export import export_messages, export_messages_from_mail_app


HOST = "127.0.0.1"
PORT = 48726
BASE_DIR = Path(__file__).resolve().parents[1]
EXPORT_PATH = BASE_DIR / "apple-mail-export.json"


def build_payload(limit):
    rows = export_messages(limit)
    source = "Apple Mail local files"
    if not rows:
        rows = export_messages_from_mail_app(limit)
        source = "Apple Mail app"
    payload = {
        "ok": True,
        "source": source,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(rows),
        "messages": rows,
    }
    EXPORT_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_json(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_json(200, {"ok": True})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/status":
            return self.send_json(200, {"ok": True, "name": "FILIP CRM Apple Mail sync", "port": PORT})
        if parsed.path != "/sync":
            return self.send_json(404, {"ok": False, "error": "Neznamy pozadavek."})
        try:
            qs = parse_qs(parsed.query)
            limit = int(qs.get("limit", ["12000"])[0])
            limit = max(1, min(limit, 50000))
            payload = build_payload(limit)
            return self.send_json(200, payload)
        except Exception as exc:
            return self.send_json(500, {"ok": False, "error": str(exc)})


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print("FILIP CRM - Apple Mail synchronizace")
    print(f"Bezi na http://{HOST}:{PORT}")
    print("Nech toto okno otevrene, dokud chces v CRM pouzivat tlacitko Synchronizovat Apple Mail.")
    print("Obsah e-mailu se neuklada, jen hlavicky a odkazy.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nApple Mail synchronizace ukoncena.")


if __name__ == "__main__":
    main()
