## 2026.10.28-2

- Transakční import Avant XLSX ve FKI: náhled, párování podle silné identity klienta, ISIN a pokynu, bezpečné novější ocenění a ruční řešení nejasností.
- Společná kontrola Avant/Codya s porovnáním CRM/report, červeným označením klienta, fondu a hodnot, potvrzením CRM nebo převzetím jednoznačné změny.
- Zachování pozic chybějících ve výpisu, ručních a novějších údajů. Nové pozice a změny základu investice vyžadují potvrzení; převody a konverze zůstávají k ručnímu zpracování.
- Opakovaný import nepřidává stejné transakce; stejný soubor lze po úpravě CRM znovu porovnat. Změna dat mezi náhledem a uložením brání převzetí zastaralého návrhu.
- Odkupy rozlišují vyplacené peníze a aktuální hodnotu odkoupených CP. Zbývající AUM, celkový výnos a klientský report používají odpovídající hodnoty.
- Importní historie a rozhodnutí se ukládají, obnovují a slučují se zálohami. Neúspěšné uložení vrací předchozí stav. Pevné pořadí dashboardu zachováno.

## 2026.10.28-1

- Volitelné měření práce v rychlé i podrobné aktivitě: oblast, skutečnost/odhad/nezjištěno, běžný/nový postup, překážka a explicitní obchodní případ. Délka aktivity zůstává jediným časovým údajem.
- Dvoutýdenní pilot v Analýze: vlastní začátek a proces, ruční výběr existujících aktivních případů, návod, osnova zápisu a kontrola dalších kroků bez automatického vytváření úkolů.
- Pracovní výstupy spojují jednotlivé bloky včetně kontrol a oprav. Porovnání zobrazuje počty a medián; neúplná měření ani odhady se nezapočítají do naměřené úspory.
- Rozlišení prázdného času a potvrzené nuly, oddělení pracovní doby od obchodních výsledků a vyloučení plánovaných délek. Historické a předvyplněné hodnoty nejsou automaticky skutečné měření.
- Zachování rozepsaných hodnot při přechodu z rychlé aktivity do detailu, editace interní práce bez klienta a ponechání formuláře při chybě uložení. Úprava zdrojové aktivity znovu neotevře dokončený navazující krok.
- Stabilní identity aktivit a pracovních výstupů, přemapování vazeb při slučování záloh a rozšíření ochrany před ztrátou dat. Pevné pořadí dashboardu zůstává zachované.

## 2026.10.27-4
- Opraven penzijní blok ve Správě smlouvy: společný styl formuláře přebíjel atribut hidden a zobrazoval ho i u auta a dalších nepenzijních smluv. Nyní je blok viditelný a aktivní pouze pro DPS/DIP.
- Nepenzijní smlouvy nepředvyplňují penzijní formulář svou platbou. Přepnutí typu zachovává rozepsané penzijní hodnoty při návratu k DPS/DIP; u ostatních typů se penzijní pole neukládají.
- Ověřeno oddělení penzijního majetku od ostatních smluv včetně uložení, opětovného otevření a zobrazení na počítači i telefonu.

## 2026.10.27-3
- Nové investice a FKI mají samostatná tlačítka „Uložit prognózu“ a „Založit obchodní případy“. Prognóza nemění obchodní evidenci ani AUM; aktivní varianta vytvoří samostatný případ každého fondu ve fázi Nabídka.
- Uloženou prognózu lze otevřít a převést na případy. Zachová se vybraná varianta i původní záznam; stabilní vazby brání opakovanému založení stejných případů a obnovování sjednaných nebo zrušených případů.
- Sjednání zachovává fond, ISIN a pravidelný vklad. Dokup přičte skutečnou částku k existující investici bez ztráty dosavadního ocenění; FKI pozice se při překreslení znovu nepřepisují. Měsíční plán lze zadat bez jednorázového vkladu a sám nezvyšuje AUM.
- Prognózy a jejich návaznosti se bezpečně slučují ze záloh i při změně číselných ID. Sloučení klientů zachovává prognózy a externí investice.
- Selhání ukládání návrhu ponechá formulář otevřený a vrátí předchozí evidenci. Pevné pořadí dashboardu zůstává zachované.

## 2026.10.27-2
- Dashboard má pět pevných sekcí v pořadí: dnešní 3 priority, tento týden 3 cíle, produkční grafy, statistiky/grafy/kontrola dat, úkoly a připomínky. Pořadí je shodně ukotvené v HTML i pojmenovaných oblastech CSS mřížky.
- Statistiky jsou před úkoly. Nedokončené priority patří do posledního bloku úkolů; rychlé odkazy jsou uvnitř denní sekce, takže stránka začíná denními prioritami.
- Zachováno zadávání priorit, cílů, filtry, grafy i rozbalovací přehledy. Pořadí hlídá regresní kontrola po překreslení, změně filtrů, navigaci, obnovení stránky a na telefonu.

## 2026.10.27-1
- Klientské reporty mají u investic a FKI zavřený rozbalovací blok „Bližší info o fondu“. Podrobné údaje i popis fondu zůstávají dostupné na kliknutí; název, společnost, ISIN a datum ocenění jsou viditelné hned.
- Po údajích o konkrétní investici následují rozbalovací transakce. Odstraněn opakovaný obecný blok o odkupu pod transakcemi; likvidita a výstupní poplatky zůstávají v informacích o fondu.
- Klient vidí pouze odkaz na oficiální stránku fondu. Odkazy na KID, statuty, factsheety a ceníky zůstávají v interním přehledu podkladů poradce.
- Fondy v CRM i klientských výstupech se řadí nejprve podle investiční společnosti a potom podle názvu. Změna pořadí nemění ocenění, uložené pozice ani pořadí transakcí.
- Opraveno ovládání časového posuvníku grafu klávesnicí kolem změny letního a zimního času. Posun o den již neuvízne na dnešku; tisk obnoví původní datum i hodnotu grafu.
- Nové rozložení se použije v nově vytvořených HTML reportech; dříve stažené soubory zůstávají samostatnými snímky.

