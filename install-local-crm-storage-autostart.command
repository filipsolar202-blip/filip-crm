#!/bin/zsh
set -e
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/FILIP CRM"
DATA_DIR="$APP_SUPPORT/data"
LOG_DIR="$APP_SUPPORT/logs"
BIN_DIR="$APP_SUPPORT/bin"
SERVICE_SCRIPT="$BIN_DIR/local_crm_storage.py"
OLD_DATA_DIR="$APP_DIR/FILIP-CRM-data"
PLIST="$HOME/Library/LaunchAgents/cz.filipcrm.local-storage.plist"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" "$DATA_DIR" "$BIN_DIR"
cp "$APP_DIR/tools/local_crm_storage.py" "$SERVICE_SCRIPT"
chmod 700 "$SERVICE_SCRIPT"
if [ ! -f "$DATA_DIR/state/crm-state.json" ] && [ -d "$OLD_DATA_DIR" ]; then
  echo "Kopiruji dosavadni data CRM do bezpecne systemove slozky..."
  ditto "$OLD_DATA_DIR" "$DATA_DIR"
fi

CODEX_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [ -x "/usr/bin/python3" ]; then
  PYTHON_BIN="/usr/bin/python3"
elif [ -x "$CODEX_PYTHON" ]; then
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
    <string>$SERVICE_SCRIPT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>FILIP_CRM_DATA_DIR</key>
    <string>$DATA_DIR</string>
  </dict>
  <key>WorkingDirectory</key>
  <string>$APP_SUPPORT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
    <string>$LOG_DIR/local-crm-storage.log</string>
  <key>StandardErrorPath</key>
    <string>$LOG_DIR/local-crm-storage-error.log</string>
</dict>
</plist>
PLIST
launchctl bootout "gui/$(id -u)/cz.filipcrm.local-storage" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "FILIP CRM - diskove uloziste je nastavene na pozadi."
echo ""
echo "Data:"
echo "$DATA_DIR"
echo ""
echo "Kontrola:"
echo "http://127.0.0.1:48730/status"
echo ""
echo "Hotovo. Tohle okno muzes zavrit."
if [ -t 0 ]; then read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."; fi
