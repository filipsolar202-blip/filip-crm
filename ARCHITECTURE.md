# Architektura hlavního CRM

Stav k verzi 2026.09.21-2. Starší ARCHITECTURE_AUDIT.md popisuje stav před tímto sjednocením.

## Jedna aplikace

FILIP-CRM.html obsahuje společnou navigaci, agendy a formuláře. Vzhled dodává assets/css/crm.css a chování assets/js/crm.js. Hlavní stránka neobsahuje dodatečné balíky, které by za běhu nahrazovaly implementace funkcí. Pojmenované aplikační funkce mají každá jedinou definici.

Společný stav `state` používají klienti, smlouvy, obchody, investice, FKI, penze, aktivity, reporty a zálohy. Jedno spuštění připraví scénáře, vykreslí rozhraní a inicializuje diskové úložiště. Po jeho načtení se sjednotí výchozí údaje fondů a zobrazení se obnoví. `renderAll` je společný vstup pro překreslení.

Investice mimo správu jsou uloženy samostatně v `externalInvestments` a prognózy v `investmentForecasts`. Výpočty AUM, produkce a provizí tyto externí položky nečtou. Prognóza si ukládá vlastní snímek spravovaných i externích pozic a návrhu, aby šla později znovu otevřít beze změny historického výstupu.

Samostatné historické HTML nástroje zůstávají zachované. Nejsou součástí běhu hlavní aplikace a nebyly tímto vydáním funkčně sloučeny ani odstraněny.

## Data

- Prohlížeč: dosavadní klíč localStorage `filip_crm_main_v1`.
- Disk: existující pomocná služba na 127.0.0.1:48730, standardně složka FILIP-CRM-data. Data nejsou součástí Git repozitáře.
- Google: dosavadní Apps Script pro přenos zálohy mezi zařízeními; vyžaduje soukromou konfiguraci uživatele.

Diskový zápis odesílá snímek stavu. Pokud během čekání vzniknou novější změny, odpověď je nepřepíše a následuje další zápis. Nejde o řešení současné editace z více zařízení.

## Výstupy a závislosti

Klientský přehled, FKI přehled a investiční prognóza používají společné stahování HTML. Výstupy obsahují vlastní styly a lze je předat samostatně. Změna vzhledu aplikace nepřepisuje vzhled klientských reportů.

Časový test investic a FKI se počítá jednou společnou funkcí z data nákupu nebo emise a pravidla konkrétního fondu. Datum ocenění se k výpočtu nepoužívá. Pokud datum nákupu chybí, aplikace zobrazí chybějící údaj a termín neodhaduje.

Chart.js 4.5.0 a SheetJS 0.18.5 jsou uložené v assets/vendor s licencemi. Nasazení vyžaduje HTML i assets; pouhé přenesení hlavního HTML nestačí. Odkazy na hlavní CSS a JS obsahují verzi vydání.

## Údržba

Upravovat existující funkci nebo společné styly, nepřidávat další přepisovací skript na konec stránky. Při vydání změnit VERSION, VERSION_NOTE, odkazy s verzí v hlavní stránce a přesměrování index.html. Zapsat změnu do CHANGELOG.md a spustit relevantní ověření z tools/qa.
