[PROCES.md](https://github.com/user-attachments/files/30384156/PROCES.md)
# FILIP CRM - proces stavby

## Cil
Postavit jeden samostatny CRM system nad klienty, smlouvami, obchody, doporucenimi a aktivitami. Stare HTML nastroje zustavaji jako zaloha a zdroj logiky.

## Soubor
- Hlavni aplikace: `FILIP-CRM.html`
- Ulozeni dat: lokalni prohlizec + jedna spolecna Google zaloha
- Klientske vystupy: samostatne HTML soubory podle konkretni kalkulacky/reportu

## Faze 1 - hotovy zaklad
- Klienti
- Detail klienta ve stylu CRM karty
- Smlouvy prirazene ke klientum
- Obchody prirazene ke klientum
- Aktivity a historie klienta
- Poznamky jako samostatna vyhledavaci agenda podle temat, klientu a textu
- Prilezitosti jako predobchodni agenda se stavy: Oportunita, Cekam na podklady, Ve schvalovani, Schvaleno, Podepsano, Zamitnuto
- Dashboard
- Google zaloha celeho CRM
- Migrace ze starych lokalnich dat, pokud je prohlizec uvidi
- Bezpecny nahled Google zalohy pred prevzetim do lokalniho CRM
- Kontrola duplicit klientu a cisel smluv s rychlou opravou z dashboardu. U klientu musi byt moznost skupinu sloucit, vybrat hlavni kartu, vybrat spravne kontaktni udaje a presunout smlouvy, obchody, prilezitosti, poznamky i aktivity pod jednoho klienta. Rodne cislo / ICO je nejsilnejsi identifikator.
- Obchody zobrazene podle mesicu stejne jako v puvodni aplikaci
- Schuzka u klienta otevre predvyplnenou udalost v Google Kalendari
- Obchod slouzi jako hlavni vstup: pri ulozeni umi rovnou zalozit nebo aktualizovat navazanou smlouvu u klienta
- Podepsana prilezitost se automaticky prepise do obchodu a podle nastaveni i do smluv klienta
- Rocni plan je jedna spolecna karta: rok, koeficient, novi klienti, investice objem vcetne FKI, hypoteky objem, zivot BJ, nezivot BJ, uvery BJ a penze BJ.
- Dashboard sleduje dve rady metrik: BJ letos, BJ aktualni mesic, obrat aktualni mesic, obrat/provizi letos, investice letos vcetne FKI, hypoteky letos, ocekavanou provizi a pocet obchodu letos. Graf investic ukazuje jen investice celkem a hypoteky.
- Obchody zustavaji podle mesicu. Tabulka ma klienta, kategorii, spolecnost, produkt, datum, objem, BJ, obrat, zaplacenost provize, skutecnou provizi a typare. Typare a doporuceni klientu pocitat pod hlavni tabulkou.
- Klient ma mit evidovany zdroj: volny/vlastni klient, typař nebo doporuceni. U typare se uklada jmeno a domluvene procento z obratu obchodu. Pri zalozeni obchodu se typar/doporucitel predvyplni podle klienta. Typar je placeny zdroj, doporuceni je evidencni zdroj bez automaticke provize.
- Klient muze byt sam oznaceny jako typař nebo jako clovek, ktery dava doporuceni. U typare se na karte klienta uklada domluvene procento provize. Obchody, kde je tento clovek zadan jako typař, si toto procento vezmou automaticky a skutecna provize v obchodech se zobrazuje uz po odecteni vyplaty typare.
- Samostatna zalozka Typaři ukazuje zdroje klientu, typare, doporuceni, domluvene procento, castky k vyplate, vyplaceno/nevyplaceno a navazani na obchody.
- V karte klienta je samostatna zalozka Doporuceni. Ukazuje, koho klient doporucil nebo natypoval, a u kazdeho cloveka pocita obchody, BJ, obrat, investice a hypoteky. Z karty klienta jde rovnou zalozit doporuceni nebo tip na existujiciho i noveho klienta.
- Zalozka Typari je rozdelena na dve siroke tabulky pod sebou: Tabulka typaru a Tabulka doporuceni. Vyhledavani zustava spolecne.
- Poznamky maji byt jako jednoducha tabulka ve stylu Notion: nazev, datum, klient/tema, stitky a typ. Vyhledavani nesmi prohledavat samotny text poznamky, jen metadata.
- Smlouvy maji zustat rozdelene podle puvodnich agend: Auta + majetek, Zivotni, Hypoteky a Uvery. Klientsky radek je standardne zavreny a detaily smluv se rozbaluji az kliknutim.
- Smlouvy se radi podle priority: urgentni a horsi sazby nahoru, potom aktivne resene veci, potom blizici se vyroci/fixace a nakonec veci v poradku. Barevne odliseni je na cele karte klienta i na radku smlouvy.
- Poradi hlavnich zalozek: Dashboard, Klienti, Prilezitosti, Smlouvy, Obchody, Typari, Investice, FKI, Poznamky, Rocni plan, Google zaloha.
- FKI je samostatna zalozka a ma zachovat puvodni logiku z `investment-crm.html`. Bezna zalozka Investice nesmi michat FKI dohromady.
- Poznamky maji mit samostatny velky cteci nahled a velky editor textu. V seznamu zustava jen metadata, uvnitr otevrene poznamky muze byt hledani v textu.
- Jakmile je prilezitost oznacena jako Podepsano, automaticky se propise do obchodu a smluv a zmizi ze seznamu otevrenych prilezitosti.
- Aktivni stavy smluv jako V reseni, Domluvena schuzka, Odeslana nabidka, Cekam na nabidku, Cekam na podklady, Email, Telefon, WhatsApp se automaticky zobrazuji i jako otevrene prilezitosti. Nezaklada se tim duplicitni obchod, je to pracovni pohled nad smlouvou.
- V karte klienta je tlacitko Report pro klienta. Report se stahuje jako samostatne HTML a uzivatel si muze zaskrtnout jen casti, ktere chce klientovi poslat: souhrn, smlouvy, veci v reseni, obchody, investice, FKI a poznamky.
- V prilezitostech jde stav menit primo v hlavni tabulce. U radku ze smlouvy se tim meni jen CRM/pipeline stav prilezitosti, ne puvodni smluvni stav jako Odeslana vypoved nebo Email.
- V karte klienta jsou prilezitosti zobrazene jako produktove slozky: Zivot, Auto, Nemovitost, Hypoteka, Uvery, Penze, Investice, FKI, Ostatni a vlastni oblasti. Poznamka k reseni zustava primo u konkretni prilezitosti. Rychle stitky v prehledu/X-sell panelu jsou klikatelne a preskoci do portfolia na danou oblast.
- Zprava smlouvy je velky pracovni editor. Enter vlozi novy datovany zaznam, Shift+Enter udela jen obycejny novy radek. Ke smlouve lze pripojit mensi obrazky nebo PDF, ktere se ukladaji primo ke smlouve v lokalnich datech a Google zaloze.
- Historie klienta obsahuje prvni bezpecnou fazi Apple Mail napojeni. CRM nestahuje ani neuklada e-maily, jen zkopiruje hledani podle e-mailu klienta, dalsich e-mailu klienta, jmena a cisel smluv. V nastaveni se ukladaji poradenske e-maily jen jako orientacni seznam pro praci s historii. Nepouzivat prazdny `message://` odkaz, Apple Mail ho odmita chybou 1030.
- Psaní e-mailu klientovi jde pres vychozi e-mailovou aplikaci v macOS, typicky Apple Mail.
- Aktivita u klienta ma vetsi editor. Enter vlozi novy datovany zaznam, Shift+Enter udela obycejny novy radek.
- Rodne cislo / ICO je globalni spojovaci klic celeho CRM. Kdyz se stejna hodnota objevi u klienta, smlouvy, investice nebo FKI, ma se vse automaticky pripojit k jedne klientské karte. Pokud se jmeno v FKI lisi od jmena v CRM, CRM zachova puvodni jmeno jako alias a pouzije hlavni jmeno z karty klienta.
- Hlavni CRM umi nacist lokalni FKI evidenci ze stejneho prohlizece (`crm3`) a sparovat ji podle RČ/ICO. Pri ulozeni klienta se tato vazba znovu zkontroluje, aby nově zalozeny klient hned videl sve FKI produkty.

## Faze 2 - doplneni dalsich modulu
- Doporuceni jako samostatna agenda napojena na klienta
- Rozsireni poznamek o lepsi tematicke rozdeleni skoleni/fondu a vazby na klienty
- Rozsireni prilezitosti o Raynet/Notion pipeline pohled
- Rozsirene reporty obchodu a rocniho planu
- Lepsi filtry u smluv a obchodu
- Rychle akce Telefon / WhatsApp / Email podle preferovane komunikace
- Automaticky zapis do Google Kalendare pres Google API nebo Apps Script, pokud bude potreba zapis bez rucniho potvrzeni
- Plne napojeni Apple Mailu jako v Raynetu bude potrebovat samostatny lokalni import hlavicek e-mailu z Macu. Do CRM staci ukladat datum, predmet, odesilatele/prijemce, klienta a odkaz `message://`, aby klik otevrel konkretni zpravu v Apple Mailu. Obsah e-mailu neukladat, pokud to nebude vyslovene potreba.
- Gmail resit jen jako pripadnou specialni variantu pro vybrane spolupracujici klienty/kolegy, ne jako hlavni e-mailove prostredi CRM.
- Investice jako plnohodnotny modul podle `investment-crm.html`: bezne investice a FKI oddelene, investicni zaznamy, fondy, AUM, hodnoty fondu, klientsky report
- Importy pro jednotlive moduly resit postupne: nejdriv JSON a CSV pro klienty, smlouvy, obchody, typare, investice, FKI a poznamky. Screenshot import az jako samostatny kontrolovany krok s OCR/AI vrstvou a povinnym nahledem pred ulozenim, aby se nedvojili klienti, smlouvy ani obchody.
- Architektonicky audit je ulozeny v `ARCHITECTURE_AUDIT.md`. Pred velkym refaktoringem nejdriv potvrdit konkretni fazi a nemenit cely system najednou.

## Bezpecny postup Google zalohy
- Nejdriv kliknout na `Nacist nahled z Google`.
- Zkontrolovat pocty klientu, smluv, obchodu, aktivit a duplicity v zaloze.
- Az potom kliknout na `Prevzit nacteny nahled`.
- Prevzeti data slouci do lokalniho CRM a samo neprepise Google zalohu.
- Google zalohu prepsat az rucne tlacitkem `Odeslat zalohu`, kdyz data vypadaji spravne.

## Faze 3 - kalkulacky a vystupy pro klienta
- Napojit klientskou kalkulacku na vybraneho klienta
- Napojit DPS vs DIP
- Napojit hypotecni a investicni plan
- Vystupy vzdy generovat jako samostatne HTML pro klienta

## Zdrojove moduly
- `smlouvy-tracker.html`: logika klientu, smluv, vyroci aut/majetku, fixaci hypoték, stavu a upozorneni.
- `Obchody-tabulka.html`: mesicni evidence obchodu, BJ, provize, rocni plan, typari a doporuceni.
- `investment-crm.html`: FKI klienti, investicni transakce, fondy, aktualni hodnota investic, AUM, nasledna provize a klientsky investicni report.

CRM nema byt slepenec obrazovek. Klient je hlavni karta a jednotlive moduly jsou pohledy nad stejnymi daty.

## Pravidla dalsich uprav
- Neprepisovat stare nastroje bez duvodu.
- Nejdrit prenest logiku, az potom vylepsovat vzhled.
- Po kazde zmene kontrolovat JavaScript.
- Google zaloha bude jedna pro cele FILIP CRM.
