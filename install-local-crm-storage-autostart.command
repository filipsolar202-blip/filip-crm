#!/bin/zsh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$HOME/Documents/Codex/FILIP-CRM-data"
PLIST="$HOME/Library/LaunchAgents/cz.filipcrm.local-storage.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$APP_DIR/logs" "$DATA_DIR"

CODEX_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [ -x "$CODEX_PYTHON" ]; then
  PYTHON_BIN="$CODEX_PYTHON"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi
if [ -z "$PYTHON_BIN" ]; then
  echo "Nenasel jsem python3. Nainstaluj Python 3 (napr. z python.org) a spust tento soubor znovu."
  read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."
  exit 1
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
  <key>EnvironmentVariables</key>
  <dict>
    <key>FILIP_CRM_DATA_DIR</key>
    <string>$DATA_DIR</string>
  </dict>
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
echo "$DATA_DIR"
echo ""
echo "Kontrola:"
echo "http://127.0.0.1:48730/status"
echo ""
echo "Hotovo. Tohle okno muzes zavrit."
read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."
