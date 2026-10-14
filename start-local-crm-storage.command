#!/bin/zsh
cd "$(dirname "$0")"
APP_SUPPORT="$HOME/Library/Application Support/FILIP CRM"
mkdir -p "$APP_SUPPORT/data" "$APP_SUPPORT/logs"
export FILIP_CRM_DATA_DIR="$APP_SUPPORT/data"
CODEX_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [ -x "/usr/bin/python3" ]; then
  PYTHON_BIN="/usr/bin/python3"
elif [ -x "$CODEX_PYTHON" ]; then
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
