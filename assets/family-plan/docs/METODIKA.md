# Právní metodika v1 — 15. 10. 2026

Stav: vývojová metodika, kontrola veřejných zdrojů; NENÍ odborně ověřena českým právníkem nebo notářem. Aplikace je pracovní finanční model, nikoliv právní stanovisko. Před klientským použitím je nutná odborná revize. Datum kontroly zdrojů není datem odborné certifikace.

Zdroje: zákon č. 89/2012 Sb. v aktuálním znění 1. 1.–31. 12. 2026 na https://www.zakonyprolidi.cz/cs/2012-89 a oficiální https://e-sbirka.gov.cz/sb/2012/89 ; Portál veřejné správy https://portal.gov.cz/informace/zakonna-dedicka-posloupnost-INF-77 a https://portal.gov.cz/informace/nepominutelny-dedic-INF-78 .

## Výpočetní kontrakt

Pracujeme s potvrzeným úplným okruhem právních příbuzných, jedním rozhodným dnem a českým právem. Neznámý příbuzný není automaticky zemřelý. Uživatel potvrzuje úplnost vstupů. Rodičovské vazby jsou právní; biologické vazby zaniklé osvojením se nezapisují současně jako právní. Osvojení se eviduje, ale pro jeho různé právní účinky výpočet vyžaduje individuální posouzení. Nejasná časová posloupnost úmrtí, neznámý věk potomka, právní výjimky, zpochybněné vlastnictví a neověřená domácnost zastavují výsledky. § 1641: více souběžných titulů ve stejné třídě se sčítá; komplikované rodové smyčky se odmítají.

## Registr pravidel

Každý záznam má ID, ustanovení, postup, podmínky/výjimky a test níže. Společný zdroj je občanský zákoník výše, kontrola 15. 10. 2026, odborné ověření u všech záznamů: čeká na notáře. Strojově čitelný registr je src/rules.js.

| ID | Pravidlo / ustanovení | Postup a podmínka | Příklad |
|---|---|---|---|
| C1 | Potomci a manžel, § 1635 | Rovné kmeny dětí a podíl manžela; potomci zemřelého dítěte zastupují rekurzivně. Jen běžné předúmrtí, ne odmítnutí či vydědění. | Manžel + dvě děti: každý 1/3. |
| C2 | Manžel, rodiče, domácnost, § 1636 | Bez potomků; manžel nejméně 1/2. Samotná osoba domácnosti přechází do C3. | Manžel, dva rodiče: 1/2, 1/4, 1/4. |
| C3 | Sourozenci a domácnost, § 1637 | Bez dědice C1 a bez manžela i rodičů; rovné kmeny. Zastupují pouze děti sourozence. Domácnost: rok + péče nebo výživová závislost. | Zemřelý bratr, jeho dvě děti, partner splňující podmínky: 1/4, 1/4, 1/2. |
| C4 | Prarodiče, § 1638 | Žádný dědic předchozích tříd; rovné podíly. | Dva žijící prarodiče: 1/2 každému. |
| C5 | Praprarodiče, § 1639 | Každé rodičovské straně polovina, dvojici čtvrtina, osobě osmina; přirůstání uvnitř dvojice, strany, pak mezi stranami. Vyžaduje oba rodiče a všechny čtyři prarodiče v evidenci, včetně zemřelých. | Jediný žijící praprarodič: celek. |
| C6 | Prasynovci, praneteře, tety, strýcové, § 1640 | Rovné kmeny; děti zemřelých tet/strýců zastupují, potomci prasynovců nikoliv. | Teta a dva bratranci zastupující strýce: 1/2, 1/4, 1/4. |
| STATE | Odúmrť, § 1634 | Teprve bez všech výše uvedených a s kompletním rodokmenem; stát. | Žádný způsobilý žijící příbuzný: 100 % stát. |
| RESERVED | Povinný díl, §§ 1642–1644, 1654–1664 | Zákonný podíl potomka krát 3/4 do 18 let, jinak 1/4; násobeno čistou modelovou pozůstalostí. Bez darů k započtení, bez vyloučení a dalších výjimek. Jde o hodnotové minimum, ne další dědictví navíc. | Dítě 10 let s podílem 1/3: minimum 1/4 pozůstalosti. |
| SJM | §§ 709–742 a 764 | Polovina u výslovně potvrzeného zjednodušeného vypořádání standardního SJM; nejde o obecnou automatickou právní polovinu každé věci. Vnosy, smluvené režimy a spory vyžadují individuální posouzení. | Model SJM 8 mil.: 4 mil. do pozůstalosti. |
| DEBT | §§ 1701–1707 | Pro finanční čistou hodnotu odečet modelové části dluhů; nejde o určení odpovědnosti jednotlivého dědice či dlužníka vůči věřiteli. Záporná pozůstalost a ručení zastaví rozdělení. | Aktiva 5 mil., dluh 1 mil.: čistý model 4 mil. |
| SEQUENCE | §§ 1475, 1635–1640 | Každá událost přepočítá vlastníky; pro následující událost se přenese poměrný podíl každé položky. Pouze zákonný model, nikoli konkrétní dohoda dědiců nebo převod dluhů vůči věřiteli. | Otec → manželka a děti; poté manželka → její děti. |

## Situace bez automatického právního závěru

