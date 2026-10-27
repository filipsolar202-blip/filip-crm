# Architektura hlavního CRM

Stav k verzi 2026.10.27-2. Starší ARCHITECTURE_AUDIT.md popisuje stav před sjednocením aplikační logiky.

## Jedna aplikace

FILIP-CRM.html obsahuje společnou navigaci, agendy a formuláře. Vzhled dodává assets/css/crm.css a chování assets/js/crm.js. Hlavní stránka neobsahuje dodatečné balíky, které by za běhu nahrazovaly implementace funkcí. Pojmenované aplikační funkce mají každá jedinou definici.

Společný stav `state` používají klienti, smlouvy, obchody, investice, FKI, penze, aktivity, reporty a zálohy. Jedno spuštění připraví scénáře, vykreslí rozhraní a inicializuje diskové úložiště. Po jeho načtení se sjednotí výchozí údaje fondů a zobrazení se obnoví. `renderAll` je společný vstup pro překreslení.

Pojistné události používají kolekci `state.insuranceClaims`. Modul `assets/js/insurance-claims.js` dodává vlastní přehled, obsah klientské záložky a dialog; načítá se před `crm.js`, nemění existující funkce a používá společné `persist`, `uid` a navigaci. Normalizace, slučování záloh, vazby na klienta/smlouvu a ochranné počty zůstávají v `crm.js`. Událost má stabilní `syncId`, datovanou historii a přílohy. Sloučení importu používá mapování identity klienta a smlouvy, nikoli shodu číselných ID napříč zálohami. Neúplné importované vazby zůstávají k ručnímu doplnění. Události ani jejich vyplacené částky nevstupují do produkce nebo AUM.

Investice mimo správu jsou uloženy samostatně v `externalInvestments` a prognózy v `investmentForecasts`. Výpočty AUM, produkce a provizí tyto externí položky nečtou. Prognóza si ukládá vlastní snímek spravovaných i externích pozic a návrhu, aby šla později znovu otevřít beze změny historického výstupu.

Samostatné historické HTML nástroje zůstávají zachované. Nejsou součástí běhu hlavní aplikace a nebyly tímto vydáním funkčně sloučeny ani odstraněny.

## Pevné pořadí dashboardu

Uživatel výslovně požaduje pořadí: denní 3 priority → týdenní 3 cíle → produkční grafy → statistiky, grafy a kontrola dat → úkoly a připomínky. Při úpravách ostatních funkcí toto pořadí neměnit. `#dashboardLayout` obsahuje právě pět stabilních bloků `data-dashboard-section="daily|weekly|charts|stats|tasks"`; pořadí HTML odpovídá pojmenovaným CSS oblastem. Grafy jsou uvnitř `#dashboardCharts`, nedokončené priority uvnitř `#dashboardTasks` a rychlé odkazy uvnitř denní karty. Renderovací funkce aktualizují obsah, nepřesouvají hlavní bloky. `tools/qa/focus-dashboard.cjs` chrání pořadí DOM i skutečné rozmístění na počítači a telefonu.

## Data

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
