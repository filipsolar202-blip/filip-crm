#!/bin/zsh
cd "$(dirname "$0")"
mkdir -p logs
export FILIP_CRM_DATA_DIR="$HOME/Documents/FILIP-CRM-data"
PYTHON_BIN="$(command -v python3 || true)"
if [ -z "$PYTHON_BIN" ]; then
  echo "Nenasel jsem python3. Nainstaluj Python 3 (napr. z python.org) a spust tento soubor znovu."
  read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."
  exit 1
fi
echo "Spoustim FILIP CRM lokalni diskove uloziste..."
echo "Data budou v $FILIP_CRM_DATA_DIR"
exec "$PYTHON_BIN" tools/local_crm_storage.py
