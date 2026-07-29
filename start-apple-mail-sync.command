#!/bin/zsh
set -e

DIR="${0:A:h}"
cd "$DIR"

echo "FILIP CRM - Apple Mail propojeni"
echo ""
echo "Toto okno spusti lokalni pomocnik jen na tomto Macu."
echo "CRM pak u klienta ukaze pouze datum, predmet, odesilatele/prijemce a otevre vybrany e-mail v Apple Mailu."
echo ""
echo "macOS se muze zeptat, zda smi Terminal nebo Python ovladat aplikaci Mail."
echo "Vyber Povolit. Full Disk Access neni potreba."
echo ""
echo "Kontrola pomocnika: http://127.0.0.1:48726/status"
echo ""

/usr/bin/python3 "$DIR/tools/apple_mail_bridge.py"
