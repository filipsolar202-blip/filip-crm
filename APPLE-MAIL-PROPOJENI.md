# Apple Mail propojeni pro FILIP CRM

Toto propojeni funguje jen lokalne na MacBooku. CRM neuklada obsah e-mailu, nahledy, prilohy, HTML ani prihlasovaci udaje. Uklada se pouze technicky index ve slozce:

`~/Library/Application Support/FILIP-CRM/apple-mail-index.sqlite`

Index neni soucasti GitHubu, Google zalohy ani hlavniho CRM JSON.

## Prvni spusteni

1. Otevri aplikaci Apple Mail.
2. Ve slozce FILIP-CRM spust `start-apple-mail-sync.command`.
3. Pokud se macOS zepta, zda Terminal nebo Python smi ovladat aplikaci Mail, zvol `Povolit`.
4. Otevri FILIP CRM a na karte klienta otevri zalozku `E-maily`.

Full Disk Access neni potreba. Staci oprávneni Automatizace pro ovladani Apple Mailu.

## Gmail ucet v Apple Mailu

Propojeni nepouziva Gmail API ani Google Cloud. Gmail musi byt pouze pridany v aplikaci Apple Mail:

1. Otevri Apple Mail.
2. V nastaveni Mailu zkontroluj, ze Gmail ucet existuje a synchronizuje zpravy.
3. Pokud v Mailu zpravy vidis, CRM je umi pres lokalni pomocnik zaindexovat.

## Prvni synchronizace

Prvni synchronizace nacte technicke informace ke zpravám za poslednich 24 mesicu. Zahrnuje prijate, odeslane a archivovane zpravy, pokud jsou dostupne v Apple Mailu.

Na karte klienta se e-maily paruji podle e-mailove adresy klienta. Pokud klient e-mail nema, CRM napise:

`Pro zobrazeni komunikace doplnte klientovi e-mailovou adresu.`

## Automaticke spousteni

Pro automaticke spusteni po prihlaseni spust:

`install-apple-mail-sync-autostart.command`

Tento soubor nastavi uzivatelsky LaunchAgent. Po prihlaseni se lokalni pomocnik spusti sam.

## Rucni synchronizace

V CRM otevri `Zaloha` a v casti Apple Mail klikni na `Synchronizovat`.

Na karte klienta v zalozce `E-maily` lze pouzit take tlacitko `Synchronizovat` nebo `Nacist znovu`.

## Znovu vytvorit index

Pokud se e-maily nezobrazuji spravne, v CRM otevri `Zaloha` a klikni na `Znovu vytvorit index`.

CRM se predem zepta na potvrzeni. CRM data se tim nemeni.

## Zastaveni sluzby

Pro docasne zastaveni spust:

`stop-apple-mail-sync.command`

CRM zustane funkcni. Na zarizeni bez lokalniho pomocnika jen zobrazi:

`Propojeni s Apple Mail je dostupne na vasem Macu.`

## Odinstalovani automatickeho spousteni

Pro odebrani spousteni po prihlaseni spust:

`uninstall-apple-mail-sync-autostart.command`

Samotny lokalni index zustane v Application Support, aby se pri dalsim zapnuti nemusel zbytecne vytvaret znovu.

## Nejbeznejsi problemy

`Apple Mail neni pripojen`

Spust `start-apple-mail-sync.command` nebo nainstaluj autostart. Zkontroluj, ze Apple Mail bezi.

`Pristup k Apple Mail nebyl povolen`

V macOS otevri Nastaveni systemu, soukromi a zabezpeceni, Automatizace. Povol Terminalu nebo Pythonu ovladat Mail. Potom spust synchronizaci znovu.

`Klient nema ulozenou e-mailovou adresu`

Otevri kartu klienta, klikni na `Upravit klienta` a dopln e-mail.

`E-mail se v Apple Mail nepodarilo najit`

Otevri Apple Mail, pockej na synchronizaci uctu a zkus e-mail otevrit z CRM znovu. Zprava mohla byt presunuta nebo zatim neni stazena v Mailu.
