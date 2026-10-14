# AI Inbox – spuštění a ochrana dat

## Co lze zkoušet hned

V záložce **AI Inbox** přepněte na **Textová poznámka**, vložte diktovaný nebo ručně napsaný zápis a zvolte **Připravit zápis ke kontrole**. CRM vytvoří návrhy poznámky, aktivity, příležitosti, úkolu a následné komunikace. Do ostrých dat se zapíší pouze jednotlivě potvrzené položky po volbě **Zapsat potvrzené do CRM**.

## Přepis M4A

Zvuk zpracovává lokální pomocník `tools/local_crm_storage.py`. Tajný OpenAI klíč není součástí HTML, JavaScriptu, GitHubu ani zálohy CRM.

Lokální pomocník se po instalaci spouští automaticky. AI Inbox přímo ukazuje jeho stav. Pokud klíč chybí, vložte jej do zobrazeného pole a zvolte **Uložit bezpečně do Klíčenky**. Klíč se uloží do Klíčenky macOS a nebude součástí CRM, GitHubu ani zálohy.

Pokud pomocník neběží, jednou otevřete `install-local-crm-storage-autostart.command`.

Potom v AI Inboxu nahrajte `.m4a`. Pro přepis se používá model nastavený proměnnou `FILIP_CRM_TRANSCRIBE_MODEL` (výchozí `gpt-4o-transcribe`) a pro strukturovanou analýzu `FILIP_CRM_AI_MODEL` (výchozí `gpt-4o-mini`).

## Tok a uchování dat

- Prohlížeč odešle audio pouze pomocníkovi na `127.0.0.1:48730`. Přístup je omezený na oficiální adresu FILIP CRM a lokální stránku.
- Pomocník pošle audio do OpenAI API pro český přepis a přepis pro strukturovanou analýzu.
- Audio se v CRM, lokálním pomocníkovi ani GitHubu neukládá. Po dokončení požadavku zůstane pouze v provozní paměti a je uvolněno.
- CRM uloží originální přepis, kontrolní návrhy, odpovědi na nejasnosti a název/velikost původního souboru.
- Automatické odeslání e-mailu nebo SMS není povolené; ukládá se jen návrh textu.
- Záznam lze z AI Inboxu smazat. Už potvrzené klientské položky se tím automaticky nemažou, aby nedošlo k nechtěné ztrátě historie.

## Provozní omezení první verze

Lokální pomocník je dostupný z prohlížeče na stejném Macu. Přímé nahrávání z iPhonu mimo Mac bude vyžadovat veřejně dostupný zabezpečený backend s přihlášením a pravidly uchování. Tato volba má provozní a bezpečnostní dopady, proto není v první verzi automaticky aktivovaná.
