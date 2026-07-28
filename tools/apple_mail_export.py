#!/usr/bin/env python3
import argparse
import email
import email.policy
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote


MAIL_ROOT = Path.home() / "Library" / "Mail"
HEADER_LIMIT = 65536


def read_headers(path):
    try:
        raw = path.read_bytes()[:HEADER_LIMIT]
    except Exception:
        return None
    text = raw.decode("utf-8", "replace")
    lines = text.splitlines()
    if lines and lines[0].strip().isdigit():
        text = "\n".join(lines[1:])
    header_text = re.split(r"\r?\n\r?\n", text, maxsplit=1)[0]
    if not header_text.strip():
        return None
    try:
        return email.message_from_string(header_text, policy=email.policy.default)
    except Exception:
        return None


def format_addresses(value):
    pairs = getaddresses([value or ""])
    out = []
    for name, addr in pairs:
        if not addr:
            continue
        out.append(f"{name} <{addr}>" if name else addr)
    return ", ".join(out)


def iso_date(value, fallback_ts):
    try:
        dt = parsedate_to_datetime(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except Exception:
        return datetime.fromtimestamp(fallback_ts, tz=timezone.utc).isoformat()


def message_url(message_id):
    mid = (message_id or "").strip()
    if not mid:
        return ""
    if not (mid.startswith("<") and mid.endswith(">")):
        mid = "<" + mid.strip("<>") + ">"
    return "message://" + quote(mid, safe="")


def mailbox_from_path(path):
    parts = path.parts
    for marker in ("INBOX.mbox", "Sent Messages.mbox", "Sent.mbox", "Archive.mbox"):
        if marker in parts:
            return marker.replace(".mbox", "")
    for part in reversed(parts):
        if part.endswith(".mbox"):
            return part.replace(".mbox", "")
    return ""


def export_messages(limit):
    if not MAIL_ROOT.exists():
        return []
    try:
        paths = sorted(MAIL_ROOT.rglob("*.emlx"), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True)
    except Exception:
        return []
    rows = []
    for path in paths:
        if len(rows) >= limit:
            break
        msg = read_headers(path)
        if not msg:
            continue
        message_id = str(msg.get("Message-ID") or msg.get("Message-Id") or "").strip()
        subject = str(msg.get("Subject") or "Bez predmetu")
        from_value = format_addresses(str(msg.get("From") or ""))
        to_value = format_addresses(str(msg.get("To") or ""))
        cc_value = format_addresses(str(msg.get("Cc") or ""))
        if not (message_id or subject or from_value or to_value):
            continue
        rows.append({
            "id": message_id or str(path),
            "messageId": message_id,
            "messageUrl": message_url(message_id),
            "date": iso_date(str(msg.get("Date") or ""), path.stat().st_mtime),
            "subject": subject,
            "from": from_value,
            "to": to_value,
            "cc": cc_value,
            "bcc": "",
            "mailbox": mailbox_from_path(path),
        })
    return rows


def as_lines(script, limit):
    try:
        out = subprocess.check_output(["/usr/bin/osascript", "-e", script, str(limit)], text=True, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as exc:
        print(f"AppleScript export se nepovedl: {exc.output or exc}", file=sys.stderr)
        return []
    except Exception as exc:
        print(f"AppleScript export se nepovedl: {exc}", file=sys.stderr)
        return []
    return [line for line in out.splitlines() if line.strip()]


APPLESCRIPT = r'''
on pad2(n)
  set s to n as text
  if (count of s) is 1 then return "0" & s
  return s
end pad2

on isoDate(d)
  try
    return (year of d as integer) & "-" & my pad2(month of d as integer) & "-" & my pad2(day of d as integer) & "T" & my pad2(hours of d as integer) & ":" & my pad2(minutes of d as integer) & ":00"
  on error
    return ""
  end try
end isoDate

on cleanText(t)
  set s to t as text
  set AppleScript's text item delimiters to tab
  set s to text items of s as text
  set AppleScript's text item delimiters to linefeed
  set s to text items of s as text
  set AppleScript's text item delimiters to ""
  return s
end cleanText

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
    if ad is not "" then
      if out is not "" then set out to out & ", "
      if nm is not "" then
        set out to out & nm & " <" & ad & ">"
      else
        set out to out & ad
      end if
    end if
  end repeat
  return out
end recipientList

on emitMessage(m, boxName)
  try
    set mid to (id of m) as text
  on error
    set mid to ""
  end try
  try
    set subj to (subject of m) as text
  on error
    set subj to "Bez predmetu"
  end try
  try
    set senderText to (sender of m) as text
  on error
    set senderText to ""
  end try
  set toText to ""
  set ccText to ""
  try
    set d to my isoDate(date received of m)
  on error
    set d to ""
  end try
  return my cleanText(mid) & tab & my cleanText(d) & tab & my cleanText(subj) & tab & my cleanText(senderText) & tab & my cleanText(toText) & tab & my cleanText(ccText) & tab & my cleanText(boxName)
end emitMessage
end using terms from

on run argv
  set maxRows to item 1 of argv as integer
  set outputRows to ""
  set exportedCount to 0
  tell application "Mail"
    set targetBoxes to {}
    try
      set pickedMessages to selection
      repeat with picked in pickedMessages
        if exportedCount >= maxRows then exit repeat
        try
          set outputRows to outputRows & my emitMessage(picked, "Vybrane zpravy") & linefeed
          set exportedCount to exportedCount + 1
        end try
      end repeat
    end try
    try
      set end of targetBoxes to inbox
    end try
    repeat with mb in targetBoxes
      if exportedCount >= maxRows then exit repeat
      try
        set boxName to name of mb as text
        set msgCount to count of messages of mb
        repeat with i from 1 to msgCount
          if exportedCount >= maxRows then exit repeat
          try
            set outputRows to outputRows & my emitMessage(item i of messages of mb, boxName) & linefeed
            set exportedCount to exportedCount + 1
          end try
        end repeat
      end try
    end repeat
  end tell
  return outputRows
end run
'''


def export_messages_from_mail_app(limit):
    rows = []
    for line in as_lines(APPLESCRIPT, limit):
        cols = line.split("\t")
        if len(cols) < 7:
            continue
        message_id, date_value, subject, from_value, to_value, cc_value, mailbox = cols[:7]
        rows.append({
            "id": message_id or f"applemail-{len(rows)}-{date_value}-{subject}",
            "messageId": message_id,
            "messageUrl": message_url(message_id),
            "date": date_value,
            "subject": subject or "Bez predmetu",
            "from": from_value,
            "to": to_value,
            "cc": cc_value,
            "bcc": "",
            "mailbox": mailbox,
        })
    rows.sort(key=lambda x: x.get("date") or "", reverse=True)
    return rows[:limit]


def main():
    parser = argparse.ArgumentParser(description="Exportuje jen hlavicky Apple Mail zprav pro FILIP CRM.")
    parser.add_argument("--output", default="apple-mail-export.json")
    parser.add_argument("--limit", type=int, default=12000)
    args = parser.parse_args()
    rows = export_messages(max(1, args.limit))
    if not rows:
        rows = export_messages_from_mail_app(max(1, args.limit))
    payload = {
        "source": "Apple Mail local headers",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(rows),
        "messages": rows,
    }
    out = Path(args.output).expanduser().resolve()
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Hotovo: {out}")
    print(f"Exportovano hlavicek: {len(rows)}")


if __name__ == "__main__":
    main()
