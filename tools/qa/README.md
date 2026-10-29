# Ověření CRM

Spouštět z kořene repozitáře:

```sh
node tools/qa/static.cjs
node tools/qa/google-sync.cjs
python3 tools/qa/storage.py
node tools/qa/regression.cjs
node tools/qa/investment-settlement.cjs
node tools/qa/investment-settlement-core.cjs
node tools/qa/investment-settlement-restore.cjs
node tools/qa/report-pending.cjs
node tools/qa/portfolio-deletion.cjs
node tools/qa/provider-deletion.cjs
node tools/qa/provider-import.cjs
node tools/qa/provider-storage-calc.cjs
node tools/qa/fki-nav.cjs
node tools/qa/fki-valuation-consistency.cjs
node tools/qa/fund-nav-propagation.cjs
node tools/qa/classic-valuation.cjs
node tools/qa/contract-investment.cjs
node tools/qa/investment-proposal.cjs
node tools/qa/investment-proposal-position.cjs
node tools/qa/forecast-merge.cjs
node tools/qa/atris-manual.cjs
node tools/qa/report-selection.cjs
node tools/qa/pension-report.cjs
node tools/qa/fund-profiles.cjs
node tools/qa/report-fund-layout.cjs
node tools/qa/weekly-goals.cjs
node tools/qa/focus-dashboard.cjs
node tools/qa/daily-tasks.cjs
node tools/qa/delegation.cjs
node tools/qa/work-measurement.cjs
node tools/qa/work-measurement-storage.cjs
node tools/qa/insurance-claims.cjs
```

Prohlížečový test vyžaduje Playwright a Chrome/Chromium. runtime.cjs hledá instalovaný balík Playwright nebo sdílený běhový balík Codex. Na Macu používá Chrome z Applications; jiný prohlížeč lze zadat proměnnou CRM_QA_BROWSER. Test potřebuje přístup ke spuštění prohlížeče.

Regrese porovnává aktuální aplikaci s commitem d332145; ten musí být v lokální historii Git. Používá pouze fixture.cjs a izolovaný profil. Síťové požadavky jsou nahrazené testovacími odpověďmi, skutečný diskový server ani Google se nepoužívají. Diskový test zapisuje výhradně do dočasné složky; test Google používá paměťovou tabulku.

Regrese ukládá souhrn a náhledy do /private/tmp/crm-regression-results.json, /private/tmp/crm-unified-fki.png a /private/tmp/crm-unified-ipad.png. Tento výstupní adresář odpovídá současnému testovacímu Macu. smoke.cjs je doplňkový průchod prázdným stavem.

focus-dashboard.cjs ověřuje rozepsané cíle, dokončení sdílené aktivity, změny pořadí, přelom dne/týdne, výslovné rozhodování o nedokončených položkách, archiv vyhodnocení, roční cíle, export DPS/DIP a vypnutých sekcí, izolaci klientů, obnovu a slučování zálohy a mobilní šířku. Používá jen syntetická data.

Tentýž test chrání pevné pořadí hlavních sekcí dashboardu: denní priority → týdenní cíle → grafy → statistiky a kontrola dat → úkoly. Kontroluje DOM i skutečné rozmístění po překreslení, použití filtrů, navigaci, rozbalení statistik, obnovení stránky a na mobilní šířce. Hlavní bloky se nesmějí při renderování nahrazovat ani přemisťovat; mění se pouze jejich obsah. Změna pořadí jednotlivých denních priorit je dál podporovaná.

fund-profiles.cjs ověřuje přesné ISIN, aktuální i vlastní metadata, zachování ocenění a provizí, bezpečné odkazy a samostatné klientské reporty. pension-report.cjs ověřuje ukládání a historii DPS/DIP, příspěvky a výběry, nulu versus neznámou hodnotu a mobilní i tiskové zobrazení. Oba používají pouze syntetická data.

report-fund-layout.cjs ověřuje sbalené informace o fondu, ovládání myší a klávesnicí, klientské odkazy pouze na oficiální stránky a zachování interních zdrojů. Porovnává pořadí společností a fondů v CRM, katalozích a reportech, správné odkazy přehledu na detail, výběr fondů, mobilní šířku i tisk. Kontroluje nezměněná data investic a chronologii transakcí. Používá pouze syntetická data a oddělený prohlížeč.

insurance-claims.cjs ověřuje založení a úpravy pojistných událostí, historii, soubory, filtry, klientské vazby, nulu versus neuvedené plnění, obnovu JSON/Google, opakované sloučení a ochranu před ztrátou dat. Kontroluje i neúspěšné uložení a souběžné změny otevřeného záznamu. Snímky počítače a telefonu ukládá do /private/tmp/crm-claims-desktop.png, /private/tmp/crm-claims-mobile.png a /private/tmp/crm-claim-editor-mobile.png. Používá jen syntetická data a oddělený prohlížeč.

