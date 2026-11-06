/* Client-facing copy shared by all questionnaire entry points. */
window.ClientMailTemplates=(()=>{
 const topics={
  life:['Připravíme životní pojištění podle Vaší situace','Připravíme životní pojištění podle Tvé situace','abych mohl připravit vhodné životní pojištění, potřebuji znát pár informací o rodině, příjmech a současném zajištění.'],
  family:['Připravíme přehled majetku a další plán','Připravíme přehled majetku a další plán','abych mohl připravit přehled majetku a návrh dalšího postupu, potřebuji znát pár informací o rodině, majetku a závazcích.'],
  loans:['Připravíme možnosti financování','Připravíme možnosti financování','abych mohl porovnat vhodné možnosti financování, potřebuji znát pár informací o plánovaném záměru, příjmech a současných závazcích.'],
  car:['Připravíme pojištění Vašeho auta','Připravíme pojištění Tvého auta','abych mohl navrhnout vhodné pojištění auta, potřebuji znát pár informací o vozidle, jeho využití a požadovaném krytí.'],
  property:['Připravíme pojištění Vašeho bydlení','Připravíme pojištění Tvého bydlení','abych mohl navrhnout vhodné pojištění nemovitosti a domácnosti, potřebuji znát pár informací o bydlení, jeho hodnotě a vybavení.'],
  pets:['Připravíme pojištění Vašeho mazlíčka','Připravíme pojištění Tvého mazlíčka','abych mohl porovnat vhodné možnosti pojištění mazlíčka, potřebuji znát pár informací o jeho věku, zdravotním stavu a požadovaném krytí.'],
  liability:['Připravíme pojištění odpovědnosti podle Vaší práce','Připravíme pojištění odpovědnosti podle Tvé práce','abych mohl navrhnout vhodné pojištění odpovědnosti v zaměstnání, potřebuji znát pár informací o pracovní činnosti — například jakou práci vykonáváte a zda řídíte služební auto.','abych Ti mohl navrhnout vhodné pojištění odpovědnosti v zaměstnání, potřebuji znát pár informací o Tvé práci — například co děláš a zda řídíš služební auto.'],
  travel:['Připravíme pojištění na Vaši cestu','Připravíme pojištění na Tvou cestu','abych mohl navrhnout vhodné cestovní pojištění, potřebuji znát cíl a termín cesty, kdo cestuje a jaké aktivity jsou v plánu.'],
  claims:['Připravíme podklady k pojistné události','Připravíme podklady k pojistné události','abych mohl pomoci s řešením pojistné události, potřebuji vědět, co se stalo, které smlouvy se událost týká a jaké podklady jsou k dispozici.']
 };
 function build({formId,tone='formal',url='',anniversary=false,product=''}){
  const t=topics[formId];if(!t)throw Error('Pro tento formulář zatím není e-mailová šablona.');
  const informal=tone==='informal',insurance=!['loans','family','claims'].includes(formId);
  const greeting=informal?'Ahoj,':'Dobrý den,';
  let intro=(informal?(t[3]||t[2]):t[2]).replace(/^abych mohl/,informal?'abych Ti mohl':'abych Vám mohl'),subject=t[informal?1:0];
  if(anniversary){subject='Kontrola smlouvy'+(product?' – '+product:'');intro=informal?'rád bych s Tebou zkontroloval, zda smlouva stále odpovídá Tvé aktuální situaci.':'rád bych s Vámi zkontroloval, zda smlouva stále odpovídá Vaší aktuální situaci.';intro+='\n\n'+(informal?'Pošli mi prosím aktuální podklady':'Zašlete mi prosím aktuální podklady')+(insurance?' od pojišťovny, případně nové předpisy pojistného.':' ke smlouvě.')+' '+(informal?'Případné změny můžeš doplnit v krátkém dotazníku. Pokud kontrolu nyní řešit nechceš, dej mi prosím vědět.':'Případné změny můžete doplnit v krátkém dotazníku. Pokud kontrolu nyní řešit nechcete, dejte mi prosím vědět.');}
  const instructions=informal?'Otevřeš ho na telefonu i počítači. Po vyplnění stáhni odpovědi a soubor mi přilož k odpovědi na tento e-mail.':'Otevřete ho na telefonu i počítači. Po vyplnění stáhněte odpovědi a soubor mi přiložte k odpovědi na tento e-mail.';
  const next=informal?'Pak podklady projdu a ozvu se Ti s dalším postupem. Pokud si s něčím nebudeš vědět rady, napiš nebo zavolej.':'Pak podklady projdu a ozvu se Vám s dalším postupem. Pokud si s něčím nebudete vědět rady, napište nebo zavolejte.';
  return {subject,body:[greeting,intro,'Vyplnit dotazník:\n'+url,instructions,next,informal?'Díky,\nFilip':'Děkuji a přeji hezký den.\nFilip Solár'].join('\n\n')};
 }
 function contract(tone){const informal=tone==='informal';return informal?'Ahoj,\n\nrád bych s Tebou zkontroloval, zda smlouva stále odpovídá Tvé aktuální situaci. Pošli mi prosím aktuální podklady a napiš, co se změnilo nebo co chceš probrat.\n\nPodklady projdu a ozvu se Ti s dalším postupem. Pokud kontrolu nyní řešit nechceš, dej mi prosím vědět.\n\nDíky,\nFilip':'Dobrý den,\n\nrád bych s Vámi zkontroloval, zda smlouva stále odpovídá Vaší aktuální situaci. Zašlete mi prosím aktuální podklady a napište, co se změnilo nebo co chcete probrat.\n\nPodklady projdu a ozvu se Vám s dalším postupem. Pokud kontrolu nyní řešit nechcete, dejte mi prosím vědět.\n\nDěkuji a přeji hezký den.\nFilip Solár';}
 return {build,contract,formIds:Object.keys(topics)};
})();
