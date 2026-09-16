# Ověření CRM

Spouštět z kořene repozitáře:

```sh
node tools/qa/static.cjs
node tools/qa/google-sync.cjs
python3 tools/qa/storage.py
node tools/qa/regression.cjs
```

Prohlížečový test vyžaduje Playwright a Chrome/Chromium. runtime.cjs hledá instalovaný balík Playwright nebo sdílený běhový balík Codex. Na Macu používá Chrome z Applications; jiný prohlížeč lze zadat proměnnou CRM_QA_BROWSER. Test potřebuje přístup ke spuštění prohlížeče.

Regrese porovnává aktuální aplikaci s commitem d332145; ten musí být v lokální historii Git. Používá pouze fixture.cjs a izolovaný profil. Síťové požadavky jsou nahrazené testovacími odpověďmi, skutečný diskový server ani Google se nepoužívají. Diskový test zapisuje výhradně do dočasné složky; test Google používá paměťovou tabulku.

Regrese ukládá souhrn a náhledy do /private/tmp/crm-regression-results.json, /private/tmp/crm-unified-fki.png a /private/tmp/crm-unified-ipad.png. Tento výstupní adresář odpovídá současnému testovacímu Macu. smoke.cjs je doplňkový průchod prázdným stavem.
