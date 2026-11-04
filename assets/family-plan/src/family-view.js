import {age,statutory} from './engine.js';
export const escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function appearance(c,p){const sample={jan:['Jan Novák','male'],eva:['Eva Nováková','female'],anna:['Anna Nováková','female'],tomas:['Tomáš Novák','male'],petra:['Petra Nováková','female']};return p?.appearance||(c.demo&&sample[p?.id]?.[0]===p?.name?sample[p.id][1]:'neutral');}
export function figure(c,p,{dead=false}={}){const years=age(p,c.date),minor=years!==null&&years<18,style=appearance(c,p);return `<svg class="family-figure ${minor?'minor':''} ${dead?'deceased':''}" viewBox="0 0 80 130" aria-hidden="true"><circle cx="40" cy="18" r="13" fill="currentColor"/>${style==='female'?'<path d="M29 36Q40 30 51 36L65 87H15z" fill="currentColor"/><path d="M31 88v31M49 88v31M26 40 15 72M54 40l11 32" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>':'<rect x="25" y="34" width="30" height="52" rx="9" fill="currentColor"/><path d="M30 39H25Q16 39 16 49V76M50 39H55Q64 39 64 49V76M31 80V119M49 80V119" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>'}</svg>`;}
export function familyLabels(c,p){const byId=id=>c.people.find(x=>x.id===id)?.name||'neuvedená osoba',female=appearance(c,p)==='female',male=appearance(c,p)==='male',labels=[];
 for(const r of c.relations.filter(r=>r.a===p.id||r.b===p.id)){const other=r.a===p.id?r.b:r.a,ended=!!r.end&&r.end<=c.date,future=r.start>c.date;const noun=r.type==='marriage'?(female?'manželka':male?'manžel':'manžel/ka'):(female?'partnerka':male?'partner':'partner/ka');labels.push(`${future?'Budoucí':ended?'Bývalá/bývalý':'Současná/současný'} ${noun} · ${byId(other)}`.replace('Bývalá/bývalý',female?'Bývalá':male?'Bývalý':'Bývalý vztah:').replace('Současná/současný',female?'Současná':male?'Současný':'Současný vztah:'));}
 if(p.parents.length)labels.push(`${female?'Dcera':male?'Syn':'Dítě'} · rodiče: ${p.parents.map(byId).join(', ')}`);
 const kids=c.people.filter(x=>x.parents.includes(p.id));if(kids.length)labels.push(`${female?'Matka':male?'Otec':'Rodič'} · ${kids.map(x=>x.name).join(', ')}`);
 if(!labels.length&&p.parents.length){const siblings=c.people.filter(x=>x.id!==p.id&&x.parents.some(id=>p.parents.includes(id)));if(siblings.length)labels.push('Sourozenec · '+siblings.map(x=>x.name).join(', '));}
 if(!labels.length&&p.relationshipHint)labels.push('Klient uvádí: '+p.relationshipHint);
 if(!labels.length)labels.push('Rodinná vazba zatím nedoplněna');return labels;
}
export function relationshipTo(c,id,ref){if(id===ref)return 'Osoba ve scénáři';const p=c.people.find(x=>x.id===id),r=c.people.find(x=>x.id===ref);if(!p||!r)return id==='STATE'?'Stát':'Vazba k doplnění';const female=appearance(c,p)==='female',male=appearance(c,p)==='male';if(p.parents.includes(ref))return female?'Dcera':male?'Syn':'Dítě';if(r.parents.includes(id))return female?'Matka':male?'Otec':'Rodič';const relation=c.relations.find(x=>[x.a,x.b].includes(id)&&[x.a,x.b].includes(ref)&&(!x.end||x.end>c.date)&&x.start<=c.date);if(relation)return relation.type==='marriage'?(female?'Manželka':male?'Manžel':'Manžel/ka'):(female?'Partnerka':male?'Partner':'Partner/ka');if(p.parents.some(x=>r.parents.includes(x)))return female?'Sestra':male?'Bratr':'Sourozenec';return familyLabels(c,p)[0];}
export function comparisonRows(c,r){const ids=[...new Set([...r.heirs.map(h=>h.id),...(r.allocation||[]).map(a=>a.id)])];return ids.map(id=>{const h=r.heirs.find(h=>h.id===id),a=r.allocation?.find(a=>a.id===id),own=h?.own??c.assets.reduce((s,a)=>s+(a.kind==='debt'?-1:1)*a.value*(a.owners[id]||0),0);return {id,law:h?.amount||0,value:r.allocation?(a?.value||0):(h?.amount||0),own,total:own+(r.allocation?(a?.value||0):(h?.amount||0)),minimum:h?.minimum||0,age:h?.age,descendant:h?.descendant,priority:r.scenario==='D'?id===r.beneficiary:r.scenario==='E'?!!h?.descendant:false};}).sort((a,b)=>Number(b.priority)-Number(a.priority));}
export function variantReason(row,r){if(r.scenario==='D'){if(row.priority)return 'Prioritní osoba · zbytek po povinných dílech potomků';if(row.descendant)return `${row.age<18?'Nezletilý potomek · ¾':'Zletilý potomek · ¼'} zákonného podílu`;return 'V této variantě bez dědictví';}if(r.scenario==='E')return row.descendant?'Celá pozůstalost dětem v poměru jejich zákonných podílů':'0 Kč z pozůstalosti; vlastní majetek zůstává';return 'Zákonný podíl';}
export const scenarioGuide={A:'Nejdříve oddělíme majetek ostatních a vypořádáme SJM. Majetek zemřelého minus modelové dluhy tvoří čistou pozůstalost. Tu rozdělí zákonný model.',B:'Ukazujeme, co by nastalo bez závěti. Existující dokumenty tato srovnávací varianta úmyslně nezohledňuje.',C:'Existující závěť nebo smlouvu musí posoudit notář. Samotný popis přání nestačí k potvrzení platnosti a výsledku.',D:'Teoreticky lze s notářem připravit závěť ve prospěch partnera při zachování povinných dílů potomků: nezletilým nejméně ¾ a zletilým nejméně ¼ jejich zákonného podílu. Jde o hodnotové minimum, ne další částku navíc ani automatický podíl na každé věci.',E:'Tato hypotetická závětní varianta směřuje celou pozůstalost dětem. Manžel/ka není nepominutelným dědicem a může být v závěti opomenut/a. Její/jeho vlastní majetek a výsledek vypořádání SJM zůstávají mimo tuto pozůstalost. Bydlení, případná další práva pozůstalého a platnost řešení posoudí notář.',F:'Platně a účinně převedený majetek už převodci nepatří, a proto zpravidla není součástí jeho pozůstalosti. Dar ale může ovlivnit započtení na dědické nebo povinné díly. S notářem řešte i bydlení dárce, služebnost užívání a ochranu před ztrátou kontroly nad majetkem.',G:'Každé úmrtí je samostatná událost. Přeneste první výsledek, vyberte další osobu a zkontrolujte datum. Další výpočet už vychází z nových modelových vlastníků.'};

