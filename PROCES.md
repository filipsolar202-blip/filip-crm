# FILIP CRM - proces stavby

## Cil
Postavit jeden samostatny CRM system nad klienty, smlouvami, obchody, doporucenimi a aktivitami. Stare HTML nastroje zustavaji jako zaloha a zdroj logiky.

## Soubor
- Hlavni aplikace: `FILIP-CRM.html`
- Ulozeni dat: lokalni prohlizec + jedna spolecna Google zaloha
- Klientske vystupy: samostatne HTML soubory podle konkretni kalkulacky/reportu

## Faze 1 - hotovy zaklad
- Klienti
- Detail klienta ve stylu CRM karty
- Smlouvy prirazene ke klientum
- Obchody prirazene ke klientum
- Aktivity a historie klienta
- Dashboard
- Google zaloha celeho CRM
- Migrace ze starych lokalnich dat, pokud je prohlizec uvidi
- Bezpecny nahled Google zalohy pred prevzetim do lokalniho CRM
- Kontrola duplicit klientu a cisel smluv s rychlou opravou z dashboardu
- Obchody zobrazene podle mesicu stejne jako v puvodni aplikaci
- Schuzka u klienta otevre predvyplnenou udalost v Google Kalendari
- Obchod slouzi jako hlavni vstup: pri ulozeni umi rovnou zalozit nebo aktualizovat navazanou smlouvu u klienta

## Faze 2 - doplneni dalsich modulu
- Doporuceni jako samostatna agenda napojena na klienta
- Rozsirene reporty obchodu a rocniho planu
- Lepsi filtry u smluv a obchodu
- Rychle akce Telefon / WhatsApp / Email podle preferovane komunikace
- Automaticky zapis do Google Kalendare pres Google API nebo Apps Script, pokud bude potreba zapis bez rucniho potvrzeni

## Bezpecny postup Google zalohy
- Nejdriv kliknout na `Nacist nahled z Google`.
- Zkontrolovat pocty klientu, smluv, obchodu, aktivit a duplicity v zaloze.
- Az potom kliknout na `Prevzit nacteny nahled`.
- Prevzeti data slouci do lokalniho CRM a samo neprepise Google zalohu.
- Google zalohu prepsat az rucne tlacitkem `Odeslat zalohu`, kdyz data vypadaji spravne.

## Faze 3 - kalkulacky a vystupy pro klienta
- Napojit klientskou kalkulacku na vybraneho klienta
- Napojit DPS vs DIP
- Napojit hypotecni a investicni plan
- Vystupy vzdy generovat jako samostatne HTML pro klienta

## Pravidla dalsich uprav
- Neprepisovat stare nastroje bez duvodu.
- Nejdrit prenest logiku, az potom vylepsovat vzhled.
- Po kazde zmene kontrolovat JavaScript.
- Google zaloha bude jedna pro cele FILIP CRM.
