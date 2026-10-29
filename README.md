# FILIP CRM

Lokální CRM pro klienty, smlouvy, obchody, pojistné události, investice, FKI, poznámky, reporty a zálohu.

## Verze 2026.10.29-3

### Nakoupeno a čekání na připsání

Sjednání obchodu zachová datum obchodu a produkci, ale nevymýšlí datum skutečného nákupu nebo emise. U klienta otevři **Nakoupeno → Doplnit údaje**. Klasická investice vstoupí do AUM po doplnění skutečného data nákupu; FKI potřebuje také datum emise. Prázdné nebo budoucí datum ponechá investici v čekání. Změna ceny CP sama nákup nepotvrdí.

Ve **FKI / Investice → AUM** jsou oddělené částky a záložky **Investováno** a **Čeká na připsání**. Čekající částka se nezapočítává do klientského ani poradenského AUM, vložené částky aktivního portfolia, výnosu nebo grafů. V klientském reportu je v samostatné zapínatelné sekci. Také starší investice s chybějícími daty se zobrazí v čekání; nejsou smazané. Potvrzený souhrnný zůstatek účtu Edward zůstává oceněním účtu, nikoli jednotlivým novým nákupem.

Dokup klasické investice má vlastní pozici a nepřepisuje předchozí zůstatek. Pozdější aktualizace **celkové hodnoty fondu** zahrnuje již připsané nákupy, aby se nesčítaly podruhé. Opakované uložení nebo potvrzení nevytváří další nákup, obchod ani BJ. Data nákupu lze znovu vyprázdnit; při selhání uložení zůstává formulář otevřený.

### Mazání nesprávných záznamů

Na kartě klientského fondu je **Smazat fond klienta**, u jednotlivých transakcí **Smazat**. U běžných investic lze odstranit pouze jednu aktualizaci — v takovém případě se může znovu zobrazit předchozí hodnota. Úplné odstranění fondu klienta odstraní také jeho aktualizace a zabrání obnovení ze zachovaných obchodů/smluv. Katalog fondu, cena CP i ostatní klienti zůstávají.

Před potvrzením CRM vysvětlí rozsah odstranění. Nákup s výslovně navázanými odkupy se odstraní společně; u nejasně přiřazených odkupů je potřeba nejprve upřesnit vazbu nebo odstranit celý fond klienta. Smlouvy, obchody a případy mají také přímé tlačítko mazání. Smazání smlouvy ponechá pojistné události, přílohy a výplaty v historii klienta.

### Společná cena CP a aktuální AUM

Změna **ceny jednoho CP a data ocenění** u klienta nebo v detailu fondu se podle přesného ISIN použije pro všechny jeho automatické pozice ve **FKI i Investicích**. Karta klienta, celkové AUM a nově vytvořený report počítají ze stejného ocenění; jednotlivé pozice není potřeba otevřít a znovu uložit. Rozdílný název nebo společnost u stejného ISIN cenu nerozdělují. Starší datum nepřepíše novější cenu.

Ručně zadané celkové hodnoty v Kč, ruční výnosy a potvrzené nulové zůstatky zůstávají zachované. Přepočet potřebuje počet CP nebo vloženou částku a upisovací cenu. Pouhá změna poznámky nepublikuje klientský výpis jako cenu pro ostatní. Ověřený výpis má přednost před starší cenou; explicitní nová cena může přecenit automatické pozice. V editoru FKI lze přes **Použít výpočet z CP** zvolit výpočet místo uloženého výpisu.

Staré importy Codya používaly den nahrání jako datum ocenění. Tento údaj již neblokuje dostupný výpočet z CP. Dříve stažené HTML reporty zůstávají snímky — pro nové hodnoty je vytvoř znovu.

### Import reportů Avant a Codya

Ve **FKI → Avant XLSX** vyber transakční export Avantu. Náhled nic nemění; tlačítko **Převzít bezpečné změny a uložit kontroly** převezme jednoznačné novější ocenění a uloží ostatní rozdíly k rozhodnutí. Párování používá RČ/IČO, ISIN a identitu pokynu/transakce. Samotné jméno nestačí. Ocenění respektuje datum uvedené u každého řádku reportu.

Klient, dotčený fond a sporné hodnoty se označí červeně. Přes upozornění nebo **Kontrola reportů** zobrazíš hodnotu CRM vedle reportu a vybereš **Potvrdit správnost CRM**, **Přijmout údaje reportu**, případně **Otevřít klienta a upravit**. Přijetí je dostupné jen při jednoznačné vazbě. Po ruční opravě lze potvrdit CRM; při změně vazby znovu nahraj report pro nové porovnání.

- Nové pozice, změny vkladu/počtu CP, ruční ocenění, starší výpis a nulová hodnota vyžadují kontrolu. Převody a konverze se zpracují ručně po ověření obou stran.
- Investice chybějící v reportu zůstávají uložené a zobrazí se k ověření. Report nezakládá klienta podle podobnosti jména a nemaže novější nákup.
- Stejný report nevytváří duplicitní transakce. Po změně CRM lze stejný soubor znovu načíst a porovnat s aktuálními údaji.
- **Codya XLSX** v Investicích i FKI používá stejnou kontrolu. Doplň skutečné datum stavu výpisu; prázdná buňka není nula. Souhrn fondu se automaticky nerozděluje mezi více nákupů a různé třídy se nepárují podle podobnosti názvu.
- U odkupů se odděluje skutečně vyplacená částka od aktuální hodnoty odkoupených CP, aby AUM i výnos odpovídaly zbylé investici a vyplaceným penězům.

