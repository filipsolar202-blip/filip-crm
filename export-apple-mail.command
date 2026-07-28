#!/bin/zsh
set -e
DIR="${0:A:h}"
cd "$DIR"
echo "FILIP CRM - export Apple Mail hlavicek"
echo "Ukladam jen datum, predmet, od/komu a odkaz do Apple Mailu. Obsah e-mailu se neuklada."
/usr/bin/python3 "$DIR/tools/apple_mail_export.py" --output "$DIR/apple-mail-export.json" --limit 12000
echo ""
echo "Soubor je pripraveny:"
echo "$DIR/apple-mail-export.json"
echo ""
echo "Ted ho nacti ve FILIP CRM: Google zaloha / Apple Mail / Nacist export Apple Mail."
echo "Okno muzes zavrit."
read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."
