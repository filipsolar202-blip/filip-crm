# FILIP CRM - GitHub, Mac a iPad

## Cíl

Jedna aplikace muze byt otevrena z GitHubu jako web. Data ale zustavaji mimo GitHub:

- Mac: hlavni uloziste je lokalni disk `FILIP-CRM-data`.
- iPad: pracuje pres Google zalohu.
- GitHub: drzi jen aplikaci, ne klientskou databazi.

## Co nahravat na GitHub

Na GitHub patri hlavne:

- `index.html`
- `FILIP-CRM.html`
- `investment-crm.html`
- pomocne HTML kalkulacky, ktere chces mit dostupne
- `google-sync/`
- navody `.md`
- `tools/` a `.command` soubory pro Mac

Na GitHub nepatri:

- `FILIP-CRM-data/`
- soukrome zalozni balicky s klientskymi daty
- logy
- exporty s osobnimi udaji

## Nastaveni GitHub Pages

1. V GitHubu otevri repozitar `filip-crm`.
2. Jdi do `Settings`.
3. Jdi do `Pages`.
4. Pokud je repozitar soukromy a Pages nejde zapnout, je potreba bud verejny repozitar bez dat, nebo placeny GitHub plan.
5. Source nastav na branch `main` a slozku `/root`.
6. Uloz.
7. GitHub ukaze webovou adresu. Otevres ji na PC i iPadu.

## Jak pracovat na Macu

1. Otevri CRM z GitHub Pages nebo lokalne.
2. Nech bezet diskove uloziste `FILIP-CRM-data`.
3. V zalozce `Zaloha` zkontroluj, ze disk funguje.
4. Zapni volbu `Na Macu automaticky prevzit novejsi Google zalohu pri spusteni`.
5. Mac pak pri otevreni CRM zkontroluje Google zalohu. Pokud je novejsi, prevezme ji a ulozi na disk.

## Jak pracovat na iPadu

1. Otevri CRM pres GitHub Pages v Safari.
2. V zalozce `Zaloha` dopln Apps Script URL a soukromy klic.
3. Klikni na `Nacist nahled z Google`.
4. Pokud data sedi, klikni na `Prevzit nacteny nahled`.
5. Po praci klikni na `Odeslat zalohu`.
6. Az se vratis na Mac, Mac si novejsi Google zalohu prevezme pri otevreni CRM.

## Dulezite pravidlo

Kdyz delas zmeny na iPadu, po praci vzdy klikni na `Odeslat zalohu`. Jinak se Mac nema odkud dozvedet, ze na iPadu vznikla nova data.
