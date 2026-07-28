#!/bin/zsh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/cz.filipcrm.local-storage.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$APP_DIR/logs" "/Users/a./Documents/Codex/FILIP-CRM-data"
PYTHON_BIN="/usr/bin/python3"
if [ -x "/Users/a./.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" ]; then
  PYTHON_BIN="/Users/a./.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
fi
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>cz.filipcrm.local-storage</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$APP_DIR/tools/local_crm_storage.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$APP_DIR/logs/local-crm-storage.log</string>
  <key>StandardErrorPath</key>
  <string>$APP_DIR/logs/local-crm-storage-error.log</string>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" >/dev/null 2>&1 || true
launchctl load "$PLIST"
echo "FILIP CRM - diskove uloziste je nastavene na pozadi."
echo ""
echo "Data:"
echo "/Users/a./Documents/Codex/FILIP-CRM-data"
echo ""
echo "Kontrola:"
echo "http://127.0.0.1:48730/status"
echo ""
echo "Hotovo. Tohle okno muzes zavrit."
