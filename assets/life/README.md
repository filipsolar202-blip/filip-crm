# Dodané kalkulačky a dotazníky

Integrované 3. 11. 2026 ze souborů poskytnutých uživatelem. Výpočetní pravidla, důchodový model, pojistné částky, produktový katalog a ratingy jsou převzaté; tato integrace je neověřuje ani nemění.

| Zdrojový soubor | SHA-256 originálu |
| --- | --- |
| `index.html` | `640e35a3dbc8d5c247576afe70363b0a55e8ca57f0d21baa3c8a1e267716b2ed` |
| `dotaznik-fairlife.html` | `3639b5dc94162cb4e45ab0db3d5c80c9bdfcc6c4f778d750318881b82019a750` |
| `dotaznik-mantra.html` | `8f97982ab1f89fa6330965b166aed127f3085252d9b9d6345d5bf03f60e2c13e` |

`calculator.html` odpovídá `index.html`, s odstraněnou velkou vloženou kopií obou dotazníků, událostí `life:changed` při vykreslení a přidaným propojením `life-frame.js`. `life-engine.js` je přesná kopie původního jádra; jeho shoda s originálem i vloženým jádrem kalkulačky byla ověřena. `life-catalog.js` má pouze přejmenovanou globální proměnnou na `CrmLifeCatalog`.

FairLife dotazník je původní soubor. Mantra dotazník mění zobrazeného poradce na Martina Čermáka a doplňuje, že odpovědi přebírá Filip Solár. Původní e-mailové adresy zůstávají beze změny. CRM při stažení přidává identifikaci kalkulace a volitelně základní identitu klienta; žádné poradenské poznámky nebo připravené nabídky.

Aktualizace výpočetního jádra musí současně aktualizovat hlavní kalkulačku, rodičovský `life-engine.js` a obě přenosné varianty. Ověření integrace: `tools/qa/life-crm.cjs`.

## Úprava klientského reportu 4. 11. 2026

`calculator.html` nově přesouvá identitu do úvodu, filtruje nabídky podle produktu/ceny se zachováním jejich indexů a upravuje stránkování. FairLife vzhled je oddělen v `assets/css/life-report.css`; Mantra má původní styl i ikonu. Výpočty v jádru, dotazníky a ukládání dat nejsou touto úpravou měněny. Tiskové scénáře včetně více osob a dlouhých textů ověřuje `tools/qa/life-report.cjs`.


## Kombinované nabídky (2026-11-09)

Každá ze tří nabídek podporuje `components` (nejvýše 4 smlouvy) s `productId`, `premium`, `kind: new|retained` a volitelným `label` pro neznámý produkt. Staré nabídky bez `components` zůstávají kompatibilní. `coverage[person][risk].allocations[offer]` uchovává částky ve stejném pořadí jako smlouvy. `Life.syncOffers` odvozuje celkovou cenu a krytí, nikdy nepřičítá historický sloupec `current`. Cena zůstává neznámá, dokud nejsou vyplněny všechny části.

Orientační kombinované hodnocení není oficiálním ratingem EUCS: v jednom řádku rizika váží rating podle přidělených částek, v kategorii průměruje aktivní řádky a celkem aktivní kategorie. Obecné podmínky jsou aritmetickým průměrem produktů. Chybějící rating kterékoliv relevantní části vede k neznámé kategorii/celku. Podmínky a verze zachované smlouvy musí odpovídat zvolenému produktu; jinak použít vlastní název bez ratingu.

Kontroly: `tools/qa/life-combinations.cjs`, `life-crm.cjs`, `life-report.cjs`.
