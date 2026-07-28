# FILIP CRM

Lokální CRM pro klienty, smlouvy, obchody, investice, FKI, poznámky, reporty a zálohu.

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
