## 2026.10.04-3

- Při přechodu mezi záložkami CRM vykresluje pouze otevřenou část aplikace.
- Zrychlená práce s klienty, obchodními případy, smlouvami, investicemi a reporty u větší databáze.
- Úvodní načtení a ukládání dat zůstávají zachované.

## 2026.10.04-2

- Opravené zamrznutí při obnovení CRM nad větší databází klientů.
- Investiční a FKI položky se pro správce načtou jedním průchodem a během stejného vykreslení se znovu použijí.
- Oddělení vlastního AUM a partnerského AUM Mantry zůstává zachované.

## 2026.10.04-1

- Nová záložka Správa odděluje vlastní klienty Filipa Solára od partnerských klientů Mantry bez vytváření duplicitních karet.
- Správce se eviduje u klienta a ukládá také do obchodu a obchodního případu, aby historické přehledy zůstaly správné.
- Partnerský přehled ukazuje klienty, produkci, AUM, odhad počátečních a následných provizí i skutečně přijaté výplaty.
- Investice a FKI klientů Mantry zůstávají dostupné pro sledování vývoje, ale nezvyšují osobní AUM Filipa Solára.
- Stávající klienti se automaticky zařadí pod správu Filipa Solára; správce lze změnit přímo na kartě klienta.

## 2026.10.02-2

- Pipeline, obchodní případy a jejich součty obsahují pouze explicitně založené případy. Servisní stav smlouvy již nevytváří automatický případ.
- Původní smlouvy, jejich stavy, historie a nové rozpracované případy zůstávají zachované.
- Stávající tlačítko Nový obchodní případ vysvětluje oddělený postup; majetková smlouva předvyplní kategorii Nemovitost.

## 2026.10.02-1

- Písmo Fustat vložené do aplikace a samostatných reportů, včetně licence OFL.
- Zarovnané číslice, zachování desetinných míst u CP/NAV v reportu.
- Zvýrazněná data ocenění a termíny odkupů, datum ocenění u každého fondu v souhrnu.
- Mobilní posouvání transakčních tabulek a úpravy tiskových stylů.
- Zachované interaktivní grafy, barvy, výpočty, časové testy a všechny funkce verze 2026.10.01-2.

# Historie verzí

## 2026.10.01-2
- Nový obchodní případ se zakládá odděleně od původní smlouvy. Výběr náhrady je až u dokončení nebo úpravy obchodu.
- Samostatné datum obchodu a účinnosti: budoucí náhrada zachová původní smlouvu a aktivuje se při otevření/obnovení CRM od účinnosti.
- Úprava již dokončeného obchodu umožní přiřadit původní smlouvu bez duplicitního aktuálního produktu.
- Původní podmínky, poznámky a přílohy zůstávají v historii.

## 2026.10.01-1
- Nový obchodní případ lze propojit s původní smlouvou přes akci Nový případ / náhrada nebo výběr ve formuláři.
- Náhrada je samostatný případ u klienta a v Pipeline, nenavyšuje počet aktuálních produktů; potlačuje duplicitní automatický případ ze stejné smlouvy.
- Dokončení je možné až po zadaném podpisu a účinnosti. Do té doby zůstává původní smlouva aktuální; k budoucímu datu se náhrada neaktivuje bez dokončení uživatelem.
- Dokončení aktualizuje stejný záznam smlouvy a uloží historii původních údajů, poznámek a příloh. Historické obchody a provize zůstávají zachované.
- Souhrny tabulky a Pipeline ukazují plánované BJ místo objemu, očekávaná provize zůstává v Kč. Sloupce Pipeline sčítají BJ.

## 2026.09.30-3
- Samostatný objem řešeného případu u smluv, oddělený od částky / platby smlouvy.
- Úprava objemu kliknutím na částku v tabulce a Pipeline nebo ve formuláři smlouvy; podpora zápisu 2 500 000 a 2,5 mil.
- Stejný objem v součtech obou pohledů a při přípravě nového obchodu.

## 2026.09.30-2
- Příležitosti přejmenovány na Obchodní případy; nová Pipeline nad stejnými záznamy.
- Fáze Nabídka, Scoring, Kompletace, Schvalování, Podpis a K zadání (BeTy); staré stavy se zobrazují v odpovídajících nových fázích bez přepisování historie.
- Společné hledání, kategorie, fáze a řazení; počet dnů od poslední aktualizace a zvýraznění nad 14 dní.
- Změny fází výběrem nebo přetažením; propojeno i s případy ze smluv.
- Převod do obchodu se dokončí až uložením obchodu; zavření formuláře zachová otevřený případ.

## 2026.09.30-1
- Propojený graf vývoje a koláč alokace: kurzor, časový posuvník, hodnoty, vklady a zhodnocení ke společnému datu; funguje i ve staženém HTML bez internetu.
- Filtry společností u klientského portfolia a v klientských sekcích Investice, FKI a Penze, včetně volby Všechny společnosti.
- Report: jednoduchý celkový přehled, grafy, souhrnná tabulka fondů a pak detail. Transakce se rozbalují až na kliknutí.
- Tisk/PDF zobrazí transakce a vrátí grafy na aktuální hodnoty; po tisku obnoví zvolený náhled.
- Zachována dosavadní metodika výnosů, časových testů a odkupu.

## 2026.09.28-3
- Graf lineárně propojuje počáteční investici s aktuální hodnotou a navazující prognózou.
- Vklady ze stejného dne se sčítají; pozdější dokupy tvoří skoky v průběhu.
- Historická část je označena jako zjednodušená ilustrace.

