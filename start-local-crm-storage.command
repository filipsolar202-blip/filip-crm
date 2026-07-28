#!/bin/zsh
cd "$(dirname "$0")"
mkdir -p logs
PYTHON_BIN="/usr/bin/python3"
if [ -x "/Users/a./.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3" ]; then
  PYTHON_BIN="/Users/a./.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
fi
echo "Spoustim FILIP CRM lokalni diskove uloziste..."
echo "Data budou v /Users/a./Documents/Codex/FILIP-CRM-data"
exec "$PYTHON_BIN" tools/local_crm_storage.py
