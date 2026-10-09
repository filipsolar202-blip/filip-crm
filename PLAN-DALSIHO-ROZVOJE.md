# Plán dalšího rozvoje FILIP CRM

Stav: sjednocený plán rozvoje. První vrstva „3 hlavní cíle týdne“ je nasazená; další body na ni budou postupně napojeny.

## 0. Tři hlavní cíle týdne

První verze je od 9. 10. 2026 přímo na Dashboardu. Obsahuje tři pevné priority, ruční i automatická KPI, průběh, týdenní reflexi a archiv posledních 12 týdnů. Další krok bude propojit historii cílů s obchodním výsledkem a ukázat, které opakované aktivity skutečně zvyšují počet příležitostí, schůzek, podpisů a provizí.

## Jak budou jednotlivé části spolupracovat

CRM bude mít čtyři navazující vrstvy:

1. **Zápis práce** – rychlé aktivity a automatické události zachytí, co se skutečně stalo.
2. **Týdenní řízení** – tři hlavní cíle vyberou činnosti s největším dopadem a průběžně převezmou skutečné hodnoty ze zápisů.
3. **Manažerský pohled** – měsíční analýza vysvětlí, které aktivity vedly k příležitostem, schůzkám, podpisům, BJ a provizím.
4. **Výhled** – pipeline ukáže obchody před dokončením, rizika, očekávanou provizi a počet nových případů potřebných pro splnění cíle.

Jeden zápis se vytvoří pouze jednou. Ostatní části CRM jej jen použijí ve svém výpočtu. Například uskutečněná schůzka se zapíše jako aktivita, automaticky zvýší příslušný týdenní cíl a současně se zobrazí v měsíční analýze. Posun karty v pipeline zůstane systémovou událostí a nebude se vydávat za schůzku.

### Napojení tří hlavních cílů

- **Kontaktovaní klienti** se budou počítat z hotových telefonů, zpráv, e-mailů a schůzek s přiřazeným klientem.
- **Nové příležitosti** se budou počítat podle data založení obchodního případu.
- **Schůzky, analýzy, prezentace, doporučení a podpisy** se budou přebírat z jednotných aktivit.
- **Obchodní výsledek** se bude počítat z dokončených obchodů, BJ, objemu a skutečné nebo očekávané provize.
- Ruční hodnota zůstane pro cíle, které CRM nedokáže spolehlivě změřit, například zavedení nového postupu nebo delegování činnosti.

## 1. Další importy reportů

### Cíl

Zrychlit pravidelnou aktualizaci klientských dat a omezit ruční přepisování hodnot.

### Navrhované řešení

- Vytvořit společné importní centrum pro všechny producenty.
- Každý producent bude mít vlastní profil, který určí formát CSV/XLSX, identifikaci klienta, produkt, ISIN, AUM, vloženou částku, datum hodnoty a případně výnos.
- Před uložením vždy zobrazit kontrolní náhled:
  - nalezení klienti,
  - noví nebo nerozpoznaní klienti,
  - aktualizované fondy,
  - nulové pozice, které budou přeskočeny,
  - možné duplicity a rozdílné názvy stejného ISIN.
- Import smí měnit pouze svoji oblast. Import běžných investic nebude měnit FKI a import FKI nebude měnit běžné investice.
- Ručně zadaná hodnota nebo výnos musí mít podle současného pravidla přednost před automatickým výpočtem.
- U každé aktualizace uložit datum, zdroj a stručný záznam do historie klienta.

### Doporučení

Nové importy přidávat nad jedním společným importním systémem. Díky tomu nebude pro každý nový report vznikat samostatné a odlišně fungující řešení.

## 2. Pipeline: zapínání sloupců a očekávaná provize

### Cíl

Dočasně zobrazit jen vybrané fáze pipeline a okamžitě zjistit, jakou provizi lze z těchto fází očekávat.

### Navrhované řešení

- Do horní části pipeline přidat volbu **Zobrazené fáze**.
- Každý sloupec bude možné zapnout nebo skrýt bez změny stavu obchodního případu.
- Volba se uloží, aby zůstala zachovaná po obnovení stránky.
- Nad pipeline zobrazit souhrn pouze za označené sloupce:
  - počet případů,
  - plánované BJ,
  - celkovou očekávanou provizi,
  - provizi po zohlednění pravděpodobnosti dokončení.
- Umožnit rychlé předvolby, například:
  - Rozpracované obchody,
  - Od nabídky dál,
  - Před podpisem,
  - Podepsané a k zadání,
  - Všechny fáze.

### Doporučení

Zobrazovat dvě částky. **Plná očekávaná provize** ukáže, kolik přinesou všechny vybrané případy při dokončení. **Vážený odhad** zohlední pravděpodobnost jednotlivých fází a bude vhodnější pro reálný výhled příjmů.

## 3. Analýza za měsíc a jednotlivé týdny

### Cíl

Nahradit současný pohled na jediný týden přehledem celého měsíce a současně zachovat možnost kontroly jednotlivých týdnů.

### Navrhované řešení

