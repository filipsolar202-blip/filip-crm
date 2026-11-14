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


## Čas a delegování (2026.11.14-9)

Úkoly → Čas a delegování a detail případu → Čas obchodu nabízejí souhrn podle obchodu a konkrétní otevřené úkoly k předání. Nové obchody využívají současný automatický postup; otevřené, budoucí podmíněné, pozastavené a dokončené kroky se zobrazují odděleně. Souhrn všech typů zahrnuje i nepřiřazené úkoly, v samostatné skupině bez domýšlení vazby podle klienta. Staré obchody bez postupu nemají zpětně vymyšlené vykonané kroky.

Zbývá tobě = samostatný odhad tvých otevřených úkolů + tvá kontrola otevřených úkolů přidělených asistentce. Naplánováno asistentce = její vlastní odhady těchto úkolů. Ještě můžeš uvolnit = součet kladných rozdílů samostatného času a kontroly u otevřených, zatím nepředaných delegovatelných úkolů. Dokončené, pozastavené, budoucí, zrušené či neuskutečněné kroky nejsou aktuálním potenciálem k předání. Skutečný čas vyžaduje explicitní work.timeKind=actual a dokončený záznam; potvrzená nula je platná. Běžná délka události ani přidělení asistentce nejsou dokladem skutečně odpracovaného času nebo realizované úspory.

Odhady vycházejí z verzovaných šablon. Kontrola podkladů a odpovědi má výchozí 10 min samostatně / 10 min asistentka / 2 min kontrola, odborné posouzení podkladů 30 min a nedelegovatelné. Ruční Telefon 10, Schůzka 60, Email 10, SMS 5 a Úkol 15 min jsou pouze výchozí odhady s neposouzeným delegováním. Explicitní odhad v evidenci práce má přednost před výchozím časem; úprava v novém přehledu se ukládá jako workEstimate a synchronizuje s vlastním krokem šablony. U neznámých dat se zobrazuje chybějící odhad, ne falešná naměřená nula.

Dokončený odhad je uložen v capacitySnapshot; znovu otevřený úkol přesune snímek do capacityEstimateHistory. Úprava budoucích šablon nepřepíše historický odhad. Při převodu do podepsaného obchodu udržuje workFlowId vazbu i u ručních aktivit. Jedno ID aktivity se počítá jednou. Náhled nemění kalendář; předání mění vlastníka téhož úkolu a zachovává jeho ID a termín. Odborné posouzení nelze přidělit asistentce.

Odhady lze upravit po úkolech nebo v existujícím editoru šablon pro budoucí případy. Skutečné minuty se zadávají přes stávající detail aktivity → měření práce. Přehled skutečnosti je celkový, protože stávající měření neukládá spolehlivě skutečného vykonavatele. Bez nové služby, API nebo poplatku.

Ověřeno: work-capacity.cjs, work-measurement.cjs, work-measurement-storage.cjs, workflow-automation.cjs, task-center.cjs, document-checklist.cjs, calendar-sync.cjs a static.cjs; pouze izolovaná testovací data.

2026.11.14-10: Přehled skutečnosti zahrnuje také explicitně změřené historické záznamy včetně práce na neúspěšném hovoru. Prostý historický záznam bez měření zůstává vyloučený.

## Plánování, servis, podklady a produktové návaznosti (2026.11.14-11)

Úkoly → Plánování a servis. Návrh jednoho týdne respektuje 120 minut denně, tři existující prioritní sloty, kalendář Filip pracovní a naplánované CRM události. Používá otevřené úkoly Filipa s odhadem, ne asistentčiny, pozastavené či Davidovy. Bez platného Google přihlášení návrh nelze použít. Před použitím se znovu načte kalendář a přepočte návrh; změna vyžaduje nový náhled. Použití mění původní aktivitu, drží syncId/calendarLink, původní deadline uchová jako planningDeadline. Přidá pouze volné denní priority. Nezařazené úkoly a důvod zůstanou v náhledu. Pracovní okno 9–17 h; dnešní minulost se nenabízí. Rozvrhová délka calendarDuration je oddělená od evidované duration, aby obousměrná změna plánovaného bloku nepřepsala naměřené minuty.

Součástí kontroly týdne je přehled odeslaných podkladů/nabídek, dotazníků, přijatých odpovědí, nezkontrolovaných podkladů a čekání na e-mail. Neodvozuje odpověď ze stáří záznamu a nepovažuje odeslání za dokončení. Kontroly bez jednoznačné vazby nevytváří hromadně.

Servis: 90denní horizont; auto/majetek využívají stávající servisní rytmus, hypotéka evidovaný konec fixace. Další produkty mají ručně ověřený servisní termín na smlouvě. Pracovní předstih 60/90 dnů není právní lhůta. Uživatel zakládá jednotlivé kontroly z náhledu. Známý existující úkol se použije, odeslaný dotazník směřuje na existující návaznost, více shod brání nové kopii. Administrativní příprava patří asistentce; její skutečné dokončení založí právě jednu odbornou kontrolu Filipovi. Znovuotevření předchůdce odbornou kontrolu pozastaví. Odebraný úkol se automaticky nevytváří znovu. Vazby jsou součástí zálohy a mapují se při importu podle ID.

Podklady a doporučení: lokální souhrn konkrétního klienta s odkazy na zdrojová ID smluv, případů a dokumentů; explicitně označené potřebné ověření. Nenahrazuje finanční plán, nerozpočítává neznámé částky, nenavrhuje produkty. Otevírá existující Majetek a plán, který má vlastní předvyplnění, historii a schvalování změn. U podepsaného obchodu lze připravit jeden úkol asistentce s návrhem žádosti o doporučení ke schválení. Žádný mail/SMS se neodesílá.

Detail případu → Podrobný produktový postup. Náhled a zapnutí po jednom případu, bez migrace celého kmene. Hypotéky/úvěry: příjmy, zástava, schválené podmínky, čerpání. Život: zdravotní dotazník, předoocenění, výluky a souhlas. Investice/FKI/penze: profil, rizika/náklady, potvrzení připsání. Auto/majetek: rozsah krytí a údaje smlouvy. Společná administrativa po podpisu: podepsané dokumenty, první platba, předání a servis. Nové závislosti jsou uložené ve verzované specifikaci kroků; další termín se odvíjí od skutečného dokončení předchůdce. Cykly a neexistující předchůdci se odmítají. Zrušení není splnění. Odborné kroky jsou nedelegovatelné. Stávající ID, termíny, historie a ruční přiřazení zůstanou zachované. Samotný náhled nezmění fázi ani data. Jde o pracovní šablony k doladění, ne závazné úplné produktové postupy.

Bez nové placené služby. Kalendář nadále používá stávající synchronizaci při otevřeném CRM a platném přihlášení; případný konflikt se řeší ve stávajícím náhledu. Nové funkce nespouštějí samostatný plánovač na pozadí.
