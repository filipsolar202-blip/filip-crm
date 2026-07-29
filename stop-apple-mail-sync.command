#!/bin/zsh
set -e

LABEL="com.filipcrm.apple-mail-sync"

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
/usr/bin/pkill -f "apple_mail_bridge.py" >/dev/null 2>&1 || true

echo "FILIP CRM - Apple Mail pomocnik je zastaveny."
echo "CRM zustane funkcni, jen u e-mailu ukaze, ze propojeni je dostupne na Macu."
echo ""
read -k 1 "?Hotovo. Stiskni libovolnou klavesu pro zavreni..."