## 2026.10.23-2
- Samostatné Pojistné události v hlavní navigaci, vlastní záložka klienta a rychlé založení přímo z jeho karty. Evidence pro životní pojištění, úrazy a děti, auta, majetek, odpovědnost a ostatní oblasti.
- Pipeline Nahlášeno, Kompletace, Odesláno pojišťovně, Posouzení a Vyřízeno; samostatné ukončení zamítnutím nebo zrušením. Hledání a filtry podle oblasti, stavu a otevřených/ukončených událostí.
- Samostatná data vzniku, evidence, nahlášení, odeslání a vyřízení; volitelné propojení se smlouvou, číslo události, popis, další krok, požadované a vyplacené plnění a výsledek. Prázdná částka se nezaměňuje za nulové plnění.
- Datované poznámky, přílohy a historie změn zůstávají u klienta i po uzavření. Neúspěšné uložení ponechá rozepsaný formulář otevřený.
- Události, přílohy a historie jsou součástí JSON, Google i diskové zálohy včetně ochrany před přepsáním neúplnou zálohou. Opakovaný import slučuje podle stabilní identity, zachovává historii a převádí vazby klientů a smluv. Klienta s událostmi nelze nechtěně smazat.
- Vyplacené pojistné plnění je oddělené od obchodů, provizí a klientského AUM.

## 2026.10.23-1
- Celý katalog prověřen podle přesných ISIN: 30 tříd FKI a 8 běžných fondů. Jednotné profily obsahují cíle, výkonnost s datem, velikost, poplatky, oceňování, horizont, riziko, správu a likviditu. Oficiální odkazy a datum kontroly jsou součástí samostatného HTML reportu.
- Přehled Informace o fondech je dostupný v FKI i Investice → Fondy, včetně fondů bez klientů. Veřejný katalog je oddělený od klientských hodnot, cen CP, provizí a zámků. Vlastní upravené texty se zachovávají a označují.
- Opraveny chybné popisy KOOR, PFFL a fondů Direct/VIGO. Zachycena transformace ČSNF a pozastavení odkupů VENDEAVOUR. Rozpory oficiálních dokumentů u Penty RE, FČKD, OPC a JRD jsou viditelně uvedeny; chybějící výkonnost jiné třídy se nedoplňuje odhadem.
- Záznam Silverline bez ISIN zůstává označený k doplnění; není automaticky sloučen s podobně pojmenovanou třídou. Obálky DIP/Edward, dluhopisy a stavební spoření nejsou vydávány za jednotlivé fondové třídy.
- DPS/DIP mají samostatnou rychlou aktualizaci vlastních vkladů, aktuální hodnoty, strategie, měsíčního příspěvku, příspěvků státu/zaměstnavatele a výběrů. Každá změna zachovává historii na stávající smlouvě nebo obchodu. Rozlišen skutečný orientační výnos a rozdíl proti vlastním vkladům, pokud další příspěvky nejsou známé.
- Penzijní karty v klientském reportu mají stejný vzhled jako investice; nezobrazují čísla smluv. Jsou součástí celkového majetku, zůstávají mimo investiční graf výkonnosti a respektují výběr položek.
- Kruhový graf portfolia má oddělené zaoblené segmenty, součet uprostřed, ovládání klávesnicí a přenosný SVG výstup bez síťové závislosti. Opraveno rozložení pro mobil a tisk i označení aktuálního dne při přechodu letního času.

## 2026.10.22-4
- Denní priority i týdenní cíle jsou na počítači ve třech kompaktních kartách vedle sebe. Delší poznámka je v detailu, produkční grafy jsou opět viditelné hned pod cíli a aktivity pod grafy. Historie a rozpracované cíle zůstávají zachované.
- HTML report obsahuje přepínače sekcí, kategorií i jednotlivých fondů a penzijních účtů. Součty, přehledy, detaily a grafy reagují společně, bez připojení; tisk respektuje výběr. Investice a FKI lze z exportu vyřadit samostatně.
- Celkové portfolio v reportu zahrnuje aktuální penzijní majetek. Penzijní hodnota a měsíční příspěvek mají v editaci smlouvy oddělená pole. Starší evidovaná částka používá dosavadní význam v klientském AUM; neznámá hodnota se nezaměňuje za doloženou nulu. DPS/DIP nevstupují do grafu výkonnosti ani investičního výnosu.
- Následné provize mají vlastní formulář a přehled v Obchodech. Nevytvářejí klienta, smlouvu, BJ, investiční produkci ani FKI/AUM. Příčina chyby byla technická klientská karta a odhad investiční oblasti podle společnosti.
- Rozpoznané technické klienty a chybné odvozené pozice aplikace přesune mimo aktivní evidenci do archivu opravy v záloze; částky a výplaty provizí zachová. Obnova i sloučení záloh podporují provize bez klienta a nevytvářejí je znovu.
- Ověřeno na syntetických datech: ukládání, historie cílů, penzijní zůstatky včetně nuly, výběry v samostatném HTML, tisk, mobilní šířka, odstranění technického klienta, provizní příjmy a zálohy.

## 2026.10.22-3
- Dashboard začíná třemi denními prioritami a třemi týdenními cíli. Běžné úkoly, filtry, statistiky, grafy a kontrola duplicit jsou dostupné po rozbalení; náročné přehledy se nevykreslují při běžném otevření dashboardu.
- Denní priorita může navazovat na klienta, týdenní cíl nebo existující aktivitu. Dokončení sdíleného úkolu nevytváří druhý záznam. Priority lze řadit a procházet podle dnů.
- Výchozí týdenní oblasti jsou Obchod a podpisy, Investice a AUM, Provize a kontrola. Povinný je jen název; BJ a investiční objem lze čerpat z uzavřených obchodů, AUM ze stejné vlastní správy jako v reportech. Podrobnosti cíle jsou volitelné.
- Nedokončené priority zůstávají uložené, nic se automaticky nepřenáší. Nabídka Pokračovat / Mezi běžné úkoly / Zrušit jako neaktuální uchovává původní historii. Uzavření týdne lze provést zpětně.
- Vyhodnocení archivuje cíle, BJ, investiční produkci, dostupné pozorované změny AUM, výsledek kontroly provizí a dvě reflexe. Chybějící historická AUM se nevymýšlejí; změna mezi uloženými daty zahrnuje i přecenění. Starší reflexe zůstávají čitelné.
- Roční cíle rozšiřují dosavadní plán o celkové BJ, cílové AUM a osobní/podnikatelské cíle. Rozepsané denní, týdenní, roční cíle i vyhodnocení se uchovávají při přepínání a obnovení stránky. Nová evidence je součástí společné zálohy.
- Klientský export FKI + investice nabízí samostatné volby Pojištění, Úvěry a hypotéky, Investice, DPS/DIP a Upozornění. DPS/DIP používá současnou evidenci penzí, rozlišuje platbu a ocenění a eliminuje navázaný duplicitní obchod. Vypnutí investic vypne i jejich souhrn.

