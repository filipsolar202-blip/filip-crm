# Životní pojištění na kartě klienta

Verze 2026.11.03-1. Dodaná kalkulačka i vzhled reportu zůstávají zachované. Výpočty pojistných částek, důchodové předpoklady, produktový katalog a ratingy nebyly touto integrací změněné ani aktualizované.

## Kalkulace

Otevři **Klienti → konkrétní klient → Život** vedle záložky Majetek a plán. Při prvním otevření se doplní známé jméno, platné rodné číslo, datum narození a pohlaví. Neznámé údaje zůstávají prázdné. Příjmy, zdravotní odpovědi a složení domácnosti se neodhadují z investic nebo jiných nesouvisejících údajů.

Změny se průběžně ukládají do stejného CRM jako klientská data. Při návratu se obnoví vyplněné údaje, nabídky, krytí i poslední krok průvodce. **Uložit ke klientovi** vyvolá uložení znovu; stav je vidět u kalkulačky. Při neúspěchu nezavírej stránku a použij také **Stáhnout kalkulaci**. **Doplnit známé údaje** doplní pouze prázdné identifikační údaje a nepřepíše ruční hodnoty.

Report vytvoříš původním postupem přes **Export → Tisk / Uložit jako PDF**. Samotnou kalkulaci lze stáhnout jako JSON.

## Vybraná nabídka do obchodního případu

1. V kroku **Nabídky** vyber produkt, doplň měsíční pojistné a označ vybranou variantu jako doporučenou.
2. Stiskni **Vybranou variantu → obchodní případ**.
3. Zkontroluj náhled a otevři předvyplněný případ.
4. Potvrď jeho uložení. Kategorie je Život, nový stav Nabídka, částka představuje **měsíční pojistné**. BJ se nedopočítávají ani se neoznačuje podpis.

Opakovaný převod stejné varianty otevře její existující případ. Aktualizaci jeho údajů z kalkulačky potvrzuješ uložením formuláře. Jiná varianta může mít vlastní případ. Po dokončení obchodu se stejná varianta podruhé nezakládá. Pro další sjednání použij **Historie kalkulací → Založit novou kalkulaci**. Potvrdíš nový prázdný výpočet se známou identitou; původní kompletní kalkulace zůstane v historii. V případě zůstává snímek výpočtu a volby; pozdější úprava kalkulačky jej sama nepřepíše. Z detailu případu se tlačítkem **Kalkulace Život** vrátíš ke klientovi. Při převodu případu do obchodu se snímek zachová.

## Dotazníky FairLife a Mantra

**Dotazník pro klienta** předvolí značku podle správce:

- Filip Solár / vlastní správa → FairLife, `f.solar@fair-life.cz`.
- Martin Čermák / Mantra → Mantra, `filip.solar@mantra-finance.cz`. Dotazník uvádí Martina jako poradce a Filipa jako příjemce odpovědí.

Značku můžeš před stažením změnit. Volitelně předvyplň pouze známé identifikační údaje. Dotazník neobsahuje interní poznámky, zdravotní informace ani nabídky z rozpracované kalkulace. Obsahuje nenápadnou trvalou vazbu na správnou kalkulaci, nikoli veřejný odkaz na klientská data.

Stáhni HTML a odešli klientovi jako přílohu. Nic se samo neodesílá. Klient soubor otevře v prohlížeči, vyplní a přes **Stáhnout odpovědi pro poradce** uloží `zivot-odpovedi.json`. Tento soubor přiloží do e-mailu na uvedenou adresu. Pokud jeho pošta HTML blokuje, je třeba použít jiný dohodnutý způsob předání souboru.

Vrácený JSON načti u příslušného klienta přes **Načíst odpovědi / kalkulaci**. Nejprve se zobrazí náhled; změnu potvrzuješ. Dotazník svázaný s jiným klientem nebo s odlišným známým rodným číslem se odmítne. Starší nepřiřazené soubory vyžadují odpovídající jméno. Jména a souhrn zkontroluj i při správné vazbě.

**Klientské odpovědi zachovají rozpracované nabídky, ceny a existující krytí.** Osobní údaje a rozpočet se převezmou; při změně domácnosti může zmizet krytí odebraných osob. Doporučení podle nových údajů zkontroluj a případné převzetí nových částek do nabídek potvrď původním tlačítkem kalkulačky. Import celé poradenské kalkulace naopak nahradí i nabídky. Obojí předem zachová původní stav v historii. Samotná karta klienta, AUM a obchodní případy se importem odpovědí nemění.

## Historie a zálohy

**Historie kalkulací** obsahuje snímky před importem, obnovou a převodem do případu, také zachované verze při sloučení klientů/záloh. Obnovení vyžaduje potvrzení a původní aktuální stav se opět zachová. Automatické psaní ukládá aktuální rozepsaný stav; nevytváří nový historický snímek po každém písmenu.

Kalkulace a historie jsou součástí běžné JSON, diskové a Google zálohy CRM. Před změnou byla vytvořena kopie dat `/private/tmp/filip-crm-before-life-2026-11-03.json` a kódu `/private/tmp/filip-crm-before-life-2026-11-03.tar`. Pro návrat nejprve exportuj aktuální CRM, aby zůstala zachovaná novější práce. Předchozí vydání 2026.10.31-1 je commit `0a14443e70b4c7e3bc48ca79c003dd9640d3e9bf`; vrácení vydání nemá automaticky vracet starší klientská data.
