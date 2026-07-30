#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path


SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "FILIP-CRM"
DEFAULT_EXPORT = SUPPORT_DIR / "apple-mail-export.json"


def message_id(value):
    value = str(value or "").strip()
    if not value:
        return ""
    if not (value.startswith("<") and value.endswith(">")):
        value = "<" + value.strip("<>") + ">"
    return value


def parse_apple_date(value):
    value = str(value or "").strip()
    if not value:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return value


def since_value(since):
    if since is None:
        since = datetime.now() - timedelta(days=730)
    if isinstance(since, datetime):
        return since.strftime("%Y-%m-%dT%H:%M:%S")
    return str(since)


APPLESCRIPT = r'''
on pad2(n)
  set s to n as text
  if (count of s) is 1 then return "0" & s
  return s
end pad2

on isoDate(d)
  try
    set y to year of d as integer
    set mo to month of d as integer
    set da to day of d as integer
    set h to hours of d as integer
    set mi to minutes of d as integer
    set se to seconds of d as integer
    return (y as text) & "-" & my pad2(mo) & "-" & my pad2(da) & "T" & my pad2(h) & ":" & my pad2(mi) & ":" & my pad2(se)
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
  set AppleScript's text item delimiters to return
  set s to text items of s as text
  set AppleScript's text item delimiters to ""
  return s
end cleanText

on lowerText(t)
  set upperChars to "ABCDEFGHIJKLMNOPQRSTUVWXYZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ"
  set lowerChars to "abcdefghijklmnopqrstuvwxyzáčďéěíňóřšťúůýž"
  set out to ""
  repeat with i from 1 to count of characters of (t as text)
    set ch to character i of (t as text)
    set p to offset of ch in upperChars
    if p is greater than 0 then
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
  if n contains "archive" then return true
  if n contains "archiv" then return true
  if n contains "all mail" then return true
  if n contains "všechna pošta" then return true
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

on emitMessage(m, accName, boxName, boxId, dirName, sinceDateText)
  try
    set msgDate to date received of m
  on error
    try
      set msgDate to date sent of m
    on error
      set msgDate to current date
    end try
  end try
  if my isoDate(msgDate) is less than sinceDateText then return ""
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
  set ccText to ""
  try
    set ccText to my recipientList(cc recipients of m)
  end try
  if ccText is not "" then
    if toText is not "" then
      set toText to toText & ", " & ccText
    else
      set toText to ccText
    end if
  end if
  return my cleanText(rfcId) & tab & my cleanText(appleId) & tab & my cleanText(my isoDate(msgDate)) & tab & my cleanText(subj) & tab & my cleanText(senderText) & tab & my cleanText(toText) & tab & my cleanText(dirName) & tab & my cleanText(accName) & tab & my cleanText(boxName) & tab & my cleanText(boxId)
end emitMessage
end using terms from

on run argv
  set maxRows to item 1 of argv as integer
  set sinceDateText to item 2 of argv as text
  set outputRows to ""
  set exportedCount to 0
  set perMailboxLimit to maxRows
  if maxRows > 500 then set perMailboxLimit to 120
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
            set exportedFromMailbox to 0
            set messageCount to 0
            try
              set messageCount to count of messages of mb
            end try
            repeat with messageIndex from 1 to messageCount
              if exportedCount >= maxRows then exit repeat
              if exportedFromMailbox >= perMailboxLimit then exit repeat
              try
                set m to message messageIndex of mb
                set rowText to my emitMessage(m, accName, boxName, boxId, dirName, sinceDateText)
                if rowText is not "" then
                  set outputRows to outputRows & rowText & linefeed
                  set exportedCount to exportedCount + 1
                  set exportedFromMailbox to exportedFromMailbox + 1
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


def run_applescript(limit, since):
    try:
        out = subprocess.check_output(
            ["/usr/bin/osascript", "-e", APPLESCRIPT, str(limit), since_value(since)],
            text=True,
            stderr=subprocess.STDOUT,
            timeout=300,
        )
    except subprocess.CalledProcessError as exc:
        text = exc.output or str(exc)
        lowered = text.lower()
        if "not authorized" in lowered or "not allowed" in lowered or "erraeeventnotpermitted" in lowered:
            raise PermissionError("Přístup k Apple Mail nebyl povolen.") from exc
        raise RuntimeError(text.strip() or "Apple Mail není spuštěný.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Apple Mail synchronizace trvala příliš dlouho. Zkuste ji spustit znovu.") from exc
    return [line for line in out.splitlines() if line.strip()]


def export_messages_from_mail_app(limit=50000, since=None):
    rows = []
    seen = set()
    for line in run_applescript(max(1, int(limit or 50000)), since):
        cols = line.split("\t")
        if len(cols) < 10:
            continue
        rfc_id, apple_id, date_value, subject, sender, recipients, direction, account, mailbox, mailbox_id = cols[:10]
        mid = message_id(rfc_id)
        if not mid or mid in seen:
            continue
        seen.add(mid)
        rows.append(
            {
                "id": mid,
                "messageId": mid,
                "appleId": apple_id,
                "date": parse_apple_date(date_value),
                "subject": subject or "Bez předmětu",
                "from": sender,
                "to": recipients,
                "direction": "sent" if direction == "sent" else "received",
                "account": account,
                "mailbox": mailbox,
                "mailboxId": mailbox_id,
            }
        )
    rows.sort(key=lambda x: x.get("date") or "", reverse=True)
    return rows[: max(1, int(limit or 50000))]


def export_messages(limit=50000):
    return export_messages_from_mail_app(limit=limit)


def main():
    parser = argparse.ArgumentParser(description="Exportuje technický index Apple Mail zpráv pro FILIP CRM.")
    parser.add_argument("--output", default=str(DEFAULT_EXPORT))
    parser.add_argument("--limit", type=int, default=50000)
    parser.add_argument("--months", type=int, default=24)
    args = parser.parse_args()
    since = datetime.now() - timedelta(days=max(1, args.months) * 31)
    rows = export_messages_from_mail_app(limit=args.limit, since=since)
    payload = {
        "source": "Apple Mail local technical index",
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "count": len(rows),
        "messages": rows,
    }
    out = Path(args.output).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Hotovo: {out}")
    print(f"Exportováno technických záznamů: {len(rows)}")


if __name__ == "__main__":
    main()