## 2026.10.22-2
- Opraveno ukládání u fondů s více historickými aktualizacemi: upravuje se otevřený záznam místo prvního nalezeného. Starší aktualizace tak nezastíní ručně změněnou částku. Datum klientského ocenění je samostatné od společné ceny CP. Reprodukční test Atrisu ověřuje skutečné tlačítko karty, historii a obnovení stránky.
- Investiční smlouva nabízí přímo celkové vklady, aktuální hodnotu, výnos v Kč / %, roční údaj producenta a režim investování. Sdílí jeden uložený záznam s detailem investice. Pravidelná platba smlouvy, obchodní objem ani BJ se aktualizací majetku nemění.
- Zařazení smlouvy respektuje zvolený typ, i když v názvu produktu nebo původním importu zůstalo DIP. Přesun do investic se projeví na kartě klienta, v investicích, penzích a reportech; historický navázaný obchod nevytvoří falešnou penzijní položku.
- Klasické investice mají volbu jednorázová, pravidelná nebo kombinace obou. U pravidelné lze uvést výši a frekvenci vkladu, celkem vložená částka zůstává samostatným údajem.
- Aktualizace klienta přímo nabízí vklady v Kč, aktuální hodnotu po odkupech, výnos v Kč, celkové procento a p.a./MWR. Vyplněné údaje mají přednost včetně nuly a záporného výnosu; prázdné výnosy se počítají průběžně.
- Prázdná aktuální hodnota se dopočte z CP (případně z vkladu a nákupní ceny), jinak ze zadaného celkového výnosu. Bez podkladů zůstává rovna vkladům po odkupech, což formulář výslovně uvádí. Náhled odlišuje ruční a vypočtené hodnoty, automatické částky se nevydávají za ručně zadané.
- Ruční hodnoty a výnosy se zachovávají po znovuotevření; stejné výsledky používají detail, souhrny a klientské reporty. Zadaná aktuální hodnota je již po odkupech, odkup se od ní neodečítá podruhé.
- U pravidelných a kombinovaných vkladů se bez historie jednotlivých plateb nevytváří zavádějící p.a. z jediného počátečního data. Roční výnos / MWR producenta lze zadat ručně.
- Ověřeno v izolovaném prohlížeči na syntetických datech včetně importu, změny NAV, nulových hodnot, odkupů, ukládání a oddělení klientů.

## 2026.10.22-1
- FKI záznam automaticky počítá hodnotu z počtu CP a aktuální ceny. Když počet CP není zadaný, odvodí jej z čisté investice a upisovací ceny; pole aktuální hodnoty v Kč lze nechat prázdné.
- Formulář ukazuje okamžitý výpočet a rozlišuje zadaný a dopočtený počet CP. Stejný výpočet se používá při uložení, na kartách klienta, v součtech a reportech.
- Opravená přednost ocenění: výslovná úprava CP již není přebita ponechanou částkou z importu Codya. Rozpoznané starší ruční úpravy se přepočtou také; původní importované údaje zůstávají zachované. Nově načtený výpis opět získá přednost, dokud není ocenění aktualizováno.
- Přidána výslovná volba ruční aktuální hodnoty v Kč. Zadaná částka se uloží, po otevření zůstává zachovaná a změna ceny CP ji nepřepíše. Návrat k automatickému výpočtu je možný vypnutím volby.
- Zachovány vazby odkupů při změně upisovací ceny nebo identifikace nákupu. Ověřeny vícečetné nákupy Julius Meinl, Penta Equity a Penta RE na syntetických údajích, počítání výnosu od nákupu, ukládání a nové importy.

## 2026.10.21-1
- Karta klienta má novou záložku Majetek a plán: sjednocené investice a FKI, penze, externí investice, závazky a další ručně doplněný majetek.
- Export společného souboru pro samostatný dědický a krizový plán a majetkový přehled k tisku. Přenáší kontakty, rodinné vazby, majetek, smlouvy a původ údajů; bez rodných čísel a bez automatického odesílání.
- Náhled importu dotazníku i zpětného exportu z plánu: výběr položek, kontrola klienta, rozlišení nových a změněných záznamů. Opakovaný import nevytváří duplicity, vyplněné kontakty se nepřepisují.
- Neznámé zůstatky penzí a úvěrů zůstávají k doplnění. Pojistné krytí není majetek; různé měny se nesčítají. Podklady pro plán nemění spravované AUM, obchody ani provize.
- Údaje se ukládají do stávající zálohy CRM včetně ochrany proti jejich ztrátě při synchronizaci. Ověřen přenos skutečnými importéry obou aplikací, ukládání, opakovaný import a původní funkce CRM.

## 2026.10.19-4
- Na detailu obchodního případu a ve všech nabídkách stavů jsou nové volby Klient nemá zájem a Zrušeno.
- Oba stavy ukončují případ bez vytvoření obchodu či změny smlouvy. Případ vypadne z otevřené pipeline, plánovaných BJ a očekávaných provizí; jeho údaje a historie zůstávají zachované.
- Rozbalovací archiv uzavřených případů je dostupný v obchodních případech, pipeline i na kartě klienta. Neúspěšný případ lze znovu otevřít výběrem aktivní fáze.
- Timeline klienta nyní zahrnuje i historii uzavřených případů. Ověřeno ukládání, obnovení, znovuotevření a oddělení od obchodů a smluv.

## 2026.10.19-3
- Denní přehled má jednotné sloupce klient, úkol a popis, termín a akce. Typ aktivity je uveden u úkolu; rozdílný počet tlačítek již neposouvá datum.
- Filtr typu aktivity, dneška s prodlenými úkoly, následujících sedmi dní, všech termínů nebo vlastního intervalu. Řazení podle termínu oběma směry; úkoly bez termínu se nezobrazují s vymyšleným dnešním datem.
- Rozpoznané starší automatické záznamy o úpravách klientů, smluv a obchodů se při načtení označí jako dokončené a zůstanou v historii. Původní stav se uchová u záznamu. Ručně zadané úkoly a navazující aktivity jsou chráněny; nová automatická historie je výslovně odlišená od úkolů.
- Připomínky smluv jsou v samostatném rozbalovacím přehledu s významem data: výročí, konec fixace nebo revize. Datum odpovídá počítanému termínu, nikoli původnímu datu smlouvy. Opraven jednodenní posun počtu dní přes změnu letního času.
- Další úkoly se načítají tlačítkem po stovce. Ověřena migrace, obnovení stránky a zálohy, kombinace filtrů, dokončování, zarovnání a mobilní rozložení; prošla také celková regresní kontrola CRM.

