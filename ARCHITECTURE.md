# Architektura hlavního CRM

Stav k verzi 2026.10.29-4. Starší ARCHITECTURE_AUDIT.md popisuje stav před sjednocením aplikační logiky.

## Jedna aplikace

FILIP-CRM.html obsahuje společnou navigaci, agendy a formuláře. Vzhled dodává assets/css/crm.css a chování assets/js/crm.js. Hlavní stránka neobsahuje dodatečné balíky, které by za běhu nahrazovaly implementace funkcí. Pojmenované aplikační funkce mají každá jedinou definici.

Společný stav `state` používají klienti, smlouvy, obchody, investice, FKI, penze, aktivity, reporty a zálohy. Jedno spuštění připraví scénáře, vykreslí rozhraní a inicializuje diskové úložiště. Po jeho načtení se sjednotí výchozí údaje fondů a zobrazení se obnoví. `renderAll` je společný vstup pro překreslení.

Pojistné události používají kolekci `state.insuranceClaims`. Modul `assets/js/insurance-claims.js` dodává vlastní přehled, obsah klientské záložky a dialog; načítá se před `crm.js`, nemění existující funkce a používá společné `persist`, `uid` a navigaci. Normalizace, slučování záloh, vazby na klienta/smlouvu a ochranné počty zůstávají v `crm.js`. Událost má stabilní `syncId`, datovanou historii a přílohy. Sloučení importu používá mapování identity klienta a smlouvy, nikoli shodu číselných ID napříč zálohami. Neúplné importované vazby zůstávají k ručnímu doplnění. Události ani jejich vyplacené částky nevstupují do produkce nebo AUM.

Investice mimo správu jsou uloženy samostatně v `externalInvestments` a prognózy v `investmentForecasts`. Výpočty AUM, produkce a provizí tyto externí položky nečtou. Prognóza si ukládá vlastní snímek spravovaných i externích pozic a návrhu, aby šla později znovu otevřít beze změny historického výstupu.

Samostatné historické HTML nástroje zůstávají zachované. Nejsou součástí běhu hlavní aplikace a nebyly tímto vydáním funkčně sloučeny ani odstraněny.

## Rozsah investičních čtení

`withPortfolioReadContext` obaluje synchronní vykreslení aktivní stránky, detailu klienta a sestavení jeho investičního výstupu. Vnořené volání sdílí kontext, v `finally` se kontext uvolní. Indexy klientských identit, vlastnictví záznamů, zdrojových vazeb, NAV a posledních snapshotů se ukládají jen do tohoto dočasného kontextu; neukládají se do dat ani mezi vykresleními. `persist` je zneplatní před normalizací; odlišná reference `state` obchází staré indexy. Volání kalkulaček a importů mimo kontext čtou přímo stav.

Přímá změna dat uvnitř stejného synchronního kontextu musí před dalším čtením zavolat `invalidatePortfolioReadContext`. Kontext není určen pro asynchronní operace. Při běžné změně a následném novém vykreslení se vytvoří nový. Výběr vlastníka nadále zachovává jednoznačné silné identity, výslovně nepřiřazené importy i nejednoznačná jména. Ruční hodnoty, výpisy, NAV a čekající nákupy používají původní výpočetní pravidla.

`renderClients` v režimu detailu vynechává skrytý adresář. Klientské reporty volají `classicInvestmentItemsForClient` a `fkItemsForClient`, nikoli výpočty všech klientů. Neinvestiční smlouvy se vyřazují před hledáním investičních vazeb. Souhrny klienta se již neuchovávají v trvalé cache.

## Investiční návrh a obchodní případy

`saveInvestmentScenario(mode)` rozlišuje `forecast`, `proposal` a pokročilé přímé sjednání `signed`. Výslovná tlačítka oddělují prognózu a obchodní případy. Oba typy investic používají stejný postup. Z obchodně potvrzené aktivní varianty vzniká jeden případ na fond; jiné varianty, dosavadní portfolio ani majetek mimo správu se nezakládají jako nové obchody. Přesun do jiného fondu zakládá pouze cílový nákup; prodej původního majetku se eviduje zvlášť.

Prognóza má stabilní `syncId`, uchovává `activeVariantId` a při úpravě se aktualizuje pod původním ID. Varianty a jejich řádky mají stabilní identity; `scenarioLinkKey` na případu a obchodu spojuje prognózu, variantu a řádek. Opakovaný převod zachovává existující případ včetně stavu a ručních změn; sjednaný nebo zrušený případ neotevírá znovu. Nová prognóza automaticky nepřebírá rozpracované případy klienta. Selhání trvalého uložení vrací předchozí stav a ponechává návrh ve formuláři.

