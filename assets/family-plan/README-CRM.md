# Rodinný plán vložený do FILIP CRM

Zdroj: uživatelův místní projekt `rodinny-plan`, verze 1.2.0, převzato 4. 11. 2026.

Výpočetní jádro a pravidla jsou převzaté beze změny. CRM adaptace: `src/crm-bridge.js`, větev úložiště v `src/storage.js`, vložené ovládání v `src/app.js`, `crm-embed.css` a odkaz na styl v `index.html`. Rodičovská integrace je v `../js/family-plan-crm.js`.

Každý klient má vlastní případ v `client.familyPlan`. Komunikace ověřuje zdrojové okno, origin, token, klientskou vazbu a identitu případu. Původní samostatný projekt není touto kopií aktualizovaný ani publikovaný.

Font Fustat: licence v `Fustat-OFL.txt`. Převzatá metodika a dokumentace zůstávají v `docs/`.