## 2026.10.19-2
- Klienti mají ručně nastavitelný rozsah spolupráce: jednotlivý produkt, více oblastí a komplexní správa financí. Staré karty zůstávají bez odhadovaného zařazení.
- Adresář ukazuje rozsah a produktové oblasti; oba nové filtry lze kombinovat se správcem, kontaktem a hledáním.
- Rychlý i podrobný zápis aktivity nabízí osobní označení „asistentka“, „automatizace“, „nechat u sebe“ nebo „zatím neposouzeno“.
- Analýza má rozbalovací přehled času uskutečněných aktivit za zvolený měsíc a samostatný model opakovaných činností. Odhad úspory odečítá čas zadání a kontroly; nesčítá se s evidovanými aktivitami.
- Nové údaje jsou součástí společné zálohy, ochrany proti ztrátě dat a importu. Při slučování záloh se zachovají i interní aktivity bez klienta.
- Ověřeno ukládání, filtrování, měsíční výpočty bez dvojího započtení, import bez duplicit a rychlost adresáře s 1 200 klienty.

## 2026.10.19-1
- Dashboard umožňuje vybrat libovolný uložený týden a přepínat na předchozí, další a aktuální týden.
- Upozornění zpřístupní neuzavřené minulé týdny. Historie obsahuje i rozpracované plány; změna kalendářního týdne cíle nemaže ani neuzavírá.
- Minulý týden lze dodatečně upravit a vyhodnotit i s méně než třemi nastavenými cíli. Archivované výsledky a reflexe zůstávají zmrazené.
- Z nesplněného cíle lze přenést zbývající počet do volného místa aktuálního týdne. Přenos zachová původní výsledek, chrání obsazené priority a nevytváří duplicity.
- Analýza nabízí přímý odkaz na tři cíle vybraného týdne.
- Nový izolovaný test ověřuje přechod neděle/pondělí, obnovení stránky, dodatečné uzavření, historii a přenos bez ztráty dat.

## 2026.10.16-2
- Klientský adresář počítá kontakty, produkty a otevřené případy jedním průchodem místo opakovaného přepočtu celého CRM pro každého klienta.
- Karta klienta načítá investice pouze vybraného klienta a znovu používá už vypočtené souhrny.
- Filtry klientů používají připravený souhrn, takže vyhledávání a řazení reagují okamžitě i u velké databáze.

## 2026.10.16-1
- Hlavní navigace je přesunutá do pevného levého panelu; široké pracovní části a pipeline zůstávají vodorovně posuvné.
- Klienti mají nový centrální seznam s kontakty, správcem, počtem produktů, otevřenými případy, posledním kontaktem a datem založení.
- Karta klienta má výraznou hlavičku, kontakty, čtyři hlavní ukazatele, zjednodušené záložky a kontextová tlačítka uvnitř jednotlivých částí.
- Timeline automaticky spojuje aktivity, poznámky, změny obchodních případů, smlouvy a uzavřené obchody.
- Obchodní případ se z tabulky i pipeline otevírá do samostatného detailu s osou fází, dalším krokem, parametry, historií a očekávanou provizí.
- Datový model, AUM, smlouvy, obchody, provize a existující klientská data zůstávají beze změny.

## 2026.10.15-2

- AI Inbox byl na přání odstraněn z navigace, obrazovek, datového modelu i lokálního pomocníka.
- Nevyřízená fronta AI Inboxu se při načtení zahodí. Již potvrzené poznámky, aktivity, úkoly a obchodní případy zůstávají jako běžná CRM data.
- Lokální diskové úložiště a zálohy pokračují bez přepisovacích a OpenAI rozhraní.

## 2026.10.15-1

- Dlouhý místní přepis už neběží v jediném otevřeném požadavku prohlížeče. Pomocník přijme audio jako samostatnou úlohu a CRM průběžně zobrazuje odesílání, přípravu, přepis a dokončení.
- Nahrávka se posílá přímo jako audio místo objemného Base64 JSON, takže má podstatně menší paměťovou režii a menší riziko chyby `Failed to fetch`.
- AI Inbox nově vysvětluje tři kroky: místní přepis, kontrolu výstupů a ručně potvrzené přiřazení ke klientovi.
- Dočasný zvukový soubor se po dokončení nebo chybě smaže; nedokončené soubory pomocník odstraní při dalším spuštění.

## 2026.10.14-5

- AI Inbox používá bezplatný open-source `whisper.cpp` a místní český model; není potřeba kredit, předplatné ani placené napojení MacWhisperu.
- M4A a další běžné formáty se místně převedou do úsporného pracovního formátu a po přepisu se smažou.
- OpenAI zůstává pouze jako volitelná záložní cesta, pokud místní model chybí.

## 2026.10.14-4

- AI Inbox přednostně používá již nainstalovaný MacWhisper a jeho stažený český model; audio neopouští Mac a nevzniká poplatek za OpenAI API.
- Po místním přepisu CRM vytvoří kontrolní návrhy vlastními pravidly v prohlížeči. OpenAI klíč zůstává jen jako volitelná záložní cesta.
- Stavová karta jasně rozlišuje bezplatný místní přepis a placenou cloudovou variantu.

## 2026.10.14-3

- AI Inbox automaticky zmenší a rozdělí nahrávky větší než 24 MB na půlhodinové části a jejich přepisy znovu spojí.
- Původní nahrávka se neukládá; dočasné zvukové části se po zpracování automaticky odstraní.
- Maximální vstupní velikost zůstává 100 MB, aby velký soubor nezablokoval prohlížeč ani lokálního pomocníka.

## 2026.10.14-2

- Opraven pád lokálního pomocníka způsobený ochranou složky Dokumenty v macOS.
- Program i pracovní data pomocníka nyní běží ze složky `Library/Application Support/FILIP CRM`; instalační skript bezpečně zkopíruje dosavadní data.
- AI Inbox zobrazuje, zda pomocník běží a zda je přepis nakonfigurovaný.
- OpenAI API klíč lze jednorázově uložit přímo z AI Inboxu do Klíčenky macOS. Nezapisuje se do HTML, localStorage, GitHubu ani zálohy.
- Lokální rozhraní omezuje přístup na oficiální GitHub Pages CRM a podporuje bezpečnostní kontrolu privátní sítě v Chrome.

## 2026.10.14-1

- Přidán AI Inbox pro nahrávky ze schůzek, hlasové poznámky a textový test bez externího API.
- Každý návrh lze potvrdit, upravit nebo vynechat; do klientů, historie, úkolů a pipeline se zapisuje až po závěrečném potvrzení.
- M4A přepis běží přes lokálního pomocníka a OpenAI API. API klíč není uložený ve veřejném CRM a audio se po zpracování nearchivuje.
- Originální přepis, nejasnosti, návrhy follow-upu, e-mailu a SMS zůstávají dohledatelné v AI Inboxu.

