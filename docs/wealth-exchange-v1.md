# Fair Life – společný majetkový dotazník, verze 1

Samostatné CRM a rodinný plán si předávají soubory JSON. Žádná aplikace neposílá klientské údaje druhé automaticky. Přijetí vždy předchází náhled a výběr klienta/případu.

Základ je stávající `family-plan-questionnaire`, `version: 1`: `date`, `status` (`draft` nebo `submitted`), `self`, `people`, `assets`, `answers`, `budget`, `manual`, `confirm`, `notes`, volitelně `crisis`. Zachovává strukturu dotazníku rodinny-plan/src/intake-contract.js. Draft není klientem potvrzený dotazník; nesmí získat podvržené souhlasy. CRM přijímá i původní hotové dotazníky bez exchange.

## Volitelné rozšíření

- `self.email`, `self.phone`, `self.address`: texty; rodné číslo ani interní klíče služeb se nepřenášejí.
- `exchange.version`: 1.
- `exchange.source`: `filip-crm` nebo `family-plan`.
- `exchange.exportId`: UUID exportu.
- `exchange.exportedAt`: ISO čas exportu.
- `exchange.clientRef`: neprůhledný stabilní klíč klienta. Není oprávnění k automatickému přepsání klienta; zachovat při zpětném exportu.
- `exchange.assetRefs`: objekt klíčovaný přesně ID položky `assets`. Hodnoty `{sourceKey,kind,company,isin,asOf}` jsou texty. Původní sourceKey a ID zachovat při exportu z druhé aplikace, nové položky dostanou vlastní stabilní ID. `kind` např. investment, fki, pension, external, wealth, debt. `asOf` je datum ocenění, nikoliv datum exportu.
- `exchange.contracts`: samostatná evidence smluv `{id,type,company,product,number,currency,payment,startDate,endDate,notes}`, vše textové hodnoty. Prázdná částka = neznámá; payment je platba, nikoli aktuální hodnota majetku nebo zbývající jistina. ID zachovat. Pojištění může být též v `crisis.policies` s týmž ID; při importu se nesmí zdvojit.

## Majetek

`assets[]`: `{id,name,kind:'asset'|'debt',category,value:string,valueUnknown:boolean,currency:'CZK'|'EUR'|'USD',owner:'me'|'person'|'joint'|'shares'|'unknown',person,share:string,acquisition:'purchase'|'before'|'gift'|'inheritance'|'unknown',liquid:boolean,note}`.

Částka znamená hodnotu celé uvedené položky. Není-li známá, `value:''`, `valueUnknown:true`; nula je skutečně známá nula. Vlastnictví v CRM samotnou vazbou ke klientovi není doloženo: výchozí `owner:'unknown'`. U podílů se uvede procento primárního klienta; sdílený majetek se nesmí započíst dvakrát. Investiční pozice z CRM se exportují z existujícího sjednoceného portfolia, nikoliv opakovaně ze smlouvy, obchodu a evidence fondu. Penzijní měsíční platba není majetkový zůstatek. Úvěrová původní částka není potvrzený aktuální dluh. Pojistné krytí se neexportuje jako majetek. Různé měny se nesčítají bez konverze. Chybějící datum ocenění se nepřepisuje dnešním datem.

## Import a bezpečné zachování dat

Kontrolovat typ/verzi, velikost do 5 MB, strukturu, číselné rozsahy, jedinečnost ID, referenční vazby, nebezpečné názvy klíčů a limity textů/počtů. Cizí texty se vždy vykreslují jako text, nikoli HTML. Neznámé verze se odmítají.

Opakovaný soubor nesmí vytvářet duplicity. Stabilní provenance a ID určují shodu; jméno není automatická autorizace pro přepsání klienta. Při odlišné identitě je nutný výslovný výběr, propojený export jiného klienta se nesmí omylem uložit pod otevřenou kartu. Prázdný vstup nesmí potichu mazat existující údaje. Majetek importovaný z dotazníku je evidencí pro plán, s oddělením od spravovaného AUM, obchodní produkce a provizí; převzetí neznamená ověření vlastnictví.

Kompatibilní syntetický vzor: `tools/qa/fixtures/wealth-exchange-v1.json` (žádná skutečná klientská data).