export function familyGroups(c){
 const groups=new Map(),included=new Set();
 for(const child of c.people.filter(p=>p.parents.length)){
  const ids=[...child.parents].sort(),key=ids.join('|');
  if(!groups.has(key))groups.set(key,{parents:ids.map(id=>c.people.find(p=>p.id===id)).filter(Boolean),children:[]});
  groups.get(key).children.push(child);ids.forEach(id=>included.add(id));included.add(child.id);
 }
 for(const r of c.relations){const key=[r.a,r.b].sort().join('|');if(!groups.has(key))groups.set(key,{parents:[r.a,r.b].map(id=>c.people.find(p=>p.id===id)).filter(Boolean),children:[],relation:r});else groups.get(key).relation=r;included.add(r.a);included.add(r.b);}
 for(const p of c.people)if(!included.has(p.id))groups.set(p.id,{parents:[p],children:[]});
 return [...groups.values()];
}
export function familyGroupHtml(c,g,{interactive=false,selected='',deceased=''}={}){
 const e=escapeHtml,card=(p,child=false)=>{const years=age(p,c.date),tag=interactive?'button':'div';return `<${tag} class="kin-person ${p.id===selected?'kin-selected':''}" ${interactive?`data-person="${e(p.id)}"`:''} title="${e(familyLabels(c,p).join('; '))}">${figure(c,p,{dead:!!(p.dead||p.death||p.id===deceased)})}<strong>${e(p.name)}</strong><small>${years===null?'Věk neuveden':years+' let'}${child?' · '+(years===null?'dítě':years<18?'nezletilé dítě':'dospělé dítě'):''}</small></${tag}>`;};
 const relationship=g.relation?(g.relation.end&&g.relation.end<=c.date?'Dřívější vztah':g.relation.type==='marriage'?'Manželé':'Partneři'):(g.parents.length===2?'Rodiče těchto dětí':g.children.length?'Uvedený rodič':'Člen rodiny');
 return `<article class="kin-group"><div class="kin-caption">${e(relationship)}</div><div class="kin-parents">${g.parents.map(p=>card(p)).join('<span class="kin-plus">+</span>')}</div>${g.children.length?`<div class="kin-arrow">↓ <span>${g.parents.length===2?'Jejich společné děti':'Děti tohoto rodiče · druhý rodič není uveden'}</span></div><div class="kin-children">${g.children.map(p=>card(p,true)).join('')}</div>`:(g.parents.length===2?'<p class="kin-empty">V této dvojici nejsou uvedeny společné děti.</p>':'')}</article>`;
}
export function assetDescription(c,a){const owners=Object.keys(a.owners).map(id=>c.people.find(p=>p.id===id)?.name||'Neuvedeno').join(' + ');return `${({sjm:'Společné jmění',exclusive:'Výlučný majetek',shares:'Podílové vlastnictví',unknown:'Vlastníky doplníme',modified:'Smluvený režim'})[a.regime]||a.regime} · ${owners}${a.acquisition?' · Nabytí: '+a.acquisition:''}`;}