## 2026.10.11-2

- Všechny dopočítávané výnosy p.a. u FKI i běžných investic používají datum skutečného nákupu nebo připsání peněz.
- Datum emise se do výnosu nepoužívá; zůstává samostatně pro pravidla odkupu a splnění časového testu.
- Stejné pravidlo používají karty klientů, detail pozic, klientské HTML reporty, souhrny fondů i odhady budoucí hodnoty při odkupu.
- Klientský report u běžných investic nyní důsledně odděluje vloženou částku od aktuální hodnoty, aby se při sjednocených záznamech nezaměnily.
- Pokud datum nákupu chybí, CRM výnos p.a. raději nezobrazí. Ručně zadaný nebo importovaný MWR/XIRR má nadále přednost před jednoduchým dopočtem.

## 2026.10.11-1

- Roční výnos FKI se počítá od skutečného data připsání platby. Datum emise se použije pouze tehdy, když datum platby chybí.
- U r2p investice 490 000 Kč z 10. 8. 2023 s hodnotou 636 808 Kč k 31. 8. 2026 tak výnos p.a. odpovídá 8,95 % místo chybně vyšších 9,4 % počítaných od emise 29. 9. 2023.

## 2026.10.10-2

- Z dodatku Broker Trust se podle ISIN přebírá výhradně následné MNG fee z AUM; údaj 48 % ze vstupního poplatku se v CRM neeviduje ani nepoužívá.
- Automatická vstupní provize je samostatná ručně doplnitelná sazba každého FKI i běžného investičního fondu a vždy se počítá z objemu úpisu.
- Fond lze vybrat už v obchodním případu v pipeline. Při objemu 200 000 Kč a vstupní sazbě 2 % CRM zobrazí očekávanou provizi 4 000 Kč při 0 BJ a stejné údaje zachová po převedení do obchodu.
- MNG fee zůstává oddělené a počítá se z aktuálního AUM investic.

## 2026.10.10-1

- FKI fondy uvedené v dodatku Broker Trust Avant_fondy 2026_10_E dostávají podle ISIN aktuální následné MNG fee s platností od 5. 10. 2026.
- Každý FKI i běžný investiční fond má samostatné pole pro vstupní provizi z investované částky, následné MNG fee a případný podíl ze vstupního poplatku.
- Při zápisu investičního obchodu lze vybrat fond podle ISIN; CRM načte jeho sazby a z objemu vypočítá očekávanou vstupní provizi.
- Report fondů ukazuje MNG fee, vstupní sazbu z objemu, podíl ze vstupního poplatku a odhad vstupní provize odděleně.

## 2026.10.09-6

- Analýza řadí obsah jako měsíční KPI, minuty navolávání, výsledkové karty měsíce, rychlý zápis a výrazné týdenní karty.
- Malou měsíční tabulku nahradily čitelné karty; týdenní karty zobrazují velké počty hovorů, schůzek a podpisů.
- Detail týdne, konkrétní týdenní zápisy, historie týdnů, typaři a doporučení jsou samostatně rozbalitelné.
- Dlouhé tabulky ve Správě, Reportu, Investicích, FKI a Analýze zobrazí dvouřádkový náhled a tlačítko pro rozbalení, pokud mají více než deset řádků.
- Investiční i FKI fond eviduje vedle následné provize také vstupní provizi či bonifikaci v procentech; Report ukazuje i její odhad z vložené částky.

## 2026.10.09-5

- Měsíční Analýza je vizuálně sjednocená se zbytkem FILIP CRM: modrostříbrné rámečky, chladné světlé plochy, tmavě modrá typografie a stejné zvýraznění aktivních prvků.
- Zachováno zlepšené měsíční rozložení, týdenní detail i jednotný rychlý zápis aktivit.

## 2026.10.09-4

- Analýza po otevření prioritně ukazuje celý zvolený měsíc: hlavní výsledky, souhrn aktivit a samostatné karty jednotlivých týdnů.
- Kliknutím na týden se otevře jeho podrobný funnel, minuty navolávání a konkrétní zápisy až pod měsíčním přehledem.
- Dva rozměrné formuláře pro hovor a schůzku nahradil společný rychlý zápis „+ Aktivita“ s předvolbami Telefon, Schůzka, Zpráva a Nabídka.
- Jeden rychlý zápis se automaticky promítá do historie klienta, Analýzy i automatických KPI týdenních cílů a může zároveň založit další krok.

## 2026.10.09-3

- Každá fáze pipeline má vlastní přepínač „Počítat do provize“; vypnutá fáze zůstane viditelná, ale její případy se nezapočítají do očekávané provize.
- Souhrn nad pipeline ihned ukazuje provizi zapnutých fází, počet započítaných případů a částku celé pipeline pro srovnání.
- Přidána rychlá tlačítka „Počítat vše“ a „Vypnout vše“ a uložené nastavení zůstane zachované po obnovení CRM.

## 2026.10.09-2

- Stálé tlačítko „+ Aktivita“ zpřístupňuje rychlý zápis z každé části CRM; stejné tlačítko je také přímo u klienta a na kartách pipeline.
- Telefon, schůzka, e-mail nebo zpráva, odeslaná nabídka, následný kontakt a interní práce mají vlastní jednoduché předvolby.
- Povinný je pouze klient u klientských aktivit; poznámka, délka a navazující krok zůstávají volitelné.
- Jeden zápis se automaticky promítne do historie klienta, týdenních cílů a Analýzy bez dalšího ručního přepisování.
- Z rychlého zápisu lze rovnou vytvořit navazující telefon, zprávu, e-mail, schůzku nebo úkol s termínem.

## 2026.10.09-1

- Hlavní Dashboard obsahuje nový výrazný blok „3 hlavní cíle týdne“ se třemi pevnými prioritami, průběhem, termínem a upozorněním na nesplnění.
- Cíl lze měřit ručně nebo automaticky podle kontaktovaných klientů, nových příležitostí, schůzek, analýz, doporučení, prezentací, podpisů a uzavřených obchodů.
- Týden lze uzavřít reflexí, automatickým shrnutím a archivovat do trendu posledních 12 týdnů.
- Týdenní cíle i vyhodnocení jsou součástí zálohy CRM.

## 2026.10.08-4

- Interní označení produktu „FKI“ a „investiční akcie“ u stejného ISIN, názvu, společnosti a třídy už nevytváří falešnou duplicitu fondu.

## 2026.10.08-3

