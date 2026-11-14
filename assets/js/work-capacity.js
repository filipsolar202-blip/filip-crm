/* Derived estimates share the existing activity ledger. They never create tasks,
   mark work performed, change dates or send messages. */
(function(){
 'use strict';
 const same=(a,b)=>String(a??'')===String(b??''),h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const minutes=x=>x!==''&&x!=null&&Number.isFinite(+x)&&+x>=0?+x:null;
 const fmt=n=>n==null?'Nezjištěno':n>=60?`${Math.floor(n/60)} h${n%60?' '+Math.round(n%60*10)/10+' min':''}`:`${Math.round(n*10)/10} min`;
 const ended=new Set(['cancelled','missed','moved']),closed=new Set(['Zrušeno','Zamítnuto','Klient nemá zájem']);
 function sources(s){
  const seen=new Set();return [['deal',s.deals||[]],['case',s.opportunities||[]]].flatMap(([kind,list])=>list.map(row=>({key:kind+':'+row.id,row,kind}))).filter(x=>{const id=x.row.automation?.id;if(id&&seen.has(id))return false;if(id)seen.add(id);return true;});
 }
 function sourceFor(s,a,list=sources(s)){
  const original=(s.opportunities||[]).find(x=>a.sourceOpportunityId!=null&&same(x.id,a.sourceOpportunityId));
  return list.find(x=>(a.workFlowId||a.automation?.flowId)&&x.row.automation?.id===(a.workFlowId||a.automation.flowId))||list.find(x=>a.documentCheck?.id&&x.row.documentChecklist?.id===a.documentCheck.id)||list.find(x=>x.kind==='case'&&a.sourceOpportunityId!=null&&same(x.row.id,a.sourceOpportunityId))||list.find(x=>original?.automation?.id&&x.row.automation?.id===original.automation.id)||null;
 }
 function status(a,step,row){
  if(a){if(ended.has(a.automation?.status))return a.automation.status;if(['no_show','noshow'].includes(a.outcome))return 'missed';if(a.outcome==='moved')return 'moved';if(a.completed||a.completedAt)return a.outcome==='realized'?'done':'cancelled';}
  if(step?.enabled===false||closed.has(row?.status))return 'cancelled';
  if(!a&&step?.status==='planned')return 'planned';
  if(row?.automation&&(row.automation.paused||!row.automation.enabled)||a?.automation?.status==='paused')return 'paused';
  return a?'open':step?.status||'planned';
 }
 function clean(raw){if(!raw)return null;const solo=minutes(raw.solo);if(solo===null)return null;const delegate=['yes','partial','no'].includes(raw.delegate)?raw.delegate:'unknown';return {solo,delegate,assistant:delegate==='no'?0:minutes(raw.assistant),residual:delegate==='no'?solo:minutes(raw.residual),source:raw.source||'Odhad šablony'};}
 function estimate(a,step){
  let spec;
  if(a?.capacitySnapshot&&status(a)==='done')spec=clean(a.capacitySnapshot);
  else if(a?.workEstimate)spec=clean(a.workEstimate);
  else if(step)spec=clean({...step.completedEstimate||step.spec,source:'Šablona pracovního postupu'});
  else if(a?.documentCheck)spec=clean(a.documentCheck.kind==='expert'?{solo:30,delegate:'no',source:'Výchozí odhad odborného posouzení'}:{solo:10,assistant:10,residual:2,delegate:'yes',source:'Výchozí odhad kontroly podkladů'});
  else if(a?.automation?.origin==='email')spec=clean({solo:10,assistant:10,residual:2,delegate:'yes',source:'Výchozí odhad kontroly odpovědi'});
  else if(a){const defaults={Telefon:10,Schůzka:60,Email:10,SMS:5,'Úkol':15};spec=clean({solo:defaults[a.type],delegate:'unknown',source:'Orientační odhad podle typu aktivity'});}
  if(a?.work?.timeKind==='estimate'&&minutes(a.duration)!==null&&!a.capacitySnapshot&&!a.workEstimate)spec={...(spec||{}),solo:minutes(a.duration),delegate:spec?.delegate||'unknown',source:'Tvůj zapsaný odhad'};
  if(spec&&a?.documentCheck?.kind==='expert')spec={...spec,delegate:'no',assistant:0,residual:spec.solo};
  return spec;
 }
 function entries(s){
  const list=sources(s),bySync=new Map((s.activities||[]).filter(a=>a.syncId).map(a=>[a.syncId,a])),seen=new Set(),out=[];
  function add(src,a,step){
   const id=a?'activity:'+(a.syncId||a.id):'step:'+src.row.automation.id+':'+step.id;if(seen.has(id))return;seen.add(id);
   const st=status(a,step,src?.row),e=estimate(a,step),owner=st==='done'&&a?.capacitySnapshot?a.capacitySnapshot.owner:(a?CrmTasks.owner(a):step?.spec.assignee)||'me';
   const measured=!!a&&(a.completed||!!a.completedAt)&&a.work?.timeKind==='actual'?minutes(a.duration):null;
   const can=!!e&&['yes','partial'].includes(e.delegate)&&e.assistant!==null&&e.residual!==null;
   out.push({id,src,a,step,status:st,estimate:e,owner,measured,can,title:a?.text||step?.spec.title||a?.type||'Úkol'});
  }
  for(const src of list)for(const step of src.row.automation?.steps||[])add(src,bySync.get(step.activitySyncId),step);
  for(const a of s.activities||[]){if(a.emailWait||activityIsInformational(a)||a.recordKind==='history'&&a.work?.timeKind!=='actual')continue;add(sourceFor(s,a,list),a,null);}
  return out;
 }
 function total(rows){
  const t={soloTotal:0,me:0,assistant:0,saving:0,candidateAssistant:0,retained:0,doneEstimate:0,actual:0,actualCount:0,future:0,paused:0,unknown:0,unassessed:0,readyCount:0};
  for(const x of rows){
   if(x.measured!==null){t.actual+=x.measured;t.actualCount++;}
   const e=x.estimate;if(e&&!ended.has(x.status))t.soloTotal+=e.solo;
   if(x.status==='done'){if(e)t.doneEstimate+=e.solo;continue;}
   if(ended.has(x.status))continue;
   if(!e){t.unknown++;continue;}
   if(x.status==='planned'){t.future+=e.solo;continue;}
   if(x.status==='paused'){t.paused+=e.solo;continue;}
   if(x.status!=='open')continue;
   if(x.owner==='assistant'){
    if(x.can){t.me+=e.residual;t.assistant+=e.assistant;}else{t.unknown++;}
   }else{
    t.me+=e.solo;
    if(x.can&&e.solo>e.residual){t.saving+=e.solo-e.residual;t.candidateAssistant+=e.assistant;t.retained+=e.residual;t.readyCount++;}
    else if(e.delegate==='unknown')t.unassessed++;
   }
  }
  return t;
 }
 function reconcile(s){
  for(const x of entries(s)){if(x.a?.capacitySnapshot&&!['done','cancelled','missed','moved'].includes(x.status)){x.a.capacityEstimateHistory=[...(x.a.capacityEstimateHistory||[]),x.a.capacitySnapshot];delete x.a.capacitySnapshot;x.a.updatedAt=new Date().toISOString();}if(x.a&&x.status==='done'&&x.estimate&&!x.a.capacitySnapshot){x.a.capacitySnapshot={...x.estimate,owner:x.owner,at:new Date().toISOString(),version:1};x.a.updatedAt=new Date().toISOString();}}
 }
 const label=(s,src)=>src?`${typeof clientName==='function'?clientName((s.clients||[]).find(c=>same(c.id,src.row.clientId))):'Klient'} · ${src.row.product||src.row.category||'Případ'}`:'Bez vazby na obchod';
 function selectRows(s,key='',category=''){return entries(s).filter(x=>(!key||x.src?.key===key||x.src?.row.automation?.id===key)&&(!category||x.src?.row.category===category));}
 function cards(rows){const t=total(rows);return `<div class="capacity-metrics">${[['Zbývá tobě',fmt(t.me),'Podle aktuálního rozdělení'],['Naplánováno asistentce',fmt(t.assistant),'Její odhadovaná kapacita'],['Ještě můžeš uvolnit',fmt(t.saving),`${t.readyCount} úkolů · asistentka ${fmt(t.candidateAssistant)} · tvá kontrola ${fmt(t.retained)}`],['Skutečně zapsáno',t.actualCount?fmt(t.actual):'Zatím bez měření',`${t.actualCount} záznamů · celkem bez rozlišení vykonavatele`]].map(([title,value,note])=>`<div class="capacity-metric"><small>${title}</small><b>${value}</b><span>${note}</span></div>`).join('')}</div><p class="note">Celkový odhad samostatné práce včetně podmíněných kroků: <b>${fmt(t.soloTotal)}</b>. Dokončené kroky – odhad při samostatné práci: <b>${fmt(t.doneEstimate)}</b> · budoucí podmíněné kroky: <b>${fmt(t.future)}</b> · pozastavené: <b>${fmt(t.paused)}</b>. ${t.unknown?`${t.unknown} kroků nemá úplný odhad a v kapacitě chybí. `:''}${t.unassessed?`${t.unassessed} otevřených úkolů ještě nemá posouzené delegování.`:''}</p>`;}
 function summaryHtml(key='',category=''){return `<div class="capacity-panel">${cards(selectRows(state,key,category))}<button class="btn" data-capacity-case="${h(key)}">Čas a delegování · podrobnosti</button></div>`;}
 let currentKey='',currentCategory='',returnFocus=null,entryLimit=100;
 function open(key='',category=''){
  currentKey=key;currentCategory=category;entryLimit=100;let root=document.getElementById('capacityModal');if(!root){root=document.createElement('div');root.id='capacityModal';root.className='modal workflow-modal';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Čas a delegování');document.body.append(root);}root.style.display='flex';render();
 }
 function close(){const root=document.getElementById('capacityModal');if(root)root.style.display='none';returnFocus?.focus?.();}
 function refresh(){if(document.getElementById('capacityModal')?.style.display==='flex')render();}
 function render(){
  const all=selectRows(state,currentKey,currentCategory),t=total(all),list=sources(state),target=list.find(x=>x.key===currentKey||x.row.automation?.id===currentKey),groups=new Map();
  for(const x of all){const key=x.src?.key||'';if(!groups.has(key))groups.set(key,{src:x.src,rows:[]});groups.get(key).rows.push(x);}
  const candidates=all.filter(x=>x.status==='open'&&x.owner!=='assistant'&&x.can&&x.estimate.solo>x.estimate.residual);
  const root=document.getElementById('capacityModal');root.innerHTML=`<div class="box capacity-panel"><div class="toolbar"><div><h2>Čas a delegování</h2><p class="note">${h(target?label(state,target):'Přehled obchodů a úkolů')}</p></div><button class="btn" data-capacity-action="close">Zavřít</button></div><p class="note">Časy se automaticky odvozují z šablon a existujících úkolů. Dokončené kroky mají odhad uložený zvlášť od skutečně zapsaných minut. Přidělení asistentce je zatím plán práce; nepotvrzuje, kdo práci skutečně provedl.</p><div class="actions">${currentKey?'<button class="btn" data-capacity-case="">Všechny obchody</button>':`<label>Typ obchodu<select id="capacityCategory"><option value="">Všechny typy</option>${[...new Set(list.map(x=>x.row.category).filter(Boolean))].sort().map(c=>`<option ${c===currentCategory?'selected':''}>${h(c)}</option>`).join('')}</select></label>`}<button class="btn" data-wf-action="templates" data-capacity-templates>Upravit výchozí odhady v šablonách</button></div>${cards(all)}<h3>Práce, kterou můžeš předat</h3><p class="note">Úspora = tvůj čas samostatně minus tvůj čas kontroly po předání. Čas asistentky se počítá samostatně. Odborné kroky nejsou v návrzích k předání.</p><div class="capacity-candidates">${candidates.map(x=>`<article class="wf-step"><div><b>${h(x.title)}</b><p class="note">${h(label(state,x.src))}</p><small>Ty ${fmt(x.estimate.solo)} → kontrola ${fmt(x.estimate.residual)} · asistentka ${fmt(x.estimate.assistant)} · uvolníš ${fmt(x.estimate.solo-x.estimate.residual)}</small></div><div class="actions"><button class="btn" data-capacity-action="assign" data-id="${h(x.a.id)}">Předat asistentce</button><button class="btn" data-capacity-action="estimate" data-id="${h(x.a.id)}">Upravit odhad</button></div></article>`).join('')||'<p class="note">Žádné další otevřené úkoly s potvrzeným odhadem úspory. U ostatních úkolů můžeš doplnit odhad a možnost delegování.</p>'}</div><h3>Souhrn podle obchodu</h3><div class="table-wrap"><table><thead><tr><th>Klient / obchod</th><th>Celkem – odhad</th><th>Zbývá tobě</th><th>Asistentka</th><th>Ještě uvolnit</th><th>Hotovo – odhad</th><th>Skutečně zapsáno</th></tr></thead><tbody>${[...groups.values()].map(g=>{const q=total(g.rows);return `<tr><td>${g.src?`<button class="btn slim" data-capacity-case="${h(g.src.key)}">${h(label(state,g.src))}</button>`:'Bez vazby na obchod'}</td><td>${fmt(q.soloTotal)}</td><td>${fmt(q.me)}</td><td>${fmt(q.assistant)}</td><td>${fmt(q.saving)}</td><td>${fmt(q.doneEstimate)}</td><td>${q.actualCount?fmt(q.actual):'Nezjištěno'}</td></tr>`;}).join('')}</tbody></table></div><details ${currentKey?'open':''}><summary>Zdrojové kroky a úprava odhadů · ${all.length}</summary><p class="note">Ruční úkoly bez vazby se nepřiřazují k obchodům jen podle jména klienta. Historické obchody bez postupu nemají zpětně vymyšlený čas. ${list.filter(x=>!x.row.automation).length} obchodů nemá zapnutou šablonu.</p>${all.slice(0,entryLimit).map(x=>`<article class="wf-step"><div><b>${h(x.title)}</b><p class="note">${h(label(state,x.src))} · ${{open:'Otevřeno',done:'Dokončeno',planned:'Budoucí podmíněný krok',paused:'Pozastaveno',cancelled:'Zrušeno',missed:'Neuskutečněno',moved:'Přesunuto'}[x.status]||h(x.status)} · ${x.owner==='assistant'?'Asistentka (plán)':'Filip (plán)'}</p><small>${x.estimate?`${h(x.estimate.source)} · samostatně ${fmt(x.estimate.solo)} · delegování ${{yes:'ano',partial:'částečně',no:'ne',unknown:'neposouzeno'}[x.estimate.delegate]}`:'Odhad chybí'}${x.measured!==null?' · skutečně '+fmt(x.measured):''}</small></div><div class="actions">${x.a?`${!['done','cancelled','missed','moved'].includes(x.status)?`<button class="btn" data-capacity-action="estimate" data-id="${h(x.a.id)}">Odhad / delegování</button>`:''}<button class="btn" data-capacity-action="activity" data-id="${h(x.a.id)}">Zapsat skutečný čas / detail</button>`:''}</div></article>`).join('')}${all.length>entryLimit?'<button class="btn" data-capacity-action="more">Zobrazit dalších 100 kroků</button>':''}</details><p class="note">Přehled nemění termíny ani nevytváří kalendářní události. Výchozí minuty jsou pracovní předpoklady, které si můžeš upravit.</p></div>`;
 }
 function edit(id){const a=state.activities.find(x=>same(x.id,id)),x=entries(state).find(x=>x.a===a);if(!x)return;const e=x.estimate||{},locked=a.documentCheck?.kind==='expert'||x.step?.spec.delegate==='no';document.getElementById('capacityModal').innerHTML=`<div class="box capacity-panel"><h2>Odhad · ${h(x.title)}</h2><p class="note">Platí jen pro tento úkol. Skutečné minuty zůstávají oddělené. Odhad se nepřepisuje délkou události v kalendáři.</p><div class="capacity-form"><label>Tvůj čas samostatně (min)<input id="capacitySolo" type="number" min="0" value="${h(e.solo??'')}"></label><label>Delegování<select id="capacityDelegate" ${locked?'disabled':''}>${[['unknown','Ještě neposouzeno'],['yes','Ano'],['partial','Částečně'],['no','Ne']].map(([v,t])=>`<option value="${v}" ${v===(locked?'no':e.delegate||'unknown')?'selected':''}>${t}</option>`).join('')}</select></label><label>Čas asistentky (min)<input id="capacityAssistant" type="number" min="0" value="${h(e.assistant??'')}"></label><label>Tvůj čas kontroly po předání (min)<input id="capacityResidual" type="number" min="0" value="${h(e.residual??'')}"></label></div><div class="actions"><button class="btn" data-capacity-action="save" data-id="${h(a.id)}">Uložit odhad</button><button class="btn" data-capacity-action="back">Zpět</button></div></div>`;}
 function setEstimate(s,a,data){
  if(status(a)!=='open'&&status(a)!=='paused')throw Error('Odhad dokončeného kroku je uchovaný v historii.');
  const e=clean({...data,source:'Tvůj odhad pro tento úkol'});if(!e||e.solo>100000||['yes','partial'].includes(e.delegate)&&(e.assistant===null||e.residual===null))throw Error('Doplň nezáporné minuty. U delegování vyplň také čas asistentky a vlastní kontroly.');
  if([e.assistant,e.residual].some(v=>v!==null&&v>100000))throw Error('Odhad je příliš vysoký.');
  const x=entries(s).find(x=>x.a===a);if((a.documentCheck?.kind==='expert'||x?.step?.spec.delegate==='no')&&e.delegate!=='no')throw Error('Odborný krok zůstává u Filipa.');
  if(CrmTasks.owner(a)==='assistant'&&e.delegate==='no')throw Error('Nejdřív přiděl úkol zpět sobě.');
  if(x?.step){Object.assign(x.step.spec,{solo:e.solo,assistant:e.assistant??0,residual:e.residual??e.solo,delegate:e.delegate==='unknown'?x.step.spec.delegate:e.delegate});x.step.manualEstimate=true;x.src.row.automation.updatedAt=new Date().toISOString();}
  a.workEstimate={...e,version:1,updatedAt:new Date().toISOString()};a.updatedAt=a.workEstimate.updatedAt;
 }
 function transaction(fn){const before=structuredClone(state);try{fn();if(!persist()){state=before;renderActiveView();return;}renderActiveView();refresh();}catch(e){state=before;alert(e.message);}}
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-capacity-case],[data-capacity-action],[data-capacity-templates]');if(!b)return;
  if(b.hasAttribute('data-capacity-templates')){close();return;}
  if(b.hasAttribute('data-capacity-case')){returnFocus=b;open(b.dataset.capacityCase);return;}
  const act=b.dataset.capacityAction,id=b.dataset.id,a=state.activities.find(x=>same(x.id,id));
  if(act==='close')close();else if(act==='back')render();else if(act==='more'){entryLimit+=100;render();}else if(act==='estimate')edit(id);else if(act==='activity'){close();openActivityModal(null,+id);}
  else if(act==='assign')transaction(()=>{const x=entries(state).find(x=>x.a===a);if(!x||x.status!=='open'||!x.can)throw Error('Tento úkol nyní nelze předat.');CrmTasks.assign(state,a,'assistant');});
  else if(act==='save')transaction(()=>setEstimate(state,a,{solo:document.getElementById('capacitySolo').value,delegate:document.getElementById('capacityDelegate').value,assistant:document.getElementById('capacityAssistant').value,residual:document.getElementById('capacityResidual').value}));
 });
 document.addEventListener('change',e=>{if(e.target.id==='capacityCategory'){currentCategory=e.target.value;entryLimit=100;render();}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
 window.CrmCapacity={estimate,entries,total,reconcile,summaryHtml,open,refresh,setEstimate};
})();
