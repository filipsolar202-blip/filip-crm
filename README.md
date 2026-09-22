# FILIP CRM

Lokální CRM pro klienty, smlouvy, obchody, investice, FKI, poznámky, reporty a zálohu.

## Verze 2026.09.22-3

Hlavní CRM má jednu aplikační logiku a společný modrý glass vzhled. Investiční plán porovnává aktuální portfolio s nejvýše dvěma alternativami A a B. Odprodej lze rozdělit do více nových nákupů. Pro klienta lze stáhnout podrobný investiční návrh ve stylu původní kalkulačky nebo stručné srovnání variant. Přehled změn je v `CHANGELOG.md`, výsledky ověření v `QA-2026-09-16.md`.

## Soubory aplikace

- `FILIP-CRM.html` — vstupní stránka a formuláře.
- `assets/js/crm.js` — společná aplikační logika.
- `assets/css/crm.css` — společný vzhled včetně rozložení pro tablet.
- `assets/vendor/` — lokální knihovny pro grafy a tabulky.
- `index.html` — přesměrování na aktuální verzi.

Při kopírování aplikace je nutné přenést také celou složku `assets`. Samostatné klientské HTML reporty jsou nadále přenosné jako jediný soubor.

Ostatní HTML kalkulačky v kořeni jsou zachované samostatné nástroje; hlavní CRM je nenačítá jako další aplikační vrstvu. Podrobnosti: `ARCHITECTURE.md`.

## Spuštění

### Na Macu

1. Otevři `FILIP-CRM.html` lokálně nebo přes GitHub Pages.
2. Spusť diskové úložiště přes `install-local-crm-storage-autostart.command`, pokud už neběží.
3. V CRM otevři `Záloha`.
4. Zkontroluj, že `Diskové úložiště funguje`.

### Na iPadu

1. Otevři CRM přes GitHub Pages v Safari.
2. V `Záloha` doplň Apps Script URL a soukromý klíč.
3. Klikni na `Načíst náhled z Google`.
4. Po kontrole klikni na `Převzít načtený náhled`.
5. Po práci klikni na `Odeslat zálohu`.

## Správný režim dat

- GitHub drží aplikaci.
- Mac drží hlavní data na disku ve složce `FILIP-CRM-data`.
- Google záloha slouží jako přenos mezi Macem a iPadem.
- iPad neumí používat lokální diskové úložiště z Macu, proto jede přes Google zálohu.

## Co nedávat na GitHub

Nenahrávej:

- `FILIP-CRM-data`
- soukromé exporty klientů
- balíčky `CRM-záloha`
- logy
- soubory s klientskými PDF/přílohami

Repo má `.gitignore`, ale při ručním uploadu na GitHub je potřeba to hlídat taky očima.

## Důležité návody

- `GITHUB-IPAD-REZIM.md`
- `DISKOVE-ULOZISTE-NAVOD.md`
- `GOOGLE-ZALOHA-NAVOD.md`
- `APPLE-MAIL-NAVOD.md`
