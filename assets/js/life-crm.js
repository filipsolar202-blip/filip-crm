/* Per-client persistence for the supplied life calculator; no portfolio/production mutation. */
(function(){
 'use strict';
 const clone=x=>structuredClone(x),eq=(a,b)=>String(a??'')===String(b??''),now=()=>new Date().toISOString();
 let session=null,timer=null,dirty=false,pendingImport=null,pendingCase=null,uploadOwner=null;
 function client(){return session&&eq(selectedClientId,session.clientId)&&clientSection==='life'?findClient(session.clientId):null;}
 function brand(c){return /mantra/i.test(clientManagementId(c)+' '+managementPartner(clientManagementId(c)).company)?'mantra':'fairlife';}
 function identity(c){const p={name:clientName(c)},rc=Life.parseNationalId(String(c.birthId||''));if(!rc.error&&rc.birth){p.nationalId=String(c.birthId);p.birth=rc.birth;p.sex=rc.sex;}else if(c.birthDate&&Life.validDate(c.birthDate))p.birth=c.birthDate;return p;}
 function ensure(c){
  if(c.lifeInsurance?.data)return c.lifeInsurance;
  const data=Life.normalize(Life.fresh()),id=crypto.randomUUID();Object.assign(data.adults[0],identity(c));data.reportBrand=brand(c);data.advisorBrand=brand(c);data.crmLifeRef=id;Life.syncCoverage(data);
  c.lifeInsurance={id,data,updatedAt:now(),history:[],importSignatures:[]};dirty=true;return c.lifeInsurance;
 }
 function draft(data){
  const raw=JSON.stringify(data);if(raw.length>5e6)throw Error('Kalkulace je příliš velká.');
  const walk=(v,depth=0)=>{if(depth>25)throw Error('Příliš složitá struktura.');if(v&&typeof v==='object')for(const [k,x] of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Neplatná struktura kalkulace.');walk(x,depth+1);}};walk(data);
  if(data?.schema!=='life-wizard'||data.schemaVersion!==1||!Array.isArray(data.adults)||data.adults.length!==2||!Array.isArray(data.children)||data.children.length>5||!Array.isArray(data.offers)||data.offers.length!==3)throw Error('Neplatný formát kalkulace.');return JSON.parse(raw);
 }
 function send(type,extra={}){const f=document.getElementById('clientLifeFrame');if(session&&f?.contentWindow)f.contentWindow.postMessage({channel:'filip-life',token:session.token,type,...extra},location.origin);}
 function status(text){const el=document.getElementById('lifeSaveState');if(el)el.textContent=text;}
 function flush(){clearTimeout(timer);if(!dirty)return true;const ok=persist();dirty=!ok;status(ok?'Uloženo ke klientovi.':'Uložení selhalo. Nezavírej stránku; stáhni kalkulaci jako zálohu.');send('saved',{ok});return ok;}
 function queue(){dirty=true;status('Ukládám změny…');clearTimeout(timer);timer=setTimeout(flush,400);}
 function view(c){const p=ensure(c),b=brand(c);return `<section class="life-client"><div class="toolbar"><div><h3>Život · ${b==='mantra'?'Mantra':'FairLife'}</h3><p class="note" id="lifeSaveState">Kalkulace patří pouze tomuto klientovi.</p></div><div class="actions"><button class="btn" onclick="CrmLife.questionnaire()">Dotazník pro klienta</button><button class="btn" onclick="CrmLife.chooseImport()">Načíst odpovědi / kalkulaci</button><button class="btn" onclick="CrmLife.prefill()">Doplnit známé údaje</button><button class="btn" onclick="CrmLife.history()">Historie kalkulací (${p.history?.length||0})</button></div></div><p class="note">Vybraná nabídka vytvoří rozpracovaný obchodní případ. Podpis ani BJ se nepotvrdí automaticky.</p><iframe id="clientLifeFrame" title="Životní pojištění – kalkulace klienta" src="assets/life/calculator.html?v=2026.11.04-2&amp;embed=1" allow="clipboard-write"></iframe></section>`;}
 function mount(c){session={clientId:c.id,token:crypto.randomUUID()};if(dirty)queue();}
 function archive(p,reason){p.history||=[];const last=p.history[p.history.length-1];if(last?.reason===reason&&JSON.stringify(last.data)===JSON.stringify(p.data))return;p.history.push({id:crypto.randomUUID(),calculationId:p.id,date:now(),reason,data:clone(p.data)});}
 function replace(data,reason){const c=client();if(!c)return;const before=clone(c.lifeInsurance),p=ensure(c);archive(p,reason);p.data=draft(data);p.data.crmLifeRef=p.id;p.updatedAt=now();dirty=true;if(!flush()){c.lifeInsurance=before;dirty=false;return false;}send('replace',{data:p.data});return true;}
 function prefill(){const c=client();if(!c)return;const next=clone(ensure(c).data),known=identity(c);for(const [k,v] of Object.entries(known))if(!next.adults[0][k])next.adults[0][k]=v;replace(next,'Doplnění prázdných identifikačních údajů z CRM');}
 function chooseImport(){if(!client())return;uploadOwner=client().id;let input=document.getElementById('lifeImportFile');if(!input){input=document.createElement('input');input.id='lifeImportFile';input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);input.onchange=async()=>{try{const f=input.files[0];if(!f)return;if(f.size>5e6)throw Error('Soubor je příliš velký.');const data=JSON.parse(await f.text());if(!eq(client()?.id,uploadOwner))throw Error('Otevřený klient se změnil. Vyber soubor znovu na správné kartě.');previewImport(data,f.name);}catch(e){alert(e.message);}finally{input.value='';}};}input.click();}
 function previewImport(value,name='Odpovědi'){
  const c=client();if(!c)return;Life.validate(value);const p=ensure(c),ref=value.crmLifeRef,knownRefs=[p.id,...(p.history||[]).map(x=>x.calculationId)];
  if(ref&&!knownRefs.includes(ref))throw Error('Dotazník patří jinému klientovi. Otevři správnou kartu; nic nebylo změněno.');
  const person=value.adults[0],current=p.data.adults[0],strong=v=>String(v||'').replace(/\W/g,'');
  if(person.nationalId&&c.birthId&&strong(person.nationalId)!==strong(c.birthId))throw Error('Rodné číslo v dotazníku nesouhlasí s klientem. Import byl zastaven.');
  if(!ref&&!importNamesCompatible(person.name,clientName(c))&&norm(person.name)!==norm(clientName(c)))throw Error('Jméno v nepřiřazeném dotazníku nesouhlasí s klientem. Import byl zastaven.');
  const signature=JSON.stringify(value);if((p.importSignatures||[]).includes(signature)){alert('Tento soubor již byl převzat. Kalkulace zůstává beze změny.');return;}
  let data=Life.normalize(clone(value));const answers=value.documentType==='client-answers';
  if(answers){
    const old=p.data;data.offers=clone(old.offers);data.recommended=old.recommended;data.recommendationReason=old.recommendationReason;data.message=old.message;data.currentPremium=old.currentPremium;data.guarantee=old.guarantee;data.coverage=clone(old.coverage);data.reportBrand=old.reportBrand;
    const previous=[...old.adults,...old.children],used=new Set();
    for(const [i,person] of [...data.adults,...data.children].entries()){
      const match=i===0?old.adults[0]:previous.find(x=>!used.has(x.id)&&((person.nationalId&&strong(person.nationalId)===strong(x.nationalId))||(person.name&&norm(person.name)===norm(x.name)&&person.birth===x.birth)));
      if(match&&!used.has(match.id)){person.id=match.id;used.add(match.id);person.hiddenRisks=clone(match.hiddenRisks||[]);person.overrides=clone(match.overrides||{});}
    }
    Life.syncCoverage(data);data.step=0;
  }
  data.crmLifeRef=p.id;pendingImport={clientId:c.id,data,name,signature};
  crmExtraModal('lifeImportPreview','Převzetí do klienta '+clientName(c),`<p><b>${esc(name)}</b> · ${answers?'Klientské odpovědi':'Celá kalkulace'}</p><p>${esc(Life.active(data).map(x=>x.name).join(', '))} · děti: ${data.children.length}</p><p class="note">${answers?'Převezmou se osobní údaje, odpovědi a rozpočet. Existující nabídky, ceny a krytí zůstanou zachované; nová doporučení zkontroluj ve výpočtu. Změna složení domácnosti může odstranit krytí odebraných osob.':'Nahradí se celá kalkulace včetně variant.'} Předchozí stav se uloží do historie. Karta klienta, ostatní klienti a obchody se nemění.</p><button class="btn primary" onclick="CrmLife.confirmImport()">Převzít po kontrole</button>`);
 }
 function confirmImport(){if(!pendingImport||!eq(client()?.id,pendingImport.clientId))return alert('Klient se změnil. Otevři nový náhled.');const p=ensure(client()),before=clone(p);p.importSignatures||=[];p.importSignatures.push(pendingImport.signature);if(replace(pendingImport.data,'Import: '+pendingImport.name)){closeModal('lifeImportPreview');pendingImport=null;}else client().lifeInsurance=before;}
 function questionnaire(){const c=client();if(!c)return;const b=brand(c);crmExtraModal('lifeQuestionnaire','Dotazník pro klienta',`<p>${esc(clientName(c))} · správce ${esc(managementPartner(clientManagementId(c)).name)}</p><label>Značka<select id="lifeQuestionnaireBrand"><option value="fairlife" ${b==='fairlife'?'selected':''}>FairLife · f.solar@fair-life.cz</option><option value="mantra" ${b==='mantra'?'selected':''}>Mantra · filip.solar@mantra-finance.cz</option></select></label><label><input type="checkbox" id="lifeQuestionnairePrefill" checked> Předvyplnit pouze známé jméno, narození, pohlaví a rodné číslo</label><p class="note">Soubor bude patřit tomuto klientovi. Neobsahuje nabídky, interní poznámky ani zdravotní odpovědi z kalkulace. Klient vrátí soubor zivot-odpovedi.json, který zde načteš. Stažení souboru samo neodesílá e-mail.</p><button class="btn primary" onclick="CrmLife.downloadQuestionnaire()">Stáhnout HTML k odeslání</button>`);}
 async function downloadQuestionnaire(){
  const c=client();if(!c)return;const p=ensure(c),b=val('lifeQuestionnaireBrand')==='mantra'?'mantra':'fairlife',prefill=document.getElementById('lifeQuestionnairePrefill').checked;
  if(!flush())return;const response=await fetch('assets/life/dotaznik-'+b+'.html?v=2026.11.04-2');if(!response.ok)throw Error('Dotazník se nepodařilo načíst.');let html=await response.text();
  const seed=JSON.stringify({ref:p.id,identity:prefill?identity(c):{},brand:b}).replace(/</g,'\\u003c');
  const script='<script>(function(){const seed='+seed+';d=L.normalize(L.fresh());Object.assign(d.adults[0],seed.identity);d.crmLifeRef=seed.ref;d.reportBrand=seed.brand;d.advisorBrand=seed.brand;d.clientChecks={household:false,children:false};render();})();<'+ '/script>';
  html=html.includes('</body>')?html.replace('</body>',script+'</body>'):html+script;
  downloadHtmlFile(html,'dotaznik-'+b+'-'+String(c.id)+'.html');closeModal('lifeQuestionnaire');
 }
 function history(){const c=client();if(!c)return;const p=ensure(c);crmExtraModal('lifeHistory','Historie kalkulace',`<button class="btn" onclick="CrmLife.newCalculation()">Založit novou kalkulaci</button><p class="note">Automatické ukládání zachovává aktuální rozepsaný stav. Snímek vzniká před importem, obnovou a převodem do případu.</p>${(p.history||[]).slice().reverse().map(x=>`<div class="product-row"><div><b>${esc(x.reason)}</b><small>${esc(x.date)}</small></div><button class="btn" data-life-restore="${esc(x.id)}">Obnovit</button></div>`).join('')||'<p>Zatím bez předchozích snímků.</p>'}`);}
 function newCalculation(){const c=client();if(!c||!confirm('Založit novou kalkulaci se známou identitou klienta? Současná kalkulace zůstane celá v historii.'))return;const p=ensure(c),before=clone(p);archive(p,'Před založením nové kalkulace');p.id=crypto.randomUUID();p.data=Life.normalize(Life.fresh());Object.assign(p.data.adults[0],identity(c));p.data.reportBrand=brand(c);p.data.advisorBrand=brand(c);p.data.crmLifeRef=p.id;Life.syncCoverage(p.data);p.updatedAt=now();p.importSignatures=[];dirty=true;if(!flush()){c.lifeInsurance=before;dirty=false;return;}pendingCase=null;pendingImport=null;send('replace',{data:p.data});closeModal('lifeHistory');}
 function offerSummary(data,index){const offer=data.offers[index],product=CrmLifeCatalog.products.find(x=>x.id===offer?.productId);if(!product||offer.premium==null||!Number.isFinite(+offer.premium)||+offer.premium<0)throw Error('Nejdříve vyber variantu, její produkt a měsíční pojistné.');return {offer,product,text:[`Životní pojištění · varianta ${index+1}`,`Pojištěné osoby: ${Life.active(data).concat(data.children).map(p=>p.name).join(', ')}`,`Měsíční pojistné: ${offer.premium} Kč`,data.recommendationReason?`Doporučení: ${data.recommendationReason}`:''].filter(Boolean).join('\n')};}
 function propose(data){const c=client();if(!c)return;Life.validate(data);const index=data.recommended;if(!Number.isInteger(index)||index<0||index>2)throw Error('V Nabídkách nejprve zvol doporučenou variantu.');const selected=offerSummary(data,index),p=ensure(c),key=p.id+':'+index;
  const existing=state.opportunities.find(x=>x.lifeProposal?.key===key&&eq(x.clientId,c.id)),deal=state.deals.find(x=>x.lifeProposal?.key===key&&eq(x.clientId,c.id));
  if(deal){alert('Tato varianta již byla uzavřena jako obchod. Další duplicitní případ se nevytvoří.');return;}
  pendingCase={clientId:c.id,calculationId:p.id,key,index,data:clone(data),existingId:existing?.id||null,product:selected.product,text:selected.text};
  crmExtraModal('lifeCasePreview',existing?'Aktualizovat navázaný případ':'Nový případ z vybrané varianty',`<h3>${esc(selected.product.insurer)} · ${esc(selected.product.name||selected.product.product||selected.product.id)}</h3><p>Měsíční pojistné ${money(selected.offer.premium)}</p><p class="note">${existing?'Otevře se existující případ této varianty. Nové údaje z kalkulace potvrď jeho uložením.':'Otevře se předvyplněný nový případ ve fázi Nabídka. Zkontroluj jej a ulož.'} Nezakládá se podepsaná smlouva ani automatické BJ.</p><button class="btn primary" onclick="CrmLife.openCase()">Otevřít případ k uložení</button>`);
 }
 function openCase(){const p=pendingCase;if(!p||!eq(client()?.id,p.clientId))return;closeModal('lifeCasePreview');if(!flush())return;openOpportunityModal(p.clientId,p.existingId);pendingCase=p;setVal('oCategory','Život');setVal('oCompany',p.product.insurer);setVal('oProduct',p.product.name||p.product.product||p.product.id);setVal('oAmount',p.data.offers[p.index].premium);const previous=p.existingId?state.opportunities.find(o=>eq(o.id,p.existingId))?.note:'';setVal('oNote',previous?(previous.includes(p.text)?previous:previous+'\n\nAktualizace kalkulace:\n'+p.text):p.text);if(!p.existingId)setVal('oStatus','Nabídka');}
 function decorate(o){const p=pendingCase;if(!p||!eq(o.clientId,p.clientId)||!eq(p.existingId||'',editingOpportunityId||''))return;o.lifeProposal={key:p.key,calculationId:p.calculationId,variant:p.index,selectedAt:now(),data:clone(p.data)};const c=findClient(o.clientId);archive(ensure(c),'Varianta '+(p.index+1)+' připravena do obchodního případu');}
 function clearCase(){pendingCase=null;}
 function mountCase(o){if(!o.lifeProposal)return;const root=document.getElementById('caseDetailContent'),actions=root?.querySelector('.case-detail-breadcrumb .actions');if(!actions||actions.querySelector('[data-life-client]'))return;const button=document.createElement('button');button.className='btn';button.textContent='Kalkulace Život · varianta '+(o.lifeProposal.variant+1);button.dataset.lifeClient=o.clientId;button.onclick=()=>openClientWorkspace(o.clientId,'life');actions.append(button);}

 function mergeClient(target,source){if(!source.lifeInsurance)return;if(!target.lifeInsurance){target.lifeInsurance=clone(source.lifeInsurance);return;}const t=target.lifeInsurance,s=source.lifeInsurance;if(JSON.stringify(t)===JSON.stringify(s))return;
  t.history||=[];const add=x=>{if(!t.history.some(y=>y.id===x.id))t.history.push(clone(x));};(s.history||[]).forEach(add);
  if(JSON.stringify(t.data)!==JSON.stringify(s.data)){
    if(t.id===s.id&&Date.parse(s.updatedAt)>Date.parse(t.updatedAt)){add({id:'merge:'+t.id+':'+t.updatedAt,calculationId:t.id,date:t.updatedAt,reason:'Předchozí stav ze sloučení',data:t.data});t.data=clone(s.data);t.updatedAt=s.updatedAt;}
    else add({id:'merge:'+s.id+':'+s.updatedAt,calculationId:s.id,date:s.updatedAt,reason:'Kalkulace ze sloučené zálohy / klienta',data:s.data});
  }
  t.importSignatures=[...new Set([...(t.importSignatures||[]),...(s.importSignatures||[])])];
 }
 window.addEventListener('message',e=>{
  const frame=document.getElementById('clientLifeFrame');if(!session||!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.channel!=='filip-life')return;
  const msg=e.data,c=client();if(!c)return;
  if(msg.type==='ready'){send('init',{data:clone(ensure(c).data)});return;}
  if(msg.token!==session.token)return;
  try{
    if(msg.type==='save'){const p=ensure(c);p.data=draft(msg.data);p.data.crmLifeRef=p.id;p.updatedAt=now();queue();}
    if(msg.type==='case')propose(msg.data);
    if(msg.type==='import')chooseImport();
  }catch(err){status(err.message);alert(err.message);}
 });
 document.addEventListener('click',e=>{const b=e.target.closest('[data-life-restore]');if(!b||!client())return;const p=ensure(client()),item=p.history.find(x=>x.id===b.dataset.lifeRestore);if(item&&confirm('Obnovit tento snímek? Současný stav se zachová v historii.')){replace(item.data,'Před obnovením historické kalkulace');closeModal('lifeHistory');}});
 window.addEventListener('beforeunload',e=>{if(dirty&&!flush()){e.preventDefault();e.returnValue='';}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)flush();});
 window.CrmLife={view,mount,flush,ensure,draft,identity,brand,prefill,chooseImport,previewImport,confirmImport,questionnaire,newCalculation,downloadQuestionnaire:()=>downloadQuestionnaire().catch(e=>alert(e.message)),history,propose,openCase,decorate,clearCase,mountCase,mergeClient};
})();
