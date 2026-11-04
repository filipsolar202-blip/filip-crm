# Dva klientské plány Fair Life

Aktualizace 20. 10. 2026. Podkladem pro uspořádání byly uživatelem dodaný přepis webináře a screenshoty ukázkových dokumentů. Veřejný repozitář neobsahuje přepis, screenshoty ani skutečné klientské údaje. Texty jsou vlastní adaptace; nejde o kopii původního PDF ani automatické právní stanovisko.

## Co výstupy obsahují

| Ukázka z webináře | Provedení v aplikaci |
| --- | --- |
| Přehled finančního, nemovitého a dalšího majetku | Kategorie, nabytí, vlastníci, hodnoty, oddělené závazky |
| SJM a výlučný majetek každého partnera | Souhrn podílů osob zahrnutých v plánu; cizí podíly se nesčítají |
| Dědická struktura obou partnerů | Dva nezávislé zákonné scénáře, relevantní vazby, podíly a vlastní majetek |
| Možnosti změny rozdělení | Povinné díly, přehled právních nástrojů a otázky pro notáře |
| Kontakty, pojistky a smlouvy domácnosti | Opakovatelné záznamy v aplikaci i dotazníku |
| Pět krizových situací | Škoda na majetku, nemoc/úraz, trvalé následky, invalidita, úmrtí |
| Státní a soukromé zabezpečení | Obecné podmínky, individuální částka se zdrojem, datem a stavem odhad/potvrzeno |
| Rychle dostupné peníze | Rozpočtový schodek, rezerva, očekávané plnění, podmínky přístupu |
| Praktické návody | Kroky, odkazy a vložené QR kódy veřejných institucí |
| Kontakty a disclaimer | Fair Life, Filip Solár a uživatelem potvrzené kontakty |

## Důležité odlišnosti od slovního výkladu

- Úmrtí majitele neznamená automatické zablokování všech operací na účtu. Přístup záleží na oprávnění a nastavení s bankou. Disponent není automaticky vlastníkem peněz.
- Částky státních dávek se bez individuálních vstupů nedopočítávají. Poradce zadává podklad a rozlišuje odhad od potvrzeného nároku; prázdné pole není nula.
- Pojistné plnění není garantováno samotným uvedením smlouvy.
- Plný dědický dokument výslovně modeluje zákonnou posloupnost. Existující závěť eviduje, ale automaticky neinterpretuje. D/E varianty lze ukázat v krátké prezentaci; nepředstavují hotové právní dokumenty.
- Zahraniční vazba neblokuje podmíněný český model. Je uvedena v rozsahu výstupu.

Veřejné zdroje a odkazy jsou v `src/plan-content.js`: ČNB, ČSSZ, MPSV, Notářská komora, Portál veřejné správy a Policie ČR. Kontrola zdrojů není právní certifikace.

## Ověření a reprodukce

`node --test tests/*.test.js` ověřuje výpočty, import, zpětnou kompatibilitu, escapování a generování dokumentů. `node scripts/build.mjs` sestaví i samostatný dotazník bez síťových závislostí.

`node scripts/sample-plans.mjs` vytváří dva smyšlené výstupy a zátěžové varianty (osm dětí, dlouhé poznámky a dvacet kontaktů) v ignorované složce `output/pdf`. Výstupy ani testovací podklady se nenasazují na Pages. Skutečná klientská data zůstávají v místním úložišti nebo uživatelem exportovaném souboru.

Vizuální kontrola vzorů: A4 na výšku, měřítko 100 %, bez záhlaví a zápatí prohlížeče. Ověřeny všechny stránky obou ukázkových PDF. Pro vlastní mimořádně dlouhé názvy a poznámky před předáním zkontrolujte náhled tisku.
