# Ověření CRM

Spouštět z kořene repozitáře:

```sh
node tools/qa/static.cjs
node tools/qa/google-sync.cjs
python3 tools/qa/storage.py
node tools/qa/regression.cjs
node tools/qa/fki-nav.cjs
node tools/qa/classic-valuation.cjs
node tools/qa/contract-investment.cjs
node tools/qa/atris-manual.cjs
node tools/qa/report-selection.cjs
node tools/qa/pension-report.cjs
node tools/qa/fund-profiles.cjs
node tools/qa/weekly-goals.cjs
node tools/qa/focus-dashboard.cjs
node tools/qa/daily-tasks.cjs
node tools/qa/delegation.cjs
```

Prohlížečový test vyžaduje Playwright a Chrome/Chromium. runtime.cjs hledá instalovaný balík Playwright nebo sdílený běhový balík Codex. Na Macu používá Chrome z Applications; jiný prohlížeč lze zadat proměnnou CRM_QA_BROWSER. Test potřebuje přístup ke spuštění prohlížeče.

Regrese porovnává aktuální aplikaci s commitem d332145; ten musí být v lokální historii Git. Používá pouze fixture.cjs a izolovaný profil. Síťové požadavky jsou nahrazené testovacími odpověďmi, skutečný diskový server ani Google se nepoužívají. Diskový test zapisuje výhradně do dočasné složky; test Google používá paměťovou tabulku.

Regrese ukládá souhrn a náhledy do /private/tmp/crm-regression-results.json, /private/tmp/crm-unified-fki.png a /private/tmp/crm-unified-ipad.png. Tento výstupní adresář odpovídá současnému testovacímu Macu. smoke.cjs je doplňkový průchod prázdným stavem.

focus-dashboard.cjs ověřuje rozepsané cíle, dokončení sdílené aktivity, změny pořadí, přelom dne/týdne, výslovné rozhodování o nedokončených položkách, archiv vyhodnocení, roční cíle, export DPS/DIP a vypnutých sekcí, izolaci klientů, obnovu a slučování zálohy a mobilní šířku. Používá jen syntetická data.

fund-profiles.cjs ověřuje přesné ISIN, aktuální i vlastní metadata, zachování ocenění a provizí, bezpečné odkazy a samostatné klientské reporty. pension-report.cjs ověřuje ukládání a historii DPS/DIP, příspěvky a výběry, nulu versus neznámou hodnotu a mobilní i tiskové zobrazení. Oba používají pouze syntetická data.
