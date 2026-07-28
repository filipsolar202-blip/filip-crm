#!/bin/zsh
cd "$(dirname "$0")"
mkdir -p logs
export FILIP_CRM_DATA_DIR="$HOME/Documents/Codex/FILIP-CRM-data"
CODEX_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [ -x "$CODEX_PYTHON" ]; then
  PYTHON_BIN="$CODEX_PYTHON"
else
  PYTHON_BIN="$(command -v python3 || true)"
fi
if [ -z "$PYTHON_BIN" ]; then
  echo "Nenasel jsem python3. Nainstaluj Python 3 (napr. z python.org) a spust tento soubor znovu."
  read -k 1 "?Stiskni libovolnou klavesu pro zavreni..."
  exit 1
fi
echo "Spoustim FILIP CRM lokalni diskove uloziste..."
echo "Data budou v $FILIP_CRM_DATA_DIR"
exec "$PYTHON_BIN" tools/local_crm_storage.py
