# Google Kalendář — první verze propojení

Implementace 2026.11.13-1, zatím bez živé autorizace a bez publikace na GitHub Pages.

## Co je hotové

V záložce Záloha je panel Google Kalendář. Po přihlášení a výběru kalendáře zobrazí otevřené aktivity a existující vazby. Každé první propojení potvrzuje uživatel. Potom lze zapnout synchronizaci již propojených aktivit při změně, návratu do okna a každou minutu při viditelné stránce. Volba „Nové kroky od zapnutí automaticky přidávat“ zaznamená dosavadní aktivity a exportuje pouze následně vzniklé otevřené kroky; starší se vždy párují v náhledu. Konflikty a podobné události se zastaví ke kontrole.

Časované aktivity jsou události; aktivity bez času jsou jednodenní celodenní transparentní připomínky. Nejde o Google Tasks. Historie komunikace se neexportuje. Kalendář dostává název typu/klienta, text úkolu, místo a termín. Žádné přílohy, rodná čísla ani celá klientská karta. Do textu úkolu proto nevkládat údaje, které v kalendáři nemají být.

Přenos zpět zahrnuje název, poznámku, místo, datum, čas a délku. Prefix `✓ ` v názvu znamená dokončeno. Uplynutí termínu neznamená splnění. Při souběžné změně se ukáží oba směry; uživatel zvolí zdroj. Pozvánky s účastníky, opakované a speciální události se automaticky nemění. Události vytvořené mimo CRM se nepřebírají bez explicitního párování.

Smazání v Google je konflikt ke kontrole, nikoli pokyn ke smazání CRM aktivity ani automatickému obnovení. Smazání aktivity v CRM nemaže událost v Google. Před smazáním propojené aktivity je třeba vazbu vyřešit ručně. Plná správa odstranění a nový vstup Google → nový úkol CRM patří do další etapy.

## Jednorázové zprovoznění

1. V projektu Google Cloud zapnout Google Calendar API, nastavit OAuth consent a vytvořit OAuth client typu Web application. Pokud je aplikace v testovacím režimu, přidat svůj Google účet mezi testovací uživatele.
2. Do Authorized JavaScript origins vložit skutečný origin CRM, například `https://filipsolar202-blip.github.io`. Bez cesty. `file://` není podporován. Použít existující projekt, pokud ho uživatel má; nevyžaduje se klientské tajemství v aplikaci.
3. Publikovat ověřené soubory aplikace. Zachovat poslední soukromá data a zálohu, zavřít staré karty a teprve pak otevřít novou verzi. Zkontrolovat aktuální data z disku před synchronizací.
4. Záloha → Google Kalendář → Jednorázové nastavení připojení: vložit OAuth Client ID. Kliknout Přihlásit Google a udělit oprávnění jen ke kalendáři, nikoli k poště.
5. Po přihlášení se ověří právo zápisu a použije výslovně schválený kalendář Filip pracovní (`4c5sjddqejkk65ghl68dd1tl64@group.calendar.google.com`). Osobní ani jiné kalendáře nejsou cílem synchronizace.
6. Porovnat s kalendářem. U podobné existující události zvolit propojení, nevytvářet kopii. U konfliktního času upravit termín. Na jednom skutečném úkolu ověřit oba směry a obnovení stránky, potom přidávat další.

OAuth přihlášení konektoru uvnitř Codexu nelze převzít do vlastního CRM. CRM potřebuje vlastní autorizaci Google. Access token je pouze v paměti stránky, ne v CRM datech, záloze ani localStorage. Uložený Client ID není tajný klíč. Odpojit zahodí místní token a vypne automatický režim; oprávnění účtu lze odvolat v Google účtu.

## Provozní hranice

Synchronizace běží ve webovém CRM, není závislá na spuštěném Codexu. Vyžaduje otevřené CRM, připojení a platný krátkodobý token. Po expiraci nebo znovuotevření je nutné přihlášení. Pro běh bez otevřeného CRM je potřeba další serverová služba, zatím nenainstalována.

Stabilní ID odvozené ze syncId aktivity chrání opakovaný POST po výpadku. Soukromé vlastnosti Google uchovávají vazbu i u ručně spárované události. Aktualizace používá If-Match/etag. Obnovy ze starých záloh se nesmějí bez kontroly považovat za nový zdroj pravdy. Synchronizace neřeší obecný problém současného ukládání starých karet CRM na disk. Storage událost z jiné karty zastaví tento modul; před aktivací pracovat v jedné aktuální kartě. Před každou změnou je místní bezpečnostní snímek `filip_crm_calendar_before_sync`; existující diskové ukládání vytváří vlastní zálohy.