Uzavření případu přenáší ISIN, fond a pravidelný vklad. `syncSignedInvestmentPosition` vytváří samostatný snapshot `scope: purchase` se stabilním `purchaseId`, nikoli přepsaný zůstatek stávajícího fondu. Skutečné datum nákupu je prázdné; marker na obchodu brání opakovanému vytvoření. FKI synchronizace založí pozici jednou a nepřepisuje pozdější ručně zadané ocenění aktuální hodnotou celého fondu. Prognózy a vazby se zachovávají také při sloučení záloh s přemapováním klientů a číselných ID.

## Připsané a čekající investice

`investmentSettlementInfo` validuje skutečné datum nákupu a pro FKI i emise, včetně budoucích dat. Nevyužívá obchodní datum jako náhradu. `investmentPendingRows` skládá čekající řádky z existujících kolekcí, s výslovnými vazbami odstraňuje zrcadlové obchody a smlouvy. Výpočty aktivního portfolia filtrují čekající položky; samotné oceňovací funkce nadále vracejí uložené údaje pro editor a porovnání importu.

`latestInvestmentSnapshots` nejprve vybírá poslední ocenění a teprve potom rozlišuje připsání, aby starší hodnota nenahradila aktuálně čekající záznam. `coveredPurchaseIds` vznikají při zápisu celkového ocenění a určují zahrnuté samostatné nákupy téhož klienta a fondu, u souhrnu účtu téhož poskytovatele. Při čtení se zahrnutí neodhaduje pouze podle data. Pending baseline nepotvrzuje své nákupy a nezapočítává jejich vloženou částku dvakrát.

Modul `assets/js/investment-settlement-ui.js` načítaný před `crm.js` dodává klientskou záložku, panely AUM a dialog doplnění dat. Používá existující transakční editory i mazání. Samostatná kolekce čekajících záznamů se nezakládá. HTML report má nezávislý seznam čekajících částek mimo aktivní souhrny a projekce.

## Pevné pořadí dashboardu

Uživatel výslovně požaduje pořadí: denní 3 priority → týdenní 3 cíle → produkční grafy → statistiky, grafy a kontrola dat → úkoly a připomínky. Při úpravách ostatních funkcí toto pořadí neměnit. `#dashboardLayout` obsahuje právě pět stabilních bloků `data-dashboard-section="daily|weekly|charts|stats|tasks"`; pořadí HTML odpovídá pojmenovaným CSS oblastem. Grafy jsou uvnitř `#dashboardCharts`, nedokončené priority uvnitř `#dashboardTasks` a rychlé odkazy uvnitř denní karty. Renderovací funkce aktualizují obsah, nepřesouvají hlavní bloky. `tools/qa/focus-dashboard.cjs` chrání pořadí DOM i skutečné rozmístění na počítači a telefonu.

## Data

### Jednotné ocenění a sdílení NAV

`fundNavQuote(key, isin, source)` vybírá nejnovější cenu z `fundValues` napříč klíči `isin|…`, `investment-isin|…` a existujícími aliasy přesného ISIN. Nerozděluje cenu podle společnosti či oblasti. `publishFundNav` publikuje výslovnou změnu ceny a data, chrání novější datum a při změně ukládá `_navUpdatedAt`. Existujícím aliasům mění pouze cenu, datum a tento marker. Nevytváří druhý katalogový fond, nepřepisuje klientské částky ani pořizovací údaje. Bez ISIN platí jen přesná původní vazba, nikoli podobnost názvů.

`invValuation` a `investmentSnapshotValuation` vracejí hodnotu, datum a původ ocenění pro kartu, AUM, editor, report i náhled importu. Ruční hodnoty mají přednost. Ověřený výpis zůstává, dokud není dostupná novější cena; explicitní oprava společné NAV ve stejném dni se rozlišuje časem publikace a importu. Potvrzená nula se automaticky neoživuje. Historický `codyaImportDate` je datum nahrání a nemůže blokovat výpočet z CP. Importované nemanuální výnosy při přecenění nejsou výnosem nového ocenění.

Editory si uchovávají původní cenové vstupy. Uložení poznámky nepublikuje individuální výpis jako společnou cenu. Import producenta nepřidává globální kotace; řádky ostatních klientů se neprohledávají jako zdroj společné NAV. Sloučení záloh při shodném datu respektuje `_navUpdatedAt`. Nové souhrny se počítají při čtení, ne prostřednictvím destruktivního přepisování všech historických záznamů.

### Reporty producentů

`provider-import.js` obsahuje čisté parsery Avant/Codya a plánování nad předaným stavem; `provider-import-ui.js` poskytuje náhled a porovnání. Oba moduly se načítají před `crm.js`. Náhled nemutuje portfolio. Teprve explicitní commit aplikuje bezpečné položky a uloží `providerImports`; ostatní položky zůstávají `pending`. Rozhodnutí `accepted`/`kept` i stav beze změny se uchovávají. Hash zdrojového stavu, cílového záznamu a souvisejících údajů fondu chrání proti zastaralému přijetí. Selhání ukládání obnoví předchozí stav.

