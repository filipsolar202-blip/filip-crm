# FILIP CRM – nastavení Mac + iPad zálohování

Aplikace už toto přesně umí zabudované – nešlo o dopisování funkce, jen o zprovoznění
a opravu natvrdo zadaných cest z původního počítače (ty by na tvém Macu nefungovaly).
Opravil jsem `local_crm_storage.py` a `.command` skripty, otestoval jsem, že lokální
server opravdu zapisuje na disk, a zkontroloval JS i Python na syntaktické chyby.

## Jak to funguje (princip)
- **Mac = primární úložiště.** Malý Python program běží na pozadí a při každé změně
  zapisuje data na disk do `~/Documents/Codex/FILIP-CRM/FILIP-CRM-data`.
- **iPad nemá přístup k disku Macu**, proto jede přes Google (jedna sdílená tabulka
  jako "přenosová schránka" mezi zařízeními).
- **GitHub Pages** drží jen samotnou aplikaci (HTML/JS), ne klientská data.

## Krok 1 – nahrát aplikaci na GitHub Pages (aby šla otevřít na obou zařízeních)
1. Rozbal přiložený `FILIP-CRM.zip`.
2. Na github.com vytvoř repozitář, např. `filip-crm`.
3. Nahraj do něj obsah rozbalené složky (kromě souboru `.gitignore`, ten tam zůstane
   automaticky – GitHub ho respektuje) – **nikdy nenahrávej** složku `FILIP-CRM-data`.
4. V repozitáři: `Settings → Pages → Source: main / root` → uložit.
5. GitHub ti dá adresu typu `https://tvuj-ucet.github.io/filip-crm/` – tu použiješ
   na Macu i iPadu.

## Krok 2 – Mac: lokální disková záloha (primární)
1. Ve složce `FILIP-CRM` (na disku, ne v Zip) dvakrát klikni na
   `install-local-crm-storage-autostart.command`.
   - macOS se může ptát na potvrzení spuštění (Terminal) – potvrď.
   - Pomocník se od teď spouští automaticky po přihlášení do Macu.
2. Ověř v prohlížeči: `http://127.0.0.1:48730/status` → má vrátit `"ok": true`.
3. Otevři CRM (lokálně nebo z GitHub Pages) → záložka **Záloha** → zkontroluj,
   že je vidět „Diskové úložiště funguje".
4. Data odteď leží v `~/Documents/Codex/FILIP-CRM/FILIP-CRM-data` (stav, přílohy, časové zálohy).

Chceš to jen vypnout/dočasně spustit ručně? K tomu slouží
`stop-local-crm-storage-autostart.command` a `start-local-crm-storage.command`.

## Krok 3 – Google záloha (most mezi Mac a iPad)
Postupuj podle `google-sync/README.md` (je součástí balíčku):
1. Vytvoř si vlastní Google tabulku a Google Apps Script podle návodu.
2. Do `Code.gs` vlož vlastní `SPREADSHEET_ID` a vlastní dlouhý `SYNC_KEY` (heslo).
3. Nasaď jako Web App (`Execute as: Me`, `Who has access: Anyone`), zkopíruj URL
   končící na `/exec`.
4. V CRM → záložka **Záloha** vlož tuto URL a svůj klíč, klikni „Zkontrolovat Google".

⚠️ Nepoužívej ID tabulky, které je jen jako ukázka v `google-sync/README.md` – je
to tabulka z původního nastavení a nemusí být tvoje. Vytvoř si vlastní.

## Krok 4 – iPad: stažení dat a záloha
1. Otevři adresu GitHub Pages v Safari na iPadu.
2. Záložka **Záloha** → vlož stejnou Apps Script URL a stejný klíč jako na Macu.
3. „Načíst náhled z Google" (nic nepřepisuje, jen ukáže náhled).
4. Zkontroluj počty klientů/smluv → „Převzít načtený náhled" (sloučí data lokálně
   do prohlížeče na iPadu).
5. Po práci na iPadu vždy klikni na **„Odeslat zálohu"** – jinak se Mac nemá jak
   dozvědět o nových datech.

## Krok 5 – návrat na Mac
Na Macu v **Záloha** zapni „Na Macu automaticky převzít novější Google zálohu při
spuštění". Mac pak při otevření CRM sám zkontroluje, jestli je na Google novější
záloha z iPadu, a pokud ano, převezme ji a uloží na disk.

## Shrnutí – kdo je „primární"
| Zařízení | Kde jsou data | Role |
|---|---|---|
| Mac | `~/Documents/Codex/FILIP-CRM/FILIP-CRM-data` (disk) | primární, trvalé úložiště |
| iPad | prohlížeč (localStorage) | dočasné, jen mezi synchronizacemi |
| Google Sheet | Apps Script | přenosový/synchronizační most |
| GitHub | jen kód aplikace | žádná klientská data |

## Co jsem opravil oproti původnímu souboru
- Cesta k datům na Macu je nastavena přes domovskou složku:
  `~/Documents/Codex/FILIP-CRM/FILIP-CRM-data`.
  Uživatel tak má všechno pod hlavní složkou `Codex`, ale klientská data nejsou uvnitř Git repozitáře.
- Skripty hledaly Python na cestě, která na tvém Macu neexistuje → teď používají
  systémový `python3` a při chybě srozumitelně napíšou, co nainstalovat.
- Ověřil jsem funkčnost: JS prošel syntaktickou kontrolou, Python skripty se
  zkompilovaly bez chyby a reálný test uložení dat na disk proběhl úspěšně.

## Co zůstává stejné (funguje beze změny)
- Apple Mail synchronizace (`APPLE-MAIL-NAVOD.md`).
- Struktura CRM (klienti, smlouvy, obchody, investice, FKI, poznámky...).
- Bezpečný postup Google zálohy (nejdřív náhled, pak převzetí, pak ruční odeslání).