- Výchozí obrazovka bude zobrazovat vybraný kalendářní měsíc.
- V horní části budou hlavní měsíční výsledky a porovnání s plánem.
- Pod nimi budou samostatné karty pro jednotlivé týdny měsíce.
- Kliknutím na týden se otevře denní detail.
- Mezi měsíci půjde přecházet dopředu a zpět.
- Analýza zobrazí minimálně:
  - volání a kontakty,
  - schůzky s novými a stávajícími klienty,
  - nabídky a prezentace,
  - nově založené příležitosti,
  - podepsané obchody,
  - BJ, objem a provizi,
  - splněné a odložené následné kroky.
- U každé hodnoty musí být možné otevřít seznam položek, ze kterých byla vypočtena.

### Doporučení

Měsíční pohled má být hlavní manažerský přehled. Týdenní část má vysvětlovat, proč měsíc vychází daným způsobem. Data se mají počítat z jednoho společného zdroje, aby se stejná aktivita nezapočítala dvakrát.

## 4. Jednodušší zapisování aktivit

### Cíl

Zkrátit zápis běžné aktivity na několik sekund, aby se aktivity skutečně zapisovaly průběžně.

### Navrhované řešení

- Přidat stále dostupné tlačítko **Rychlá aktivita**.
- Nabídnout velké předvolby:
  - telefon,
  - schůzka,
  - e-mail nebo zpráva,
  - nabídka odeslána,
  - následný kontakt,
  - interní práce.
- Po výběru předvolby předvyplnit aktuální datum, čas a posledního otevřeného klienta.
- Povinné mají být pouze typ aktivity a klient, pokud se aktivita klienta týká.
- Poznámka, výsledek a další termín budou volitelné a rychle dostupné.
- Jedním kliknutím půjde uložit aktivitu a zároveň vytvořit další úkol.
- Stejný rychlý zápis zpřístupnit z klienta, obchodního případu i pipeline.

### Doporučení

Formulář má být krátký. Podrobnosti se mohou doplnit později. Důležitější je spolehlivě zachytit typ, klienta, datum a výsledek kontaktu.

## 5. Automatické události z obchodů

### Cíl

Využít informace, které už CRM zná, a nevyžadovat jejich další ruční zápis.

### Navrhované řešení

CRM může automaticky vytvářet systémové události například při:

- založení opportunity,
- změně fáze pipeline,
- odeslání nabídky,
- podpisu obchodu,
- převodu obchodu na smlouvu,
- zadání do BeTy,
- přijetí provize.

Systémové události budou v historii klienta viditelné, ale budou označené jako automatické. Analýza musí rozlišovat obchodní výsledek a skutečně provedenou poradenskou aktivitu. Samotný přesun karty v pipeline proto nesmí automaticky znamenat uskutečněnou schůzku nebo telefonát.

## Doporučené pořadí realizace

1. **Hotovo:** nasadit tři hlavní cíle týdne, ruční a automatická KPI, reflexi a historii.
2. Zjednodušit zápis aktivit a sjednotit jejich datový model. Současně opravit automatické KPI týdenních cílů tak, aby četla jen z tohoto jednotného zdroje.
3. Přidat automatické systémové události z obchodů a ochranu proti dvojímu započítání.
4. Postavit měsíční a týdenní analýzu nad jednotnými aktivitami a systémovými událostmi.
5. Doplnit výběr sloupců pipeline, zdraví obchodu, provizní výhled a výpočet potřebného počtu nových příležitostí.
6. Propojit historii týdenních cílů s měsíčním obchodním výsledkem a vyhodnotit, které aktivity mají největší dopad.
7. Postupně přidávat nové profily importovaných reportů do společného importního centra.

Importní centrum lze připravovat nezávisle souběžně s prvními čtyřmi body.

## Co bude potřeba později rozhodnout

- Kteří producenti a jaké konkrétní reporty budou přidány jako první.
- Zda se vážená provize bude počítat pevnou pravděpodobností podle fáze, nebo ručně nastavitelnou pravděpodobností u případu.
- Které aktivity se mají počítat do osobní produkční analýzy.
- Jaké měsíční cíle mají být v analýze sledované.
- Které změny obchodu mají vytvořit automatickou událost a které mají zůstat pouze v technické historii.
- Jaký měsíční nebo roční cíl provize se použije pro výpočet chybějící pipeline.
- Zda bude pravděpodobnost dokončení vycházet pouze z historické úspěšnosti fáze, nebo ji bude možné upravit také u konkrétního případu.

## Podmínky kvalitního výsledku

- Žádná nová funkce nesmí zdvojovat klienty, fondy, AUM, obchody ani provize.
- Každý automatický zápis musí mít dohledatelný zdroj.
- Ruční oprava musí mít přednost před automatickým výpočtem, pokud je tak označena.
- Přehledy musí umožnit otevřít položky, ze kterých vznikl součet.
- Nové funkce nesmí odebírat současné možnosti CRM.
- Každá obchodní aktivita a událost musí mít stabilní identifikátor, aby se nemohla započítat vícekrát v cílech, analýze ani pipeline.
- Automatické metriky musí umožnit otevřít seznam konkrétních záznamů, ze kterých vznikly.