- Závěť (§ 1494 a násl.), dědická smlouva (§ 1582 a násl., limit § 1585), odkazy (§ 1594 a násl.): uchování dokumentů a zamýšlených účinků, nikoli posouzení platnosti. Aktuální stav se zastaví; scénář „Bez závěti“ je výslovně kontrafaktuální.
- Vydědění (§§ 1646–1649), nezpůsobilost (§§ 1481–1483), zřeknutí (§ 1484), odmítnutí (§§ 1485–1489): neautomatizovat přechod na potomky.
- Dary a započtení (§§ 1658–1664): převodní scénář změní majetkové hodnoty, ale následné právní rozdělení vyžaduje posouzení započtení.
- Osvojení (§ 832 a násl., zvláštní účinky osvojení zletilého), registrované partnerství a partnerství (§ 655 odst. 2, § 3020): v této verzi individuální posouzení; nesezdaný partner není automaticky manžel.
- Nezletilí: vypočte se věková sazba, upozorní se na správu jejich majetku a schválení relevantních jednání soudem (§ 898). Nenavrhuje se automatické ustanovení opatrovníka.
- Výhrada soupisu (§ 1674 a násl., § 1706): aplikační checkbox není právní prohlášení. Správa pozůstalosti (§ 1677 a násl.) se řeší s notářem. Přeshraniční případy: nařízení EU 650/2012, individuální určení rozhodného práva.

## Scénáře a likvidita

A: aktuální stav. B: model bez pořízení pro případ smrti. C: evidence existující závěti s blokací přesného výsledku. D: hypotetické hodnotové maximum pro zvoleného partnera po odečtení povinných dílů potomků; není to hotová závěť ani prokázané maximum pro každou situaci. E: hypotetická alokace celku potomkům podle jejich kmenů. F: kopie případu s převodem položky; darování nevratné a může mít další důsledky. G: návazné zákonné modely se zachováním hodnot položek. D/E jsou hodnotové varianty k notáři, nelze je přenášet jako rozhodnuté právní nabytí.

Likvidita: kladný měsíční deficit × počet měsíců + jednorázové výdaje + výslovně zadané vypořádání − dostupná rezerva − očekávané pojistné plnění. Zákonný podíl se do hotovostní potřeby nepřičítá automaticky. Rezerva musí být pozůstalým skutečně dostupná a nesmí se započítat dvakrát. Pojistné plnění je scénářový odhad, nikoli garantované plnění. Daně, výnosy, inflace a čas vyřízení nejsou automaticky modelovány.


## Zobrazení hodnotových variant (16. 10. 2026)

Zabezpečení partnera ukazuje nejprve prioritního příjemce a u potomků odvození minima (¾ zákonného podílu nezletilého, ¼ zletilého). Zabezpečení dětí je hypotetické závětní řešení; není automatickým zákonným rozdělením. Manžel/ka není nepominutelným dědicem, může mít v této variantě nulové dědictví, ale zůstává mu/jí vlastní majetek a modelový výsledek vypořádání SJM. Tabulky vždy rozlišují zákonnou referenci, dědictví ve variantě a vlastní čistý majetek. Celková hodnota varianty nepřičítá zároveň zákonné dědictví. Neřeší se konkrétní věci, bydlení ani další případná práva pozůstalého.

Podklady: [gov.cz – Nepominutelný dědic](https://portal.gov.cz/informace/nepominutelny-dedic-INF-78), [Notářská komora – FAQ](https://www.nkcr.cz/vasi-notari/detail/239_1104-faq-casto-kladene-dotazy-(zavet-a-dedeni)). Kontrola těchto veřejných vysvětlení nenahrazuje odbornou revizi celé metodiky.

Popisky příbuzenství vycházejí z evidovaných vazeb. Postavička je volitelný vzhled, ne vstup do výpočtu. Chybějící rodič se nedomýšlí podle jména či partnerství; původní slovní popis z dotazníku zůstává označen jako tvrzení klienta.

## Převzetí klientských odpovědí a krátký výstup (16. 10. 2026)
Poradce volí převzetí odpovědí, nebo jejich úpravu. Převzetí zaznamenává zdroj údajů; nejde o nezávislé ověření. Známé hodnoty a uvedené vlastnictví lze použít bez povinných poznámek ke každé položce. Neznámé hodnoty se nikdy nepovažují za potvrzené nuly. Právní situace mimo rozsah modelu zůstávají označené.
Majetek přijatý darem se odlišuje od darů poskytnutých zůstavitelem. Nabytí darem samo o sobě nezapíná blokaci započtení poskytnutých darů. U položek se uvádí vlastník, režim a způsob nabytí podle klienta. Podklad: https://portal.gov.cz/informace/zakonny-rezim-spolecneho-jmeni-manzelu-INF-50
Výchozí prezentace obsahuje pouze majetek, rodinné větve, modelovou pozůstalost, příjemce a další kroky. Krizový manuál zůstává dostupný v aplikaci. Rozsáhlá rodina či majetek se stránkují.

## Relevantní osoby a neblokující zahraniční vazba
Výchozí vizualizace používá zákonný okruh dědiců, vybraného klienta, současného manžela a případného příjemce varianty. Samotná chyba majetkového vstupu nerozšiřuje zobrazení na celou rodinu. Úplná evidence zůstává dostupná pro další scénáře.
Zahraniční vazba je upozornění, nikoli blokace českého orientačního výpočtu. Aplikace neurčuje rozhodné právo a výsledek neprezentuje jako potvrzený přeshraniční právní výsledek. Upozornění se uvádí i v klientském výstupu. Neznámá hodnota majetku zůstává k doplnění přes přímý odkaz na danou položku.
