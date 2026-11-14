/* Local, explicit planning. All actions reuse the native activity ledger. */
window.CrmPractice=(()=>{
'use strict';
const h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const same=(a,b)=>String(a??'')===String(b??''),stamp=()=>new Date().toISOString(),day=()=>CrmWorkflow.day(),plus=(d,n)=>CrmWorkflow.plus(d,n),valid=d=>CrmWorkflow.validDate(d);
const $=id=>document.getElementById(id),v=id=>$(id)?.value||'',btn=(label,action,id='')=>`<button class="btn" data-practice="${h(action)}" data-id="${h(id)}">${h(label)}</button>`;
const client=(s,id)=>s.clients.find(c=>same(c.id,id)),name=(s,id)=>clientName(client(s,id));
const protectedClient=(s,id)=>/\bdavid\b/i.test(name(s,id)||'');
const sources=s=>[...s.opportunities.map(row=>({row,key:'case:'+row.id})),...s.deals.map(row=>({row,key:'deal:'+row.id}))];
const source=(s,key)=>sources(s).find(x=>x.key===key);
const open=a=>!a.deletedAt&&!a.completed&&!a.completedAt&&a.recordKind!=='history'&&(!a.automation||a.automation.status==='open');
let currentTab='plan',preview=null,processPreview=null;
function monday(d){const wd=new Date(d+'T12:00:00Z').getUTCDay();return plus(d,-((wd+6)%7));}
function mutation(fn){const before=structuredClone(state);try{fn();if(!persist())throw Error('Změnu se nepodařilo uložit.');renderActiveView();return true;}catch(e){state=before;alert(e.message);return false;}}
function modal(body){crmExtraModal('practiceModal','Plánování a klientský servis',`<div class="task-segments practice-tabs">${[['plan','Týden · 2 h denně'],['service','Servis klientů'],['brief','Podklady a doporučení']].map(([k,l])=>btn(l,'tab',k)).join('')}</div><div class="practice-content">${body}</div>`);}
function mount(){const host=document.querySelector('#taskCenter>.toolbar .actions')||document.querySelector('#dashboard.active .toolbar');if(host&&!host.querySelector('[data-practice="open"]'))host.insertAdjacentHTML('beforeend',btn('Plánování a servis','open'));}
function evidence(s){
 const out=[];
 for(const c of s.clients){if(protectedClient(s,c.id))continue;
  for(const f of c.clientForms||[])out.push({clientId:c.id,kind:'Dotazník',title:f.name||f.formId,date:f.reminderDate||f.sentDate||'',status:f.responses?.length?'Odpovědi přijaty – zkontrolovat':f.sentDate?'Odesláno – čekání':'Přijato',ref:f.id});
  for(const d of c.documents||[])if(!d.deletedAt&&d.sent)out.push({clientId:c.id,kind:'Podklad / nabídka',title:d.title,date:d.date,status:'Odesláno; přijetí a kontrola nejsou potvrzeny',ref:d.id});
 }
 for(const a of s.activities)if(a.emailWait&&a.emailWait.status==='waiting'&&!protectedClient(s,a.clientId))out.push({clientId:a.clientId,kind:'E-mail',title:a.emailWait.topic,date:a.emailWait.due,status:'Odpověď není zaznamenána',ref:a.syncId});
 for(const {row} of sources(s))if(row.documentChecklist&&!protectedClient(s,row.clientId))for(const i of row.documentChecklist.items)if(!['checked','waived'].includes(i.status))out.push({clientId:row.clientId,kind:'Kontrola podkladů',title:i.title||i.name||row.product,date:'',status:{missing:'Chybí',requested:'Vyžádáno',received:'Přijato – nezkontrolováno'}[i.status]||i.status,ref:i.id});
 return out;
}
function evidenceHtml(s){const list=evidence(s);return `<details><summary>Podklady pro kontrolu týdne · ${list.length}</summary><p class="note">Odeslání, přijetí a kontrola jsou různé stavy. Záznamy bez vazby na úkol vyžadují posouzení; systém neodhaduje odpověď z času.</p>${list.map(x=>`<article class="wf-step"><div><b>${h(name(s,x.clientId))} · ${h(x.title)}</b><p>${h(x.kind)} · ${h(x.status)} · ${h(x.date)}</p></div>${btn('Otevřít klienta','client',x.clientId)}</article>`).join('')||'<p>Bez evidovaných čekání.</p>'}</details>`;}
function intervals(s,events,exclude=''){
 const list=[];
 for(const e of events){if(e.status==='cancelled'||e.transparency==='transparent'||e.extendedProperties?.private?.filipCrmActivity===exclude)continue;const z=CrmCalendarCore.shape(e);if(!z.start||!z.end)continue;list.push([z.allDay?z.start+'T00:00':z.start,z.allDay?z.end+'T00:00':z.end]);}
 for(const a of s.activities)if(open(a)&&a.time&&a.syncId!==exclude&&valid(a.date)){const start=a.date+'T'+a.time;const end=new Date(Date.parse(start+':00Z')+(+a.calendarDuration||+a.duration||30)*60000).toISOString().slice(0,16);list.push([start,end]);}
 return list;
}
function plan(s,start,events=[],now=day()){
 if(!valid(start)||monday(start)!==start)throw Error('Vyber datum v požadovaném týdnu.');
 const entries=CrmCapacity.entries(s),end=plus(start,4),priorities=s.dailyPriorities||[],taken=new Set(priorities.filter(p=>p.date>=start&&p.date<=end).map(p=>String(p.activityId))),busy=intervals(s,events),result=[],unscheduled=[];
 const candidates=entries.filter(x=>x.a&&x.status==='open'&&x.owner==='me'&&!x.a.time&&!x.a.emailWait&&!activityIsInformational(x.a)&&!protectedClient(s,x.a.clientId)&&!taken.has(String(x.a.id))&&(!x.a.date||x.a.date<=end)).sort((a,b)=>(a.a.date||'9999').localeCompare(b.a.date||'9999')||String(a.id).localeCompare(String(b.id)));
 for(const x of candidates){const n=x.estimate?.solo;if(!n||n>120){unscheduled.push({...x,why:!n?'Doplnit odhad':'Rozdělit úkol nad 2 hodiny'});continue;}let placed=false;
  for(let i=0;i<5&&!placed;i++){const date=plus(start,i);if(date<now)continue;const existing=priorities.filter(p=>p.date===date),planned=result.filter(p=>p.date===date),scheduled=entries.filter(x=>x.a?.date===date&&x.a.time&&x.status==='open'&&x.owner==='me'&&x.a.type!=='Schůzka'),scheduledIds=new Set(scheduled.map(x=>String(x.a.id))),used=scheduled.reduce((sum,x)=>sum+(x.estimate?.solo??(Number(x.a.calendarDuration)||120)),0)+existing.reduce((sum,p)=>{const x=entries.find(z=>same(z.a?.id,p.activityId));return sum+(scheduledIds.has(String(p.activityId))||x?.a?.time&&x.a.type==='Schůzka'?0:x?.estimate?.solo??120);},0)+planned.reduce((sum,p)=>sum+p.minutes,0);
   if(used+n>120||existing.length+planned.length>=3)continue;
   const slot=[1,2,3].find(k=>!existing.some(p=>+p.slot===k)&&!planned.some(p=>p.slot===k));
   for(let min=9*60;min+n<=17*60;min+=15){if(date===day()){const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date());if(min<+local.slice(0,2)*60+(+local.slice(3))+15)continue;}const time=String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0'),a=date+'T'+time,b=new Date(Date.parse(a+':00Z')+n*60000).toISOString().slice(0,16);if(busy.some(([lo,hi])=>a<hi&&lo<b))continue;
    result.push({id:x.a.id,syncId:x.a.syncId,date,time,minutes:n,slot,title:x.title,clientId:x.a.clientId,before:JSON.stringify(x.a)});busy.push([a,b]);placed=true;break;
   }
  }
  if(!placed)unscheduled.push({...x,why:'Nevchází do zbývající kapacity / volného času'});
 }
 return {start,end,rows:result,unscheduled};
}
function acceptPlan(s,p){
 for(const x of p.rows){const a=s.activities.find(a=>same(a.id,x.id));if(!a||JSON.stringify(a)!==x.before)throw Error('Úkol se změnil. Vytvoř nový návrh.');if(s.dailyPriorities.some(q=>q.date===x.date&&(+q.slot===x.slot||same(q.activityId,a.id))))throw Error('Priority se změnily. Vytvoř nový návrh.');}
 for(const x of p.rows){const a=s.activities.find(a=>same(a.id,x.id));a.planningDeadline=a.planningDeadline||a.date||'';Object.assign(a,{date:x.date,time:x.time,calendarDuration:x.minutes,updatedAt:stamp()});if(a.automation){a.automation.manualDate=true;a.automation.calendarRequestedAt=stamp();}s.dailyPriorities.push({id:s.nextId++,date:x.date,slot:x.slot,title:x.title,activityId:a.id,clientId:a.clientId,status:'Čeká',note:'Navrženo v limitu 120 minut denně; původní termín '+(a.planningDeadline||'neurčen'),createdAt:stamp(),updatedAt:stamp()});}
}
function planner(){preview=null;modal(`<p>Maximálně <b>120 minut denně</b> a 3 priority. Nabídka volných bloků v pracovních dnech 9–17 h. Stávající schůzky, ruční priority a David zůstávají zachované.</p><label class="field">Týden obsahující den<input id="practiceWeek" type="date" value="${day()}"></label>${btn('Načíst kalendář a navrhnout týden','preview')}<p id="practiceStatus" role="status"></p><div id="practicePlan"></div>${evidenceHtml(state)}`);}
async function buildPlan(){const start=monday(v('practiceWeek'));$('practiceStatus').textContent='Ověřuji Filip pracovní…';try{const events=await CrmCalendar.availability(start,plus(start,6));preview=plan(state,start,events);$('practiceStatus').textContent='Kalendář ověřen. Návrh zatím nic nemění.';$('practicePlan').innerHTML=preview.rows.map(x=>`<article class="wf-step"><div><b>${h(x.title)}</b><p>${h(name(state,x.clientId))} · ${h(x.date)} ${h(x.time)} · ${x.minutes} min${state.activities.find(a=>same(a.id,x.id))?.date<x.date?' · PŮVODNÍ TERMÍN JIŽ UPLYNUL':''}</p></div></article>`).join('')+`<p>Mimo návrh: ${preview.unscheduled.length} úkolů.</p><details><summary>Důvody nezařazení</summary>${preview.unscheduled.map(x=>`<p>${h(x.title)} · ${h(x.why)}</p>`).join('')}</details>`+(preview.rows.length?btn('Použít návrh a aktualizovat stejné úkoly','apply-plan'):'<p>Žádné volné priority k doplnění.</p>');}catch(e){preview=null;$('practiceStatus').textContent=e.message+' Bez ověření kalendáře nelze návrh použít.';}}
async function applyPlan(){if(!preview)return;const p=preview;const events=await CrmCalendar.availability(p.start,plus(p.start,6));const fresh=plan(state,p.start,events);if(JSON.stringify(fresh.rows)!==JSON.stringify(p.rows))throw Error('Kalendář nebo úkoly se změnily. Načti nový návrh.');if(mutation(()=>acceptPlan(state,p))){planner();$('practiceStatus').textContent='Priority uloženy. Termíny jsou na původních úkolech. Přenos do Google probíhá existující synchronizací; její případné konflikty zkontroluj v Kalendáři.';}}
function inactive(c){return c.deletedAt||c.hidden||/zru[sš]|ukon[cč]|storno|neplat|vypov|výpov/i.test([c.status,c.statuses?.join?.(' ')].filter(Boolean).join(' '));}
function services(s,now=day()){
 const until=plus(now,90),out=[];
 for(const c of s.contracts){if(inactive(c)||protectedClient(s,c.clientId))continue;let date='',why='';
  if(valid(c.serviceDueDate)){date=c.serviceDueDate;why='Ručně ověřený servisní termín';}
  else if(['auto','majetek'].includes(c.type)){date=contractReviewDate(c,now);why='Výročí · servisní rytmus CRM';}
  else if(c.type==='hypotéka'&&valid(c.anniv)){date=c.anniv;why='Evidovaný konec fixace – ověř platnost údaje';}
  if(!date||date>until)continue;
  const saved=(c.serviceCycles||[]).find(x=>x.date===date),key=saved?.syncId||'service:'+c.id+':'+date,task=s.activities.find(a=>a.syncId===key||a.serviceCycle?.kind!=='expert'&&same(a.serviceCycle?.contractId,c.id)&&a.serviceCycle?.date===date);
  const forms=(client(s,c.clientId)?.clientForms||[]).filter(f=>same(f.contractId,c.id)&&f.sentDate&&f.sentDate>=plus(date,-90)&&f.sentDate<=date);
  out.push({c,date,why,key,task,forms,suppressed:!!saved&&!task});
 }
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
function serviceTask(s,key,now=day()){const x=services(s,now).find(x=>x.key===key);if(!x)throw Error('Servis již není aktuální.');if(x.task)return x.task;if(x.suppressed)throw Error('Původní servisní úkol byl odstraněn. Automaticky se neobnovuje.');
 const remember=a=>{x.c.serviceCycles=x.c.serviceCycles||[];if(!x.c.serviceCycles.some(c=>c.date===x.date))x.c.serviceCycles.push({date:x.date,syncId:a.syncId});x.c.updatedAt=stamp();return a;};
 const related=s.activities.filter(a=>open(a)&&same(a.clientId,x.c.clientId)&&(same(a.contractId,x.c.id)||same(a.sourceContractId,x.c.id))&&/servis|výroč|fixac|kontrol/i.test(a.text||''));
 if(related.length>1)throw Error('Existuje více navazujících úkolů. Propoj je ručně; další nebyl vytvořen.');
 if(related[0]){related[0].serviceCycle={contractId:x.c.id,date:x.date};related[0].updatedAt=stamp();return remember(related[0]);}
 if(x.forms.length)throw Error('K tomuto cyklu je už odeslaný dotazník. Nejprve zkontroluj jeho odpověď a existující připomínku na kartě klienta.');
 const due=plus(x.date,x.c.type==='hypotéka'?-90:-60);const a={id:s.nextId++,syncId:key,clientId:x.c.clientId,contractId:x.c.id,type:'Úkol',text:'Připravit servis: '+[x.c.type,x.c.company,x.c.product].filter(Boolean).join(' · '),date:due<now?now:due,time:'',completed:false,recordKind:'activity',outcome:'agreed',serviceCycle:{contractId:x.c.id,date:x.date},automation:{origin:'service',status:'open',assignee:'assistant',calendarRequestedAt:stamp()},workEstimate:{solo:15,assistant:15,residual:5,delegate:'yes',source:'Odhad přípravy servisu'},createdAt:stamp(),updatedAt:stamp()};s.activities.push(a);return remember(a);}
function reconcile(s){
 for(const a of [...s.activities]){if(!a.serviceCycle||a.serviceCycle.kind==='expert'||!a.completed||a.outcome!=='realized'||protectedClient(s,a.clientId))continue;
  const c=s.contracts.find(c=>same(c.id,a.serviceCycle.contractId));if(!c||inactive(c))continue;
  if(a.serviceExpertCreated)continue;
  const id='service-expert:'+a.syncId;if(s.activities.some(x=>x.syncId===id)){a.serviceExpertCreated=true;continue;}
  s.activities.push({id:s.nextId++,syncId:id,clientId:a.clientId,contractId:c.id,type:'Úkol',text:'Odborně posoudit servis: '+(c.product||c.type),date:day(),time:'',completed:false,recordKind:'activity',outcome:'agreed',serviceCycle:{...a.serviceCycle,kind:'expert',parentSyncId:a.syncId},automation:{origin:'service',status:'open',assignee:'me'},workEstimate:{solo:30,assistant:0,residual:30,delegate:'no'},createdAt:stamp(),updatedAt:stamp()});a.serviceExpertCreated=true;a.updatedAt=stamp();
 }
 for(const a of s.activities.filter(a=>a.serviceCycle?.kind==='expert'&&!a.completed)){const parent=s.activities.find(x=>x.syncId===a.serviceCycle.parentSyncId),c=s.contracts.find(c=>same(c.id,a.serviceCycle.contractId));a.automation.status=parent?.completed&&parent.outcome==='realized'&&c&&!inactive(c)?'open':'paused';}
}
function serviceView(){const rows=services(state);modal(`<details><summary>Vlastní servisní termín pro další produkty</summary><label>Smlouva<select id="practiceContract">${state.contracts.filter(c=>!inactive(c)&&!protectedClient(state,c.clientId)).map(c=>`<option value="${h(c.id)}">${h(name(state,c.clientId))} · ${h(c.product||c.type)} · ${h(c.number||'')}</option>`).join('')}</select></label><label>Ověřený termín<input id="practiceServiceDate" type="date"></label>${btn('Uložit servisní termín','service-date')}</details><p>Výročí auta a majetku a evidované fixace hypoték do 90 dnů. Přípravu přebírá asistentka, odborné rozhodnutí Filip. Časy 60 / 90 dnů jsou pracovní předstihy, nikoli smluvní lhůty.</p><p class="note">Ostatní typy vyžadují vlastní ověřený servisní termín. Odeslaný dotazník se nepovažuje za dokončený servis.</p>${rows.map(x=>`<article class="wf-step"><div><b>${h(name(state,x.c.clientId))} · ${h(x.c.product||x.c.type)}</b><p>${h(x.date)} · ${h(x.why)}</p><small>${x.suppressed?'Původní úkol odstraněn – neobnovuji':x.task?(x.task.completed?'Kontrola uzavřena; výsledek viz aktivita':'Existující kontrola '+x.task.date):x.forms.length?'Dotazník odeslán – navázat na jeho kontrolu':'Bez servisního úkolu'}</small></div><div class="actions">${x.suppressed?btn('Otevřít klienta','client',x.c.clientId):x.task?btn('Otevřít kontrolu','activity',x.task.id):x.forms.length?btn('Otevřít klienta','client',x.c.clientId):btn('Připravit servisní úkol','service',x.key)}</div></article>`).join('')||'<p>Žádné termíny v daném horizontu.</p>'}`);}
function brief(s,id){const c=client(s,id);if(!c)throw Error('Klient chybí.');const contracts=s.contracts.filter(x=>same(x.clientId,id)&&!inactive(x)),cases=sources(s).filter(x=>same(x.row.clientId,id));return ['PODKLAD PRO JEDNÁNÍ – '+name(s,id),'Vygenerováno '+day()+' ze záznamů CRM. Údaje ještě ověř s klientem.','', 'KONTAKT', 'E-mail: '+(c.email||'Nezadáno'),'Telefon: '+(c.phone||'Nezadáno'),'','SMLOUVY (bez součtu nesrovnatelných částek)',...contracts.map(x=>`• ${x.type||''} / ${x.company||''} / ${x.product||''} | zdroj: smlouva #${x.id} | termín: ${x.anniv||'nezadán'}`),'','ROZPRACOVANÉ PŘÍPADY',...cases.map(x=>`• ${x.row.product||x.row.category} | ${x.row.status||'podepsaný obchod'} | zdroj: ${x.key}`),'','DOKUMENTY A ODPOVĚDI',...evidence(s).filter(x=>same(x.clientId,id)).map(x=>`• ${x.title}: ${x.status} | ${x.date} | zdroj: ${x.kind} ${x.ref}`),'','OVĚŘIT PŘED FINÁLNÍM PLÁNEM','• Cíle, termíny a priority klienta; aktuálnost příjmů, výdajů a rezerv.','• Zůstatky úvěrů, vlastnictví majetku a závazků; měsíční platba není hodnota majetku.','• Rizikový profil, zkušenosti a přiměřenost řešení v příslušných kalkulacích.','• Tento přehled nepředstavuje schválené finanční doporučení.'].join('\n');}
function referral(s,key,date){const x=source(s,key);if(!x||!key.startsWith('deal:')||protectedClient(s,x.row.clientId)||!valid(date))throw Error('Vyber podepsaný obchod a platný termín.');const syncId='referral:'+key;let a=s.activities.find(a=>a.syncId===syncId||a.referralPreparation?.sourceKey===key);if(a)return a;a={id:s.nextId++,syncId,clientId:x.row.clientId,type:'Úkol',text:'Připravit k Filipovu schválení žádost o doporučení',date,time:'',completed:false,recordKind:'activity',outcome:'agreed',referralPreparation:{sourceKey:key,draft:'Dobrý den, děkuji za spolupráci. Pokud jste s ní spokojeni a víte o někom, komu by podobná pomoc prospěla, můžete mu předat můj kontakt. Děkuji, Filip Solár.'},automation:{origin:'referral',status:'open',assignee:'assistant'},workEstimate:{solo:10,assistant:10,residual:3,delegate:'yes'},createdAt:stamp(),updatedAt:stamp()};s.activities.push(a);return a;}
function briefView(id=''){modal(`<p>Podklad čerpá z uložených údajů; žádné částky ani doporučení nedoplňuje odhadem. Finanční plán pokračuje v současném editoru Majetek a plán.</p><label class="field">Klient<select id="practiceClient">${state.clients.map(c=>`<option value="${h(c.id)}" ${same(c.id,id)?'selected':''}>${h(clientName(c))}</option>`).join('')}</select></label>${btn('Připravit podklad','brief')}<div id="practiceBrief"></div>`);}
function renderBrief(){const id=v('practiceClient'),text=brief(state,id);$('practiceBrief').innerHTML=`<textarea id="practiceBriefText" rows="15" readonly>${h(text)}</textarea><div class="actions">${btn('Kopírovat podklad','copy-brief')}${btn('Otevřít Majetek a plán','family',id)}</div><details><summary>Žádost o doporučení · jen návrh ke schválení</summary><p>Vyber vhodný dokončený obchod po ověření spokojenosti klienta. Kopírování návrhu ani příprava úkolu nejsou odesláním.</p><label>Obchod<select id="practiceDeal">${state.deals.filter(d=>same(d.clientId,id)).map(d=>`<option value="deal:${h(d.id)}">${h(d.product||d.category)}</option>`).join('')}</select></label><label>Termín přípravy<input id="practiceReferralDate" type="date" value="${day()}"></label>${btn('Připravit úkol asistentce','referral')}<div id="practiceReferral"></div></details>`;}
function merge(s,incoming,maps){
 for(const c of incoming.contracts||[]){const id=maps.contracts?.get(String(c.id)),local=s.contracts.find(x=>same(x.id,id));if(!local)continue;
  if(c.serviceDueDate&&(!local.serviceDueDate||String(c.updatedAt)>String(local.updatedAt)))local.serviceDueDate=c.serviceDueDate;
  local.serviceCycles=[...new Map([...(c.serviceCycles||[]),...(local.serviceCycles||[])].map(x=>[x.date,x])).values()];
 }
 for(const a of incoming.activities||[]){const id=maps.activities?.get(String(a.id)),local=s.activities.find(x=>same(x.id,id));if(!local)continue;
  if(a.serviceCycle){const cid=maps.contracts?.get(String(a.serviceCycle.contractId));if(cid!=null&&(!local.serviceCycle||local.serviceCycle.contractId===a.serviceCycle.contractId))local.serviceCycle={...a.serviceCycle,contractId:cid};if(cid!=null)local.contractId=cid;}
  if(a.referralPreparation){const [kind,old]=a.referralPreparation.sourceKey.split(':'),id=maps.deals?.get(old);if(kind==='deal'&&id!=null&&(!local.referralPreparation||local.referralPreparation.sourceKey===a.referralPreparation.sourceKey))local.referralPreparation={...a.referralPreparation,sourceKey:'deal:'+id};}
 }
}
function show(tab=currentTab){currentTab=tab;if(tab==='service')serviceView();else if(tab==='brief')briefView();else planner();}
function productTemplate(row){
 const p=row.automation,base=p?{id:p.templateId,category:row.category,name:row.category+' – podrobný postup',version:p.version+1,steps:[...new Map(p.steps.map(x=>[x.key,structuredClone(x.spec)])).values()]}:CrmWorkflow.defaultTemplate(row.category);
 const category=String(row.category||''),loan=/Hypot|Úvěr/i.test(category),life=/Život/i.test(category),invest=/Invest|FKI|Penz/i.test(category);
 const additions=[];
 const add=(key,title,trigger,dependsOn,expert=false,minutes=15)=>additions.push({key:'detail:'+key,title,trigger,dependsOn,offset:1,working:true,assignee:expert?'me':'assistant',solo:minutes,assistant:expert?0:minutes,residual:expert?minutes:3,delegate:expert?'no':'yes',condition:'always',cancelOn:'closed',completeOn:'',replaceOn:''});
 // Existing first steps keep identity; new dependent work activates only after real completion.
 if(life){
  add('health','Zkontrolovat zdravotní dotazník a potřebu lékařských zpráv','stage:Scoring',['scoring'],true,25);
  add('preassessment','Připravit podklady pro předoocenění pojišťovnou','stage:Scoring',['detail:health']);
  add('result','Posoudit výsledek předoocenění a výluky','stage:Schvalování',['approval'],true,25);
  add('consent','Projednat upravenou nabídku a zaznamenat souhlas klienta','stage:Schvalování',['detail:result'],true,20);
 }else if(loan){
  add('income','Odborně ověřit příjmy, závazky a předpoklady financování','stage:Scoring',['scoring'],true,30);
  add('valuation','Zkontrolovat dostupnost odhadu a podkladů k zástavě','stage:Kompletace',['completion']);
  add('approval','Posoudit schválené podmínky úvěru','stage:Schvalování',['approval'],true,25);
  add('drawdown','Odborně ověřit podmínky a termín čerpání','signed',['admin'],true,30);
  add('drawdown-check','Zkontrolovat doložení podmínek a potvrzení čerpání','signed',['detail:drawdown']);
 }else if(invest){
  add('profile','Ověřit aktuální cíle, profil klienta a potřebné dotazníky','stage:Nabídka',['proposal'],true,30);
  add('cost','Projednat rizika, náklady a vhodnost řešení','stage:Nabídka',['detail:profile'],true,25);
  add('allocation','Ověřit připsání prostředků a shodu s odsouhlaseným pokynem','signed',['admin'],true,20);
 }else{
  add('risk','Posoudit rozsah krytí, limity a případné výluky','stage:Nabídka',['proposal'],true,25);
  add('data','Zkontrolovat údaje předávané do smlouvy','stage:Kompletace',['completion']);
 }
 add('signature-docs','Zkontrolovat vrácení podepsaných dokumentů','signed',['admin']);
 add('payment','Zkontrolovat první platbu / potvrzení přijetí prostředků','signed',['detail:signature-docs']);
 add('handover','Připravit klientovi souhrn a návrh dalšího servisu','signed',['detail:payment']);
 base.steps.push(...additions.filter(x=>!base.steps.some(y=>y.key===x.key)));CrmWorkflow.validateDependencies(base.steps);return base;
}
function install(s,key){const x=source(s,key);if(!x||protectedClient(s,x.row.clientId))throw Error('Tento případ nelze automaticky měnit.');if(!x.row.automation)CrmWorkflow.attach(s,x.row,key.startsWith('deal:'),day(),true);const p=x.row.automation,t=productTemplate(x.row);
 // Existing activities and their manual dates/assignment must remain byte-for-byte unchanged.
 const existing=new Map(s.activities.map(a=>[a.syncId,structuredClone(a)]));CrmWorkflow.applyVersion(s,x.row,t);for(const a of s.activities)if(existing.has(a.syncId))Object.assign(a,existing.get(a.syncId));
 p.productDetailVersion=1;p.updatedAt=stamp();CrmWorkflow.reconcile(s);return p;
}
function process(key){const x=source(state,key);if(!x)return;const t=productTemplate(x.row);processPreview={key,before:JSON.stringify(x.row)};modal(`<h3>${h(x.row.product||x.row.category)} · podrobný postup</h3><p>Ponechá současné úkoly a doplní návazné kroky. Termín závislého kroku vznikne po dokončení předchůdce; zrušený krok neznamená splněný. Odborné kroky patří Filipovi, administrativa asistentce.</p><p class="note">Pracovní šablona k přizpůsobení konkrétnímu produktu; nejde o automatické finanční rozhodování. Podklady dál spravuje existující kontrolní seznam.</p>${t.steps.filter(x=>x.key.startsWith('detail:')).map(x=>`<article class="wf-step"><div><b>${h(x.title)}</b><p>${h(x.trigger.replace('stage:',''))} · ${x.assignee==='me'?'Filip':'Asistentka'} · ${x.solo} min</p><small>Po: ${h(x.dependsOn.map(k=>t.steps.find(y=>y.key===k)?.title||k).join(', '))}</small></div></article>`).join('')}${x.row.automation?.productDetailVersion?'<p>Podrobný postup je již zapnutý. Kroky upravuj v pracovním postupu případu.</p>':btn('Zapnout pouze pro tento případ','install',key)}`);}
document.addEventListener('click',async e=>{const processButton=e.target.closest('[data-practice-process]');if(processButton){process(processButton.dataset.practiceProcess);return;}const b=e.target.closest('[data-practice]');if(!b)return;const {practice:a,id}=b.dataset;try{
 if(a==='service-date'){const c=state.contracts.find(c=>same(c.id,v('practiceContract'))),d=v('practiceServiceDate');if(!c||!valid(d)||protectedClient(state,c.clientId))throw Error('Vyber smlouvu a platný termín.');if(mutation(()=>{c.serviceDueDate=d;c.updatedAt=stamp();}))serviceView();}else if(a==='open')show();else if(a==='tab')show(id);else if(a==='preview')await buildPlan();else if(a==='apply-plan')await applyPlan();else if(a==='service'){if(mutation(()=>serviceTask(state,id)))serviceView();}else if(a==='client'){closeModal('practiceModal');openClientWorkspace(Number(id),'overview');}else if(a==='activity'){closeModal('practiceModal');openActivityModal(null,Number(id));}else if(a==='brief')renderBrief();else if(a==='copy-brief'){await navigator.clipboard.writeText(v('practiceBriefText'));b.textContent='Zkopírováno';}else if(a==='family'){closeModal('practiceModal');openClientWorkspace(Number(id),'wealth');CrmFamily.open(Number(id));}else if(a==='referral'){let task;if(mutation(()=>{task=referral(state,v('practiceDeal'),v('practiceReferralDate'));}))$('practiceReferral').innerHTML=`<p>Úkol připraven · ${h(task.date)}</p><textarea rows="5" readonly>${h(task.referralPreparation.draft)}</textarea>${btn('Otevřít úkol','activity',task.id)}`;}else if(a==='install'){if(!processPreview||JSON.stringify(source(state,id)?.row)!==processPreview.before)throw Error('Případ se změnil. Otevři nový náhled.');if(mutation(()=>install(state,id)))process(id);}
 }catch(err){alert(err.message);}});
return {merge,reconcile,mount,plan,acceptPlan,evidence,services,serviceTask,brief,referral,productTemplate,install,show};
})();
