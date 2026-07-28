#!/bin/zsh
set -e

PLIST="$HOME/Library/LaunchAgents/com.filipcrm.apple-mail-sync.plist"
APP_SUPPORT="$HOME/Library/Application Support/FILIP-CRM/apple-mail-sync"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -rf "$APP_SUPPORT"

echo "FILIP CRM - Apple Mail synchronizace na pozadi je vypnuta."
echo ""
read -k 1 "?Hotovo. Stiskni libovolnou klavesu pro zavreni..."