Importní historie a rozhodnutí jsou součástí záloh. Soubor se čte místně v prohlížeči, neposílá se nové externí službě. Import výpisu aktualizuje investiční evidenci; nevytváří další obchody ani provize.

### Měření práce a dvoutýdenní pilot

V **Analýza → Měření práce · dvoutýdenní pilot** založ pilot: zvol datum začátku, sledovaný proces a přibližně deset svých aktivních obchodních případů. Výchozím procesem je zápis po schůzce a naplánování dalších kroků. CRM žádné klienty nevybírá a případy nekopíruje.

Při běžném zápisu přes **+ Aktivita** rozbal volitelnou část **Měření práce**. Vyber oblast práce, způsob určení času a případně překážku, případ a pilot. Minuty zapisuj do původního pole **Délka minut**. Předvyplněná délka ani historické záznamy nejsou skutečné měření; skutečný čas musíš výslovně potvrdit. Prázdné minuty znamenají nezjištěný čas, výslovná nula je povolená.

Pro porovnání založ v aktivitě konkrétní **výstup** (například „Zápis ze schůzky 2. 11.“). K němu přiřazuj další pracovní bloky včetně kontroly a oprav. Výstup označ jako hotový a úplný až po dokončení všech částí. Každý blok práce zapisuj jednou; čekání na klienta do aktivního času nepatří. Při přechodu do podrobného zápisu zůstanou rozepsané hodnoty zachované.

- **Prvních pět pracovních dnů:** běžný postup, měření času a překážek, kontrola dalšího kroku a termínu u sledovaných případů. Potom vyber jednu činnost ke zlepšení.
- **Dalších pět pracovních dnů:** nový jednotný postup u 3–5 podobných výstupů, měření celého aktivního času včetně kontroly a oprav.
- **Vyhodnocení v Analýze:** počet výstupů, medián času na dokončený výstup a rozhodnutí zavést, upravit nebo měřit déle. Srovnání potřebuje alespoň tři úplně změřené výstupy každého postupu a zůstává orientační. Odhady, neúplné záznamy a plány se nevydávají za naměřenou úsporu.

Osnova zápisu: **situace klienta → rozhodnutí → chybějící podklady → kdo co udělá → termín**. Pilotní pracovní dny jsou pondělí až pátek; nepracovní dny si při vyhodnocení zohledni. Skutečný čas neúspěšného kontaktu lze měřit, aniž se tím zvýší počet uskutečněných schůzek nebo obchodů.

Přehled návaznosti pouze ukazuje ověřené další kroky, chybějící termíny a prodlení. Nezakládá úkoly bez tvého zápisu. Starší přehled **Delegování a automatizace** zůstává dostupný jako evidence délek a oddělený měsíční model odhadů. Pilot i nové údaje jsou součástí JSON a Google záloh. Nastavení a zápisy lze používat bez externích služeb.

### Dosavadní funkce

Ve Správě smlouvy se **Penzijní majetek klienta** zobrazuje a upravuje pouze pro typy **DPS a DIP**. U auta, majetku, životního pojištění, úvěrů a dalších smluv je skrytý; platba smlouvy se do penzijního formuláře nepředvyplňuje. Rozpracované penzijní údaje zůstanou při přepnutí typu tam a zpět zachované.

U nového nákupu v Investicích i FKI jsou dvě výslovné možnosti: **Uložit prognózu** uchová návrh bez obchodů a změny AUM; **Založit obchodní případy** vytvoří z aktivní varianty jeden případ na každý fond ve fázi Nabídka. Případy se řeší samostatně v klientské kartě a Pipeline. Po sjednání se každý fond připíše do portfolia; dokup zachová dosavadní hodnotu a výnos.

Uložený návrh najdeš na kartě klienta v **Portfolio → Prognózy portfolia → Převést na obchodní případy**. Otevře se poslední vybraná varianta A/B, kterou lze před převodem zkontrolovat. Opakovaný převod nevytváří další stejné případy a nemění jejich rozpracovaný nebo ukončený stav. Úpravy již založeného případu se provádějí přímo v něm; nový samostatný nákup začni novým návrhem. Měsíční investici lze zadat i bez počátečního vkladu. Plánovaný měsíční příspěvek ani budoucí dokup nejsou automaticky vložené peníze.

Dashboard má pevné pořadí: **Dnešní 3 priority → Tento týden 3 cíle → Grafy → Statistiky, grafy a kontrola dat → Úkoly a připomínky**. Změny dat, filtrů ani rozbalení přehledů pořadí nemění. Nedokončené priority jsou součástí poslední sekce; rychlé odkazy zůstávají v denní kartě.

Hlavní CRM má jednu aplikační logiku a společný modrý glass vzhled. Investiční plán porovnává aktuální portfolio s nejvýše dvěma alternativami A a B. Odprodej lze rozdělit do více nových nákupů. Pro klienta lze stáhnout podrobný investiční návrh ve stylu původní kalkulačky nebo stručné srovnání variant. Přehled změn je v `CHANGELOG.md`, ověření aktuálního vydání v `QA-2026-10-29-1.md`.

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
- `assets/js/work-measurement.js` — volitelné měření aktivit, pilot, porovnání výstupů a kontrola návaznosti.
- `assets/css/work-measurement.css` — formuláře a analýza měření práce pro počítač i telefon.
- `assets/js/provider-import.js` — parsery reportů, porovnání a potvrzení změn.
- `assets/js/provider-import-ui.js` a `assets/css/provider-import.css` — náhled, kontroly a červená upozornění.
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
