# Návaznosti obchodů v FILIP CRM

Verze 2026.10.31-1. Automatizace používají běžné aktivity CRM. Nemusíte měřit minuty ani znovu zapisovat obchod.

## První nový případ

1. Založte obchodní případ obvyklým způsobem: klient, typ, produkt a fáze. Uložte jej.
2. Otevřete detail. **Pracovní postup** ukáže první úkol, další kroky a odhad času. Neprovedené kroky nejsou vykázané jako hotové.
3. Po skutečném vyžádání podkladů nebo odeslání nabídky stiskněte odpovídající tlačítko a potvrďte datum. CRM naplánuje kontrolu nebo následný kontakt.
4. **Další kontakt** naplánuje běžnou aktivitu. Bez zadaného času jde o úkol na den, nikoliv hodinovou rezervaci. Čas lze doplnit v úpravě kroku / aktivity.
5. Podpis proveďte stávajícím převodem do obchodu. Návaznosti a historie přejdou s ním; otevřou se následné kontrolní kroky. Najdete je také na kartě klienta v **Návaznosti a čekání na klienta**.

U staršího případu nejdříve zvolte **Náhled a zapnutí postupu**. Zkontrolujte kroky a potvrďte použití pouze pro tento případ. Nic se hromadně nezapíná. Minulé odeslané nabídky, schůzky a odvedená práce se nevymýšlejí zpětně.

## E-mail a SMS

Na kartě klienta rozbalte **Návaznosti a čekání na klienta**, případně použijte akci přímo v případu:

1. **E-mail odeslán – čekám na odpověď**: vyberte konkrétní případ, skutečný den odeslání a stručný účel. Volitelně uložte ID či odkaz vlákna.
2. Výchozí kontrola je za tři kalendářní dny. Lze přepnout na pracovní dny (pondělí–pátek, bez kalendáře svátků) nebo zadat vlastní datum.
3. V termínu CRM zobrazí „Odpověď není zaznamenaná“, jednu připomínku a bezpečný obecný návrh SMS. Nečte schránku a netvrdí, že klient určitě neodpověděl.
4. Text SMS upravte. **Kopírovat** pouze kopíruje; odešlete ji sami. Až poté stiskněte **Označit jako skutečně odeslané**. Kontakt se uloží a CRM nabídne naplánovat další kontrolu.
5. **Klient odpověděl**, **Vyřešeno jinak** nebo **Už nepřipomínat** ukončí čekání a neodeslaný návrh. Dříve odeslané zprávy zůstanou v historii. **Odložit** změní termín stávající kontroly.

Stejné aktivní vlákno ve stejném případu nevytváří další čekání. Bez ID vlákna se používá datum odeslání a účel; pro dvě odlišné zprávy se stejným předmětem a datem doplňte odlišné ID. Různé případy stejného klienta jsou oddělené. Bez vybraného případu je čekání pouze u klienta a vazba je označená k doplnění.

## Šablony, časy a delegování

**Šablony** otevřete v případu nebo na **Dashboardu → Úkoly a připomínky → Návaznosti obchodů**. Vyberte typ a načtěte šablonu. Každý krok lze rozbalit, změnit, přidat nebo odebrat. Ukládá se nová verze.

Nastavíte spouštěcí událost, podmínku, odstup ve dnech, vykonavatele, delegovatelnost, můj čas samostatně, čas asistentky a můj zbývající čas po delegování. Volitelně určíte událost spolehlivě potvrzující dokončení nebo nahrazení. Pracovní předpoklady a lhůty jsou upravitelné interní odhady, nikoliv zákonné či produktové termíny. Výchozí šablony nepředpokládají konkrétní dostupnost asistentky.

Změna šablony ovlivní nové případy. U existujícího zvolte **Nová verze šablony – náhled** a potvrďte pouze zbývající práci. Dokončené odhady a ruční výjimky zůstanou zachované. **Upravit** u kroku mění jen daný případ; ručně změněný text či termín se dalším přepočtem nepřepíše. Pokud se datum dalšího kontaktu a ručně upravený termín kroku liší, rozhoduje ručně upravený krok; sjednoťte jej jeho úpravou.

