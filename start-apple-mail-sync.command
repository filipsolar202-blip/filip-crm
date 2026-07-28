#!/bin/zsh
set -e
DIR="${0:A:h}"
cd "$DIR"
echo "FILIP CRM - Apple Mail synchronizace"
echo "Toto okno nech otevrene. Potom v CRM klikni na Synchronizovat Apple Mail."
echo "Adresa pomocnika: http://127.0.0.1:48726"
echo ""
/usr/bin/python3 "$DIR/tools/apple_mail_bridge.py"
