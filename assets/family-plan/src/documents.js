import {calculate,age,liquidity} from './engine.js';
import {figure,inheritanceFamily,familyGroups,familyGroupHtml,relationshipTo,assetDescription,comparisonRows} from './family-view.js';
import {advisorOf,crisisOf,crisisTables,planPeople,disclaimer} from './plan-data.js';
import {sources,crisisGuides} from './plan-content.js';
import {fairLifeLogo,fairLifeLion} from './brand-assets.js';
import {guideQr} from './guide-qr.js';
import {htmlEscape as e} from './presentation.js';
const money=x=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(x);
const percent=x=>new Intl.NumberFormat('cs-CZ',{style:'percent',maximumFractionDigits:2}).format(x);
const batch=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,i*n+n));
const sum=xs=>xs.reduce((a,b)=>a+b,0);
const text=x=>e(x||'Neuvedeno').replace(/\n/g,'<br>');
const name=(c,id)=>c.people.find(p=>p.id===id)?.name||(id==='STATE'?'Česká republika':'Neuvedeno');
const amount=a=>a.intakeUnknownValue?'Neuvedeno':a.currency==='CZK'?money(a.value):e(a.value+' '+a.currency);
const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const note=s=>`<div class="doc-note">${s}</div>`;
const links=keys=>`<div class="doc-sources">${keys.map(k=>`<a href="${sources[k][1]}" target="_blank" rel="noopener">${e(sources[k][0])} ↗</a>`).join('')}</div>`;
const steps=xs=>`<ol class="doc-steps">${xs.map(s=>`<li>${s}</li>`).join('')}</ol>`;
const facts=xs=>`<div class="doc-facts">${xs.map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>`;
function paragraphs(value,max=1050){
 const result=[];let rest=String(value||'');
 while(rest){let n=Math.min(max,rest.length);if(n<rest.length){const p=rest.lastIndexOf(' ',n);if(p>max/2)n=p;}const lines=[...rest.slice(0,n).matchAll(/\n/g)];if(lines.length>16)n=lines[15].index+1;result.push(rest.slice(0,n));rest=rest.slice(n).trimStart();}
 return result;
}
function headerPage(c,type){
 const a=advisorOf(c),people=planPeople(c);
 return {title:type==='crisis'?'Krizový plán':'Dědický plán',section:'Váš rodinný plán',cover:true,body:`<div class="doc-cover-art"><img src="${fairLifeLion}" alt="" /></div><div class="doc-cover-copy"><div class="doc-eyebrow">FAIR LIFE · RODINA A MAJETEK</div><h1>${type==='crisis'?'Když rodina<br>potřebuje oporu.':'Aby majetek<br>spojoval rodinu.'}</h1><p>${type==='crisis'?'Kontakty, smlouvy a konkrétní kroky pro chvíle, kdy je potřebujete.':'Co vlastníte, kdo by dědil a co můžete včas připravit.'}</p><h2>${e(c.name)}</h2><p>${people.map(p=>e(p.name)).join(' · ')}</p><div class="doc-cover-meta">${e(c.date)}<br>Zpracoval ${e(a.name)}</div></div>`};
}
function contactPage(c){
 const a=advisorOf(c);
 return {title:'Váš kontakt pro další kroky',section:'Kontakty a rozsah plánu',body:`<div class="doc-advisor"><img src="${fairLifeLion}" alt="Lev Fair Life"><div><h2>${e(a.name)}</h2><p>${e(a.brand)} · finanční plánování</p><strong>${e(a.phone)}</strong><p>${e(a.email)}<br>${e(a.web)}${a.address?'<br>'+text(a.address):''}</p></div></div><h2>Jak plán používat</h2><p>${e(disclaimer(c))}</p>${c.international?note('Zahraniční vazba: číselné scénáře jsou orientační model podle českého práva. Rozhodné právo a přeshraniční dopady vyžadují individuální právní posouzení.'):''}<h3>Aktualizace</h3><p>Datum podkladů: ${e(c.date)}. Příští společná kontrola: <b>${e(c.plan?.reviewDate||'domluvte s poradcem')}</b>. Změnu manželství, dětí, bydliště, majetku či smluv promítněte do obou plánů.</p><p class="doc-small">Soukromý dokument. Sdílejte pouze s osobami, které mají rodině pomoci. Ve výstupu nejsou přístupová hesla ani náhrada oprávnění jednat.</p>`};
}
function addLongNotes(pages,c,keys){
 for(const [key,label] of keys){const value=c.manual?.[key];for(const part of paragraphs(value))pages.push({title:label,section:'Vaše pokyny pro rodinu',body:`<div class="doc-free-text">${text(part)}</div>`});}
}
function addRecordPages(pages,c,key){
 const schema=crisisTables[key],rows=crisisOf(c)[key];
 if(!rows.length){pages.push({title:schema.title,section:'Údaje vaší domácnosti',body:`${note('Zatím neuvedeno. Neznamená to, že tato smlouva nebo nárok neexistuje. Doplníte v aplikaci nebo ručně do vytištěného plánu.')}${table(Object.values(schema.fields).slice(0,4),Array.from({length:7},()=>['&nbsp;','&nbsp;','&nbsp;','&nbsp;']))}`});return;}
 for(const r of rows){
  // Each record can span multiple pages; never silently truncate long client notes.
  const entries=Object.entries(schema.fields).filter(([k])=>r[k]).flatMap(([k,l])=>paragraphs(r[k],600).map((s,i)=>[l+(i?' (pokračování)':''),s]));
  const groups=[];let group=[],weight=0;for(const entry of entries){const w=entry[1].length+200+(entry[1].match(/\n/g)||[]).length*45;if(group.length&&(weight+w>1800||group.length===5)){groups.push(group);group=[];weight=0;}group.push(entry);weight+=w;}if(group.length)groups.push(group);
  for(const group of groups)pages.push({title:schema.title,section:r.name||r.person||r.service||r.task||'Údaje vaší domácnosti',body:`<dl class="doc-record">${group.map(([l,v])=>`<div><dt>${e(l)}</dt><dd>${text(v)}</dd></div>`).join('')}</dl>`});
 }
}
function assetCategory(a){
 if(a.kind==='debt')return 'Nesplacené závazky a ručení';
 if(a.category==='Nemovitosti')return 'Nemovitý majetek';
 if(a.category==='Automobily')return 'Vozidla';
 if(['Podíly ve společnostech','Podnikatelský majetek'].includes(a.category))return 'Firmy a podnikatelský majetek';
 if(['Pohledávky','Půjčky poskytnuté jiným osobám'].includes(a.category))return 'Pohledávky';
 if(['Jiný movitý majetek','Ostatní majetek'].includes(a.category))return 'Ostatní hodnotné věci';
 return 'Finanční majetek';
}
export function ownershipSummary(c){
 const people=planPeople(c),ids=new Set(people.map(p=>p.id));
 return ['sjm','exclusive','shares','modified','unknown'].map(regime=>{
  const assets=c.assets.filter(a=>a.regime===regime&&Object.keys(a.owners).some(id=>ids.has(id)));
  const unknown=assets.some(a=>a.intakeUnknownValue||a.currency!=='CZK');
  const net=id=>sum(assets.map(a=>(a.kind==='debt'?-1:1)*a.value*(a.owners[id]||0)));
  return {regime,assets,unknown,values:people.map(p=>net(p.id)),total:sum(people.map(p=>net(p.id)))};
 }).filter(x=>x.assets.length);
}
const regimeName={sjm:'Společné jmění',exclusive:'Výlučné vlastnictví',shares:'Podílové vlastnictví',modified:'Smluvený režim',unknown:'Vlastnictví k upřesnění'};
function inventoryPages(pages,c){
 const owners=new Set(planPeople(c).map(p=>p.id));
 const items=c.assets.filter(a=>Object.keys(a.owners).some(id=>owners.has(id)));
 const categories=['Finanční majetek','Nemovitý majetek','Vozidla','Ostatní hodnotné věci','Firmy a podnikatelský majetek','Pohledávky','Nesplacené závazky a ručení'];
 for(const category of categories){
  const xs=items.filter(a=>assetCategory(a)===category);
  if(!xs.length)continue;
  for(const group of batch(xs,4)){
   pages.push({title:category,section:'02 · Přehled jmění',body:table(['Položka / nabytí','Vlastnictví','Hodnota celé položky'],group.map(a=>[
    `<b>${e(a.name)}</b><small>${e(a.acquisition||'Původ neuveden')} · ${e(a.category)}</small>`,
    `${e(regimeName[a.regime])}<small>${Object.entries(a.owners).map(([id,n])=>e(name(c,id))+' '+percent(n)).join('<br>')}</small>`,
    amount(a)
   ]))+note('Hodnota celé položky není vždy hodnota pro tuto domácnost. V tabulce jsou uvedeny podíly. Dar nebo dědictví označuje způsob nabytí, nikoli další částku. U dluhu jde o zadaný zbývající závazek.')});
   for(const a of group)for(const part of paragraphs(a.notes))pages.push({title:a.name,section:'Poznámka k majetku',body:`<p>${e(assetDescription(c,a))}</p><div class="doc-free-text">${text(part)}</div>`});
  }
 }
 if(!items.length)pages.push({title:'Majetek zatím neuveden',section:'02 · Přehled jmění',body:note('Doplňte majetek a dluhy hlavního klienta a případně partnera. Prázdný seznam nepovažujeme za potvrzení nulového majetku.')});
 const summary=ownershipSummary(c),people=planPeople(c);
 pages.push({title:'Souhrn vašeho jmění',section:'02 · Přehled jmění',body:table(['Režim',...people.map(p=>e(p.name)),'Celkem pro tento plán'],summary.map(s=>[e(regimeName[s.regime]),...s.values.map(v=>s.unknown?'K doplnění':money(v)),s.unknown?'K doplnění':money(s.total)]))+facts([['Čistá hodnota zahrnutá v plánu',summary.some(s=>s.unknown)?'K doplnění':money(sum(summary.map(s=>s.total)))]])+note('Aktiva minus zadané závazky. Započítány jsou pouze podíly osob uvedených na titulní straně. Cizí podíly jsou vynechány. Standardní SJM je zde finančně rozděleno 50/50; nejde o existující podíly za trvání SJM. Ručení a smluvený režim vyžadují samostatné posouzení.')});
}
function modelPages(pages,c,p){
 const r=calculate(c,p.id,{scenario:'B'}),others=planPeople(c).filter(x=>x.id!==p.id);
 pages.push({title:'Kdyby zemřel/a '+p.name,section:'03 · Dědická struktura',body:`<div class="doc-person-title">${figure(c,p,{dead:true})}<div><h2>${e(p.name)}</h2><p>Samostatný scénář k ${e(c.date)}<br>${others.map(x=>e(x.name)+' v této variantě žije.').join(' ')}</p></div></div><p>Jak by se postupovalo podle zákonné posloupnosti, bez účinků závěti či dědické smlouvy.</p>${r.errors.length?note('Číselný model zatím není úplný: '+r.errors.map(e).join(' ')):facts([['Majetek v pozůstalosti',money(r.gross)],['Dluhy v modelu',money(r.debt)],['Čistá pozůstalost',money(r.net)]])}<p>${p.documents?'Klient uvedl existující pořízení pro případ smrti. Následující zákonná varianta jej záměrně nezohledňuje a nepředpovídá skutečný výsledek.':'Model vychází z evidovaných vztahů a majetku. Zkontrolujte, zda odpovídají skutečnosti.'}</p>${c.international?note('Zahraniční vazba: podmíněný model podle českého práva; skutečný právní dopad posoudí odborník.'):''}`});
 const groups=familyGroups(inheritanceFamily(c,p.id));
 for(const g of groups){
  const children=g.children.length?batch(g.children,3):[[]];
  for(const childrenGroup of children)pages.push({title:'Vazby relevantní pro tento scénář',section:'03 · '+p.name,body:`<div class="doc-family">${familyGroupHtml(c,{...g,children:childrenGroup},{deceased:p.id})}</div><p class="doc-small">Rodina pro scénář ${e(p.name)}. Další příbuzní zůstávají v evidenci; zde se zobrazí, když mohou mít dědický nárok.</p>`});
 }
 if(r.errors.length)return;
 const rows=comparisonRows(c,r);
 for(const group of batch(rows,4))pages.push({title:'Kdo by dědil a kolik',section:'04 · Rozdělení v praxi · '+p.name,body:`<p>${r.class?r.class+'. dědická třída':'Odúmrť'} · základ ${money(r.net)}</p><div class="doc-heirs">${group.map(a=>`<div>${figure(c,c.people.find(p=>p.id===a.id)||{})}<b>${e(name(c,a.id))}</b><small>${e(relationshipTo(c,a.id,p.id))}</small><div class="doc-donut" style="--share:${(r.heirs.find(h=>h.id===a.id)?.share||0)*100}%"><span>${percent(r.heirs.find(h=>h.id===a.id)?.share||0)}</span></div><strong>${money(a.value)}</strong></div>`).join('')}</div>${table(['Osoba','Dědictví','Vlastní čistý majetek','Celkem'],group.map(a=>[e(name(c,a.id)),money(a.value),money(a.own),'<b>'+money(a.total)+'</b>']))}${note('Dědický podíl je hodnota nároku, nikoli pokyn k okamžité výplatě. Vlastní majetek zahrnuje modelové vypořádání SJM. Dluhy mohou mít jiný dopad vůči věřitelům; projednejte výhradu soupisu.')}`});
 const basis=c.assets.filter(a=>a.owners[p.id]);
 for(const group of batch(basis,6))pages.push({title:'Z čeho vychází výpočet',section:'04 · '+p.name,body:table(['Položka','Nabytí / režim','Podíl do modelu','Do pozůstalosti'],group.map(a=>[e(a.name),e(a.acquisition||'Neuvedeno')+'<small>'+e(regimeName[a.regime])+'</small>',percent(a.owners[p.id]),(a.kind==='debt'?'− ':'')+money(a.value*a.owners[p.id])]))+note('U standardního SJM vstupuje modelově polovina, u výlučného majetku vše a u podílového jen evidovaný podíl zůstavitele. U daru rozhoduje skutečné vlastnictví a případné započtení.')});
 for(const descendants of batch(r.heirs.filter(h=>h.descendant),6))pages.push({title:'Co chrání děti',section:'05 · Možnosti a limity',body:table(['Potomek','Zákonný podíl','Minimální povinný díl'],descendants.map(h=>[e(name(c,h.id)),money(h.amount),`${h.age<18?'¾':'¼'} × ${money(h.amount)} = <b>${money(h.minimum)}</b>`]))+note('Nezletilému potomkovi náleží nejméně ¾, zletilému ¼ jeho zákonného podílu. Nejde o tento zlomek celého rodinného majetku. Manžel/ka není nepominutelný dědic. Výpočet předpokládá, že se neuplatní právní výjimky ani započtení.')+links(['mandatory'])});
}
export function inheritancePages(c){
 const pages=[headerPage(c,'inheritance')],people=planPeople(c);
 pages.push({title:'Tři otázky pro vaši rodinu',section:'01 · Dědictví srozumitelně',body:`<div class="doc-three"><div><span>01</span><h2>Co máme?</h2><p>Majetek a dluhy. Zvlášť společné jmění a to, co patří jen jednomu.</p></div><div><span>02</span><h2>Kdo dědí?</h2><p>U každého z partnerů zvlášť. Děti z různých vztahů mohou mít různé rodiče.</p></div><div><span>03</span><h2>Chceme to tak?</h2><p>Porovnáme výsledek s vašimi přáními a připravíme podklady pro notáře.</p></div></div><h2>Jak probíhá pozůstalost</h2>${steps(['Notář pověřený soudem zjistí rodinné vztahy, dokumenty, majetek a dluhy.','Nejdřív se vyřeší majetkové poměry manželů, potom to, co skutečně náleží do pozůstalosti.','Právní titul a nároky dědiců určují, kdo a co získá. Zákonný model zde slouží k přípravě rozhovoru.'])}${links(['probate'])}`});
 pages.push({title:'Co jednotlivá slova znamenají',section:'01 · Dědictví srozumitelně',body:table(['Pojem','Jednoduché vysvětlení'],[['Zůstavitel','Člověk, po kterém se dědí.'],['Pozůstalost','Majetek i dluhy, které po člověku zůstanou.'],['SJM','Společné jmění manželů. Nejdřív se vypořádá; teprve pak se řeší dědictví.'],['Výlučný majetek','Patří jen jednomu člověku. Například určitý dar nebo dědictví; rozhodují konkrétní okolnosti.'],['Povinný díl','Ochrana nepominutelných dědiců. Obvykle peněžitý nárok, ne automaticky podíl na každé věci.'],['Výhrada soupisu','Právní ochrana před neomezeným dopadem dluhů zůstavitele. Včas ji proberte s notářem.']])+links(['probate','mandatory'])});
 inventoryPages(pages,c);
 pages.push({title:'Když rozhoduje zákon',section:'03 · Dědická struktura',body:table(['Třída','Kdo přichází na řadu'],[['1','Děti a manžel/ka, rovným dílem. Místo nedědícího dítěte nastupují jeho potomci podle zákonných podmínek.'],['2','Pokud nedědí potomci: manžel/ka, rodiče a způsobilé spolužijící osoby. Manžel/ka dostane nejméně polovinu.'],['3','Pokud nedědí manžel ani rodiče: sourozenci a způsobilé spolužijící osoby. Za nedědícího sourozence jeho děti.'],['4','Prarodiče, stejným dílem.'],['5','Prarodiče rodičů, s rozdělením mezi otcovskou a mateřskou stranu a pravidly přirůstání.'],['6','Děti prarodičů a děti dětí sourozenců; v příslušné větvi mohou nastoupit děti strýce či tety.']])+note('Třídy se nepoužijí současně. Vzdálenější okruh nastupuje teprve při splnění zákonných podmínek. Nesezdaný partner při dědících potomcích v první třídě nedědí. Samotné společné bydlení automatický nárok nezakládá. Pokud není dědic, může nastat odúmrť.')+links(['probate'])});
 for(const p of people)modelPages(pages,c,p);
 if(!people.length)pages.push({title:'Nejdřív vyberte klienta',section:'03 · Dědická struktura',body:note('Přidejte osobu do rodiny a v nastavení výstupů vyberte hlavního klienta.')});
 pages.push({title:'Možnosti pro rozhovor s notářem',section:'05 · Další možnosti rozdělení',body:table(['Nástroj','Co může řešit','Na co myslet'],[['Závěť','Vyjádří, kdo má dědit.','Forma, aktuálnost a povinné díly.'],['Dovětek','Odkaz, podmínku či příkaz.','Sám neustanovuje dědice.'],['Dědická smlouva','Smluvně povolá dědice.','Notářský zápis; nejvýše ¾ pozůstalosti.'],['Darování za života','Převede majetek už nyní.','Dárce přestává být vlastníkem. Řešte bydlení, kontrolu a započtení darů.'],['Svěřenský fond','Oddělenou správu majetku podle pravidel.','Individuální právní, daňové a nákladové posouzení.'],['Oprávněné osoby','Plnění z vybraných smluv při úmrtí.','Ověřit produkt, osobu, podmínky a dobu výplaty.']])+links(['contract','codicil'])});
 addLongNotes(pages,c,[['notary','Vaše přání a otázky pro notáře']]);
 addRecordPages(pages,c,'tasks');pages.push(contactPage(c));return addContents(pages);
}
export function crisisPages(c){
 const pages=[headerPage(c,'crisis')],a=advisorOf(c);
 pages.push({title:'Otevřete tuto stránku jako první',section:'01 · Pomoc v pravou chvíli',body:`<div class="doc-emergency"><strong>155</strong> záchranná služba <strong>112</strong> tísňová linka</div><p>Při bezprostředním ohrožení řešte nejdřív bezpečí a odbornou pomoc. Finanční kroky přijdou potom.</p>${steps(['Zavolejte člověku, kterému důvěřujete. Nemusíte všechno vyřizovat sami.','Zajistěte děti, péči a nutné platby. V tomto plánu najdete kontakty a smlouvy.','Spojte se s poradcem: <b>'+e(a.name)+' · '+e(a.phone)+'</b>.'])}${note('Tento plán slouží jako rodinná příručka. Mějte jednu aktuální kopii na dohodnutém místě a řekněte rodině, kde je.')}<h2>Kde hledat dokumenty</h2><p>${text(c.manual?.documents?'Vaše informace najdete na následující stránce.':'Místo uložení doplňte do části Krizový plán v aplikaci.')}</p>`});
 addLongNotes(pages,c,[['documents','Kde jsou vaše dokumenty']]);
 addRecordPages(pages,c,'contacts');addRecordPages(pages,c,'policies');
 for(const g of crisisGuides)pages.push({title:g.title,section:'02 · Postup pro konkrétní situaci',body:`<p class="doc-lead">${e(g.intro)}</p>${steps(g.steps.map(e))}<div class="doc-two"><div><h3>Státní zabezpečení</h3><p>${e(g.state)}</p></div><div><h3>Soukromé zabezpečení</h3><p>${e(g.private)}</p></div></div><h3>Připravte si</h3><p>${g.checklist.map(e).join(' · ')}</p>${links(g.links)}`});
 addRecordPages(pages,c,'benefits');
 const f=c.financial,l=liquidity(f),unknown=c.intake?.unknownFinancial?.length||f.months<1;
 pages.push({title:'Peníze, které rodina opravdu využije',section:'03 · Rychlá disponibilita',body:`${unknown?note('Některé finanční údaje nejsou známé. Neuvádíme zástupné nuly jako výsledek.'):facts([['Měsíční schodek',money(l.deficit)],['Potřeba na '+f.months+' měsíců',money(l.need)],['Zbývá zajistit',money(l.gap)]])}${table(['Vstup podle klienta','Částka'],[['Výdaje měsíčně',money(f.expenses)],['Příjem pozůstalých měsíčně',money(f.income)],['Skutečně dostupná rezerva',money(f.reserve)],['Očekávané pojistné plnění',money(f.insurance)],['Jednorázové výdaje',money(f.oneOff)],['Plánované peněžní vypořádání',money(f.settlement)]].map(([label,v],i)=>[label,c.intake?.unknownFinancial?.includes(['expenses','income','reserve','insurance','oneOff','settlement'][i])?'Neuvedeno':v]))}${note('Potřeba = kladný měsíční schodek × počet měsíců + jednorázové výdaje + výslovně plánované vypořádání. Odečítáme dostupnou rezervu a očekávané plnění pouze jednou. Dědické podíly nejsou automaticky hotovost.')}<p>Úmrtí majitele neznamená vždy úplné zablokování účtu. Ověřte nastavení s bankou; dispoziční oprávnění není vlastnictví peněz.</p>${links(['accounts'])}`});
 addRecordPages(pages,c,'access');addRecordPages(pages,c,'services');
 pages.push({title:'Návody, které máte po ruce',section:'04 · Praktické návody',body:`<p>Odkazy otevřete kliknutím nebo naskenováním QR kódu z vytištěného plánu. Směřují přímo na veřejné informační stránky.</p><div class="doc-qr-list">${['probate','care','accident'].map(k=>`<article><img src="${guideQr[k]}" alt="QR: ${e(sources[k][0])}"><div><h2>${e(sources[k][0])}</h2><a href="${sources[k][1]}" target="_blank" rel="noopener">Otevřít aktuální návod ↗</a><small>${e(sources[k][1])}</small></div></article>`).join('')}</div>`});
 pages.push({title:'Když se stane dopravní nehoda',section:'04 · Praktické návody',body:steps(['Zastavte a zajistěte místo. Při zranění zajistěte pomoc a volejte 155 nebo 112.','Policii volejte při zranění či úmrtí, zjevné škodě přes 200 000 Kč na některém vozidle včetně přepravovaných věcí, poškození komunikace, relevantní škodě třetí osobě nebo nemožnosti obnovit provoz. Při nejistotě situaci konzultujte na 158.','Pokud policie nehodu nešetří, sepište a podepište společný záznam. Vyměňte si údaje a pořiďte fotografie.','Kontaktujte asistenční službu a pojišťovnu podle vlastní smlouvy. Uchovejte záznam i doklady.'])+links(['accident'])+note('Kontrola obecných informačních zdrojů: 20. 10. 2026. Pravidla a individuální nároky se mohou změnit.')});
 addLongNotes(pages,c,[['contact','Další kontakty a pomoc'],['children','Péče o děti a blízké'],['payments','Vaše pokyny k platbám'],['insurance','Poznámky k pojistkám'],['access','Kde najít návody a přístupy'],['firstDays','Vaše pokyny pro první dny'],['notes','Další přání rodiny']]);
 addRecordPages(pages,c,'tasks');pages.push(contactPage(c));return addContents(pages);
}
function addContents(pages){
 const sections=[];pages.slice(1).forEach((p,i)=>{if(!sections.some(s=>s[0]===p.section))sections.push([p.section,i+2]);});
 const count=Math.ceil(sections.length/16),contents=batch(sections,16).map((group,i)=>({title:'V plánu snadno najdete'+(i?' · pokračování':''),section:'Obsah',body:`<ol class="doc-contents">${group.map(([label,n])=>`<li><a href="#page-${n+count}">${e(label)}<b>${n+count}</b></a></li>`).join('')}</ol><p class="doc-small">Kliknutím otevřete kapitolu. Tisk a PDF obsahují všechny stránky. Číselné modely vycházejí z údajů uvedených v tomto dokumentu.</p>`}));
 pages.splice(1,0,...contents);return pages;
}
export function documentHtml(c,type='inheritance',css='',fontCss=''){
 const pages=type==='crisis'?crisisPages(c):inheritancePages(c),a=advisorOf(c),title=type==='crisis'?'Krizový plán':'Dědický plán';
 return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title} · ${e(c.name)} · Fair Life</title><style>${fontCss.replace(/<\/style/gi,'')}\n${css.replace(/<\/style/gi,'')}</style></head><body><nav class="doc-controls"><strong>${title}</strong><button id="doc-prev">←</button><select id="doc-select" aria-label="Stránka">${pages.map((p,i)=>`<option value="${i}">${i+1}. ${e(p.title)}</option>`).join('')}</select><button id="doc-next">→</button><button id="doc-mode">Po jedné stránce</button><button id="doc-print">Tisk / PDF</button></nav><main>${pages.map((p,i)=>`<section id="page-${i+1}" class="doc-page ${p.cover?'doc-cover':''}" aria-label="${i+1}. ${e(p.title)}"><header><img src="${fairLifeLogo}" alt="FairLife"><span>${e(title)}</span></header><div class="doc-page-content">${p.cover?'':`<div class="doc-eyebrow">${e(p.section)}</div><h1>${e(p.title)}</h1>`}${p.body}</div><footer><span>${e(a.name)} · ${e(c.date)}${c.demo?' · UKÁZKOVÁ DATA':''}</span><span>${i+1} / ${pages.length}</span></footer></section>`).join('')}</main><script>${documentScript}</script></body></html>`;
}
const documentScript=`(()=>{const pages=[...document.querySelectorAll('.doc-page')],sel=document.getElementById('doc-select');let current=0,single=false;function show(scroll=false){pages.forEach((p,i)=>p.hidden=single&&i!==current);sel.value=current;document.getElementById('doc-prev').disabled=current===0;document.getElementById('doc-next').disabled=current===pages.length-1;document.getElementById('doc-mode').textContent=single?'Všechny stránky':'Po jedné stránce';if(scroll)pages[current].scrollIntoView({block:'start'});}function go(i){current=Math.max(0,Math.min(pages.length-1,i));show(true);}sel.onchange=()=>go(Number(sel.value));document.getElementById('doc-prev').onclick=()=>go(current-1);document.getElementById('doc-next').onclick=()=>go(current+1);document.getElementById('doc-mode').onclick=()=>{single=!single;show(true);};document.getElementById('doc-print').onclick=()=>window.print();document.querySelectorAll('.doc-contents a').forEach(a=>a.onclick=ev=>{ev.preventDefault();go(Number(a.hash.replace('#page-',''))-1);});document.addEventListener('keydown',ev=>{if(['INPUT','TEXTAREA','SELECT'].includes(ev.target.tagName))return;if(ev.key==='ArrowRight')go(current+1);if(ev.key==='ArrowLeft')go(current-1);});show();})();`;