- Opravená kontrola duplicit FKI: více klientů ve stejném fondu se už nepovažuje za více fondů se stejným ISIN.
- Kontrola nyní nabízí sloučení jen tehdy, když skutečně existuje více fondových záznamů nebo odlišné názvy či třídy.

## 2026.10.08-2

- FKI lze jedním krokem zkontrolovat a sjednotit podle ISIN; u rozdílných názvů CRM vyžádá výběr správné varianty.
- Po sloučení zůstane v databázi jediný kanonický fond a duplicitní fondové klíče se skutečně odstraní.
- Správný název, společnost, typ a ISIN se propíší ke všem klientským pozicím, obchodům, smlouvám, případům a uloženým investičním variantám.
- Sloučení zachová NAV, pravidla odkupu, rozšířené informace do reportu, komentáře, následné provize a zámky fondu.

## 2026.10.08-1

- Investiční návrh zobrazuje konkrétní zdrojový fond odkupu a cílový fond reinvestice.
- Reinvestované peníze se již nezapočítávají jako nový vklad; report odděluje nové peníze, přesuny a dopad na celé portfolio.
- Klientský výstup obsahuje u fondů rozšířené informace, včetně výstupních a vstupních poplatků, likvidity, horizontu, rizika a odkazu na oficiální informace.
- Údaje fondu se ukládají a sdílejí podle ISIN, takže stejný fond používá v CRM jednotné informace.

## 2026.10.07-2

- Investiční pozice klienta nově eviduje datum investice, vloženou částku, počet cenných papírů a nákupní hodnotu CP v jednoduchém formuláři.
- Aktuální hodnota CP a datum ocenění se ukládají jednou k fondu a automaticky přepočítají pozice všech klientů se stejným fondem.
- Ruční AUM zůstává jako volitelná výjimka pro Edward a další souhrnné platformy bez počtu CP.
- Tlačítka v investiční kartě jsou přejmenována na „Pozice klienta“ a „Hodnota fondu“, aby bylo jasné, které údaje jsou klientské a které společné.

## 2026.10.07-1

- VIGO PUBLIC z Codya XLSX se eviduje pod společností Vigo Public; Codya zůstává pouze zdrojem importu.
- Opakovaný import odstraní dříve vytvořenou oddělenou Codya pozici a spojí aktuální hodnotu s existujícím Vigo Public OPF klienta.
- Klientský report rozděluje úvodní souhrn na portfolio celkem, běžné investice a FKI.
- Běžné investice jsou v reportu první; FKI následují odděleně a jsou seskupené do bloků podle investičních společností.

## 2026.10.06-2

- Párování klientů z WOOD a Codya toleruje tituly, obrácené pořadí jména a doplňující označení v CRM, například „Novotný Jiří - Jílové“.
- Rodné číslo nebo datum narození zůstává rozhodující kontrolou; při více možných klientech import nikoho automaticky nepřiřadí.

## 2026.10.06-1

- Import WOOD klientského CSV aktualizuje Realitní OPF podle ISIN CZ0008477551 a zachovává ruční zhodnocení.
- Codya XLSX lze nahrát samostatně v Investicích a samostatně ve FKI; v Investicích se zpracují veřejné OPF a ve FKI ostatní fondy.
- Codya aktualizuje pouze klienty obsažené v nahraném souboru a při novější centrální valuaci FKI znovu dostane přednost automatický výpočet z NAV.
- Importy vypíšou počet aktualizovaných, nových, vynulovaných a nespárovaných položek.

## 2026.10.05-2

- Import Edward CSV aktualizuje AUM, vloženou částku, výnos, pravidelný vklad a MWR u spárovaných klientů.
- Řádky s nulovým AUM se ignorují a souhrn Edwardu nahrazuje starší Edward položky, aby se AUM nezapočítalo dvakrát.
- Ručně zadaný výnos v Kč, celkové zhodnocení a zhodnocení p.a. mají přednost i při dalším importu.
- Automatické přepočty FKI z centrálních hodnot fondů zůstávají beze změny.

## 2026.10.05-1

- Pipeline začíná novou fází Opportunity před Nabídkou.
- Opportunity eviduje poslední kontakt, způsob oslovení, další termín a datované poznámky k jednání.
- Případ bez dalšího termínu se zřetelně označí jako ke kontaktování.

## 2026.10.04-4

- Podepsaná náhrada smlouvy se ihned propíše na kartu klienta, i když její platnost začíná až v budoucnu.
- Původní smlouva se nesmaže: přesune se se všemi údaji, poznámkami a přílohami do historie nové smlouvy.
- Nová smlouva výrazně ukazuje datum budoucí platnosti.
- Adresář klientů lze filtrovat podle správce: všichni, Filip Solár nebo Mantra.

## 2026.10.04-3

- Při přechodu mezi záložkami CRM vykresluje pouze otevřenou část aplikace.
- Zrychlená práce s klienty, obchodními případy, smlouvami, investicemi a reporty u větší databáze.
- Úvodní načtení a ukládání dat zůstávají zachované.

## 2026.10.04-2

- Opravené zamrznutí při obnovení CRM nad větší databází klientů.
- Investiční a FKI položky se pro správce načtou jedním průchodem a během stejného vykreslení se znovu použijí.
- Oddělení vlastního AUM a partnerského AUM Mantry zůstává zachované.

## 2026.10.04-1

- Nová záložka Správa odděluje vlastní klienty Filipa Solára od partnerských klientů Mantry bez vytváření duplicitních karet.
- Správce se eviduje u klienta a ukládá také do obchodu a obchodního případu, aby historické přehledy zůstaly správné.
- Partnerský přehled ukazuje klienty, produkci, AUM, odhad počátečních a následných provizí i skutečně přijaté výplaty.
- Investice a FKI klientů Mantry zůstávají dostupné pro sledování vývoje, ale nezvyšují osobní AUM Filipa Solára.
- Stávající klienti se automaticky zařadí pod správu Filipa Solára; správce lze změnit přímo na kartě klienta.

## 2026.10.02-2

- Pipeline, obchodní případy a jejich součty obsahují pouze explicitně založené případy. Servisní stav smlouvy již nevytváří automatický případ.
- Původní smlouvy, jejich stavy, historie a nové rozpracované případy zůstávají zachované.
- Stávající tlačítko Nový obchodní případ vysvětluje oddělený postup; majetková smlouva předvyplní kategorii Nemovitost.

## 2026.10.02-1

- Písmo Fustat vložené do aplikace a samostatných reportů, včetně licence OFL.
- Zarovnané číslice, zachování desetinných míst u CP/NAV v reportu.
- Zvýrazněná data ocenění a termíny odkupů, datum ocenění u každého fondu v souhrnu.
- Mobilní posouvání transakčních tabulek a úpravy tiskových stylů.
- Zachované interaktivní grafy, barvy, výpočty, časové testy a všechny funkce verze 2026.10.01-2.