## 2026.09.28-2
- Popis fondu předchází zvýrazněným hodnotám; termíny odkupu jsou drobnou poznámkou pod transakcemi.
- Odhad odkupní částky používá dosavadní průměrný roční výnos pozice pouze do nejbližšího odkupu, během vypořádání neroste.
- Graf od prvního evidovaného vkladu barevně rozlišuje historické vklady a budoucí model; nezaměňuje vklady za historická ocenění.
- Investiční přehled a grafy mají v reportu přednost před ostatními produkty.

## 2026.09.28-1
- Klientský report: samostatný přehled dostupnosti prostředků u investic a FKI, včetně časového testu, odkupu a vypořádání po jednotlivých nákupech.
- Nejbližší termín se počítá nejdříve ode dne vytvoření reportu; chybějící pravidla se označí místo vymyšleného termínu.
- Přehled rozlišuje nejbližší známou pozici a vypořádání všech zbývajících pozic.

## 2026.09.22-4
- Souhrny smluv a hypoték v jednom řádku na monitoru; tržní sazba jako kompaktní dlaždice.
- Příležitosti řazené od schválených přes schvalování až k novým příležitostem.
- Investice a penze: koláč rozložení podle společností a rozbalovací přehled jejich klientů, produktů a hodnot.
- Klienti investičního fondu se zobrazují pod příslušnou společností.

## 2026.09.22-3

- Výraznější modrostříbrné rámečky karet, polí a tlačítek.
- Tmavě modré nadpisy a hlavní text, jemně tónované portfolio a kontakty při zachování světlého skleněného vzhledu.

## 2026.09.22-2

- Přehled výplat jednotlivých obchodů tipařů napříč roky, filtry stavu, datum výplaty, poznámka a historie oprav.
- CRM využívá celou šířku monitoru.
- Rodinné vazby na kartě klienta: děti, rodiče, partneři a sourozenci, obousměrné propojení i založení nového člena.
- Volitelná evidence správy produktů rodičem do 18 let; vazby se ukládají v klientských datech a záloze.

## 2026.09.22-1

- Stažení investičního návrhu znovu používá podrobný klientský výstup z původní kalkulačky.
- Návrh obsahuje souhrn scénáře, koláč skladby nového nákupu, graf modelového vývoje a samostatný detail každého fondu.
- Stručné srovnání aktuálního portfolia s alternativami A/B zůstává dostupné samostatným tlačítkem.

## 2026.09.21-7

- Jednostránkový investiční výstup má kompaktní záhlaví bez velkého sloganu a začíná přehledem „Aktuální portfolio“.
- Aktuální portfolio obsahuje samostatné grafické rozdělení podle fondů, segmentů a likvidity.
- Pod aktuálním stavem lze zobrazit nejvýše dvě navrhované alternativy A a B.
- Odprodej jedné současné investice lze rozdělit do několika cílových fondů přes zdroj peněz u nových nákupů.
- Reinvestované částky se počítají jako nové nákupy a report výslovně upozorňuje na nový časový test.

## 2026.09.21-6

- Klientský investiční plán má nový jednostránkový výstup A4 na výšku ve světlém modrostříbrném stylu.
- Hlavní doporučená varianta je zvýrazněná nahoře včetně rozložení portfolia, průměrného očekávaného výnosu a konkrétních odprodejů, přesunů a nákupů.
- Pod hlavní variantou lze zobrazit nejvýše dvě stručné alternativy, aby se celý materiál vešel na jednu stránku.
- Editor omezuje plán na jednu hlavní variantu a maximálně dvě alternativy; uložené plány používají stejný výstup.

## 2026.09.21-5

- Prognóza umí libovolný počet pojmenovaných variant, které lze kopírovat, upravovat, uložit a znovu otevřít.
- U každé současné investice i fondu mimo správu lze ve variantě zvolit ponechání, částečný nebo úplný odprodej a přesun do jiného fondu.
- Přesunutá částka se nepočítá jako nové peníze klienta a návrh nijak nemění AUM, provize ani skutečnou evidenci.
- Každá varianta může obsahovat vlastní nové nákupy klasických investic i FKI.
- Průměrné očekávané zhodnocení se počítá váženě přes celé výsledné portfolio varianty.
- Nový jednostránkový výstup A4 na šířku ukazuje současné fondy, společný graf a přehled kroků i výsledků všech variant.

## 2026.09.21-4

- Investiční prognóza začíná v bodu „Dnes“ celou částkou, kterou klient investuje, místo nulou.
- Graf i roční tabulka zobrazují jediný očekávaný vývoj bez opatrné a optimistické varianty.
- Prognóza ukazuje vážené průměrné očekávané zhodnocení všech navrhovaných investic dohromady.
- Stejné údaje a stejné zjednodušení obsahuje i stažený klientský HTML report.

## 2026.09.21-3

- Karta klienta zobrazuje konkrétní jména lidí, které klient natipoval nebo doporučil.
- Spárovaná jména lze otevřít přímo do jejich klientské karty.
- Počty „Natipoval“ a „Doporučil“ jsou prokliknutelné do úplného přehledu a nepřičítají duplicitně stejnou vazbu.
- Na kartě je vidět také jméno typaře nebo doporučitele, přes kterého klient přišel.

## 2026.09.21-2

- Opraven klientský report, který zaměňoval datum ocenění fondu za termín časového testu.
- Časový test se počítá podle pravidla konkrétního fondu, standardně 36 měsíců od nákupu nebo emise.
- Investice i FKI ukazují termín přímo u každého fondu a každé jednotlivé pozice klienta.
- Klientský report obsahuje samostatný sloupec s termínem časového testu každé transakce.
- Pokud chybí datum nákupu, CRM zobrazí chybějící údaj a nevytvoří zavádějící odhad.
- Přechod z karty klienta do Investic nebo FKI automaticky skryje seznam ostatních klientů; tlačítko jej kdykoli znovu zobrazí.

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
