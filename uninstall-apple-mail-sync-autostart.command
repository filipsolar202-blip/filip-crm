#!/bin/zsh
set -e

PLIST="$HOME/Library/LaunchAgents/com.filipcrm.apple-mail-sync.plist"
APP_SUPPORT="$HOME/Library/Application Support/FILIP-CRM/apple-mail-sync"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -rf "$APP_SUPPORT"

echo "FILIP CRM - automaticke spousteni Apple Mail propojeni je odinstalovane."
echo "Lokalni e-mailovy index a token zustavaji v Application Support, aby se zbytecne neztratila synchronizace."
echo ""
read -k 1 "?Hotovo. Stiskni libovolnou klavesu pro zavreni..."
