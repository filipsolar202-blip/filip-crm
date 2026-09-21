# Historie verzí

## 2026.09.21-2

- Opraven klientský report, který zaměňoval datum ocenění fondu za termín časového testu.
- Časový test se počítá podle pravidla konkrétního fondu, standardně 36 měsíců od nákupu nebo emise.
- Investice i FKI ukazují termín přímo u každého fondu a každé jednotlivé pozice klienta.
- Klientský report obsahuje samostatný sloupec s termínem časového testu každé transakce.
- Pokud chybí datum nákupu, CRM zobrazí chybějící údaj a nevytvoří zavádějící odhad.

## 2026.09.21-1

- Proklik na Investici nebo FKI z karty klienta otevře příslušnou záložku rovnou s vybraným klientem.
- Rychlý investiční přehled na kartě klienta má u každé položky stejné tlačítko Detail.
- Karta klienta eviduje investice mimo správu odděleně od AUM, produkce a provizí.
- Nová prognóza porovnává vývoj bez změny s novým jednorázovým nebo pravidelným nákupem.
- Prognóza obsahuje opatrnou, očekávanou a optimistickou variantu a lze ji uložit ke klientovi.
- Uloženou prognózu lze znovu otevřít nebo stáhnout jako samostatný klientský HTML report.
- Samotné uložení prognózy nevytváří obchod ani příležitost; propsání je samostatná volba.

## 2026.09.17-2

- Nová záložka Kampaně mezi Poznámkami a Ročním plánem.
- Výběr klientů podle investic, FKI, penzí, nemovitostí, aut nebo všech klientů.
- Kontrola a ruční vyřazení příjemců před otevřením e-mailu; klienti jsou vloženi do skryté kopie.
- Potvrzená kampaň se ihned uloží do evidence a zapíše klientům do historie jako Smart emailing.
- Volitelná ochrana před opakovaným oslovením stejným předmětem.

## 2026.09.17-1

- Na kartě klienta se z platného rodného čísla zobrazí aktuální věk.
- Telefon se kopíruje kliknutím na číslo; samostatné tlačítko slouží pro volání.
- E-mail a adresa mají samostatné akce pro otevření i kopírování.
- Přichycená horní lišta má zaoblený spodní okraj.

## 2026.09.16-6

- AUM na kartě klienta obsahuje běžné investice, FKI i aktivní penze.
- Penze jsou ve stejné kartě zobrazené samostatně.

## 2026.09.16-5

- Denní úkoly jsou na celé šířce v kompaktních řádcích podle vzhledu Příležitostí.
- Akce jsou na široké obrazovce v jednom řádku.

## 2026.09.16-4

- Každá položka hlavní navigace má vlastní stříbrný glass rámeček.

## 2026.09.16-3

- Logo a název CRM jsou větší v levém rohu, verze je samostatně v pravém rohu.
- Dashboard má výraznější rámečky karet; denní úkoly jsou samostatná kompaktní karta.
- Plnění ročního plánu je pouze v záložce Roční plán.
- Stav diskového úložiště je pouze v záložce Záloha.

## 2026.09.16-2

- Světlý stříbrný glass vzhled se zachovanými modrými akcenty.
- Kompaktnější pracovní plocha, panely, ovládací prvky a rozestupy.

## 2026.09.16-1

- Sjednocení postupně přidaných přepisů funkcí do jedné aplikační logiky a jednoho spuštění.
- Oddělení hlavní stránky, společného stylu a aplikační logiky.
- Mírně tmavší modré plochy, zachovaný průsvitný glass vzhled a viditelné ovládání klávesnicí.
- Širší obsah investic a FKI na tabletu díky seznamu klientů nad detailem.
- Společné stahování klientských HTML výstupů; report bez vybrané sekce se nestahuje.
- Oprava dokončení aktivity z dashboardu.
- Ochrana novějších změn před opožděnou odpovědí diskového úložiště.
- Lokálně uložené knihovny Chart.js a SheetJS, číslované odkazy na aplikační soubory.
- Regresní ověření na smyšlených datech včetně porovnání s vydanou verzí; viz QA-2026-09-16.md.

Datové schéma a klíče úložiště zůstávají zachované. Toto vydání nevyžaduje převod klientských dat.

## 2026.09.15-1

- Zápis verze pro vydání opravy stahování HTML investičního návrhu včetně FKI.
- Tlačítko vytvoření HTML stáhne soubor pro předání klientovi.
