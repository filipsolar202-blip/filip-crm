# FILIP CRM - diskove uloziste

## Kde jsou data

Hlavni data CRM jsou po teto uprave ulozena zde:

`/Users/a./Documents/Codex/FILIP-CRM-data`

Uvnitř jsou hlavni slozky:

- `state/crm-state.json` - hlavni data CRM.
- `attachments/` - PDF a obrazky ke smlouvam.
- `backups/` - automaticke casove kopie hlavniho JSONu.
- `logs/` - technicke logy pomocnika.

Prohlizec porad drzi nouzovou kopii, ale hlavni zdroj ma byt disk.

## Jak to spustit

Ve slozce `FILIP-CRM` otevri:

`install-local-crm-storage-autostart.command`

Tím se nastavi lokalni pomocnik, ktery bezi na pozadi a zapisuje data na disk.

Kontrola:

`http://127.0.0.1:48730/status`

## Jak CRM pracuje s daty

1. Po otevreni CRM zkusi nacist data z disku.
2. Pokud na disku jeste nic neni, vezme aktualni data z prohlizece a zalozi prvni diskovou kopii.
3. Pri kazdem ulozeni CRM zapise data na disk.
4. Puvodni Google zaloha zustava jako druha pojistka.

## Přílohy

Nove PDF a obrazky se po ulozeni smlouvy ukladaji jako skutecne soubory do slozky `attachments`.

To znamena:

- puvodni PDF ve Stazenych souborech muzes pozdeji smazat,
- CRM pouziva vlastni kopii v datove slozce,
- pokud nejde prilohu otevrit, zkontroluj, ze bezi lokalni diskove uloziste.

## Doporučení

Slozku `FILIP-CRM-data` nedavat verejne na GitHub. Obsahuje klientská data.