# Historie verzí

## 2026.10.01-2
- Nový obchodní případ se zakládá odděleně od původní smlouvy. Výběr náhrady je až u dokončení nebo úpravy obchodu.
- Samostatné datum obchodu a účinnosti: budoucí náhrada zachová původní smlouvu a aktivuje se při otevření/obnovení CRM od účinnosti.
- Úprava již dokončeného obchodu umožní přiřadit původní smlouvu bez duplicitního aktuálního produktu.
- Původní podmínky, poznámky a přílohy zůstávají v historii.

## 2026.10.01-1
- Nový obchodní případ lze propojit s původní smlouvou přes akci Nový případ / náhrada nebo výběr ve formuláři.
- Náhrada je samostatný případ u klienta a v Pipeline, nenavyšuje počet aktuálních produktů; potlačuje duplicitní automatický případ ze stejné smlouvy.
- Dokončení je možné až po zadaném podpisu a účinnosti. Do té doby zůstává původní smlouva aktuální; k budoucímu datu se náhrada neaktivuje bez dokončení uživatelem.
- Dokončení aktualizuje stejný záznam smlouvy a uloží historii původních údajů, poznámek a příloh. Historické obchody a provize zůstávají zachované.
- Souhrny tabulky a Pipeline ukazují plánované BJ místo objemu, očekávaná provize zůstává v Kč. Sloupce Pipeline sčítají BJ.

## 2026.09.30-3
- Samostatný objem řešeného případu u smluv, oddělený od částky / platby smlouvy.
- Úprava objemu kliknutím na částku v tabulce a Pipeline nebo ve formuláři smlouvy; podpora zápisu 2 500 000 a 2,5 mil.
- Stejný objem v součtech obou pohledů a při přípravě nového obchodu.

## 2026.09.30-2
- Příležitosti přejmenovány na Obchodní případy; nová Pipeline nad stejnými záznamy.
- Fáze Nabídka, Scoring, Kompletace, Schvalování, Podpis a K zadání (BeTy); staré stavy se zobrazují v odpovídajících nových fázích bez přepisování historie.
- Společné hledání, kategorie, fáze a řazení; počet dnů od poslední aktualizace a zvýraznění nad 14 dní.
- Změny fází výběrem nebo přetažením; propojeno i s případy ze smluv.
- Převod do obchodu se dokončí až uložením obchodu; zavření formuláře zachová otevřený případ.

## 2026.09.30-1
- Propojený graf vývoje a koláč alokace: kurzor, časový posuvník, hodnoty, vklady a zhodnocení ke společnému datu; funguje i ve staženém HTML bez internetu.
- Filtry společností u klientského portfolia a v klientských sekcích Investice, FKI a Penze, včetně volby Všechny společnosti.
- Report: jednoduchý celkový přehled, grafy, souhrnná tabulka fondů a pak detail. Transakce se rozbalují až na kliknutí.
- Tisk/PDF zobrazí transakce a vrátí grafy na aktuální hodnoty; po tisku obnoví zvolený náhled.
- Zachována dosavadní metodika výnosů, časových testů a odkupu.

## 2026.09.28-3
- Graf lineárně propojuje počáteční investici s aktuální hodnotou a navazující prognózou.
- Vklady ze stejného dne se sčítají; pozdější dokupy tvoří skoky v průběhu.
- Historická část je označena jako zjednodušená ilustrace.

## 2026.09.28-2
- Popis fondu předchází zvýrazněným hodnotám; termíny odkupu jsou drobnou poznámkou pod transakcemi.
- Odhad odkupní částky používá dosavadní průměrný roční výnos pozice pouze do nejbližšího odkupu, během vypořádání neroste.
- Graf od prvního evidovaného vkladu barevně rozlišuje historické vklady a budoucí model; nezaměňuje vklady za historická ocenění.
- Investiční přehled a grafy mají v reportu přednost před ostatními produkty.

## 2026.09.28-1
- Klientský report: samostatný přehled dostupnosti prostředků u investic a FKI, včetně časového testu, odkupu a vypořádání po jednotlivých nákupech.
- Nejbližší termín se počítá nejdříve ode dne vytvoření reportu; chybějící pravidla se označí místo vymyšleného termínu.
- Přehled rozlišuje nejbližší známou pozici a vypořádání všech zbývajících pozic.

## 2026.09.22-4
- Souhrny smluv a hypoték v jednom řádku na monitoru; tržní sazba jako kompaktní dlaždice.
- Příležitosti řazené od schválených přes schvalování až k novým příležitostem.
- Investice a penze: koláč rozložení podle společností a rozbalovací přehled jejich klientů, produktů a hodnot.
- Klienti investičního fondu se zobrazují pod příslušnou společností.

## 2026.09.22-3

- Výraznější modrostříbrné rámečky karet, polí a tlačítek.
- Tmavě modré nadpisy a hlavní text, jemně tónované portfolio a kontakty při zachování světlého skleněného vzhledu.

## 2026.09.22-2

- Přehled výplat jednotlivých obchodů tipařů napříč roky, filtry stavu, datum výplaty, poznámka a historie oprav.
- CRM využívá celou šířku monitoru.
- Rodinné vazby na kartě klienta: děti, rodiče, partneři a sourozenci, obousměrné propojení i založení nového člena.
- Volitelná evidence správy produktů rodičem do 18 let; vazby se ukládají v klientských datech a záloze.

## 2026.09.22-1

- Stažení investičního návrhu znovu používá podrobný klientský výstup z původní kalkulačky.
- Návrh obsahuje souhrn scénáře, koláč skladby nového nákupu, graf modelového vývoje a samostatný detail každého fondu.
- Stručné srovnání aktuálního portfolia s alternativami A/B zůstává dostupné samostatným tlačítkem.

## 2026.09.21-7

- Jednostránkový investiční výstup má kompaktní záhlaví bez velkého sloganu a začíná přehledem „Aktuální portfolio“.
- Aktuální portfolio obsahuje samostatné grafické rozdělení podle fondů, segmentů a likvidity.
- Pod aktuálním stavem lze zobrazit nejvýše dvě navrhované alternativy A a B.
- Odprodej jedné současné investice lze rozdělit do několika cílových fondů přes zdroj peněz u nových nákupů.
- Reinvestované částky se počítají jako nové nákupy a report výslovně upozorňuje na nový časový test.

## 2026.09.21-6

