import {intakeErrors,draftErrors} from './intake-contract.js';
import {extensionErrors} from './plan-data.js';
/** Pure calculation layer. Money stays unrounded until presentation. */
export const clone = x => structuredClone(x);
export const today = () => new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague'}).format(new Date());
export function age(p,date){ if(!p?.birth)return null; const a=date.split('-').map(Number),b=p.birth.split('-').map(Number);return a[0]-b[0]-(a[1]<b[1]||a[1]===b[1]&&a[2]<b[2]?1:0); }
const unique=x=>[...new Set(x)];
const sum=x=>x.reduce((a,b)=>a+b,0);
export function validate(c){
 const errors=[]; const add=s=>errors.push(s);
 if(!c||c.version!==1||!Array.isArray(c.people)||!Array.isArray(c.assets)||!Array.isArray(c.relations)||!Array.isArray(c.households))return ['Neplatný formát případu (verze 1).'];
 if(c.people.length>150||c.assets.length>1000||c.relations.length>500)return ['Případ překračuje podporovanou velikost.'];
 if(c.intake&&(c.intake.version!==1||typeof c.intake.reviewed!=='boolean'||!Array.isArray(c.intake.issues)||c.intake.issues.some(i=>!i||typeof i.label!=='string'||typeof i.note!=='string'||typeof i.resolved!=='boolean'||!['family','assets','protection'].includes(i.section))||(c.intake.source?.status==='draft'?draftErrors(c.intake.source):intakeErrors(c.intake.source)).length))add('Neplatná data klientského dotazníku.');
 const ids=c.people.map(p=>p.id); if(new Set(ids).size!==ids.length)add('ID osob musí být jedinečná.');
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!validDate(c.date))add('Neplatné datum modelu.');
 for(const p of c.people){
  if(typeof p.id!=='string'||typeof p.name!=='string'||!p.name.trim())add('Osoba potřebuje ID a jméno.');
  if(!Array.isArray(p.parents)||p.parents.length>2||unique(p.parents).length!==p.parents.length||p.parents.some(id=>!ids.includes(id)||id===p.id))add('Neplatné právní rodičovství.');
  if(p.birth&&(!validDate(p.birth)||p.birth>c.date))add('Neplatné datum narození.');
  if(p.death&&(!validDate(p.death)||p.birth&&p.death<p.birth||p.death>c.date))add('Neplatné datum úmrtí.');
 }
 const visit=(id,path=[])=>{if(path.includes(id)){add('Rodinné vazby obsahují cyklus.');return;} if(path.length>30){add('Rodokmen je příliš hluboký.');return;} for(const par of c.people.find(p=>p.id===id)?.parents||[])visit(par,[...path,id]);};
 if(!errors.length)c.people.forEach(p=>visit(p.id));
 for(const r of c.relations){if(!ids.includes(r.a)||!ids.includes(r.b)||r.a===r.b||!['marriage','partner','registered','partnership'].includes(r.type)||!validDate(r.start)||r.end&&(!validDate(r.end)||r.end<r.start))add('Neplatný partnerský vztah.');}
 for(const h of c.households)if(!ids.includes(h.a)||!ids.includes(h.b)||h.a===h.b||!validDate(h.since))add('Neplatná společná domácnost.');
 for(const a of c.assets){
  if(!Number.isFinite(a.value)||a.value<0||!['asset','debt'].includes(a.kind)||!['exclusive','shares','sjm','modified','unknown'].includes(a.regime)||!a.owners||typeof a.owners!=='object') {add('Neplatná majetková položka.');continue;}
  const entries=Object.entries(a.owners);if(!entries.length||entries.some(([id,n])=>!ids.includes(id)||!Number.isFinite(n)||n<0||n>1)||Math.abs(sum(entries.map(x=>x[1]))-1)>1e-8)add('Podíly vlastníků musí dávat 100 %.');
  if(a.regime==='exclusive'&&entries.length!==1)add('Výlučné vlastnictví může mít jen jednoho vlastníka.');
  if(a.regime==='sjm'&&(entries.length!==2||entries.some(x=>x[1]!==0.5)))add('Model standardního SJM vyžaduje dva stejné modelové díly.');
 }
 if(new Set(c.assets.map(a=>a.id)).size!==c.assets.length)add('Duplicitní ID majetku.');
 if(!c.financial||['expenses','income','months','oneOff','settlement','reserve','insurance'].some(key=>typeof c.financial[key]!=='number'||!Number.isFinite(c.financial[key])||c.financial[key]<0))add('Finanční vstupy musí být nezáporná čísla.');
 return unique([...errors,...extensionErrors(c)]);
}
export function statutory(c,id){
 const people=c.people, by=id=>people.find(p=>p.id===id), alive=id=>by(id)&&!by(id).dead&&!by(id).death;
 const parents=id=>by(id)?.parents||[], children=id=>people.filter(p=>p.parents.includes(id)).map(p=>p.id);
 const siblings=id=>people.filter(p=>p.id!==id&&p.parents.some(x=>parents(id).includes(x))).map(p=>p.id);
 const active=c.relations.filter(r=>r.type==='marriage'&&r.start<=c.date&&(!r.end||r.end>c.date)&&(r.a===id||r.b===id));
 const spouses=active.map(r=>r.a===id?r.b:r.a).filter(alive);
 if(spouses.length>1)return {errors:['Více současných manželství: vyžaduje individuální právní posouzení.']};
 const spouse=spouses[0];
 const domestic=unique(c.households.filter(h=>(h.a===id||h.b===id)&&h.verified&&h.since<=`${Number(c.date.slice(0,4))-1}${c.date.slice(4)}`&&(h.care||(h.dependent&&h.a===id))).map(h=>h.a===id?h.b:h.a).filter(alive));
 const branch=(pid,depth)=>alive(pid)?[{id:pid,share:1}]:depth>0?divide(children(pid).map(x=>branch(x,depth-1)).filter(x=>x.length)):[];
 function divide(branches){return branches.flatMap(b=>b.map(x=>({...x,share:x.share/branches.length})));}
 function result(n,rows){const m=new Map();for(const r of rows)m.set(r.id,(m.get(r.id)||0)+r.share);return {class:n,rule:n?'C'+n:'STATE',heirs:[...m].map(([id,share])=>({id,share})),errors:[]};}
 let bs=children(id).map(x=>branch(x,150)).filter(x=>x.length);
 if(bs.length)return result(1,divide([...bs,...spouse?[[{id:spouse,share:1}]]:[]]));
 const pars=parents(id).filter(alive);
 if(spouse||pars.length){const other=unique([...pars,...domestic]).filter(x=>x!==spouse);if(!spouse)return result(2,other.map(id=>({id,share:1/other.length})));const s=other.length?Math.max(.5,1/(other.length+1)):1;return result(2,[{id:spouse,share:s},...other.map(id=>({id,share:(1-s)/other.length}))]);}
 bs=siblings(id).map(x=>branch(x,1)).filter(x=>x.length);
 const sibIDs=bs.flat().map(x=>x.id);
 bs.push(...domestic.filter(x=>!sibIDs.includes(x)).map(id=>[{id,share:1}]));
 if(bs.length)return result(3,divide(bs));
 const gps=unique(parents(id).flatMap(parents));
 const livingGP=gps.filter(alive);if(livingGP.length)return result(4,livingGP.map(id=>({id,share:1/livingGP.length})));
 // Do not infer absence of remote relatives from an incomplete family graph.
 if(parents(id).length!==2||parents(id).some(p=>parents(p).length!==2))return {errors:['Pro 5. a 6. třídu doplňte oba rodiče a čtyři prarodiče (včetně zemřelých).']};
 const sides=parents(id).map(p=>parents(p).map(gp=>parents(gp).filter(alive)).filter(x=>x.length)).filter(x=>x.length);
 if(sides.length)return result(5,sides.flatMap(side=>side.flatMap(pair=>pair.map(id=>({id,share:1/sides.length/side.length/pair.length})))));
 const greatN=siblings(id).flatMap(s=>children(s).flatMap(children)).filter(alive);
 const aunts=unique(gps.flatMap(children)).filter(x=>!parents(id).includes(x));
 bs=[...unique(greatN).map(id=>[{id,share:1}]),...aunts.map(x=>branch(x,1)).filter(x=>x.length)];
 if(bs.length)return result(6,divide(bs));
 return result(0,[{id:'STATE',share:1}]);
}
export function calculate(c,id,{scenario='A',beneficiary}={}){
 let errors=validate(c);if(c.intake&&!c.intake.reviewed)errors.push('Převezměte odpovědi klienta nebo je nejprve upravte.');const p=c.people?.find(p=>p.id===id);
 if(!p)return {errors:[...errors,'Vyberte osobu pro simulaci.']};
 if(p.dead||p.death)errors.push('Tato osoba již zemřela.');
 if(!c.complete)errors.push('Potvrďte úplnost relevantních rodinných vztahů a majetku.');

 if(c.people.some(p=>p.exception||p.adopted))errors.push('Osvojení nebo výjimka z dědického práva vyžaduje individuální právní posouzení.');
 if(c.households.some(h=>(h.a===id||h.b===id)&&!h.verified))errors.push('Neověřená společná domácnost.');
 if(c.relations.some(r=>['registered','partnership'].includes(r.type)&&(r.a===id||r.b===id)&&!r.end))errors.push('Právní účinky partnerství vyžadují individuální posouzení.');
 if(c.gifts)errors.push('Dary a jejich započtení vyžadují individuální právní posouzení.');
 if((p.documents||scenario==='C')&&scenario!=='B')errors.push('Existující pořízení pro případ smrti: vyžaduje individuální právní posouzení.');
 if(c.assets.some(a=>a.currency!=='CZK'))errors.push('Cizí měna vyžaduje ověřený přepočet do CZK i pro celkovou majetkovou pozici dědiců.');
 const relevant=c.assets.filter(a=>a.owners?.[id]>0);
 for(const a of relevant){
  if(a.intakeUnknownValue)errors.push(`Doplňte neznámou hodnotu: ${a.name}.`);
  if(a.currency!=='CZK')errors.push('Cizí měna vyžaduje ověřený přepočet do CZK.');
  if((!a.verified&&!a.intakeUnknownValue)||['unknown','modified'].includes(a.regime)||a.category==='Ručení')errors.push(`Neověřený právní režim: ${a.name}.`);
  if(a.regime==='sjm'){
   const other=Object.keys(a.owners).find(x=>x!==id);
   const married=c.relations.some(r=>r.type==='marriage'&&[r.a,r.b].includes(id)&&[r.a,r.b].includes(other)&&r.start<=c.date&&(!r.end||r.end>c.date));
   if(!c.sjmConfirmed||!married||c.people.find(p=>p.id===other)?.dead||c.people.find(p=>p.id===other)?.death)errors.push('SJM potřebuje platné manželství a potvrzený model vypořádání.');
  }
 }
 if(errors.length)return {errors:unique(errors)};
 const law=statutory(c,id);if(law.errors.length)return law;
 const gross=sum(relevant.filter(a=>a.kind==='asset').map(a=>a.value*a.owners[id]));
 const debt=sum(relevant.filter(a=>a.kind==='debt').map(a=>a.value*a.owners[id]));const net=gross-debt;
 if(net<0)return {errors:['Předlužená pozůstalost vyžaduje individuální právní posouzení.'],gross,debt,net};
 const desc=new Set();function walk(pid){c.people.filter(x=>x.parents.includes(pid)).forEach(x=>{desc.add(x.id);walk(x.id);});}walk(id);
 const heirs=law.heirs.map(h=>{const hp=c.people.find(p=>p.id===h.id);const years=age(hp,c.date);const descendant=desc.has(h.id); if(descendant&&years===null)errors.push(`Doplňte datum narození: ${hp.name}.`);const reserved=descendant?h.share*(years<18?.75:.25):0;const own=sum(c.assets.map(a=>(a.kind==='asset'?1:-1)*a.value*(a.owners[h.id]||0)));return {...h,descendant,age:years,reserved,minimum:reserved*net,amount:h.share*net,own,total:own+h.share*net};});
 let allocation=null;
 if(scenario==='D'){
  const b=c.people.find(p=>p.id===beneficiary);if(!b||b.id===id||b.dead||b.death||desc.has(b.id))errors.push('Vyberte žijícího partnera, který není potomkem zůstavitele.');
  allocation=heirs.filter(h=>h.reserved).map(h=>({id:h.id,value:h.minimum}));allocation.push({id:beneficiary,value:net-sum(heirs.map(h=>h.minimum))});
 }
 if(scenario==='E'){const ds=heirs.filter(h=>h.descendant);if(!ds.length)errors.push('Model zabezpečení dětí vyžaduje potomky.');else allocation=ds.map(h=>({id:h.id,value:net*h.share/sum(ds.map(h=>h.share))}));}
 return {errors:unique(errors),...law,gross,debt,net,heirs,allocation,scenario,beneficiary,date:c.date,deceased:id,errors:unique(errors),warnings:[...(c.international?['Zahraniční vazba: výsledek je orientační model podle českého práva. Rozhodné právo a přeshraniční dopady vyžadují individuální právní posouzení.']:[]),'Vývojový model čeká na odbornou revizi notářem.','Podíl není povinnost okamžitého vyplacení ani konkrétní rozdělení věcí.',...(heirs.some(h=>h.age!==null&&h.age<18)?['Nezletilí: projednejte správu majetku a potřebná schválení soudem.']:[]),...(debt?['Dluhy: model neurčuje odpovědnost vůči věřitelům. Projednejte výhradu soupisu.']:[]),...(scenario==='B'&&p.documents?['Tento scénář záměrně pomíjí zaznamenané pořízení pro případ smrti.']:[])]};
}
export function applyDeath(c,result){
 if(result.errors?.length||result.allocation||!result.heirs)throw Error('Tento výsledek nelze přenést do následného úmrtí.');
 const next=clone(c),id=result.deceased;
 if(result.heirs.some(h=>h.id==='STATE')&&!next.people.some(p=>p.id==='STATE'))next.people.push({id:'STATE',name:'Česká republika',parents:[],dead:false});
 for(const a of next.assets){const part=a.owners[id]||0;if(!part)continue;delete a.owners[id];for(const h of result.heirs)a.owners[h.id]=(a.owners[h.id]||0)+part*h.share;a.regime=Object.keys(a.owners).length===1?'exclusive':'shares';}
 next.people.find(p=>p.id===id).dead=true;next.people.find(p=>p.id===id).death=next.date;
 next.relations.forEach(r=>{if((r.a===id||r.b===id)&&!r.end)r.end=next.date;});
 return next;
}
export function liquidity(f){const deficit=Math.max(0,f.expenses-f.income);const need=deficit*f.months+f.oneOff+f.settlement;return {deficit,need,gap:Math.max(0,need-f.reserve-f.insurance),covered:Math.min(need,f.reserve+f.insurance)};}
