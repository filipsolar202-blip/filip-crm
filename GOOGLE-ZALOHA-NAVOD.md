# FILIP CRM - Google zaloha

## Co je potreba
- Google tabulka pro zalohy.
- Google Apps Script Web App URL.
- Soukromy sync klic.
- Soubor `FILIP-CRM.html` otevreny ve stejnem prohlizeci, kde chces CRM pouzivat.

## Pokud uz mas Google zalohu ze starsich nastroju
Stary Google sync umi drzet vice aplikaci v jedne tabulce. FILIP CRM pouziva samostatny identifikator:

`filip_crm`

Tim se nemicha s puvodnim `investment_crm` nebo `obchody_tabulka`.

## Prvni bezpecne nacteni klientu
1. Otevri `FILIP-CRM.html`.
2. Jdi do zalozky `Google zaloha`.
3. Vloz `Apps Script URL`.
4. Vloz stejny soukromy sync klic jako v Apps Scriptu.
5. Klikni na `Zkontrolovat Google`.
6. Klikni na `Nacist nahled z Google`.
7. Zkontroluj pocty klientu, smluv, obchodu a duplicit.
8. Pokud to vypada spravne, klikni na `Prevzit nacteny nahled`.
9. Zkontroluj klienty v CRM.
10. Az kdyz data sedi, klikni na `Odeslat zalohu`.

## Dulezite
- `Nacist nahled z Google` nic neprepisuje.
- `Prevzit nacteny nahled` slouci data jen do lokalniho CRM.
- Google zaloha se prepise az tlacitkem `Odeslat zalohu`.
- Kdyz jsou duplicitni klienti nebo stejne cislo smlouvy u vice klientu, uvidis to na Dashboardu v casti `Duplicity klientu a smluv`.

## Kdyz FILIP CRM zahlasi, ze zaloha neni pro FILIP CRM
Znamena to, ze ve stejne Google tabulce zatim neni ulozena zaloha pro aplikaci `filip_crm`. V takovem pripade jsou dve cesty:

1. Nejdriv pouzit `Nacist ze starych nastroju`, pokud jsou stara data v tom samem prohlizeci.
2. Nebo udelat prevodni import ze stare Google zalohy do formatu FILIP CRM.

Prevod ze stare Google zalohy je samostatny krok, protoze stare nastroje ukladaji data pod jinymi nazvy aplikaci.

## Prevod ze stare Google zalohy
V zalozce `Google zaloha` je cast `Stara Google zaloha`.

Pouziti:
1. Do horni casti `Google zaloha celeho CRM` vloz novou Apps Script URL a novy klic pro FILIP CRM.
2. Do casti `Stara Google zaloha` vloz puvodni Apps Script URL a puvodni klic ze starych Smluv/Obchodu/Investic.
3. Klikni na `Nacist vse`.
4. Zkontroluj pocty, klienty a duplicity na Dashboardu.
5. Az kdyz data sedi, klikni nahore na `Odeslat zalohu`.

Dulezite: import ze stare Google zalohy se nejdriv ulozi jen do lokalniho CRM v prohlizeci. Novou Google zalohu prepise az rucni klik na `Odeslat zalohu`.

`Nacist vse` se pokusi nacist tri stare aplikace:
- `smlouvy_tracker`
- `obchody_tabulka`
- `investment_crm`