Kontrola obsazenosti se týká vybraného kalendáře. Nečte Google Tasks ani další osobní/rodinné kalendáře. Před širším nasazením doplnit seznam kalendářů pro kontrolu konfliktů a ověřit dostupnost úkolů. Při prvním párování nenahrazuje lidskou kontrolu událostí, které mají odlišný název i datum.

Žádné e-maily ani SMS se neodesílají. Pro poštu platí nové zadání: ruční archiv vybraných zpráv přes klientskou záložku E-maily → Vložit e-mail. Starý Apple Mail konektor není tímto modulem volán.

## Ověření

`tools/qa/calendar-sync.cjs` používá pouze syntetické klienty a napodobené Google API. Testuje oba směry, opakovaný zápis, uchování vazby po reloadu, konflikty, změnu etag během zápisu, smazání v Google, párování ruční události, změnu CRM během náhledu, celodenní termíny a pražskou zónu. Živý test 14. 11. 2026 ověřil založení jednoho telefonátu z CRM, převzetí změny z Google a následnou automatickou aktualizaci téže události bez duplicit. Přístup je autorizován pro Filip pracovní.

Oficiální dokumentace:
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/workspace/calendar/api/guides/version-resources

## Google Cloud konfigurace

Projekt `skilled-drake-514614-a3` (FILIP CRM Calendar). Webový OAuth klient vytvořen 13. 11. 2026 pro origin `https://filipsolar202-blip.github.io`. Veřejné Client ID je předvyplněné v modulu. Klientské tajemství se nepoužívá ani neukládá do CRM. Testovací uživatel je vlastní účet filip.solar202@gmail.com. Živý souhlas s přístupem ke kalendáři se uděluje zvlášť v CRM.

## Automatické fáze – verze 2026.11.14-2

Nové případy dostávají pracovní postup automaticky. Starší případy bez postupu
se zapojí při další skutečné změně fáze (osa, pipeline nebo formulář); samotné
načtení stránky ani opakované uložení stejné fáze nevytváří historické úkoly.
Nezměněné standardní šablony se rozšíří na v2. Vlastní šablony se nepřepisují.
Existující v1 postupy dostanou pouze budoucí pravidla, nikoli zpětné připomínky.

| Fáze / událost | Další krok | Výchozí odstup |
| --- | --- | --- |
| Založení / Opportunity | Zkontrolovat zadání a další postup | dnes |
| Nabídka | Připravit nabídku | dnes |
| Scoring | Ověřit údaje a stav scoringu | 1 pracovní den |
| Kompletace | Zkontrolovat podklady a žádost | 1 pracovní den |
| Schvalování | Prověřit stav schvalování | 3 kalendářní dny |
| Podpis | Příprava dokumentů + telefonát k podpisu | dnes + 1 pracovní den |
| K zadání (BeTy) | Zkontrolovat zadání obchodu | 1 pracovní den |
| Skutečný podpis / převod na obchod | Kontrola účinnosti či připsání, provize | 3 a 14 kalendářních dnů |

Pracovní dny zde znamenají Po–Pá, ne kalendář státních svátků. Jde o upravitelné
pracovní připomínky, nikoli o závazné smluvní lhůty. Bez hodiny vzniká celodenní
průhledná připomínka; CRM samo neodhaduje čas schůzky.

Zapnutí volby **Nové kroky od zapnutí automaticky přidávat do kalendáře**
zachytí dosavadní úkoly jako výchozí stav, takže neexportuje starý backlog.
Nové úkoly a nově převzaté manuální kroky jdou do Filip pracovní. Stejný
identifikátor úkolu vždy odpovídá stejnému ID události. Událost už spojená
s jiným CRM úkolem se nenabízí jako kopie druhého kroku stejného klienta.

Při jednoznačné shodě se převezme existující otevřený úkol stejného klienta
a případu, včetně času a vazby na kalendář. U podpisového hovoru se rozpozná
typ Telefon a účel podpisu. Více odpovídajících úkolů vyžaduje kontrolu,
další kopie se nevytvoří. Při odchodu z fáze se původní neupravená připomínka
zruší, nikoli označí jako vykonaná. Ručně přesunuté či pojmenované úkoly se
zachovají. Uzavření případu ruší kroky podle jejich pravidla uzavření.

Propojený pozastavený krok dostane ⏸, zrušený ×; oba neblokují čas.
Události se automaticky nemažou. Dokončení a opětovné otevření přes ✓
se přenáší zpět do stejné aktivity. Konfliktní změny vyžadují výběr zdroje.
Běh vyžaduje otevřené CRM a platný Google token; žádný nový server, placené
API, billing, zprávy ani pozvánky nejsou přidány.
