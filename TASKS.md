# Úkoly a postupné delegování (2026.11.14-4)

Navigace Úkoly zobrazuje existující aktivity, nevytváří kopie. Výchozí pohled Moje; dále Asistentka a Vše, otevřené/dnes/po termínu/dokončené a hledání klienta či textu. Odpovědnost lze zvolit v tomto přehledu i u otevřeného pracovního kroku. Detaily a dokončení používají původní formulář aktivity. Případy mají rozbalovací skupiny kroků podle spouštěcí události/fáze s počty dokončení. Prohlížení budoucích kroků nemění stav ani termíny.

Asistentka je zatím plánovaná role v jednom uživatelském přehledu, nikoli nový účet nebo udělení přístupu. Přiřazení není měření skutečné práce. Časy z šablony jsou odhady; změna odpovědnosti nemění syncId, calendarLink ani datum. Kalendář zůstává Filip pracovní bez účastníků a pozvánek.

Učení je místní pravidlové: poslední ruční volba na každém jedinečném úkolu je jeden hlas. Klíčem je kategorie obchodu + klíč kroku šablony. Od pěti různých úkolů a 80 % voleb asistentky se nabízí pravidlo k výslovnému zapnutí. Vliv má pouze na budoucí vytvoření úkolů; již existující/adoptované úkoly se nemění. Ruční nastavení kroku a zákaz delegování mají přednost. Automatická volba sama netvoří další hlas. Vypnutí pravidla se uchovává v záloze a při slučování podle času změny, nedochází ke zpětnému přeřazení.

Volby jsou v activity.taskAssignment, pravidla v settings.taskDelegationRules. Žádné placené API, cloudový model, nový server ani přístup do e-mailu. Nejde o vyhodnocení kvality či způsobilosti asistentky. Ruční úkoly bez šablony lze přidělit, ale nevytvářejí obecná pravidla podle podobnosti textu.

Ověření: tools/qa/task-center.cjs, workflow-automation.cjs, calendar-sync.cjs a static.cjs. Testy používají syntetická data a zablokovanou síť, nikoli klientská data nebo živé Google API. Chrome na macOS spouštět mimo Seatbelt, viz tools/qa/runtime.cjs.
