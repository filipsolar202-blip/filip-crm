# FILIP CRM

Lokální CRM pro klienty, smlouvy, obchody, pojistné události, investice, FKI, poznámky, reporty a zálohu.

## Verze 2026.10.27-4

Ve Správě smlouvy se **Penzijní majetek klienta** zobrazuje a upravuje pouze pro typy **DPS a DIP**. U auta, majetku, životního pojištění, úvěrů a dalších smluv je skrytý; platba smlouvy se do penzijního formuláře nepředvyplňuje. Rozpracované penzijní údaje zůstanou při přepnutí typu tam a zpět zachované.

U nového nákupu v Investicích i FKI jsou dvě výslovné možnosti: **Uložit prognózu** uchová návrh bez obchodů a změny AUM; **Založit obchodní případy** vytvoří z aktivní varianty jeden případ na každý fond ve fázi Nabídka. Případy se řeší samostatně v klientské kartě a Pipeline. Po sjednání se každý fond připíše do portfolia; dokup zachová dosavadní hodnotu a výnos.

Uložený návrh najdeš na kartě klienta v **Portfolio → Prognózy portfolia → Převést na obchodní případy**. Otevře se poslední vybraná varianta A/B, kterou lze před převodem zkontrolovat. Opakovaný převod nevytváří další stejné případy a nemění jejich rozpracovaný nebo ukončený stav. Úpravy již založeného případu se provádějí přímo v něm; nový samostatný nákup začni novým návrhem. Měsíční investici lze zadat i bez počátečního vkladu. Plánovaný měsíční příspěvek ani budoucí dokup nejsou automaticky vložené peníze.

Dashboard má pevné pořadí: **Dnešní 3 priority → Tento týden 3 cíle → Grafy → Statistiky, grafy a kontrola dat → Úkoly a připomínky**. Změny dat, filtrů ani rozbalení přehledů pořadí nemění. Nedokončené priority jsou součástí poslední sekce; rychlé odkazy zůstávají v denní kartě.

Hlavní CRM má jednu aplikační logiku a společný modrý glass vzhled. Investiční plán porovnává aktuální portfolio s nejvýše dvěma alternativami A a B. Odprodej lze rozdělit do více nových nákupů. Pro klienta lze stáhnout podrobný investiční návrh ve stylu původní kalkulačky nebo stručné srovnání variant. Přehled změn je v `CHANGELOG.md`, ověření aktuálního vydání v `QA-2026-10-27-3.md`.

V klientském HTML reportu jsou podrobnosti a popis fondu pod tlačítkem **Bližší info o fondu**. Název, společnost, ISIN, ocenění a hodnoty investice jsou viditelné hned; transakce se rozbalují zvlášť. Klientský detail odkazuje jen na oficiální stránku fondu. V interním přehledu informací o fondech zůstávají všechny ověřovací podklady. Fondy se v CRM i reportech řadí podle společnosti a potom podle názvu. Pro nové rozložení vytvoř report znovu — již stažené HTML soubory se automaticky nemění.

## Pojistné události

Na kartě klienta klikni na **+ Pojistná událost**. Vyber oblast pojištění, případně existující smlouvu, a zapiš, co se stalo. Datum události, datum založení evidence a datum nahlášení pojišťovně mají samostatná pole. Lze doplnit číslo události, požadované plnění a další krok s termínem.

V hlavním menu **Pojistné události** sleduj fáze **Nahlášeno → Kompletace → Odesláno pojišťovně → Posouzení → Vyřízeno**. V detailu lze přidávat datované poznámky, podklady, datum odeslání a uzavření, skutečně vyplacenou částku a výsledek. **Zamítnuto** a **Zrušeno** uchovají celý záznam. Vyřízené události najdeš filtrem ukončených nebo všech událostí; u klienta zůstávají ve vlastní záložce.

Události jsou součástí společné JSON i Google zálohy včetně poznámek a příloh. Pojistné plnění se nezapočítává do obchodní produkce, provizí ani AUM.

## Náhrada stávající smlouvy

Nový obchodní případ se zakládá samostatně u klienta. Teprve při dokončení nebo pozdější úpravě obchodu lze v poli **Nahradit původní smlouvu** vybrat původní smlouvu klienta a datum účinnosti. Prázdná volba znamená nový produkt (při úpravě zachování současné vazby).

Datum obchodu je nezávislé na účinnosti. Obchod je evidovaný hned. Pokud je účinnost budoucí, původní smlouva zůstává aktuální; náhrada se aktivuje při otevření nebo obnovení CRM od data účinnosti. U původní smlouvy je vidět naplánovaná náhrada a odkaz na nový obchod. Původní údaje, poznámky a přílohy zůstanou v historii.

## Soubory aplikace

- `FILIP-CRM.html` — vstupní stránka a formuláře.
- `assets/js/crm.js` — společná aplikační logika.
- `assets/js/fund-profiles.js` — veřejné informace fondů podle přesného ISIN, s daty kontroly a oficiálními zdroji; neobsahuje klientská ocenění.
- `assets/js/insurance-claims.js` — evidence pojistných událostí nad společným stavem a ukládáním CRM.
- `assets/css/insurance-claims.css` — přehled a detail pojistných událostí.
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