Příklad: 30 minut samostatně, 35 minut asistentky a 5 minut mé kontroly znamená potenciální úsporu 25 minut mého času. Zvolený vykonavatel se eviduje zvlášť od možnosti delegovat. Zrušené a neuskutečněné kroky nejsou vykázané jako hotová práce. Přesunutá aktivita není dokončená práce. Výchozí odhad zahrnuje i podmíněné budoucí kroky; nejde o slíbenou skutečnou dobu.

## Kde najdete přehled

- **Detail případu:** nejbližší naplánované kroky, čekání, rozbalovací celý postup, odhad času a historie.
- **Klient → Návaznosti a čekání na klienta:** i dokončené obchody a jejich následné kontroly.
- **Dashboard → Úkoly a připomínky → Návaznosti obchodů:** dnes, čekání, SMS a po termínu. Původní pořadí dashboardu zůstává.
- **Analýza → Pracnost obchodů – odhady:** celý očekávaný čas, potvrzené dokončené kroky, zbývající práce, potenciální a zvolené delegování. Rozpad podle typu i konkrétního případu; kliknutím na součet otevřete zdrojové kroky. Přehled zahrnuje všechny případy s postupem, není filtrován existujícím měsíčním filtrem aktivit.

U postupu lze použít **Pozastavit** nebo **Vypnout automatizaci**, u kroku **Vypnout krok**. Ruční úkoly se změnami fáze nemažou. Při zrušení případu se ukončí nepotřebné automatické kroky a čekání; historie zůstává. Znovuotevření vytvoří nový potřebný krok, neopíše staré dokončení. Opakované odeslání nabídky nevytvoří souběžný druhý otevřený úkol stejného kroku; po uzavření předchozího může vzniknout další cyklus.

## Provoz a omezení

Připomínky se dopočítají při otevření a uložení CRM, změně dne a návratu do okna. Zavřené místní CRM neposílá oznámení na pozadí. Není přidaný cloudový server, automatické odesílání SMS ani nové propojení schránky. Skutečnou odpověď označujete sami. Pracovní dny nezahrnují evidenci svátků. Pro existující případy se neprovádí hromadná migrace.

Ověření zahrnuje vytvoření případu, fáze, podklady/nabídku, kontakt, čekání, SMS, odpověď, opakované spuštění, ruční změny, pozastavení/zrušení/znovuotevření, podpis, oddělení případů, výpočty delegování, pražské datum a DST, neúspěšné uložení, JSON/sloučení/obnovení, diskové zálohy a protokol Google na umělých datech. Žádné zkušební zprávy nebyly odeslané klientům. Vzhled se ověřuje na počítači a telefonu. Skutečný Google účet ani schránka nejsou součástí testu.

## Nasazení a návrat

Po nasazení zavřete uložené formuláře a obnovte CRM. Dole musí být **v2026.10.31-1**. Stávající data se zachovají; první nové případy už dostanou postup automaticky.

Před vývojem byla vytvořena kopie zdrojů `/private/tmp/filip-crm-before-automation-2026-10-31.tar` a dat `/private/tmp/filip-crm-data-before-automation-2026-10-31.json`. Kopii dat chraňte jako běžnou klientskou zálohu. Před návratem nejprve exportujte i aktuální stav přes **Záloha**, abyste nepřišli o novější práci.

Předchozí vydání je **2026.10.29-4**, commit `b8d8c926eb624ca1ee6898008be78be3769573da`. Technický návrat: vrátit nasazovací commit této změny pomocí `git revert` a odeslat na GitHub Pages. Vrácení kódu samo nevrací klientská data. Úplná obnova předchozích dat má smysl pouze po kontrole novějších záznamů; jinak by se ztratila práce od zálohy. Metadata automatizací může starší aplikace ignorovat, běžné vytvořené aktivity však zůstávají aktivitami.
