# Google sync pro FILIP CRM

## 1. Vytvor Google tabulku
Hotova tabulka:

`https://docs.google.com/spreadsheets/d/1-v4PlaKz6B_gaXleJDRgtMidkptoZTtKEmDkGbzisIQ/edit`

ID tabulky pro Apps Script:

`1-v4PlaKz6B_gaXleJDRgtMidkptoZTtKEmDkGbzisIQ`

Pokud bys chtel vytvorit novou tabulku rucne:

1. Otevri Google Sheets.
2. Vytvor novou tabulku.
3. Pojmenuj ji treba `FILIP CRM - zaloha`.
4. Z URL zkopiruj ID tabulky.

Priklad URL:

`https://docs.google.com/spreadsheets/d/TADY_JE_ID_TABULKY/edit`

## 2. Vytvor Apps Script
1. Otevri `https://script.google.com`.
2. Vytvor novy projekt.
3. Do souboru `Code.gs` vloz obsah souboru `google-sync/Code.gs`.
4. V kodu nahrad:
   - `PASTE_GOOGLE_SHEET_ID_HERE` za ID Google tabulky
   - `CHANGE_THIS_PRIVATE_KEY` za vlastni dlouhy soukromy klic

Sync klic si vymysli jako delsi heslo. Nedavej ho na GitHub.

## 3. Nasad Web App
1. Klikni `Deploy`.
2. Klikni `New deployment`.
3. Typ vyber `Web app`.
4. Nastav:
   - `Execute as`: `Me`
   - `Who has access`: `Anyone`
5. Potvrd autorizaci.
6. Zkopiruj Web App URL, ktera konci `/exec`.

## 4. Nastav FILIP CRM
1. Otevri `FILIP-CRM.html`.
2. Jdi do zalozky `Google zaloha`.
3. Vloz Web App URL.
4. Vloz stejny sync klic.
5. Klikni `Zkontrolovat Google`.

## 5. Prvni ulozeni
Pokud CRM zatim nema zadnou Google zalohu:

1. Zkontroluj, ze lokalne vidis spravna data.
2. Klikni `Odeslat zalohu`.
3. Pak klikni `Zkontrolovat Google`.

## 6. Prvni nacteni existujici zalohy
Pokud uz na Googlu nejaka zaloha existuje:

1. Klikni `Nacist nahled z Google`.
2. Zkontroluj pocty a duplicity.
3. Klikni `Prevzit nacteny nahled`.
4. Az po kontrole klikni `Odeslat zalohu`.

## Dulezite
- FILIP CRM uklada data pod aplikaci `filip_crm`.
- Google zaloha se prepise jen tlacitkem `Odeslat zalohu`.
- Nacteni nahledu nic nemeni.
- Prevzeti nahledu slouci data jen lokalne.