Avant používá normalizované RČ/IČO, ISIN, pokyn, typ transakce a směr pohybu. `investmentRecords[]._providerTransactionKey` rozlišuje i samostatné pokyny se stejným datem a částkou; při změně klíče se přemapují cílené odkupy a kontrolní vazby. `_providerClientId` omezuje vlastnictví na potvrzeného klienta. `providerValuation` uchovává datum, aktuální hodnotu, NAV a samostatnou vyplacenou částku odkupu. `_providerSource` je základ pro kontrolu pozdějších místních úprav. Převody a konverze nejsou automatické nákupy/odkupy. Codya souhrny vyžadují přesný název třídy a jedinou pozici; historické či vícenásobné pozice se nerozdělují odhadem.

Klientské kontroly jsou indexované podle vlastníka a ISIN; přehled je stránkovaný. Absence v reportu nikdy není příkaz ke smazání. Import nemění globální NAV pro ostatní klienty, obchodní produkci ani provizní evidenci. Nové kolekce a počty kontrolovaných řádků jsou zahrnuté do ochrany záloh.

### Měření práce

`assets/js/work-measurement.js` používá společný stav, formuláře a ukládání CRM; načítá se před `crm.js` a nenahrazuje jeho funkce. `activities[].duration` zůstává jedinou délkou práce. Volitelné `activities[].work` eviduje oblast, původ času (`actual`/`estimate`/`unknown`), postup, překážku, pilot a výstup. Chybějící původ času se nikdy automaticky nepovažuje za skutečnost. `null` délka je neznámá, `0` je platná výslovná hodnota.

`workPilots` obsahuje nastavení pilotu a odkazy na existující případy. `workOutputs` obsahuje kontext a stav jednotlivých výstupů; neukládá druhou kopii aktivit ani jejich minut. Čas výstupu je součtem jeho původních pracovních bloků, včetně kontroly a oprav. Porovnání vyžaduje shodný proces, dokončený výstup a úplná skutečná měření. Plánované aktivity a automatická historie jsou z pracovního času vyloučené. Pracovní metriky nemění obchodní KPI.

Aktivity mají stabilní `syncId`, piloty a výstupy stabilní řetězcová ID. Slučování záloh přemapovává klienty, případy a návazné aktivity; nevyřešené vazby se uchovají jako neověřené místo odhadu podle jména nebo shodného čísla. Nové kolekce a měření jsou součástí ochranných počtů záloh. Formuláře zachovají draft při chybě uložení a rychlý zápis předá rozepsané hodnoty do detailu.

- Prohlížeč: dosavadní klíč localStorage `filip_crm_main_v1`.
- Disk: existující pomocná služba na 127.0.0.1:48730, standardně složka FILIP-CRM-data. Data nejsou součástí Git repozitáře.
- Google: dosavadní Apps Script pro přenos zálohy mezi zařízeními; vyžaduje soukromou konfiguraci uživatele.

Diskový zápis odesílá snímek stavu. Pokud během čekání vzniknou novější změny, odpověď je nepřepíše a následuje další zápis. Nejde o řešení současné editace z více zařízení.

## Výstupy a závislosti

Klientský přehled, FKI přehled a investiční prognóza používají společné stahování HTML. Výstupy obsahují vlastní styly a lze je předat samostatně. Změna vzhledu aplikace nepřepisuje vzhled klientských reportů.

Řazení fondů v katalozích, klientských kartách a výstupech sdílí `compareFundsByCompanyName`: nejprve společnost, potom název fondu a stabilní identifikátor. `fundCompanySortName` sjednocuje známé varianty názvů pouze pro zobrazení a seskupení; identita uložených fondů se nemění. Transakce zůstávají řazené podle data. Klientská karta fondu používá nativní zavřený prvek `details` s názvem „Bližší info o fondu“. `clientOutput_xFundProfileHtml` rozlišuje klientský výstup s jediným odkazem na oficiální stránku a interní přehled poradce se všemi zdroji.

Časový test investic a FKI se počítá jednou společnou funkcí z data nákupu nebo emise a pravidla konkrétního fondu. Datum ocenění se k výpočtu nepoužívá. Pokud datum nákupu chybí, aplikace zobrazí chybějící údaj a termín neodhaduje.

Chart.js 4.5.0 a SheetJS 0.18.5 jsou uložené v assets/vendor s licencemi. Nasazení vyžaduje HTML i assets; pouhé přenesení hlavního HTML nestačí. Odkazy na hlavní CSS a JS obsahují verzi vydání.

## Údržba

Upravovat existující funkci nebo společné styly, nepřidávat další přepisovací skript na konec stránky. Při vydání změnit VERSION, VERSION_NOTE, odkazy s verzí v hlavní stránce a přesměrování index.html. Zapsat změnu do CHANGELOG.md a spustit relevantní ověření z tools/qa.