// Select people independently of missing asset inputs: those must not expand the family.
export function inheritanceFamily(c,id,{scenario='A',beneficiary=''}={}){
 const law=statutory(c,id),ids=new Set([id,...(law.heirs||[]).map(h=>h.id)]);
 if(scenario==='D'&&beneficiary)ids.add(beneficiary);
 for(const r of c.relations)if(r.type==='marriage'&&r.start<=c.date&&(!r.end||r.end>c.date)&&(r.a===id||r.b===id))ids.add(r.a===id?r.b:r.a);
 // Keep deceased links only where needed to explain representation by descendants.
 const reaches=(pid,seen=new Set())=>{if(pid===id)return true;if(seen.has(pid))return false;seen.add(pid);return (c.people.find(p=>p.id===pid)?.parents||[]).some(x=>reaches(x,new Set(seen)));};
 for(const heir of law.heirs||[]){let todo=[heir.id],seen=new Set();while(todo.length){const x=todo.pop();if(seen.has(x)||x===id)continue;seen.add(x);for(const parent of c.people.find(p=>p.id===x)?.parents||[])if(reaches(parent)){ids.add(parent);todo.push(parent);}}}
 return {...c,people:c.people.filter(p=>ids.has(p.id)).map(p=>({...p,parents:p.parents.filter(x=>ids.has(x))})),relations:c.relations.filter(r=>ids.has(r.a)&&ids.has(r.b))};
}
export function issueTarget(c,message,selected=''){
 const person=c.people.find(p=>message===`Doplňte datum narození: ${p.name}.`||message===`Doplnit narození: ${p.name}.`);if(person)return {personId:person.id,field:'birth'};
 if(message.includes('Existující pořízení')&&selected)return {personId:selected,field:'documentNotes'};
 if(message.includes('Vyberte žijícího partnera'))return {field:'beneficiary'};
 if(message.includes('Vyberte osobu'))return {field:'sim-person'};
 const asset=c.assets.find(a=>message===`Doplňte neznámou hodnotu: ${a.name}.`||message===`Neověřený právní režim: ${a.name}.`||message.startsWith(a.name+': '));
 if(asset)return {assetId:asset.id,field:asset.intakeUnknownValue?'value':'regime'};
 if(message.includes('Převezměte'))return {page:'intake'};
 if(message.includes('úplnost')||message.includes('SJM potřebuje')||message.includes('Dary'))return {page:'settings'};
 if(message.includes('měna')){const a=c.assets.find(a=>a.currency!=='CZK');if(a)return {assetId:a.id,field:'currency'};}
 if(message.includes('úplnost'))return {page:'settings',field:'complete'};
 return {page:'family'};
}
