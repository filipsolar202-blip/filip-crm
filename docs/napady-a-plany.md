# Nápady a plány

V nabídce Práce → Nápady a plány je osobní zásobník. Každý záznam má název,
text, oblast Pracovní/Osobní, prioritu Malá/Střední/Velká, fázi a volitelný den.
Řadit lze podle priority, plánovaného dne nebo od nejnovějších.

„Na den“ a „Na týden“ otevřou výběr data a přidají denní prioritu nebo ručně měřený týdenní cíl do
prvního volného místa ze tří. Obsazená místa ani uzavřené týdny nepřepisuje.
Stejný nápad nelze do stejného období přidat dvakrát. Původní poznámka zůstává
v zásobníku i v běžných poznámkách a ukazuje návaznosti. Dokončení všech
navázaných priorit/cílů se v zásobníku zobrazí jako Hotovo.

## Práce s chatem

„Předat do chatu / načíst“ nabízí čitelný přehled TXT a strukturovaný JSON.
Do chatu lze napsat například: „Projdi přiložené nápady, navrhni tři priority
pro příští týden a zatím nic nezařazuj.“ Nové poznámky z chatu lze vložit po
řádcích nebo importovat JSON. Identifikátory se při opětovném importu
zachovávají; již existující záznamy se nepřepisují. Plány přiložené v exportu
slouží jako kontext, import je automaticky nezakládá. Úpravy stávajících
poznámek se provádějí v detailu CRM.

Nejde o trvalou synchronizaci služby ChatGPT. Přímý zápis agenta je možný
jen s přístupem k aktuálním datům CRM, zálohou a ochranou před souběžným
přepsáním otevřenou kartou. Bez tohoto přístupu použij export/import.
Soukromé poznámky se neukládají do veřejného repozitáře.

Technicky jsou záznamy v existujícím state.notes s metadaty idea.key,
idea.priority, idea.area, idea.stage a idea.date. Denní a týdenní plány mají
ideaId odkazující na stabilní idea.key. Běžná záloha CRM obsahuje obě strany.

Priority vytvořené přímo na dashboardu se automaticky propojí s Nápady a plány.
U každého propojení je období, stav, datum dokončení a tlačítko pro otevření
na dashboardu. Starší dokončení bez zaznamenaného data datum nevymýšlí.
Nové ruční týdenní cíle z nápadů lze dokončit jedním kliknutím.

Přehled zobrazuje nahoře nezařazené nápady a pod nimi jednu tabulku na týden: dny a pod nimi tři týdenní cíle. Minulé týdny jsou sbalené. Priorita Velká je červená, Střední oranžová, Malá (zobrazená jako Nízká) zelená.