`investment-proposal.cjs` ověřuje prognózu versus skutečné případy, obnovu aktivní varianty, samostatné fondy, zachování rozpracovaných stavů, opakovaný převod a sjednání bez duplicit, výpadek localStorage s ponecháním formuláře a správné AUM po dokupu. `forecast-merge.cjs` ověřuje slučování prognóz podle stabilní identity, přemapování vazeb na klienty/případy/obchody, zachování novější verze a oddělení variant stejného fondu. Testy používají pouze syntetická data.

`investment-proposal-position.cjs` kontroluje, že ruční změna nově sjednané FKI pozice zachová cílené odkupy a ocenění i po aktualizaci NAV a obnovení CRM.

`pension-report.cjs` také ověřuje skutečnou viditelnost a deaktivaci penzijních polí podle typu smlouvy, zachování rozepsaných hodnot při přepnutí typu a vyloučení autosmlouvy z penzijního AUM. Volitelné `CRM_QA_SCRIPT_REF=<commit>` čte JavaScript staršího commitu pro reprodukci regrese, aniž mění pracovní soubory.

`work-measurement.cjs` ověřuje skutečné a odhadované minuty, nulu a chybějící hodnotu, plánované aktivity, přechod rychlého zápisu do detailu, rollback při chybě uložení a interní práci. Porovnání výstupů kontroluje součet oprav, mediány, úplnost, kontext klienta a případu včetně uzavření nebo přesunu a minimální počet měření. Ověřuje i ruční nastavení pilotu, návaznost a mobilní formuláře. Snímky ukládá do `/private/tmp/crm-work-measurement-*.png`.

`work-measurement-storage.cjs` ověřuje normalizaci starších záloh, stabilní identitu aktivit, přemapování klientů/případů/výstupů a opakované sloučení bez duplicit. Nové kolekce i metadata měření jsou zahrnuté do ochrany záloh. Google roundtrip ověřuje `google-sync.cjs` a dočasné diskové snímky `storage.py`. Vše používá pouze syntetická data.

`provider-import.cjs` ověřuje parser skutečně vytvořeného syntetického XLSX, česká čísla, Excel data, silné identity, pokyny, ISIN, ruční/starší hodnoty, náhled bez mutací, opakovaný import i nové porovnání po editaci, přijetí/ponechání CRM a návrat stavu při chybě. Pokrývá odkupy versus NAV, převody/konverze, Codya třídy/souhrny/prázdné/nulové buňky a viditelné červené kontroly na počítači i telefonu. Snímky: `/private/tmp/crm-provider-import-review-desktop.png` a `-mobile.png`.

`provider-storage-calc.cjs` ověřuje ukládání a slučování importní historie, identity transakcí a klientů, zachování novějších hodnot, cílené odkupy, AUM/výnos a soulad klientského reportu. V repozitáři jsou pouze syntetické testovací údaje; klientský export není fixture.

`fki-valuation-consistency.cjs` ověřuje stejnou hodnotu a datum v editoru, kartě, AUM a reportu, bez nutnosti dalšího uložení, včetně legacy importů, ověřených výpisů, novějších NAV, nul a odkupů.

`fund-nav-propagation.cjs` ověřuje více klientů stejného ISIN, obě oblasti i editory, starší a stejně datované opravy, ruční hodnoty, nulové a neúplné pozice, sloučení starší zálohy a opětovné otevření reportu. Používá pouze syntetická data.

`portfolio-deletion.cjs` ověřuje mazání nákupu/odkupu/fondu/aktualizace/smlouvy/obchodu/případu, navázané i nejasné odkupy, zachování ostatních klientů, chybně klasifikované starší řádky, uzavření importních kontrol, zrušení a rollback, obnovení stránky a historii pojistné události. `provider-deletion.cjs` kontroluje přesné cíle importních kontrol, klientské identity a idempotenci. Používají pouze syntetická data.

`investment-settlement.cjs` kontroluje skutečné editory, prázdná a doplněná data, opakované potvrzení, NAV bez aktivace nákupu, obchodní produkci, zůstatky po dokupu a následném celkovém ocenění, souhrn Edward, rollback, reload, klientské a globální UI i mobil. `investment-settlement-core.cjs` chrání především průniky zdrojového obchodu/smlouvy a autoritativní pozice. `investment-settlement-restore.cjs` kontroluje stabilní identitu nákupu a novější metadata při sloučení zálohy. `report-pending.cjs` ověřuje oddělený čekající oddíl mimo AUM/grafy, výběr položek a tisk. Všechny používají pouze syntetické údaje.
