# AI Inbox – spuštění a ochrana dat

## Co lze zkoušet hned

V záložce **AI Inbox** přepněte na **Textová poznámka**, vložte diktovaný nebo ručně napsaný zápis a zvolte **Připravit zápis ke kontrole**. CRM vytvoří návrhy poznámky, aktivity, příležitosti, úkolu a následné komunikace. Do ostrých dat se zapíší pouze jednotlivě potvrzené položky po volbě **Zapsat potvrzené do CRM**.

## Přepis M4A

Zvuk zpracovává lokální pomocník `tools/local_crm_storage.py`. Tajný OpenAI klíč není součástí HTML, JavaScriptu, GitHubu ani zálohy CRM.

Lokální pomocník se po instalaci spouští automaticky. AI Inbox přímo ukazuje jeho stav. OpenAI klíč v Klíčence je pouze volitelná placená záloha; pro místní přepis ho nepotřebujete.

Bezplatná výchozí varianta používá open-source `whisper.cpp` a místní český model. Pomocník ho spouští přímo na Macu; OpenAI API se nevolá.

Pokud pomocník neběží, jednou otevřete `install-local-crm-storage-autostart.command`.

Potom v AI Inboxu nahrajte `.m4a`. Místní Whisper vytvoří český přepis a CRM z něj v prohlížeči připraví návrhy ke kontrole. Placená cloudová záloha je ve výchozím nastavení vypnutá, takže uložený OpenAI klíč se nepoužije.

Maximální vstupní velikost nahrávky v CRM je 100 MB. Při případném použití cloudové zálohy pomocník větší audio automaticky zmenší a rozdělí na půlhodinové části.

## Tok a uchování dat

- Prohlížeč odešle audio pouze pomocníkovi na `127.0.0.1:48730`. Přístup je omezený na oficiální adresu FILIP CRM a lokální stránku.
- Při místním režimu pomocník zpracuje audio přes open-source Whisper na stejném Macu. OpenAI API se nevolá.
- Audio se v CRM, lokálním pomocníkovi ani GitHubu neukládá. Po dokončení požadavku zůstane pouze v provozní paměti a je uvolněno.
- CRM uloží originální přepis, kontrolní návrhy, odpovědi na nejasnosti a název/velikost původního souboru.
- Automatické odeslání e-mailu nebo SMS není povolené; ukládá se jen návrh textu.
- Záznam lze z AI Inboxu smazat. Už potvrzené klientské položky se tím automaticky nemažou, aby nedošlo k nechtěné ztrátě historie.

## Provozní omezení první verze

Lokální pomocník je dostupný z prohlížeče na stejném Macu. Přímé nahrávání z iPhonu mimo Mac bude vyžadovat veřejně dostupný zabezpečený backend s přihlášením a pravidly uchování. Tato volba má provozní a bezpečnostní dopady, proto není v první verzi automaticky aktivovaná.
