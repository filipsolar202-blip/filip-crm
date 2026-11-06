#!/bin/bash
# Build-only helper. No access to mail accounts and no message creation/sending.
set -euo pipefail
repo_dir="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="$(mktemp -d "${TMPDIR:-/tmp}/filip-crm-mail.XXXXXX")"
app_path="$build_dir/FILIP CRM Mail.app"
osacompile -o "$app_path" "$repo_dir/tools/mac-mail/compose.applescript"
python3 - "$app_path/Contents/Info.plist" <<'PY'
import plistlib,sys
p=sys.argv[1]
with open(p,'rb') as f:d=plistlib.load(f)
d.update(CFBundleIdentifier='cz.filipsolar.crm-mail',CFBundleName='FILIP CRM Mail',CFBundleURLTypes=[{'CFBundleURLName':'FILIP CRM draft','CFBundleURLSchemes':['filipcrm-mail']}],NSAppleEventsUsageDescription='CRM vytvoří koncept v Apple Mailu se správnou adresou odesílatele. Nikdy jej samo neodesílá.')
with open(p,'wb') as f:plistlib.dump(d,f)
PY
codesign --force --deep --sign - "$app_path"
mkdir -p "$repo_dir/assets/downloads"
ditto -c -k --sequesterRsrc --keepParent "$app_path" "$repo_dir/assets/downloads/FILIP-CRM-Mail.zip"
codesign --verify --deep --strict "$app_path"
