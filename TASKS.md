# Úkoly a postupné delegování (2026.11.14-5)

Navigace Úkoly zobrazuje existující aktivity, nevytváří kopie. Výchozí pohled Moje; dále Asistentka a Vše, otevřené/dnes/po termínu/dokončené a hledání klienta či textu. Odpovědnost lze zvolit v tomto přehledu i u otevřeného pracovního kroku. Detaily a dokončení používají původní formulář aktivity. Případy mají rozbalovací skupiny kroků podle spouštěcí události/fáze s počty dokončení. Prohlížení budoucích kroků nemění stav ani termíny.

Asistentka je zatím plánovaná role v jednom uživatelském přehledu, nikoli nový účet nebo udělení přístupu. Přiřazení není měření skutečné práce. Časy z šablony jsou odhady; změna odpovědnosti nemění syncId, calendarLink ani datum. Kalendář zůstává Filip pracovní bez účastníků a pozvánek.

Učení je místní pravidlové: poslední ruční volba na každém jedinečném úkolu je jeden hlas. Klíčem je kategorie obchodu + klíč kroku šablony. Od pěti různých úkolů a 80 % voleb asistentky se nabízí pravidlo k výslovnému zapnutí. Vliv má pouze na budoucí vytvoření úkolů; již existující/adoptované úkoly se nemění. Ruční nastavení kroku a zákaz delegování mají přednost. Automatická volba sama netvoří další hlas. Vypnutí pravidla se uchovává v záloze a při slučování podle času změny, nedochází ke zpětnému přeřazení.

Volby jsou v activity.taskAssignment, pravidla v settings.taskDelegationRules. Žádné placené API, cloudový model, nový server ani přístup do e-mailu. Nejde o vyhodnocení kvality či způsobilosti asistentky. Ruční úkoly bez šablony lze přidělit, ale nevytvářejí obecná pravidla podle podobnosti textu.

Ověření: tools/qa/task-center.cjs, workflow-automation.cjs, calendar-sync.cjs a static.cjs. Testy používají syntetická data a zablokovanou síť, nikoli klientská data nebo živé Google API. Chrome na macOS spouštět mimo Seatbelt, viz tools/qa/runtime.cjs.

## Čekání na odpověď (2026.11.14-7)

Z Úkolů lze přes „E-mail odeslán“ vybrat klienta a případ, uložit předmět a volitelně podstatný obsah. Tím se pouze eviduje uživatelem skutečně odeslaný e-mail, nepřistupuje se do schránky. Výchozí kontrola je za 3 kalendářní dny (datum, nikoli přesných 72 hodin); lze zvolit Po–Pá nebo vlastní datum. Kontrolní aktivita vzniká ihned se stabilním ID email-reminder:<waitId> a asistentkou jako výchozí odpovědnou osobou. Již existující ruční přiřazení má přednost. Vložený obsah je v emailWait.body, neposílá se do kalendáře.

„Čekám na klienta“ nabízí odpověď, vyřešení, odklad a ukončení. Kalendářní posun mění tentýž termín čekání. Odpověď zruší otevřenou kontrolu (neoznačuje neprovedenou práci jako realizovanou); existující událost se označí ×. Návrh SMS se zpřístupní při dosažení data kontroly pouze u aktivního nevyřízeného čekání. Odklad do budoucna jej opět skryje. Ruční kopírování není odeslání; „Označit jako skutečně odeslané“ pouze zaznamená již provedené odeslání. Žádný kód neposílá SMS/e-mail ani pozvánku. Opakované uložení stejného formuláře, opakovaná synchronizace ani smazání kontroly nevytvoří další kopii.

Běh a aktualizace návrhů vyžadují otevřené CRM; synchronizace navíc platné Google přihlášení a již zapnuté automatické přidávání nových kroků do Filip pracovní. Existující událost může upozornit i při zavřeném CRM podle nastavení Google Kalendáře.


## Podklady podle typu obchodu (2026.11.14-8)

V detailu obchodního případu je sekce Podklady. U existujících případů se zapíná přes „Připravit checklist“, nové pracovní postupy ji připraví automaticky. Výchozí pracovní seznamy pro hypotéky, úvěry, život, auto, nemovitost, investice, FKI, penze a ostatní lze doplnit vlastní položkou; nepotřebné položky označit „Není potřeba“. Nejde o povinný regulatorní seznam ani rozpoznávání obsahu dokumentů.

Stavy jsou explicitní: Chybí → Vyžádáno → Přijato → Úplnost zkontrolována. První vyžádání založí jednu kontrolu asistentky za 3 kalendářní dny, první přijetí bez vyžádání dnes. Existující jednoznačná otevřená kontrola stejného případu se převezme se stejným ID, kalendářní vazbou, datem a ručním přiřazením. Více shod vyžaduje výběr vazby. Změna termínu v Úkolech či Google mění tentýž úkol. Samotné propojení uloženého souboru neoznačuje přijetí ani kontrolu; výměna již zkontrolovaného souboru vyžaduje novou kontrolu.

Až jsou všechny položky administrativně zkontrolované nebo nepotřebné, kontrola asistentky se dokončí a vznikne jeden úkol odborného posouzení pro Filipa na příští den Po–Pá. Vrácení podkladu do nevyřešeného stavu otevře stejnou administrativní kontrolu a pozastaví odborné posouzení. Po doplnění pokračuje se stejnými ID. Ručně smazané úkoly se neobnovují. Zrušení případu ruší nedokončené kontroly, nikoli historii. Podklady lze otevřít přímo z úkolu, včetně převedeného podepsaného obchodu.

Žádná klientská komunikace se neodesílá. Soubor zůstává v knihovně klienta; do kalendáře jde jen běžná úkolová událost. Synchronizace využívá stávající Filip pracovní a vyžaduje otevřené CRM, platné přihlášení Google a zapnuté přidávání nových kroků. Nevzniká nová placená služba. Časy jsou pracovní předpoklady a termíny lze upravit.

Ověření: document-checklist.cjs (návaznosti, obnova/sloučení, převod do obchodu, UI), calendar-sync.cjs (napodobené Google API: oba směry, posun termínu, dokončení/pozastavení a deduplikace), workflow-automation.cjs, task-center.cjs a static.cjs. Testy nepoužívají skutečné klienty ani skutečné Google požadavky.
