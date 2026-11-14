/* A view over native activities, not a second task ledger. Learning is local,
   explicit assignment preference only; never inferred competence or actual work. */
(function(){
 'use strict';
 const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const same=(a,b)=>String(a??'')===String(b??''), now=()=>new Date().toISOString();
 let filter='me', period='open', query='';
 function link(s,a){for(const row of [...(s.opportunities||[]),...(s.deals||[])]){if(row.automation?.id===a.automation?.flowId&&a.automation?.flowId){const step=row.automation.steps.find(x=>x.id===a.automation.stepId);if(step)return {row,step};}}return null;}
 function owner(a){return a.automation?.assignee==='assistant'||(!a.automation&&a.taskAssignment?.owner==='assistant')?'assistant':'me';}
 function key(row,step){return JSON.stringify([row.category||'Ostatní',step.key]);}
 function rules(s){return s.settings?.taskDelegationRules||{};}
 function assign(s,a,to){
  if(!['me','assistant'].includes(to)||a.completed)throw Error('Tento úkol nelze přidělit.');
  const ref=link(s,a);if(to==='assistant'&&ref?.step.spec.delegate==='no')throw Error('Tento odborný krok není označen jako delegovatelný.');
  const old=owner(a), at=now();
  a.taskAssignment={owner:to,source:'manual',updatedAt:at,learningKey:ref?key(ref.row,ref.step):'',label:ref?`${ref.row.category} · ${ref.step.spec.title}`:'',history:[...(a.taskAssignment?.history||[]),{from:old,to,at}].slice(-50)};
  a.updatedAt=at;
  if(a.automation)a.automation.assignee=to;
  if(ref){ref.step.spec.assignee=to;ref.step.manualAssignment=true;ref.row.automation.updatedAt=at;}
 }
 function suggestions(s){
  const groups=new Map(),seen=new Set();
  for(const a of s.activities||[]){const d=a.taskAssignment,id=a.syncId||String(a.id);if(!d?.learningKey||d.source!=='manual'||seen.has(id))continue;seen.add(id);let g=groups.get(d.learningKey);if(!g){g={key:d.learningKey,label:d.label,total:0,assistant:0};groups.set(d.learningKey,g);}g.total++;if(d.owner==='assistant')g.assistant++;}
  return [...groups.values()].map(g=>({...g,eligible:g.total>=5&&g.assistant/g.total>=0.8}));
 }
 function setRule(s,k,enabled){
  const g=suggestions(s).find(x=>x.key===k);if(enabled&&!g?.eligible)throw Error('Pro návrh je potřeba alespoň 5 různých úkolů a 80 % voleb pro asistentku.');
  s.settings=s.settings||{};s.settings.taskDelegationRules={...rules(s),[k]:{enabled,updatedAt:now(),label:g?.label||rules(s)[k]?.label||k}};
 }
 function applyRule(s,row,step){
  if(step.manualAssignment||step.manualEstimate||step.spec.delegate==='no'||!rules(s)[key(row,step)]?.enabled)return;
  step.spec.assignee='assistant';step.assignmentRule=key(row,step);
 }
 function merge(s,incoming){s.settings=s.settings||{};const target=s.settings.taskDelegationRules={...rules(s)};for(const [k,r] of Object.entries(rules(incoming))){if(!target[k]||Date.parse(r.updatedAt)>Date.parse(target[k].updatedAt))target[k]=structuredClone(r);}}
 function ownerControl(a){return `<label class="task-owner">Odpovědnost<select aria-label="Odpovědnost úkolu" data-task-owner="${h(a.id)}"><option value="me" ${owner(a)==='me'?'selected':''}>FS · Filip</option><option value="assistant" ${owner(a)==='assistant'?'selected':''}>A · Asistentka (plán)</option></select></label>`;}
 function mutate(fn){const before=structuredClone(state);try{fn();if(!persist()){state=before;renderActiveView();return;}renderActiveView();}catch(e){state=before;renderActiveView();alert(e.message);}}
 function render(){
  const root=document.getElementById('taskCenter');if(!root)return;
  const today=CrmWorkflow.day(),all=(state.activities||[]).filter(a=>a.recordKind!=='history'&&!a.emailWait&&!activityIsInformational(a)),open=all.filter(a=>!a.completed);
  const selected=all.filter(a=>(filter==='all'||owner(a)===filter)&&(period==='done'?a.completed:!a.completed)&&(period!=='today'||a.date===today)&&(period!=='overdue'||a.date&&a.date<today)&&(!query||[a.text,clientName(state.clients.find(c=>same(c.id,a.clientId)))].join(' ').toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs')))).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'').localeCompare(b.time||''));
  const evidence=suggestions(state),saved=rules(state),keys=[...new Set([...evidence.map(g=>g.key),...Object.keys(saved)])];
  root.innerHTML=`<div class="toolbar"><h2>Úkoly</h2><button class="btn" data-task-action="new">+ Úkol</button></div><p class="note">Jeden přehled tvých úkolů i plánované práce asistentky. Přidělení nemění termín ani vazbu na kalendář Filip pracovní. Zatím vše spravuješ ty; asistentka nemá vlastní přístup.</p><div class="actions task-filters">${[['me','Moje'],['assistant','Asistentka'],['all','Vše']].map(([v,t])=>`<button class="btn ${v===filter?'primary':''}" aria-pressed="${v===filter}" data-task-filter="${v}">${t} · ${open.filter(a=>v==='all'||owner(a)===v).length}</button>`).join('')}<label>Zobrazit <select id="taskPeriod">${[['open','Otevřené'],['today','Dnes'],['overdue','Po termínu'],['done','Dokončené']].map(([v,t])=>`<option value="${v}" ${v===period?'selected':''}>${t}</option>`).join('')}</select></label><label>Klient / úkol <input id="taskQuery" value="${h(query)}" type="search" placeholder="Hledat"></label></div><p class="note">${selected.length} úkolů · termín neurčený je na konci</p><div>${selected.slice(0,200).map(a=>{
   const ref=link(state,a),client=state.clients.find(c=>same(c.id,a.clientId));return `<article class="wf-step ${!a.completed&&a.date&&a.date<today?'wf-overdue':''}"><div><b>${h(a.text||a.type||'Úkol')}</b><div class="note">${h(client?clientName(client):'Interní práce')} · ${h(a.date||'Bez termínu')} ${h(a.time||'')} ${ref?'· '+h(ref.row.product||ref.row.category)+' · '+h(ref.row.status||'Podepsáno'):''}</div><small>${a.automation?.status==='paused'?'Pozastaveno · ':''}${a.completed?(a.outcome==='realized'?'Dokončeno':'Uzavřeno bez realizace'):'Otevřeno'}${ref?' · odhad '+h(ref.step.spec.solo)+' min':''}</small></div><div class="actions">${!a.completed?ownerControl(a):`<span>${owner(a)==='assistant'?'Asistentka (plán)':'Filip'}</span>`}<button class="btn slim" data-task-edit="${h(a.id)}">${a.completed?'Detail':'Upravit / dokončit'}</button>${ref&&state.opportunities.includes(ref.row)?`<button class="btn slim" data-task-case="${h(ref.row.id)}">Případ</button>`:''}</div></article>`;}).join('')||'<p class="note">V tomto výběru nejsou žádné úkoly.</p>'}</div>${selected.length>200?'<p class="note">Zobrazeno prvních 200 úkolů. Upřesni hledání nebo období.</p>':''}<details class="wf-editor"><summary>Učení delegování · pravidla a moje rozhodnutí</summary><p class="note">Učí se pouze z tvých ručních voleb u kroků stejného typu obchodu a stejné šablony. Jeden úkol = jeden hlas, opakované přepínání nepřidává hlasy. Po alespoň 5 úkolech a 80 % voleb pro asistentku nabídne pravidlo. Zapneš ho výslovně; platí jen pro nově vytvářené úkoly a lze ho vypnout. Nehodnotí kvalitu práce a nepřiděluje nedelegovatelné kroky. Ruční úkoly bez šablony lze přidělit, ale nevytvářejí pravidla.</p>${keys.map(k=>{const g=evidence.find(x=>x.key===k),r=saved[k];return `<article class="wf-step"><div><b>${h(g?.label||r.label)}</b><p class="note">${g?`${g.assistant} z ${g.total} různých úkolů pro asistentku`:'Bez dostupných hlasů'} · ${r?.enabled?'Pravidlo zapnuto':g?.eligible?'Návrh připraven':'Sbírám rozhodnutí'}</p></div>${r?.enabled||g?.eligible?`<button class="btn" data-task-rule="${h(k)}" data-enabled="${!r?.enabled}">${r?.enabled?'Vypnout pravidlo':'Potvrdit automatické přidělení'}</button>`:''}</article>`;}).join('')||'<p class="note">Zatím žádná ruční rozhodnutí. Začni výběrem odpovědné osoby u úkolu.</p>'}</details>`;
 }
 document.addEventListener('input',e=>{if(e.target.id!=='taskQuery')return;const pos=e.target.selectionStart;query=e.target.value;render();const input=document.getElementById('taskQuery');input.focus();if(pos!==null)input.setSelectionRange(pos,pos);});
 document.addEventListener('change',e=>{const t=e.target;if(t.matches('[data-task-owner]'))mutate(()=>{const a=state.activities.find(x=>same(x.id,t.dataset.taskOwner));if(a)assign(state,a,t.value);});if(t.id==='taskPeriod'){period=t.value;render();}if(t.id==='taskQuery'){query=t.value;render();}});
 document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;if(t.dataset.taskFilter){filter=t.dataset.taskFilter;render();}if(t.dataset.taskEdit)openActivityModal(null,+t.dataset.taskEdit);if(t.dataset.taskCase)openCaseDetail(+t.dataset.taskCase);if(t.dataset.taskAction==='new'){openActivityModal();document.getElementById('aType').value='Úkol';}if(t.hasAttribute('data-task-rule'))mutate(()=>setRule(state,t.dataset.taskRule,t.dataset.enabled==='true'));});
 window.CrmTasks={render,owner,assign,ownerControl,suggestions,setRule,applyRule,merge};
})();
