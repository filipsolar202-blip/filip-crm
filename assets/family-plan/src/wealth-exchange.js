import {parseExchangeJSON} from './exchange-contract.js';
import {newIntake,parseIntake,draftErrors,criticalQuestions,budgetLabels} from './intake-contract.js';
import {importQuestionnaire} from './intake-import.js';
import {crisisOf,planPeople} from './plan-data.js';
import {validate} from './engine.js';

export function readExchangeFile(text){
 if(text.length>5_000_000)throw Error('Maximum 5 MB.');const raw=parseExchangeJSON(text);
 const draft=raw.status==='draft';
 if(draft&&!['filip-crm','family-plan'].includes(raw.exchange?.source))throw Error('Běžný rozpracovaný dotazník otevřete přes Pokračovat ze souboru v dotazníku. Pro přenos z CRM chybí údaje o původu.');
 const d=parseIntake(text,{draft});
 const c=importQuestionnaire(d,{allowDraft:draft});
 const errors=validate(c);if(errors.length)throw Error(errors.join('\n'));
 return {data:d,candidate:c};
}
export function exchangePreview(d,cases=[]){
 const duplicates=d.exchange?cases.filter(c=>c.exchange?.clientRef===d.exchange.clientRef||c.intake?.source?.exchange?.clientRef===d.exchange.clientRef):[];
 const currencies={};for(const a of d.assets){currencies[a.currency]??={assets:0,debts:0,unknown:0};if(a.valueUnknown||a.value.trim()==='')currencies[a.currency].unknown++;else currencies[a.currency][a.kind==='debt'?'debts':'assets']+=Number(a.value);}
 return {name:d.self.name,status:d.status,source:d.exchange?.source||'questionnaire',duplicates:duplicates.map(c=>({id:c.id,name:c.name})),currencies,assets:d.assets.length,people:d.people.length+1,unknownOwners:d.assets.filter(a=>!a.owner||a.owner==='unknown').length,contracts:d.exchange?.contracts.length||0};
}
export function exportExchange(c){
 const original=c.intake?.source,primary=c.people.find(p=>p.id===(c.exchangeClientId||(original?'self':planPeople(c)[0]?.id)));
 if(!primary)throw Error('Vyberte hlavního klienta. Původní klient přenosu musí zůstat v evidenci.');
 const d=newIntake(),personIds=c.intake?.personIds||{};
 const outsideId=id=>Object.keys(personIds).find(k=>personIds[k]===id)||id;
 const sourcePerson=id=>original?.people.find(p=>p.id===outsideId(id));
 const relation=c.relations.find(r=>[r.a,r.b].includes(primary.id)&&r.start<=c.date&&(!r.end||r.end>c.date));
 const partner=relation&&(relation.a===primary.id?relation.b:relation.a);
 const status=relation?({marriage:'married',partner:'partner',registered:'registered',partnership:'registered'})[relation.type]:(original?.self.status||'unknown');
 d.date=c.date;d.self={...d.self,...original?.self,name:primary.name,birth:primary.birth||'',birthUnknown:!primary.birth,appearance:primary.appearance||'neutral',status,marriageDate:relation?.type==='marriage'?relation.start:original?.self.marriageDate||'',marriageUnknown:relation?.type==='marriage'?false:original?.self.marriageUnknown??true,...c.contact};
 const peers=c.people.filter(p=>p.id!==primary.id&&p.id!=='STATE');
 d.people=peers.map(p=>{
  const src=sourcePerson(p.id);let role=p.parents.includes(primary.id)?'child':primary.parents.includes(p.id)?'parent':p.id===partner?(relation.type==='marriage'?'spouse':'partner'):p.parents.some(id=>primary.parents.includes(id))?'sibling':src?.role||'other';
  const second=p.parents.find(id=>id!==primary.id);
  let note=p.notes||src?.note||'';
  if(role==='other'&&!note)note='Vztah k hlavnímu klientovi upřesněte s poradcem.';
  return {...src,id:outsideId(p.id),name:p.name,birth:p.birth||'',birthUnknown:!p.birth,appearance:p.appearance||'neutral',role,life:p.dead||p.death?'dead':src?.life==='unknown'?'unknown':'alive',otherParent:second?outsideId(second):src?.otherParent==='only'?'only':'unknown',year:src?.year||'unknown',care:src?.care||'unknown',note};
 });
 d.assets=c.assets.map(a=>{
  const owners=Object.entries(a.owners).filter(([,v])=>v>0),other=owners.find(([id])=>id!==primary.id);let owner='unknown',person='',share='';
  if(a.regime==='exclusive'&&owners.length===1){owner=owners[0][0]===primary.id?'me':'person';person=owner==='person'?outsideId(owners[0][0]):'';}
  if(a.regime==='sjm'&&owners.length===2&&owners.every(([,n])=>n===.5)&&owners.some(([id])=>id===primary.id)&&d.people.some(p=>p.id===outsideId(other?.[0])&&p.role==='spouse'))owner='joint';
  if(a.regime==='shares'&&owners.length===2&&a.owners[primary.id]>0){owner='shares';person=outsideId(other[0]);share=String(a.owners[primary.id]*100);}
  const acquisition=({'Koupě':'purchase','Před manželstvím':'before','Dar':'gift','Dědictví':'inheritance'})[a.acquisition]||'unknown';
  const unknown=!!a.intakeUnknownValue||!Number.isFinite(a.value);
  let note=a.notes||'';if(owner==='unknown'&&!['unknown'].includes(a.regime))note+="\nVlastnictví vyžaduje upřesnění: "+a.regime+'; '+owners.map(([id,v])=>(c.people.find(p=>p.id===id)?.name||id)+' '+(v*100)+' %').join(', ');
  return {id:a.id,name:a.name,kind:a.kind,category:a.category||'Ostatní majetek',value:unknown?'':String(a.value),valueUnknown:unknown,currency:a.currency,owner,person,share,acquisition,liquid:!!a.liquid,note};
 });
 d.answers=Object.fromEntries(Object.keys(criticalQuestions).map(k=>[k,original?.answers[k]||'unknown']));
 if(d.people.some(p=>p.role==='child'))d.answers.children='yes';else if(c.complete)d.answers.children='no';
 if(d.people.some(p=>['parent','sibling','ex','other'].includes(p.role)))d.answers.otherFamily='yes';else if(c.complete)d.answers.otherFamily='no';
 for(const [k,kind] of [['assets','asset'],['debts','debt']])d.answers[k]=d.assets.some(a=>a.kind===kind)?'yes':c.complete?'no':'unknown';
 for(const [k,value] of [['will',primary.documents],['gifts',c.gifts],['international',c.international],['exceptions',c.people.some(p=>p.exception||p.adopted)]])d.answers[k]=value?'yes':original?.answers[k]==='unknown'||!original?'unknown':'no';
 if(c.sjmConfirmed)d.answers.maritalProperty='no';else if(c.assets.some(a=>a.regime==='modified'))d.answers.maritalProperty='yes';
 for(const k of Object.keys(budgetLabels)){const unknown=c.intake?.unknownFinancial?.includes(k)||(!original&&!c.financialProvided&&!c.demo)||(k==='months'&&c.financial[k]<1);d.budget[k]={unknown:!!unknown,value:unknown?'':String(c.financial[k])};}
 d.manual={...d.manual,...c.manual};d.notes=original?.notes||'';d.crisis=structuredClone(crisisOf(c));
 // A file saved by an adviser is never a newly submitted client declaration.
 d.status='draft';d.confirm=Object.fromEntries(Object.keys(d.confirm).map(k=>[k,false]));
 d.exchange={version:1,source:'family-plan',exportId:crypto.randomUUID(),exportedAt:new Date().toISOString(),clientRef:c.exchange?.clientRef||original?.exchange?.clientRef||'family-plan:'+c.id,assetRefs:structuredClone(c.exchange?.assetRefs||original?.exchange?.assetRefs||{}),contracts:structuredClone(c.exchange?.contracts||original?.exchange?.contracts||[])};
 d.exchange.assetRefs=Object.fromEntries(Object.entries(d.exchange.assetRefs).filter(([id])=>d.assets.some(a=>a.id===id)));
 const errors=draftErrors(d);if(errors.length)throw Error('Export nelze dokončit: '+errors.join(' '));return d;
}

export function prefilledQuestionnaire(html,d){
 const errors=draftErrors(d);if(errors.length)throw Error(errors.join(' '));
 const payload=JSON.stringify(d).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 return html.replace('</body>',()=>'<script type="application/json" id="prefill-data">'+payload+'</script></body>');
}
