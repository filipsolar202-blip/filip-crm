# FILIP CRM - Apple Mail

Tahle vrstva slouzi k tomu, aby CRM videlo historii e-mailu u klienta bez toho, aby do CRM ukladalo obsah zprav.

## Jak to funguje

- Exporter nacte z Apple Mailu jen hlavicky zprav: datum, predmet, od, komu, kopie a odkaz `message://`.
- Obsah e-mailu se do CRM neuklada.
- CRM pak zpravy sparuje ke klientovi podle e-mailu ulozeneho v karte klienta.
- Klik na `Otevrit` se pokusi otevrit konkretni zpravu primo v Apple Mailu.

## Doporuceny postup - automaticky pomocnik na pozadi

1. Jednou spust `install-apple-mail-sync-autostart.command`.
2. Pokud se macOS zepta na pristup k Mailu, Terminalu nebo disku, povol ho.
3. Otevri `FILIP-CRM.html`.
4. U klienta otevri `Historie`.
5. Klikni na `Synchronizovat Apple Mail`.

Po instalaci uz neni potreba rucne otevirat male terminalove okno. Pomocnik se spousti na pozadi po prihlaseni do Macu.

Pokud ho budes chtit vypnout, spust `stop-apple-mail-sync-autostart.command`.

Instalator si pomocnika zkopiruje do `~/Library/Application Support/FILIP-CRM/apple-mail-sync`.
To je zamerne: macOS muze blokovat automaticky spousteny program, pokud lezi ve slozce Dokumenty.

Kdyz CRM i po instalaci napise, ze synchronizace nebezi:

1. Otevri `System Settings` -> `Privacy & Security` -> `Full Disk Access`.
2. Povol `Terminal`.
3. Spust znovu `install-apple-mail-sync-autostart.command`.
4. V CRM klikni znovu na `Synchronizovat Apple Mail`.

## Rucni docasny postup

1. Spust `start-apple-mail-sync.command`.
2. Nech otevrene okno, ktere se objevi.
3. V CRM klikni na `Synchronizovat Apple Mail`.

CRM si vezme nove hlavicky, preskoci duplicity a sparuje zpravy ke klientum podle ulozenych e-mailovych adres.

## Rucni zalozni postup

1. Spust `export-apple-mail.command`.
2. Pokud se macOS zepta na pristup k Mailu nebo disku, povol ho jen pro tento export.
3. Ve slozce vznikne soubor `apple-mail-export.json`.
4. Otevri `FILIP-CRM.html`.
5. U klienta otevri `Historie` a klikni na `Nacist export Apple Mail`.
6. Vyber `apple-mail-export.json`.

Stejny import je i v zalozce `Google zaloha` v casti `Apple Mail`.

## Kdyz export najde 0 zprav

macOS muze blokovat cteni slozky `~/Library/Mail`.

Nejrychlejsi test:

1. Otevri Apple Mail.
2. Oznac par zprav od klienta.
3. Spust `export-apple-mail.command` znovu.

Plnejsi export:

1. Otevri `System Settings` -> `Privacy & Security` -> `Full Disk Access`.
2. Povol aplikaci, ze ktere export spoustis, typicky `Terminal` nebo `Codex`.
3. Spust `export-apple-mail.command` znovu.

## Dulezite

- Kdyz klient nema v CRM ulozeny e-mail, zpravy se mu nemaji podle ceho priradit.
- `message://` odkaz funguje jen u zprav, ktere Apple Mail stale zna.
- Kdyz presunes nebo smazes zpravu v Mailu, odkaz se nemusi otevrit.
