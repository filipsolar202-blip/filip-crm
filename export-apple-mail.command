#!/bin/zsh
set -e

DIR="${0:A:h}"
OUT="$HOME/Library/Application Support/FILIP-CRM/apple-mail-export.json"

echo "FILIP CRM - nouzovy Apple Mail export"
echo ""
echo "Bezny rezim uz pouziva lokalni pomocnik a nic se neimportuje do CRM JSON."
echo "Tento soubor slouzi jen pro kontrolu technickeho indexu mimo projekt."
echo "Obsah e-mailu, nahledy ani prilohy se nečtou."
echo ""
echo "macOS se muze zeptat, zda smi Terminal nebo Python ovladat aplikaci Mail."
echo "Vyber Povolit. Full Disk Access neni potreba."
echo ""

/usr/bin/python3 "$DIR/tools/apple_mail_export.py" --output "$OUT" --limit 50000

echo ""
echo "Soubor je ulozeny mimo projekt:"
echo "$OUT"
echo ""
read -k 1 "?Hotovo. Stiskni libovolnou klavesu pro zavreni..."
