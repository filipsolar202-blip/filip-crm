#!/bin/zsh
PLIST="$HOME/Library/LaunchAgents/cz.filipcrm.local-storage.plist"
launchctl unload "$PLIST" >/dev/null 2>&1 || true
rm -f "$PLIST"
echo "FILIP CRM - automaticke diskove uloziste je vypnute."
