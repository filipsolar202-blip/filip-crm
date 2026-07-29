#!/bin/zsh
set -e

DIR="${0:A:h}"
PLIST="$HOME/Library/LaunchAgents/com.filipcrm.apple-mail-sync.plist"
APP_SUPPORT="$HOME/Library/Application Support/FILIP-CRM/apple-mail-sync"
LOG_DIR="$HOME/Library/Logs/FILIP-CRM"

mkdir -p "$HOME/Library/LaunchAgents" "$APP_SUPPORT" "$LOG_DIR"
cp "$DIR/tools/apple_mail_bridge.py" "$APP_SUPPORT/apple_mail_bridge.py"
cp "$DIR/tools/apple_mail_export.py" "$APP_SUPPORT/apple_mail_export.py"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.filipcrm.apple-mail-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$APP_SUPPORT/apple_mail_bridge.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_SUPPORT</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/apple-mail-sync.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/apple-mail-sync-error.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl kickstart -k "gui/$(id -u)/com.filipcrm.apple-mail-sync"

echo "FILIP CRM - Apple Mail propojeni je nastavene na pozadi."
echo ""
echo "macOS se muze zeptat, zda smi Terminal nebo Python ovladat aplikaci Mail."
echo "Vyber Povolit. Full Disk Access neni potreba."
echo ""
sleep 1
if /usr/bin/curl -fsS "http://127.0.0.1:48726/status" >/dev/null 2>&1; then
  echo "Kontrola: pomocnik bezi spravne."
else
  echo "Kontrola: pomocnik zatim neodpovida."
  echo "Otevri aplikaci Mail, spust CRM a zkus v zalozce Zaloha / Apple Mail kliknout na Zkontrolovat propojeni."
fi
echo ""
echo "Co ted:"
echo "1. Otevri Apple Mail."
echo "2. Otevri FILIP CRM."
echo "3. U klienta otevri zalozku E-maily nebo v Zaloze klikni na Synchronizovat."
echo ""
read -k 1 "?Hotovo. Stiskni libovolnou klavesu pro zavreni..."
