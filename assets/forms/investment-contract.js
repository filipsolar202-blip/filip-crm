/* Intake only: no suitability score, no automatic investment recommendation. */
window.InvestmentIntake=(()=>{
 InsuranceForms.investments=InvestmentSchema;
 const documents={identity:'Občanský průkaz – přední a zadní strana',account:'Doklad s číslem účtu a jménem majitele',statements:'Aktuální výpisy investic',source:'Doklad k původu investovaných peněz'};
 function parse(value){
  if(value?.type!=='filip-investment-intake'||value.formId!=='investments')throw Error('Soubor není investiční dotazník.');
  const clean=InsuranceIntake.parse({...value,type:'filip-insurance-intake',attachments:undefined,requestedDocuments:undefined});
  const requestedDocuments=Array.isArray(value.requestedDocuments)?value.requestedDocuments.filter(x=>Object.hasOwn(documents,x)):[];
  const attachments=Array.isArray(value.attachments)?value.attachments:[];
  if(attachments.length>8||attachments.reduce((n,a)=>n+String(a.data||'').length,0)>4200000)throw Error('Přílohy jsou příliš velké (celkem nejvýše 3 MB).');
  const safe=attachments.map(a=>{if(!Object.hasOwn(documents,a.kind)||typeof a.name!=='string'||a.name.length>180||!/^data:(application\/pdf|image\/(jpeg|png));base64,[A-Za-z0-9+/]*={0,2}$/.test(a.data||''))throw Error('Nepodporovaná příloha. Použijte PDF, JPG nebo PNG.');return {kind:a.kind,name:a.name,data:a.data};});
  if(value.status==='ready'&&requestedDocuments.some(k=>!safe.some(a=>a.kind===k)))throw Error('Chybí požadovaná příloha. Odešlete rozpracovaný soubor nebo doplňte podklady.');return {...clean,type:value.type,requestedDocuments,attachments:safe};
 }
 return {documents,parse,errors:InsuranceIntake.errors,active:InsuranceIntake.active,displayDate:InsuranceIntake.displayDate,isoDate:InsuranceIntake.isoDate};
})();