- Klientský investiční plán má nový jednostránkový výstup A4 na výšku ve světlém modrostříbrném stylu.
- Hlavní doporučená varianta je zvýrazněná nahoře včetně rozložení portfolia, průměrného očekávaného výnosu a konkrétních odprodejů, přesunů a nákupů.
- Pod hlavní variantou lze zobrazit nejvýše dvě stručné alternativy, aby se celý materiál vešel na jednu stránku.
- Editor omezuje plán na jednu hlavní variantu a maximálně dvě alternativy; uložené plány používají stejný výstup.

## 2026.09.21-5

- Prognóza umí libovolný počet pojmenovaných variant, které lze kopírovat, upravovat, uložit a znovu otevřít.
- U každé současné investice i fondu mimo správu lze ve variantě zvolit ponechání, částečný nebo úplný odprodej a přesun do jiného fondu.
- Přesunutá částka se nepočítá jako nové peníze klienta a návrh nijak nemění AUM, provize ani skutečnou evidenci.
- Každá varianta může obsahovat vlastní nové nákupy klasických investic i FKI.
- Průměrné očekávané zhodnocení se počítá váženě přes celé výsledné portfolio varianty.
- Nový jednostránkový výstup A4 na šířku ukazuje současné fondy, společný graf a přehled kroků i výsledků všech variant.

## 2026.09.21-4

- Investiční prognóza začíná v bodu „Dnes“ celou částkou, kterou klient investuje, místo nulou.
- Graf i roční tabulka zobrazují jediný očekávaný vývoj bez opatrné a optimistické varianty.
- Prognóza ukazuje vážené průměrné očekávané zhodnocení všech navrhovaných investic dohromady.
- Stejné údaje a stejné zjednodušení obsahuje i stažený klientský HTML report.

## 2026.09.21-3

- Karta klienta zobrazuje konkrétní jména lidí, které klient natipoval nebo doporučil.
- Spárovaná jména lze otevřít přímo do jejich klientské karty.
- Počty „Natipoval“ a „Doporučil“ jsou prokliknutelné do úplného přehledu a nepřičítají duplicitně stejnou vazbu.
- Na kartě je vidět také jméno typaře nebo doporučitele, přes kterého klient přišel.

## 2026.09.21-2

- Opraven klientský report, který zaměňoval datum ocenění fondu za termín časového testu.
- Časový test se počítá podle pravidla konkrétního fondu, standardně 36 měsíců od nákupu nebo emise.
- Investice i FKI ukazují termín přímo u každého fondu a každé jednotlivé pozice klienta.
- Klientský report obsahuje samostatný sloupec s termínem časového testu každé transakce.
- Pokud chybí datum nákupu, CRM zobrazí chybějící údaj a nevytvoří zavádějící odhad.
- Přechod z karty klienta do Investic nebo FKI automaticky skryje seznam ostatních klientů; tlačítko jej kdykoli znovu zobrazí.

## 2026.09.21-1

- Proklik na Investici nebo FKI z karty klienta otevře příslušnou záložku rovnou s vybraným klientem.
- Rychlý investiční přehled na kartě klienta má u každé položky stejné tlačítko Detail.
- Karta klienta eviduje investice mimo správu odděleně od AUM, produkce a provizí.
- Nová prognóza porovnává vývoj bez změny s novým jednorázovým nebo pravidelným nákupem.
- Prognóza obsahuje opatrnou, očekávanou a optimistickou variantu a lze ji uložit ke klientovi.
- Uloženou prognózu lze znovu otevřít nebo stáhnout jako samostatný klientský HTML report.
- Samotné uložení prognózy nevytváří obchod ani příležitost; propsání je samostatná volba.

## 2026.09.17-2

- Nová záložka Kampaně mezi Poznámkami a Ročním plánem.
- Výběr klientů podle investic, FKI, penzí, nemovitostí, aut nebo všech klientů.
- Kontrola a ruční vyřazení příjemců před otevřením e-mailu; klienti jsou vloženi do skryté kopie.
- Potvrzená kampaň se ihned uloží do evidence a zapíše klientům do historie jako Smart emailing.
- Volitelná ochrana před opakovaným oslovením stejným předmětem.

## 2026.09.17-1

- Na kartě klienta se z platného rodného čísla zobrazí aktuální věk.
- Telefon se kopíruje kliknutím na číslo; samostatné tlačítko slouží pro volání.
- E-mail a adresa mají samostatné akce pro otevření i kopírování.
- Přichycená horní lišta má zaoblený spodní okraj.

## 2026.09.16-6

- AUM na kartě klienta obsahuje běžné investice, FKI i aktivní penze.
- Penze jsou ve stejné kartě zobrazené samostatně.

## 2026.09.16-5

- Denní úkoly jsou na celé šířce v kompaktních řádcích podle vzhledu Příležitostí.
- Akce jsou na široké obrazovce v jednom řádku.

## 2026.09.16-4

- Každá položka hlavní navigace má vlastní stříbrný glass rámeček.

## 2026.09.16-3

- Logo a název CRM jsou větší v levém rohu, verze je samostatně v pravém rohu.
- Dashboard má výraznější rámečky karet; denní úkoly jsou samostatná kompaktní karta.
- Plnění ročního plánu je pouze v záložce Roční plán.
- Stav diskového úložiště je pouze v záložce Záloha.

## 2026.09.16-2

- Světlý stříbrný glass vzhled se zachovanými modrými akcenty.
- Kompaktnější pracovní plocha, panely, ovládací prvky a rozestupy.

## 2026.09.16-1

- Sjednocení postupně přidaných přepisů funkcí do jedné aplikační logiky a jednoho spuštění.
- Oddělení hlavní stránky, společného stylu a aplikační logiky.
- Mírně tmavší modré plochy, zachovaný průsvitný glass vzhled a viditelné ovládání klávesnicí.
- Širší obsah investic a FKI na tabletu díky seznamu klientů nad detailem.
- Společné stahování klientských HTML výstupů; report bez vybrané sekce se nestahuje.
- Oprava dokončení aktivity z dashboardu.
- Ochrana novějších změn před opožděnou odpovědí diskového úložiště.
- Lokálně uložené knihovny Chart.js a SheetJS, číslované odkazy na aplikační soubory.
- Regresní ověření na smyšlených datech včetně porovnání s vydanou verzí; viz QA-2026-09-16.md.

Datové schéma a klíče úložiště zůstávají zachované. Toto vydání nevyžaduje převod klientských dat.

## 2026.09.15-1

- Zápis verze pro vydání opravy stahování HTML investičního návrhu včetně FKI.
- Tlačítko vytvoření HTML stáhne soubor pro předání klientovi.
