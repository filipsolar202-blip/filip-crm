/* Native CRM activities are the only task ledger. Plans retain versioned step definitions,
   event identities and estimates; no activity is inferred as completed from elapsed time. */
(function () {
  'use strict';
  const STAGES=['Opportunity','Nabídka','Scoring','Kompletace','Schvalování','Podpis','K zadání (BeTy)'];
  const CLOSED=['Zamítnuto','Klient nemá zájem','Zrušeno'];
  const CATEGORIES=['Život','Auto','Nemovitost','Hypotéka','Úvěry','Penze','Investice','FKI','Ostatní'];
  const EVENTS={'activity:Telefon':'Zaznamenán telefonát','activity:Email':'Zaznamenán e-mail','activity:Schůzka':'Zaznamenána schůzka',created:'Založení / zapnutí postupu',documents:'Podklady vyžádány',offer:'Nabídka odeslána',contact:'Další kontakt',signed:'Podpis',...Object.fromEntries(STAGES.map(x=>['stage:'+x,'Fáze: '+x]))};
  const clone=x=>structuredClone(x), same=(a,b)=>String(a??'')===String(b??''), stamp=()=>new Date().toISOString();
  const uuid=()=>crypto.randomUUID(), h=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>document.getElementById(id), value=id=>$(id)?.value||'';
  function day(date=new Date()) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
  function validDate(d) {return /^\d{4}-\d{2}-\d{2}$/.test(d||'')&&!Number.isNaN(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;}
  function plus(d,offset,working=false) {
    if(!validDate(d))return '';
    const date=new Date(d+'T12:00:00Z'), direction=offset<0?-1:1;
    for(let n=Math.abs(offset);n>0;){date.setUTCDate(date.getUTCDate()+direction);if(!working||![0,6].includes(date.getUTCDay()))n--;}
    return date.toISOString().slice(0,10);
  }
  function defaultTemplate(category) {
    const mortgage=['Hypotéka','Úvěry'].includes(category), investment=['FKI','Investice','Penze'].includes(category);
    const spec=(key,title,trigger,offset,solo,delegate='partial',assistant=solo,residual=5,extra={})=>({key,title,trigger,offset,working:false,assignee:'me',solo,delegate,assistant:delegate==='no'?0:assistant,residual:delegate==='no'?solo:residual,condition:'always',completeOn:'',cancelOn:'closed',replaceOn:'',...extra});
    return {id:'workflow:'+category,category,name:category+' – pracovní postup',version:1,updatedAt:'2026-10-31T00:00:00Z',steps:[
      spec('prepare','Zkontrolovat zadání a domluvit další postup','created',0,15,'partial',15,5),
      spec('proposal',mortgage?'Připravit úvěrovou nabídku':'Připravit nabídku a doporučení','stage:Nabídka',0,mortgage?45:30,'partial',35,10,{completeOn:'offer'}),
      spec('documents','Zkontrolovat doručení podkladů','documents',3,10,'yes',10,2),
      spec('follow','Navázat na odeslanou nabídku','offer',3,10,'no',0,10),
      spec('contact','Domluvený další kontakt','contact',0,10,'no',0,10),
      spec('approval','Prověřit stav schvalování','stage:Schvalování',3,10,'partial',10,3),
      spec('sign','Připravit podpis a zkontrolovat smlouvu','stage:Podpis',0,20,'partial',20,5,{completeOn:'signed'}),
      spec('admin',investment?'Zkontrolovat připsání investice a dokumenty':'Zkontrolovat účinnost smlouvy a dokumenty','signed',3,20,'yes',20,5),
      spec('commission','Zkontrolovat očekávanou provizi','signed',14,10,'yes',10,2)
    ]};
  }
  function normalize(s) {
    s.workflowTemplates=Array.isArray(s.workflowTemplates)?s.workflowTemplates:[];
    CATEGORIES.forEach(c=>{if(!s.workflowTemplates.some(t=>t.category===c))s.workflowTemplates.push(defaultTemplate(c));});
  }
  function sources(s) {return [...s.opportunities.map(row=>({row,signed:false})),...s.deals.map(row=>({row,signed:true}))];}
  function find(s,id) {return sources(s).find(x=>x.row.automation?.id===id);}
  function template(s,category) {category=({'Hypotéky':'Hypotéka','Životní pojištění':'Život','Neživotní pojištění':'Auto'})[category]||category;return s.workflowTemplates.find(t=>t.category===category)||s.workflowTemplates.find(t=>t.category==='Ostatní');}
  let activityIndex=null;
  function bySync(s,id){return activityIndex?.state===s?activityIndex.records.get(id):s.activities.find(a=>a.syncId===id);}
  function task(s,step) {return bySync(s,step.activitySyncId);}
  function log(plan,text) {plan.history.push({id:uuid(),date:stamp(),text});plan.updatedAt=stamp();}
  function newStep(spec,cycle=0) {return {id:uuid(),key:spec.key,cycle,spec:clone(spec),enabled:true,status:'planned',activitySyncId:null};}
  function attach(s,row,signed=false,date=day()) {
    if(row.automation)return row.automation;
    normalize(s);
    const t=template(s,row.category), p={id:uuid(),templateId:t.id,version:t.version,enabled:true,paused:false,startedAt:date,lastStage:signed?'Podepsáno':row.status||'Opportunity',lastContact:'',events:[],history:[],steps:t.steps.map(x=>newStep(x)),updatedAt:stamp(),knownContacts:s.activities.filter(a=>same(a.sourceOpportunityId,row.id)).map(a=>a.syncId||String(a.id))};
    row.automation=p;
    // A signed standalone trade starts with post-signature work, not invented historic activity.
    if(signed)p.steps.filter(x=>x.spec.trigger!=='signed').forEach(x=>{x.status='cancelled';x.reason='Před podpisem – nezpětně evidováno';});
    emit(s,row,signed?'signed':'created',date,signed?{key:'signed'}:{});
    if(!signed)emit(s,row,'stage:'+p.lastStage,date);
    log(p,'Použita šablona '+t.name+' v'+t.version+(signed?' od podpisu':''));
    return p;
  }
  function setTaskState(a,status,date=day()) {
    a.automation.status=status;a.updatedAt=stamp();
    a.completed=['done','cancelled','missed'].includes(status);
    a.completedAt=a.completed?date:'';
    a.recordKind=status==='cancelled'?'history':'activity';
    a.outcome=status==='done'?'realized':status==='missed'?'no_show':'agreed';
  }
  function cancelStep(s,p,step,reason) {
    if(['done','cancelled','missed'].includes(step.status))return;
    step.status='cancelled';step.reason=reason;
    const a=task(s,step);if(a)setTaskState(a,'cancelled');
    log(p,reason+': '+step.spec.title);
  }
  function finishStep(s,p,step,date) {
    if(!['open','paused'].includes(step.status))return;
    step.status='done';step.completedEstimate=clone(step.spec);step.completedAt=date;
    const a=task(s,step);if(a)setTaskState(a,'done',date);
    log(p,'Hotovo: '+step.spec.title);
  }
  function allowed(s,row,spec) {
    const c=s.clients.find(x=>same(x.id,row.clientId));
    return spec.condition==='phone'?!!c?.phone:spec.condition==='email'?!!c?.email:spec.condition==='nextContact'?validDate(row.nextContactDate):true;
  }
  function activate(s,row,step,date,eventId) {
    const p=row.automation;
    if(!step.enabled||!p.enabled||p.paused||!allowed(s,row,step.spec))return;
    const syncId='workflow:'+p.id+':'+step.id;
    if(bySync(s,syncId)){step.activitySyncId=syncId;return;}
    const due=step.spec.trigger==='contact'?date:plus(date,+step.spec.offset||0,step.spec.working);
    const a={id:s.nextId++,syncId,clientId:row.clientId,sourceOpportunityId:s.opportunities.includes(row)?row.id:null,type:step.spec.trigger==='contact'?'Telefon':'Úkol',text:step.spec.title,date:due,time:'',duration:null,recordKind:'activity',completed:false,outcome:'agreed',createdAt:stamp(),updatedAt:stamp(),
      automation:{flowId:p.id,stepId:step.id,eventId,status:'open',assignee:step.spec.assignee,origin:'template',baseText:step.spec.title,baseDate:due,manualText:false,manualDate:false}};
    s.activities.push(a);if(activityIndex?.state===s)activityIndex.records.set(syncId,a);step.status='open';step.activitySyncId=syncId;step.triggeredAt=date;
  }
  function emit(s,row,type,date=day(),options={}) {
    const p=row.automation;if(!p||!p.enabled||p.paused)return;
    const key=options.key||uuid();if(p.events.some(e=>e.key===key))return;
    const event={id:uuid(),key,type,date};p.events.push(event);
    p.steps.forEach(step=>{
      if(!step.enabled)return;
      if(step.spec.completeOn===type){if(step.status==='planned')activate(s,row,step,date,event.id);finishStep(s,p,step,date);}
      if(step.spec.replaceOn===type)cancelStep(s,p,step,'Nahrazeno událostí '+(EVENTS[type]||type));
    });
    const specs=[...new Map(p.steps.map(x=>[x.key,x.spec])).values()];
    specs.filter(spec=>spec.trigger===type).forEach(spec=>{
      if([...p.steps].reverse().find(x=>x.key===spec.key)?.enabled===false)return;
      let step=[...p.steps].reverse().find(x=>x.key===spec.key&&['planned','open','paused'].includes(x.status));
      if(!step){step=newStep(spec,p.steps.filter(x=>x.key===spec.key).length);p.steps.push(step);}
      if(step.status==='planned')activate(s,row,step,date,event.id);
      else if(type==='contact'){
        const a=task(s,step);if(a&&!a.automation.manualDate){a.date=date;a.automation.baseDate=date;a.updatedAt=stamp();}
      }
    });
    log(p,(EVENTS[type]||type)+' · '+date);
  }
  function transfer(s,source,target,date=day()) {
    if(source?.automation){target.automation=clone(source.automation);target.automation.lastStage='Podepsáno';}
    else attach(s,target,true,date);
    const p=target.automation;
    // Signature is a reliable completion event only for explicitly configured steps.
    p.steps.filter(x=>x.spec.completeOn==='signed').forEach(x=>finishStep(s,p,x,date));
    p.steps.filter(x=>x.spec.trigger!=='signed').forEach(x=>cancelStep(s,p,x,'Ukončeno podpisem'));
    emit(s,target,'signed',date,{key:'signed'});
    s.activities.filter(a=>a.automation?.flowId===p.id).forEach(a=>{a.sourceOpportunityId=null;});
  }
  function stateOf(a) {if(a.automation?.status==='cancelled')return 'cancelled';if(['noshow','no_show'].includes(a.outcome))return 'missed';if(a.outcome==='moved')return 'moved';if(a.completed||a.completedAt)return 'done';return a.automation?.status==='paused'?'paused':'open';}
  function reconcile(s,now=day()) {
    activityIndex={state:s,records:new Map(s.activities.map(a=>[a.syncId,a]))};
    try{
    const all=sources(s), indexed=new Map(all.filter(x=>x.row.automation).map(x=>[x.row.automation.id,x]));
    for(const {row,signed} of all){
      const p=row.automation;if(!p)continue;
      for(const step of p.steps){
        const a=task(s,step);if(!a){if(step.activitySyncId&&step.status!=='cancelled'){step.status='cancelled';step.reason='Aktivita byla ručně odstraněna';}continue;}
        const status=stateOf(a);
        if(status==='done'&&step.status!=='done'){step.completedEstimate=clone(step.spec);step.completedAt=a.completedAt||now;log(p,'Hotovo: '+step.spec.title);}
        step.status=status;
        if(a.text!==a.automation.baseText)a.automation.manualText=true;
        if(a.date!==a.automation.baseDate)a.automation.manualDate=true;
      }
      p.knownContacts=p.knownContacts||[];
      for(const a of s.activities.filter(a=>!a.automation&&same(a.sourceOpportunityId,row.id)&&a.completed&&a.outcome==='realized'&&['Telefon','Email','Schůzka'].includes(a.type))){const key=a.syncId||String(a.id);if(!p.knownContacts.includes(key)){p.knownContacts.push(key);emit(s,row,'activity:'+a.type,a.date||now,{key:'activity:'+key});}}
      const stage=signed?'Podepsáno':(typeof caseStage==='function'?caseStage(row.status):row.status)||'Opportunity';
      if(CLOSED.includes(stage)){
        p.steps.filter(x=>x.spec.cancelOn!=='never').forEach(x=>cancelStep(s,p,x,'Případ '+stage));p.lastStage=stage;
      }else if(p.lastStage!==stage&&!p.paused&&p.enabled){
        const reopened=CLOSED.includes(p.lastStage);p.lastStage=stage;
        if(reopened)emit(s,row,'created',now);
        emit(s,row,stage==='Podepsáno'?'signed':'stage:'+stage,now);
      }
      if(!CLOSED.includes(stage)&&p.enabled&&!p.paused){
        const contact=row.nextContactDate||'';
        if(contact!==p.lastContact){p.lastContact=contact;if(validDate(contact))emit(s,row,'contact',contact);else p.steps.filter(x=>x.spec.trigger==='contact').forEach(x=>cancelStep(s,p,x,'Další kontakt zrušen'));}
      }
      if(p.enabled&&!p.paused&&!CLOSED.includes(stage))for(const step of p.steps.filter(x=>x.status==='planned')){const event=[...p.events].reverse().find(e=>e.type===step.spec.trigger);if(event)activate(s,row,step,event.date,event.id);}
      for(const step of p.steps){const a=task(s,step);if(a&&['open','paused'].includes(step.status)){
        const paused=!p.enabled||p.paused||!step.enabled;
        step.status=paused?'paused':'open';a.automation.status=step.status;
      }}
    }
    for(const a of s.activities){
      if(a.automation?.flowId&&!indexed.has(a.automation.flowId)&&!['done','cancelled','missed'].includes(stateOf(a)))setTaskState(a,'cancelled',now);
    }
    for(const mail of s.activities.filter(a=>a.emailWait)){
      const w=mail.emailWait, source=indexed.get(w.flowId)||findSource(s,w.sourceId), reminder=bySync(s,'email-reminder:'+w.id);
      if((w.flowId||w.sourceId)&&!source&&w.status==='waiting'){w.status='stopped';w.updatedAt=stamp();w.history.push({date:now,text:'Vázaný případ byl odstraněn'});}
      if(source?.row.automation&&!w.flowId){w.flowId=source.row.automation.id;if(reminder)reminder.automation.flowId=w.flowId;}
      if(source&&CLOSED.includes(source.row.status)&&w.status==='waiting'){w.status='stopped';w.updatedAt=stamp();w.history.push({date:now,text:'Ukončeno s případem'});}
      if(w.status!=='waiting'){
        if(reminder&&!reminder.emailSms?.sentAt){setTaskState(reminder,'cancelled',now);if(reminder.emailSms)reminder.emailSms.cancelled=true;}
        continue;
      }
      const paused=source?.row.automation&&(!source.row.automation.enabled||source.row.automation.paused);
      w.key=String(mail.clientId)+'|'+(w.flowId||w.sourceId)+'|'+(w.thread?'thread:'+w.thread:'mail:'+w.sentDate+':'+w.topic.toLocaleLowerCase('cs'));
      if(reminder&&!reminder.completed)reminder.automation.status=paused||w.due>now?'paused':'open';
      if(paused||!validDate(w.due)||w.due>now||reminder||w.reminderSuppressed)continue;
      const syncId='email-reminder:'+w.id;
      s.activities.push({id:s.nextId++,syncId,clientId:mail.clientId,sourceOpportunityId:mail.sourceOpportunityId||null,type:'Úkol',text:'Připomenout e-mail: '+w.topic,date:w.due,time:'',duration:null,recordKind:'activity',completed:false,outcome:'agreed',createdAt:stamp(),updatedAt:stamp(),automation:{origin:'email',waitId:w.id,flowId:w.flowId||null,status:'open',assignee:'me'},
        emailSms:{text:`Dobrý den, jen se připomínám s e-mailem, který jsem Vám posílal ${w.sentDate.split('-').reverse().join('.')}. Dorazil Vám v pořádku? Děkuji, Filip Solár.`,sentAt:'',cancelled:false}});
      activityIndex.records.set(syncId,s.activities[s.activities.length-1]);
      w.reminderCreated=true;w.updatedAt=stamp();
    }
    // Deleting a reminder is an explicit stop, not an invitation to regenerate it.
    for(const mail of s.activities.filter(a=>a.emailWait?.reminderCreated))if(!bySync(s,'email-reminder:'+mail.emailWait.id))mail.emailWait.reminderSuppressed=true;
    }finally{activityIndex=null;}
  }
  function rows(s,selected) {
    return sources(s).filter(x=>x.row.automation&&(!selected||x.row.automation.id===selected)).flatMap(({row})=>row.automation.steps.map(step=>{
      const a=task(s,step), spec=step.completedEstimate||step.spec, active=step.enabled!==false&&!['cancelled','missed','moved'].includes(step.status), solo=active?+spec.solo||0:0, can=spec.delegate!=='no', residual=can?+spec.residual||0:solo, assistant=can?+spec.assistant||0:0;
      return {row,step,a,solo,done:step.status==='done'?solo:0,remaining:step.status==='done'?0:solo,delegable:active&&can?solo:0,assistant:active?assistant:0,residual:active?residual:0,saving:active&&can?solo-residual:0,chosenMe:active?(spec.assignee==='assistant'?residual:solo):0,chosenAssistant:active&&spec.assignee==='assistant'?assistant:0};
    }));
  }
  function totals(list) {return list.reduce((r,x)=>{['solo','done','remaining','delegable','assistant','residual','saving','chosenMe','chosenAssistant'].forEach(k=>r[k]=(r[k]||0)+x[k]);return r;},{solo:0,done:0,remaining:0,delegable:0,assistant:0,residual:0,saving:0,chosenMe:0,chosenAssistant:0});}
  function email(s,{clientId,sourceId='',sentDate,topic,due,working=false,thread=''}) {
    if(!s.clients.some(c=>same(c.id,clientId)))throw Error('Vyber klienta.');
    if(!validDate(sentDate)||!validDate(due)||due<sentDate||sentDate>day())throw Error('Doplň skutečné datum odeslání a kontrolu po odeslání.');
    if(!topic.trim())throw Error('Doplň stručný účel e-mailu.');
    const source=sourceId?findSource(s,sourceId):null;
    if(sourceId&&(!source||!same(source.row.clientId,clientId)))throw Error('Případ nepatří vybranému klientovi.');
    const threadKey=thread.trim()?'thread:'+thread.trim():'mail:'+sentDate+':'+topic.trim().toLocaleLowerCase('cs');
    const key=String(clientId)+'|'+(source?.row.automation?.id||sourceId)+'|'+threadKey;
    const prior=s.activities.find(a=>a.emailWait?.key===key&&a.emailWait.status==='waiting');
    if(prior){prior.emailWait.due=due;prior.emailWait.updatedAt=stamp();const reminder=s.activities.find(a=>a.syncId==='email-reminder:'+prior.emailWait.id);if(reminder){reminder.date=due;reminder.updatedAt=stamp();}return prior;}
    const a={id:s.nextId++,syncId:uuid(),clientId,sourceOpportunityId:source&&!source.signed?source.row.id:null,type:'Email',text:'E-mail odeslán: '+topic.trim(),date:sentDate,time:'',duration:null,completed:true,completedAt:sentDate,outcome:'realized',recordKind:'activity',createdAt:stamp(),updatedAt:stamp(),emailWait:{id:uuid(),key,flowId:source?.row.automation?.id||'',sourceId,topic:topic.trim(),thread:thread.trim(),sentDate,due,working,status:'waiting',history:[],updatedAt:stamp()}};
    s.activities.push(a);return a;
  }
  function findSource(s,key) {const [kind,id]=String(key).split(':');return sources(s).find(x=>(x.signed?'deal':'case')===kind&&same(x.row.id,id));}
  function sourceKey(row) {return (state.deals.includes(row)?'deal:':'case:')+row.id;}
  function merge(s,incoming,maps) {
    normalize(s);const updated=(x,y)=>Date.parse(x?.updatedAt||'')>Date.parse(y?.updatedAt||'');
    for(const t of incoming.workflowTemplates||[]){const local=s.workflowTemplates.find(x=>x.id===t.id);if(!local)s.workflowTemplates.push(clone(t));else if(updated(t,local))Object.assign(local,clone(t));}
    for(const kind of ['opportunities','deals'])for(const row of incoming[kind]||[]){
      if(!row.automation)continue;
      const mapped=maps[kind]?.get(String(row.id)),local=s[kind].find(x=>same(x.id,mapped));
      if(!local)continue;
      if(!local.automation)local.automation=clone(row.automation);
      else {
        const previous=local.automation, other=row.automation, newer=updated(other,previous)?other:previous, older=newer===other?previous:other;
        const result=clone(newer);
        for(const step of older.steps||[]){const index=result.steps.findIndex(x=>x.id===step.id);if(index<0)result.steps.push(clone(step));else if(step.status==='done'&&step.completedEstimate&&result.steps[index].status!=='done')result.steps[index]=clone(step);}
        for(const key of ['events','history'])result[key]=[...new Map([...(older[key]||[]),...(newer[key]||[])].map(x=>[x.id,x])).values()];
        result.knownContacts=[...new Set([...(older.knownContacts||[]),...(newer.knownContacts||[])])];
        result.lastStage=kind==='deals'?'Podepsáno':local.status||'Opportunity';local.automation=result;
      }
    }
    for(const a of incoming.activities||[]){if(!a.emailWait||a.emailWait.flowId)continue;const local=s.activities.find(x=>same(x.id,maps.activities?.get(String(a.id))));if(!local?.emailWait)continue;const [kind,id]=String(a.emailWait.sourceId||'').split(':'),mapped=maps[kind==='deal'?'deals':'opportunities']?.get(id);if(mapped!=null)local.emailWait.sourceId=kind+':'+mapped;}
    // Numeric IDs can change during import; permanent flow/step/watch IDs cannot.
    for(const a of s.activities){if(a.emailWait){const w=a.emailWait,source=sources(s).find(x=>x.row.automation?.id===w.flowId);if(source){w.sourceId=(source.signed?'deal:':'case:')+source.row.id;w.key=String(a.clientId)+'|'+w.flowId+'|'+(w.thread?'thread:'+w.thread:'mail:'+w.sentDate+':'+w.topic.toLocaleLowerCase('cs'));}}}
  }
  function transaction(fn) {
    const before=clone(state);
    try{fn();reconcile(state);if(!persist()){state=before;return false;}renderActiveView();mount();return true;}
    catch(e){state=before;alert(e.message);return false;}
  }
  function button(text,action,data={}) {return `<button type="button" class="btn slim" data-wf-action="${h(action)}" ${Object.entries(data).map(([k,v])=>`data-${k}="${h(v)}"`).join(' ')}>${h(text)}</button>`;}
  function modal(title,body) {
    let root=$('workflowModal');if(!root){root=document.createElement('div');root.id='workflowModal';root.className='modal workflow-modal';document.body.append(root);}
    root.style.display='flex';root.innerHTML=`<div class="box"><div class="toolbar"><h2>${h(title)}</h2>${button('Zavřít','close')}</div><div id="workflowBody">${body}</div></div>`;
  }
  function close() {if($('workflowModal'))$('workflowModal').style.display='none';}
  function label(row) {const c=state.clients.find(c=>same(c.id,row.clientId));return [(typeof clientName==='function'?clientName(c):c?.name)||'Klient chybí',row.product||row.category].filter(Boolean).join(' · ');}
  function select(id,options,selected) {return `<select id="${h(id)}">${Object.entries(options).map(([v,t])=>`<option value="${h(v)}" ${same(v,selected)?'selected':''}>${h(t)}</option>`).join('')}</select>`;}
  function input(id,title,v='',type='text',extra='') {return `<label>${h(title)}<input id="${h(id)}" type="${type}" value="${h(v)}" ${extra}></label>`;}
  function metricHtml(flow='',category='') {
    const t=totals(rows(state,flow).filter(x=>!category||x.row.category===category)), labels={solo:'Očekávaná práce celkem',done:'Dokončené – odhad',remaining:'Zbývající – odhad',delegable:'Potenciálně delegovatelné',assistant:'Potenciální čas asistentky',residual:'Můj čas po delegování',saving:'Potenciální čistá úspora',chosenMe:'Zvolené rozdělení – můj čas',chosenAssistant:'Zvolené rozdělení – asistentka'};
    return `<div class="wf-metrics">${Object.entries(labels).map(([k,v])=>`<button class="wf-metric" data-wf-action="drill" data-flow="${h(flow)}" data-metric="${k}" data-category="${h(category)}"><small>${v}</small><b>${t[k]} min</b></button>`).join('')}</div><p class="note">Odhady podle šablon, nikoli naměřený čas. Dokončení se počítá jen z potvrzených kroků. Kapacita asistentky není úspora mého času.</p>`;
  }
  const STATUS={planned:'Čeká na spouštěcí událost',open:'Naplánováno',paused:'Pozastaveno',done:'Hotovo',cancelled:'Zrušeno',missed:'Neuskutečněno',moved:'Přesunuto'};
  function stepHtml(row,step) {
    const a=task(state,step), c=state.clients.find(c=>same(c.id,row.clientId)), p=row.automation;
    return `<article class="wf-step ${a?.date&&a.date<day()&&step.status==='open'?'wf-overdue':''}"><div><b>${h(a?.text||step.spec.title)}</b><div class="note">${h(STATUS[step.status])} · ${h(a?(a.date||'Termín chybí – doplnit'):(EVENTS[step.spec.trigger]||'Termín neurčen'))} ${h(a?.time||'')} · ${step.spec.assignee==='assistant'?'Asistentka':'Já'} · ${step.spec.solo} min</div>${step.reason?`<small>${h(step.reason)}</small>`:''}${!c?.phone&&['contact','offer'].includes(step.spec.trigger)?'<small class="wf-warning">Doplnit telefon</small>':''}</div><div class="actions">${['open','paused'].includes(step.status)?button('Hotovo','done',{flow:p.id,step:step.id})+button('Neuskutečněno','missed',{flow:p.id,step:step.id})+button('Zrušit','cancel',{flow:p.id,step:step.id}):''}${button('Upravit','step',{flow:p.id,step:step.id})}${!['done','cancelled','missed'].includes(step.status)?button(step.enabled?'Vypnout krok':'Zapnout krok','toggle-step',{flow:p.id,step:step.id}):''}</div></article>`;
  }
  function waitHtml(mail) {
    const w=mail.emailWait, r=state.activities.find(a=>a.syncId==='email-reminder:'+w.id), source=w.flowId?find(state,w.flowId):findSource(state,w.sourceId), c=state.clients.find(x=>same(x.id,mail.clientId));
    return `<article class="wf-step"><div><b>${h(w.topic)}</b><div class="note">${h(c?clientName(c):'Klient chybí')} · ${h(source?.row.product||source?.row.category||'Bez vazby na případ – doplnit')} · kontrola ${h(w.due)}</div><small>${w.status==='waiting'?'Odpověď není zaznamenaná':({answered:'Klient odpověděl',resolved:'Vyřešeno jinak',stopped:'Ukončeno'})[w.status]||h(w.status)}</small></div><div class="actions">${w.status==='waiting'?button('Klient odpověděl','wait',{id:mail.syncId,result:'answered'})+button('Vyřešeno jinak','wait',{id:mail.syncId,result:'resolved'})+button('Odložit','defer',{id:mail.syncId})+button('Už nepřipomínat','wait',{id:mail.syncId,result:'stopped'}):''}${r?.emailSms&&!r.emailSms.cancelled?button(r.emailSms.sentAt?'Odeslaná SMS':'Návrh SMS','sms',{id:r.syncId}):''}</div></article>`;
  }
  function caseHtml(row) {
    const p=row.automation, key=sourceKey(row), waits=state.activities.filter(a=>a.emailWait&&(p?a.emailWait.flowId===p.id:a.emailWait.sourceId===key));
    return `<div class="toolbar"><h3>Pracovní postup</h3><div class="actions">${button('E-mail odeslán – čekám na odpověď','email',{client:row.clientId,source:key})}${button('Šablony','templates')}</div></div>${!p?`<p class="note">U tohoto stávajícího případu nebyla automatizace zapnuta. Nejprve zkontroluj návrh kroků.</p>${button('Náhled a zapnutí postupu','preview',{source:key})}`:`<div class="actions">${button('Podklady vyžádány','event',{flow:p.id,event:'documents'})}${button('Nabídka odeslána','event',{flow:p.id,event:'offer'})}${button('Další kontakt','contact',{flow:p.id})}${button(p.paused?'Pokračovat':'Pozastavit','pause',{flow:p.id})}${button(p.enabled?'Vypnout automatizaci':'Zapnout automatizaci','toggle',{flow:p.id})}${button('Nová verze šablony – náhled','preview',{source:key})}</div><p class="note">Šablona v${p.version} · ${!p.enabled?'Vypnuto':p.paused?'Pozastaveno':'Zapnuto'}</p>${p.steps.filter(x=>['open','paused'].includes(x.status)).sort((a,b)=>(task(state,a)?.date||'9999').localeCompare(task(state,b)?.date||'9999')).map(x=>stepHtml(row,x)).join('')||'<p class="note">Není naplánovaný další krok. Vyber odpovídající událost nebo další kontakt.</p>'}<details><summary>Celý postup a dokončené kroky · ${p.steps.length}</summary>${p.steps.filter(x=>!['open','paused'].includes(x.status)).map(x=>stepHtml(row,x)).join('')}</details><details><summary>Odhad času a delegování</summary>${metricHtml(p.id)}</details><details><summary>Historie automatizace</summary>${p.history.slice().reverse().map(x=>`<p class="note">${h(x.date)} · ${h(x.text)}</p>`).join('')}</details>`}${waits.length?`<details open><summary>Čekání na klienta</summary>${waits.map(waitHtml).join('')}</details>`:''}`;
  }
  function mountCase(row) {const root=$('caseDetailContent');if(!root)return;
    const legacy=root.querySelector('.case-detail-grid > .case-detail-shell > .case-detail-panel');if(legacy&&row.automation)legacy.style.display='none';
    const next=root.querySelector('.case-next-action');if(next&&row.automation){const p=row.automation,a=p.steps.filter(x=>x.status==='open').map(x=>task(state,x)).filter(Boolean).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'))[0];next.innerHTML=`<b>${h(!p.enabled?'Automatizace vypnutá':p.paused?'Postup pozastavený':a?.date||'Další termín není zadaný')}</b><p class="note">${h(a?.text||'Další krok najdeš v pracovním postupu.')}</p>`;}
    let box=$('workflowCase');if(!box){box=document.createElement('section');box.id='workflowCase';box.className='case-detail-panel';root.querySelector('.case-detail-top')?.after(box);}box.innerHTML=caseHtml(row);}
  function mount() {
    const section=document.querySelector('.view.active')?.id;
    if(section==='caseDetail'){const o=state.opportunities.find(o=>same(o.id,selectedCaseId));if(o)mountCase(o);}
    if(section==='dashboard'){
      let box=$('workflowDashboard');const parent=document.querySelector('#dashboardTasks>.dashboard-tasks');if(parent&&!box){box=document.createElement('details');box.className='wf-dashboard';box.id='workflowDashboard';parent.querySelector(':scope>.toolbar').after(box);}
      if(box){const old=box.open, tasks=state.activities.filter(a=>a.automation&&!a.completed&&a.automation.status==='open'), waits=state.activities.filter(a=>a.emailWait?.status==='waiting'), sms=state.activities.filter(a=>a.emailSms&&!a.emailSms.cancelled&&!a.emailSms.sentAt&&a.automation.status==='open');
        box.innerHTML=`<summary>Návaznosti obchodů · dnes ${tasks.filter(a=>a.date===day()).length} · čekám ${waits.length} · SMS ${sms.length} · po termínu ${tasks.filter(a=>a.date&&a.date<day()).length}</summary><div class="actions">${button('Dnes vyřešit','queue',{kind:'today'})}${button('Čekám na klienta','queue',{kind:'waiting'})}${button('Připravené SMS','queue',{kind:'sms'})}${button('Po termínu','queue',{kind:'overdue'})}${button('Šablony postupů','templates')}${button('Analýza pracnosti','analysis')}</div><p class="note">Kontroly se dopočítají při otevření CRM. Zavřená aplikace neposílá upozornění na pozadí.</p>`;box.open=old;}
    }
    if(section==='clients'&&typeof selectedClientId!=='undefined'&&selectedClientId){
      const root=$('clientDetail');if(root){let box=$('workflowClient');if(!box){box=document.createElement('details');box.id='workflowClient';box.className='card';root.append(box);}
        const list=sources(state).filter(x=>same(x.row.clientId,selectedClientId)), waits=state.activities.filter(a=>same(a.clientId,selectedClientId)&&a.emailWait);
        box.innerHTML=`<summary>Návaznosti a čekání na klienta</summary><div class="actions">${button('E-mail odeslán – čekám na odpověď','email',{client:selectedClientId})}${list.map(x=>button((x.signed?'Podepsáno: ':'')+(x.row.product||x.row.category),'source',{source:sourceKey(x.row)})).join('')}</div>${waits.map(waitHtml).join('')}`;
      }
    }
    const analysis=$('analysisWeek')?.closest('.view');
    if(analysis?.classList.contains('active')){let box=$('workflowAnalysis');if(!box){box=document.createElement('section');box.id='workflowAnalysis';box.className='card';analysis.append(box);}box.innerHTML=`<div class="toolbar"><h3>Pracnost obchodů – odhady</h3>${button('Podle obchodů a typů','analysis')}</div>${metricHtml()}`;}
  }
  function fieldSpec(spec,prefix) {
    return `<div class="wf-form">${input(prefix+'title','Krok',spec.title)}<label>Spouštěcí událost${select(prefix+'trigger',EVENTS,spec.trigger)}</label>${input(prefix+'offset','Odstup ve dnech',spec.offset,'number','min="0" max="3650"')}<label>Počítání dnů${select(prefix+'working',{'false':'Kalendářní','true':'Pracovní (Po–Pá)'},String(spec.working))}</label><label>Podmínka${select(prefix+'condition',{always:'Vždy',phone:'Má telefon',email:'Má e-mail',nextContact:'Má datum dalšího kontaktu'},spec.condition)}</label><label>Vykonává${select(prefix+'assignee',{me:'Já',assistant:'Asistentka'},spec.assignee)}</label>${input(prefix+'solo','Můj čas samostatně (min)',spec.solo,'number','min="0"')}<label>Delegování${select(prefix+'delegate',{yes:'Ano',partial:'Částečně',no:'Ne'},spec.delegate)}</label>${input(prefix+'assistant','Čas asistentky (min)',spec.assistant,'number','min="0"')}${input(prefix+'residual','Můj čas po delegování (min)',spec.residual,'number','min="0"')}<label>Automaticky dokončit při${select(prefix+'completeOn',{'':'Pouze ruční dokončení',...EVENTS},spec.completeOn)}</label><label>Zrušení při uzavření${select(prefix+'cancelOn',{closed:'Ukončit při uzavření případu',never:'Zachovat i po uzavření případu'},spec.cancelOn)}</label><label>Nahradit při${select(prefix+'replaceOn',{'':'Nenahrazovat',...EVENTS},spec.replaceOn)}</label></div>`;
  }
  function readSpec(prefix,base) {
    const s={...base};['title','trigger','condition','assignee','delegate','completeOn','cancelOn','replaceOn'].forEach(k=>s[k]=value(prefix+k));
    ['offset','solo','assistant','residual'].forEach(k=>{s[k]=Number(value(prefix+k));if(!Number.isFinite(s[k])||s[k]<0||s[k]>100000)throw Error('Časy a odstupy musí být nezáporná čísla.');});
    if(!Number.isInteger(s.offset)||!s.title.trim())throw Error('Doplň název kroku a celý počet dnů.');
    if(s.delegate==='no'&&s.assignee==='assistant')throw Error('Nedelegovatelný krok nemůže být přidělen asistentce.');
    s.working=value(prefix+'working')==='true';return s;
  }
  let templateDraft=null,previewDraft=null;
  function templates(id) {
    const t=state.workflowTemplates.find(t=>t.id===id)||state.workflowTemplates[0];templateDraft=clone(t);
    renderTemplate();
  }
  function renderTemplate() {
    const t=templateDraft;
    modal('Šablony pracovních postupů',`<p class="note">Nastavitelné pracovní předpoklady. Nejde o závazné produktové ani regulatorní termíny. Změny se automaticky použijí pouze na nové případy.</p><label>Typ obchodu${select('wfTemplate',Object.fromEntries(state.workflowTemplates.map(t=>[t.id,t.category])),t.id)}</label>${button('Načíst vybranou šablonu','load-template')}<div id="wfTemplateSteps">${t.steps.map((s,i)=>`<details class="wf-editor"><summary>${h(s.title)}</summary>${fieldSpec(s,'wft'+i)}${button('Odebrat krok','remove-template-step',{index:i})}</details>`).join('')}</div><div class="actions">${button('Přidat krok','add-template-step')}${button('Uložit novou verzi šablony','save-template')}</div>`);
  }
  function captureTemplate() {templateDraft.steps=templateDraft.steps.map((s,i)=>readSpec('wft'+i,s));}
  function preview(key) {
    const src=findSource(state,key);if(!src)return;const t=template(state,src.row.category), copy=clone(state), trial=findSource(copy,key).row;
    if(!trial.automation)attach(copy,trial,src.signed);else applyVersion(copy,trial,t);
    reconcile(copy);previewDraft={key,templateId:t.id,version:t.version};
    modal('Náhled postupu: '+label(src.row),`<p><b>${h(t.name)} · verze ${t.version}</b></p><p class="note">Nové kroky začínají dnes. Minulé kontakty, odeslané nabídky ani vykonanou práci neodhadujeme zpětně. Budoucí kroky čekají na svou událost. Ruční úpravy a dokončené odhady zůstanou zachované.</p>${trial.automation.steps.map(x=>`<p><b>${h(x.spec.title)}</b> · ${h(STATUS[x.status])} · ${h(task(copy,x)?.date||EVENTS[x.spec.trigger])}</p>`).join('')}${button('Použít pouze pro tento případ','apply-preview')}`);
  }
  function applyVersion(s,row,t) {
    const p=row.automation;
    for(const step of p.steps){if(['done','missed','cancelled'].includes(step.status))continue;const spec=t.steps.find(x=>x.key===step.key);if(!spec){cancelStep(s,p,step,'Odebráno novou verzí šablony');continue;}
      if(!step.manualEstimate)step.spec=clone(spec);
      const a=task(s,step);if(a){if(!a.automation.manualText){a.text=spec.title;a.automation.baseText=spec.title;}if(!a.automation.manualDate){a.date=plus(step.triggeredAt,+spec.offset||0,spec.working);a.automation.baseDate=a.date;}a.updatedAt=stamp();}
    }
    t.steps.filter(spec=>!p.steps.some(x=>x.key===spec.key)).forEach(spec=>p.steps.push(newStep(spec)));
    p.version=t.version;p.templateId=t.id;log(p,'Řízeně použita šablona v'+t.version+' na zbývající práci');
    // Only newly added steps matching the current phase are activated, never past events.
    p.steps.filter(x=>x.status==='planned'&&(x.spec.trigger==='stage:'+p.lastStage||x.spec.trigger===(p.lastStage==='Podepsáno'?'signed':'created'))).forEach(x=>activate(s,row,x,day(),'template-update:'+t.version));
  }
  function openEmail(clientId,key='') {
    const list=sources(state).filter(x=>same(x.row.clientId,clientId));
    modal('E-mail odeslán – čekám na odpověď',`<input type="hidden" id="wfMailClient" value="${h(clientId)}"><div class="wf-form"><label>Konkrétní případ${select('wfMailSource',{'':'Bez případu – doplnit vazbu',...Object.fromEntries(list.map(x=>[sourceKey(x.row),(x.signed?'Podepsáno: ':'')+(x.row.product||x.row.category)]))},key)}</label>${input('wfMailSent','Skutečné datum odeslání',day(),'date')}${input('wfMailTopic','Předmět / účel')}${input('wfMailThread','Odkaz / ID vlákna (volitelné)')}<label>Pravidlo kontroly${select('wfMailWorking',{'false':'3 kalendářní dny','true':'3 pracovní dny'},'false')}</label>${input('wfMailDue','Termín kontroly',plus(day(),3),'date')}</div><p class="note">Tímto potvrzuješ skutečně odeslaný e-mail. CRM e-mail neposílá ani nečte schránku. Bez vazby na případ bude čekání vedeno pouze u klienta.</p>${button('Zaznamenat odeslání a hlídat odpověď','save-email')}`);
  }
  function queue(kind) {
    let list=state.activities.filter(a=>a.automation&&!a.completed&&a.automation.status==='open');
    if(kind==='waiting'){modal('Čekám na klienta',state.activities.filter(a=>a.emailWait?.status==='waiting').map(waitHtml).join('')||'<p>Žádné čekání.</p>');return;}
    list=list.filter(a=>kind==='sms'?a.emailSms&&!a.emailSms.cancelled&&!a.emailSms.sentAt:kind==='overdue'?a.date&&a.date<day():a.date===day());
    modal({today:'Dnes vyřešit',sms:'Připravené SMS',overdue:'Po termínu'}[kind],list.map(a=>{
      const src=find(state,a.automation.flowId),c=state.clients.find(c=>same(c.id,a.clientId));
      return `<article class="wf-step"><div><b>${h(a.text)}</b><p class="note">${h(c?clientName(c):'Klient chybí')} · ${h(a.date)} ${h(a.time)} · ${a.automation.assignee==='assistant'?'Asistentka':'Já'}</p><p class="note">${h(c?.phone||'Telefon chybí')} · ${h(c?.email||'E-mail chybí')}</p>${src?`<small>${h(src.row.product||src.row.category)}</small>`:'<small>Vazba na případ chybí</small>'}</div><div class="actions">${button('Klient','client',{id:a.clientId})}${src?button('Případ','source',{source:sourceKey(src.row)}):''}${button('Upravit v diáři','activity',{id:a.id})}${a.emailSms?button('SMS','sms',{id:a.syncId}):''}</div></article>`;
    }).join('')||'<p>Žádné položky.</p>');
  }
  function analysis(flow='',metric='solo',category='') {
    const list=rows(state,flow).filter(x=>!category||x.row.category===category),filtered=list.filter(x=>x[metric]!==0);
    const groups=[...new Set(list.map(x=>x.row.category))].map(category=>{const t=totals(list.filter(x=>x.row.category===category));return `<tr><td>${h(category)}</td>${['solo','done','remaining','saving','assistant','chosenAssistant'].map(metric=>`<td>${button(t[metric]+' min','drill',{flow,metric,category})}</td>`).join('')}</tr>`;}).join('');
    modal('Odhady pracnosti a delegování',`${metricHtml(flow,category)}<div class="table-wrap"><table><thead><tr><th>Typ</th><th>Celkem</th><th>Dokončené</th><th>Zbývá</th><th>Možná úspora</th><th>Možný čas asistentky</th><th>Zvolený čas asistentky</th></tr></thead><tbody>${groups}</tbody></table></div><p class="note">Souhrn všech případů se zapnutou šablonou včetně dokončených. Zrušené a neuskutečněné kroky nejsou vykázané jako odvedená práce. Kliknutím na součet zobrazíš zdrojové kroky.</p><div class="table-wrap"><table><thead><tr><th>Typ / případ</th><th>Krok / stav</th><th>Příspěvek k vybranému součtu</th><th>Vykonává</th></tr></thead><tbody>${filtered.map(x=>`<tr><td>${h(x.row.category)}<br>${button(label(x.row),'source',{source:sourceKey(x.row)})}</td><td>${h(x.a?.text||x.step.spec.title)}<br>${h(STATUS[x.step.status])}</td><td>${x[metric]} min</td><td>${x.step.spec.assignee==='assistant'?'Asistentka':'Já'}</td></tr>`).join('')}</tbody></table></div>`);
  }
  function showSms(id) {
    const a=state.activities.find(a=>a.syncId===id);if(!a?.emailSms||a.emailSms.cancelled)return;
    const c=state.clients.find(c=>same(c.id,a.clientId));
    modal('Návrh SMS – ruční odeslání',`<p>${h(c?clientName(c):'Klient chybí')} · ${h(c?.phone||'Doplň telefon na kartě klienta')}</p><label>Text SMS<textarea id="wfSmsText" rows="5" ${a.emailSms.sentAt?'readonly':''}>${h(a.emailSms.text)}</textarea></label><p class="note">Kopírování neznamená odeslání. Citlivé podrobnosti se do návrhu automaticky nedoplňují.</p><div class="actions">${button('Kopírovat','copy-sms',{id})}${!a.emailSms.sentAt?button('Uložit návrh','save-sms',{id})+button('Označit jako skutečně odeslané','sent-sms',{id}):`<span>Odesláno ${h(a.emailSms.sentAt)}</span>`}</div>`);
  }
  document.addEventListener('change',e=>{if(['wfMailSent','wfMailWorking'].includes(e.target.id))$('wfMailDue').value=plus(value('wfMailSent'),3,value('wfMailWorking')==='true');});
  document.addEventListener('click',async e=>{
    const b=e.target.closest('[data-wf-action]');if(!b)return;e.preventDefault();const d=b.dataset,src=d.flow?find(state,d.flow):null,row=src?.row,p=row?.automation,step=p?.steps.find(x=>x.id===d.step);
    try{
      switch(d.wfAction){
        case 'close':close();break;
        case 'templates':templates();break;
        case 'load-template':templates(value('wfTemplate'));break;
        case 'add-template-step':captureTemplate();templateDraft.steps.push({...defaultTemplate('Ostatní').steps[0],key:uuid(),title:'Nový krok'});renderTemplate();break;
        case 'remove-template-step':captureTemplate();templateDraft.steps.splice(+d.index,1);renderTemplate();break;
        case 'save-template':captureTemplate();if(transaction(()=>{const t=state.workflowTemplates.find(t=>t.id===templateDraft.id);Object.assign(t,clone(templateDraft),{version:t.version+1,updatedAt:stamp()});}))close();break;
        case 'preview':preview(d.source);break;
        case 'apply-preview':if(transaction(()=>{const x=findSource(state,previewDraft.key),t=state.workflowTemplates.find(t=>t.id===previewDraft.templateId);if(t.version!==previewDraft.version)throw Error('Šablona se změnila. Otevři nový náhled.');if(x.row.automation)applyVersion(state,x.row,t);else attach(state,x.row,x.signed);}))close();break;
        case 'source':{const x=findSource(state,d.source);if(x){modal(label(x.row),caseHtml(x.row));}break;}
        case 'client':close();openClientWorkspace(Number(d.id),'overview');mount();break;
        case 'activity':close();openActivityModal(null,Number(d.id));break;
        case 'toggle':case 'pause':transaction(()=>{p[d.wfAction==='pause'?'paused':'enabled']=!p[d.wfAction==='pause'?'paused':'enabled'];log(p,d.wfAction==='pause'?'Změna pozastavení':'Změna zapnutí automatizace');});if($('workflowModal')?.style.display==='flex')modal(label(row),caseHtml(row));break;
        case 'toggle-step':transaction(()=>{step.enabled=!step.enabled;log(p,'Změna zapnutí kroku '+step.spec.title);});modal(label(row),caseHtml(row));break;
        case 'done':case 'cancel':case 'missed':transaction(()=>{if(d.wfAction==='done')finishStep(state,p,step,day());else if(d.wfAction==='cancel')cancelStep(state,p,step,'Ručně zrušeno');else {step.status='missed';const a=task(state,step);if(a)setTaskState(a,'missed');log(p,'Neuskutečněno: '+step.spec.title);}});if($('workflowModal')?.style.display==='flex')modal(label(row),caseHtml(row));break;
        case 'event':modal(EVENTS[d.event],`${input('wfEventDate','Skutečné datum',day(),'date')}<p class="note">Zaznamenej skutečnou událost. Opakované odeslání vytvoří nový krok jen tehdy, pokud předchozí už skončil.</p>${button('Zaznamenat','save-event',{flow:d.flow,event:d.event})}`);break;
        case 'save-event':{if(!p.enabled||p.paused)throw Error('Postup je vypnutý nebo pozastavený. Nejprve jej zapni, nebo kontakt zaznamenej běžnou aktivitou.');const date=value('wfEventDate');if(!validDate(date)||date>day())throw Error('Doplň skutečné datum.');if(transaction(()=>emit(state,row,d.event,date)))close();break;}
        case 'contact':modal('Další kontakt',`${input('wfContactDate','Datum kontaktu',row.nextContactDate||'','date')}<p class="note">Aktualizuje existující položku. Pokud má ručně změněný termín, zůstane zachovaný a upravíš jej přímo v kroku.</p>${button('Uložit kontakt','save-contact',{flow:d.flow})}`);break;
        case 'save-contact':if(!validDate(value('wfContactDate')))throw Error('Doplň datum.');if(transaction(()=>{row.nextContactDate=value('wfContactDate');row.updatedAt=stamp();}))close();break;
        case 'step':modal('Upravit pracovní krok',`${['done','cancelled','missed'].includes(step.status)?'<p>Historický krok – jeho odhad je uzamčený.</p>':fieldSpec(step.spec,'wfs')+(task(state,step)?input('wfsDate','Termín',task(state,step).date,'date')+input('wfsTime','Čas (volitelný)',task(state,step).time,'time'):'')+button('Uložit pouze pro tento případ','save-step',{flow:d.flow,step:d.step})}`);break;
        case 'save-step':{const spec=readSpec('wfs',step.spec);if(transaction(()=>{step.spec=spec;step.manualEstimate=true;const a=task(state,step);if(a){a.text=spec.title;a.date=value('wfsDate');a.time=value('wfsTime');a.automation.manualText=true;a.automation.manualDate=true;a.automation.assignee=spec.assignee;a.updatedAt=stamp();}log(p,'Ruční úprava kroku '+spec.title);}))close();break;}
        case 'email':openEmail(Number(d.client),d.source);break;
        case 'save-email':if(transaction(()=>email(state,{clientId:Number(value('wfMailClient')),sourceId:value('wfMailSource'),sentDate:value('wfMailSent'),topic:value('wfMailTopic'),due:value('wfMailDue'),thread:value('wfMailThread'),working:value('wfMailWorking')==='true'})))close();break;
        case 'wait':transaction(()=>{const a=state.activities.find(a=>a.syncId===d.id);a.emailWait.status=d.result;a.emailWait.updatedAt=stamp();a.updatedAt=stamp();a.emailWait.history.push({date:day(),text:d.result==='answered'?'Klient odpověděl':d.result==='resolved'?'Vyřešeno jinak':'Ukončeno připomínání'});});queue('waiting');break;
        case 'defer':modal('Odložit kontrolu',`${input('wfDefer','Nový termín',plus(day(),3),'date')}${button('Uložit termín','save-defer',{id:d.id})}`);break;
        case 'save-defer':if(!validDate(value('wfDefer')))throw Error('Doplň termín.');if(transaction(()=>{const a=state.activities.find(a=>a.syncId===d.id),r=state.activities.find(x=>x.syncId==='email-reminder:'+a.emailWait.id);a.emailWait.due=value('wfDefer');a.emailWait.updatedAt=stamp();a.updatedAt=stamp();a.emailWait.history.push({date:day(),text:'Kontrola odložena na '+value('wfDefer')});if(r?.emailSms?.sentAt){a.emailWait.history.push({date:day(),text:'Předchozí SMS odeslána '+r.emailSms.sentAt,previousWaitId:a.emailWait.id,reminderSyncId:r.syncId});a.emailWait.id=uuid();a.emailWait.reminderCreated=false;a.emailWait.reminderSuppressed=false;}else if(r){r.date=value('wfDefer');r.updatedAt=stamp();}}))close();break;
        case 'sms':showSms(d.id);break;
        case 'copy-sms':{await navigator.clipboard.writeText(value('wfSmsText'));b.textContent='Zkopírováno – neodesláno';break;}
        case 'save-sms':case 'sent-sms':{if(!value('wfSmsText').trim())throw Error('Text SMS je prázdný.');if(transaction(()=>{const a=state.activities.find(a=>a.syncId===d.id);if(a.emailSms.sentAt)return;a.emailSms.text=value('wfSmsText');a.updatedAt=stamp();if(d.wfAction==='sent-sms'){a.emailSms.sentAt=day();setTaskState(a,'done');const id='sms-sent:'+a.syncId;if(!state.activities.some(x=>x.syncId===id))state.activities.push({id:state.nextId++,syncId:id,clientId:a.clientId,sourceOpportunityId:a.sourceOpportunityId||null,workflowContact:{flowId:a.automation.flowId||'',waitId:a.automation.waitId},type:'SMS',text:a.emailSms.text,date:day(),time:'',duration:null,completed:true,completedAt:day(),recordKind:'activity',outcome:'realized',createdAt:stamp(),updatedAt:stamp()});}})){if(d.wfAction==='sent-sms'){const a=state.activities.find(a=>a.syncId===d.id),mail=state.activities.find(x=>x.emailWait?.id===a.automation.waitId);modal('SMS zaznamenána',`<p>Odeslání je uložené v historii. Další kontrolu zvol sám.</p>${mail?button('Naplánovat další kontrolu','defer',{id:mail.syncId}):''}`);}else close();}break;}
        case 'queue':queue(d.kind);break;
        case 'drill':analysis(d.flow,d.metric,d.category);break;
        case 'analysis':analysis();break;
      }
    }catch(err){alert(err.message);}
  });
  let checkedDay=day();
  function checkDay(){if(typeof state==='undefined'||checkedDay===day())return;checkedDay=day();if(persist())renderActiveView();}
  window.addEventListener('focus',checkDay);setInterval(checkDay,60000);
  window.CrmWorkflow={normalize,day,plus,validDate,attach,emit,transfer,reconcile,rows,totals,email,merge,mount,mountCase,applyVersion,defaultTemplate,active:a=>!a.automation||a.automation.status==='open'};
})();
