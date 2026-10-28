/* Work measurement extends existing activities; it never creates a second time ledger. */
(function () {
  'use strict';
  const AREAS = {preparation:'Příprava', recording:'Zápis', followup:'Dotažení', data:'Data', service:'Servis'};
  const TIMES = {unknown:'Nezjištěno', actual:'Skutečný čas', estimate:'Odhad'};
  const METHODS = {usual:'Běžný postup', new:'Nový, testovaný'};
  const OBSTACLES = {search:'Hledání informací', transcription:'Ruční přepisování', documents:'Chybějící podklady', communication:'Opakovaná komunikace', corrections:'Opravy', other:'Jiné'};
  const DEFAULT_PROCESS = 'Zápis po schůzce a další kroky';
  const FIELD_NAMES = ['Area','TimeKind','Method','Obstacle','Case','Pilot','Output','Process','OutputTitle','OutputStatus'];
  const forms = new Map();
  const view = {from:'', to:'', pilotId:''};
  const drilldown = {rows:[],page:0,note:''};
  const PAGE_SIZE = 50;
  const el = id => document.getElementById(id);
  const html = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val = id => el(id)?.value ?? '';
  const str = v => String(v ?? '');
  const same = (a,b) => str(a) === str(b);
  const normalized = v => str(v).trim().replace(/\s+/g,' ').toLocaleLowerCase('cs-CZ');
  const uuid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const validDate = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) && localDate(new Date(str(v)+'T12:00:00')) === v;
  const dateLabel = v => validDate(v) ? new Date(v+'T12:00:00').toLocaleDateString('cs-CZ') : 'Bez data';
  const minutes = v => v == null || str(v).trim() === '' || !Number.isFinite(Number(v)) || Number(v)<0 ? null : Number(v);
  const minLabel = v => v == null ? '—' : `${Number(v).toLocaleString('cs-CZ',{maximumFractionDigits:1})} min`;
  const hours = v => `${(v/60).toLocaleString('cs-CZ',{maximumFractionDigits:2})} h`;
  const clientLabel = id => { const c = (state.clients || []).find(c=>same(c.id,id)); return c ? (typeof clientName==='function' ? clientName(c) : c.name) : id ? 'Klient není dostupný' : 'Interní práce'; };
  const outputById = id => (state.workOutputs || []).find(o=>same(o.id,id));
  const pilotById = id => (state.workPilots || []).find(p=>same(p.id,id));
  function caseById(id,clientId) {
    if(id==null||id==='')return null;
    const live=(state.opportunities||[]).find(o=>same(o.id,id));
    if(live)return clientId===undefined||same(live.clientId,clientId)?live:null;
    const qualified=str(id).startsWith('deal:'),dealId=qualified?str(id).slice(5):'';
    const candidates=(state.deals||[]).filter(d=>(qualified?same(d.id,dealId):same(d.fromOpportunityId,id))&&(clientId===undefined||same(d.clientId,clientId)));
    // An unavailable case is historical only with a proven, unambiguous owner.
    if(!candidates.length||new Set(candidates.map(d=>str(d.clientId))).size!==1)return null;
    const d=candidates[0];return {id,clientId:d.clientId,product:d.product,category:d.category,status:'Podepsáno',_workClosed:true};
  }
  const caseOpen = o => o && !o._workClosed && (typeof isOpenOpportunity==='function' ? isOpenOpportunity(o) : !['Podepsáno','Zamítnuto','Klient nemá zájem','Zrušeno'].includes(o.status));
  const caseLabel = o => `${clientLabel(o.clientId)} · ${o.product || o.category || 'Obchodní případ'}`;
  const outcome = a => typeof activities_aOutcome==='function' ? activities_aOutcome(a) : a.outcome || (a.completed ? 'realized' : 'agreed');
  const done = a => ['realized','no_show','moved'].includes(outcome(a));
  const informative = a => a.recordKind === 'history' || (typeof activityIsInformational==='function' && activityIsInformational(a));
  const uniqueActivities = () => { const seen=new Set(); return (state.activities||[]).filter((a,i)=>{ const key=a.syncId ? 'sync:'+a.syncId : a.id!=null ? 'id:'+a.id : 'row:'+i; if(seen.has(key))return false; seen.add(key);return !informative(a); }); };
  const options = (values, selected, blank) => (blank!==undefined?`<option value="">${html(blank)}</option>`:'')+Object.entries(values).map(([k,v])=>`<option value="${html(k)}" ${same(k,selected)?'selected':''}>${html(v)}</option>`).join('');
  const field = (id,label,control,full=false) => `<div class="field${full?' full':''}"><label for="${id}">${html(label)}</label>${control}</div>`;
  const select = (id,body,change='') => `<select id="${id}"${change?` onchange="${change}"`:''}>${body}</select>`;
  const set = (id,value) => {if(el(id))el(id).value=str(value);};

  function formClient(prefix) {return val(prefix+'Client') || null;}
  function formDraft(prefix) {
    const data={};FIELD_NAMES.forEach(k=>data[k]=val(prefix+'Work'+k));
    data.open=!!el(prefix+'WorkMeasurement')?.open;
    data.hadWork=!!forms.get(prefix)?.hadWork;
    data.activityId=forms.get(prefix)?.activityId ?? null;
    return data;
  }
  function caseOptions(clientId,selected) {
    const choices=(state.opportunities||[]).filter(o=>same(o.clientId,clientId)&&(caseOpen(o)||same(o.id,selected))),historical=caseById(selected,clientId);
    if(historical&&!choices.some(o=>same(o.id,historical.id)))choices.push(historical);
    return '<option value="">Bez vazby na případ</option>'+choices.map(o=>`<option value="${html(o.id)}" ${same(o.id,selected)?'selected':''}>${html(o.product||o.category||'Případ')}${caseOpen(o)?'':' · uzavřeno'}</option>`).join('');
  }
  function pilotOptions(selected) {
    return '<option value="">Bez pilotu</option>'+(state.workPilots||[]).map(p=>`<option value="${html(p.id)}" ${same(p.id,selected)?'selected':''}>${html(p.process||DEFAULT_PROCESS)} · ${html(dateLabel(p.startDate))}</option>`).join('');
  }
  function outputOptions(clientId,selected) {
    return '<option value="">Bez společného výstupu</option><option value="__new" '+(selected==='__new'?'selected':'')+'>+ Nový výstup (zápis, podklady…)</option>'+(state.workOutputs||[]).filter(o=>same(o.clientId,clientId)).slice().sort((a,b)=>str(b.updatedAt||b.createdAt).localeCompare(str(a.updatedAt||a.createdAt))).map(o=>`<option value="${html(o.id)}" ${same(o.id,selected)?'selected':''}>${html(o.title||o.process||'Výstup')} · ${METHODS[o.method]||'Bez postupu'}${o.status==='complete'?' · úplný':' · doplnit'}</option>`).join('');
  }
  function renderFields(prefix,draft) {
    const box=el(prefix+'WorkFields');if(!box)return;
    const id=k=>prefix+'Work'+k, change=`workFieldsChanged('${prefix}',this.id)`;
    box.classList.add('work-fields');
    box.innerHTML=`<p class="note work-help">Minuty zadej v běžném poli Délka minut. Předvyplněná délka není měření. Zapiš aktivní práci, bez čekání na klienta.</p><div class="form-grid">
      ${field(id('Area'),'Oblast práce',select(id('Area'),options(AREAS,draft.Area,'Bez zařazení'),change))}
      ${field(id('TimeKind'),'Jak byl určen čas',select(id('TimeKind'),options(TIMES,draft.TimeKind||'unknown'),change))}
      ${field(id('Method'),'Postup',select(id('Method'),options(METHODS,draft.Method||'usual'),change))}
      ${field(id('Obstacle'),'Překážka · volitelné',select(id('Obstacle'),options(OBSTACLES,draft.Obstacle,'Bez překážky'),change))}
      ${field(id('Case'),'Obchodní případ · volitelné',select(id('Case'),caseOptions(formClient(prefix),draft.Case),change))}
      ${field(id('Pilot'),'Pilot · volitelné',select(id('Pilot'),pilotOptions(draft.Pilot),change))}
      ${field(id('Output'),'Spojit práci s výstupem · volitelné',select(id('Output'),outputOptions(formClient(prefix),draft.Output),`workOutputChanged('${prefix}')`),true)}
      ${field(id('Process'),'Proces',`<input id="${id('Process')}" maxlength="180" value="${html(draft.Process)}" placeholder="např. zápis po schůzce" onchange="${change}">`,true)}
      <div class="work-output-fields field full" id="${prefix}WorkOutputFields"><div class="form-grid">
      ${field(id('OutputTitle'),'Název konkrétního výstupu',`<input id="${id('OutputTitle')}" maxlength="220" value="${html(draft.OutputTitle)}" placeholder="např. zápis ze schůzky 28. 10.">`)}
      ${field(id('OutputStatus'),'Úplnost celého výstupu',select(id('OutputStatus'),options({needs_work:'Vyžaduje doplnění nebo opravu',complete:'Hotový a úplný'},draft.OutputStatus||'needs_work')))}
      </div><p class="note">Kontrolu i opravy připoj ke stejnému výstupu. Do porovnání vstoupí až celý úplný výstup se skutečně změřenými bloky.</p></div>
      </div><p class="note" id="${prefix}WorkContextHint"></p>`;
    if(el(prefix+'WorkMeasurement'))el(prefix+'WorkMeasurement').open=!!draft.open;
    updateContext(prefix);
  }
  function updateContext(prefix) {
    const out=outputById(val(prefix+'WorkOutput')), hasOutput=!!val(prefix+'WorkOutput');
    const outputFields=el(prefix+'WorkOutputFields');if(outputFields)outputFields.hidden=!hasOutput;
    ['Method','Pilot','Case'].forEach(k=>{if(el(prefix+'Work'+k))el(prefix+'Work'+k).disabled=!!out;});
    if(el(prefix+'WorkProcess'))el(prefix+'WorkProcess').readOnly=!!out;
    const hint=el(prefix+'WorkContextHint');
    if(hint)hint.textContent=out ? 'Proces, postup, klient a případ patří ke společnému výstupu. Pro jiný postup založ nový výstup.' : 'Měření je volitelné. Pro porovnání v pilotu vyber nebo založ konkrétní výstup.';
  }
  function workFillFields(prefix,a) {
    const w=a?.work||{},out=outputById(w.outputId);
    forms.set(prefix,{activityId:a?.id??null,hadWork:!!a?.work});
    renderFields(prefix,{Area:w.area||'',TimeKind:TIMES[w.timeKind]?w.timeKind:'unknown',Method:METHODS[w.method]?w.method:out?.method||'usual',Obstacle:w.obstacle||'',Case:a?.sourceOpportunityId||out?.opportunityId||'',Pilot:w.pilotId||out?.pilotId||'',Output:out?.id||'',Process:w.process||out?.process||'',OutputTitle:out?.title||'',OutputStatus:out?.status||'needs_work',open:false});
    if((a?.workLinksUnverified||w.outputId&&!out)&&el(prefix+'WorkContextHint'))el(prefix+'WorkContextHint').textContent='Vazba ze zálohy není ověřená. Vyber správný případ a výstup ručně; původní záznam není použit pro porovnání.';
  }
  function workCaptureFields(prefix) {return formDraft(prefix);}
  function workRestoreFields(prefix,draft) {
    if(!draft)return;forms.set(prefix,{activityId:draft.activityId??null,hadWork:!!draft.hadWork});renderFields(prefix,draft);
  }
  function workClientChanged(prefix) {
    const draft=formDraft(prefix),clientId=formClient(prefix),o=caseById(draft.Case),out=outputById(draft.Output);
    if(draft.Case&&(!o||!same(o.clientId,clientId)))draft.Case='';
    if(out&&!same(out.clientId,clientId)){draft.Output='';draft.OutputTitle='';draft.OutputStatus='needs_work';}
    renderFields(prefix,draft);
  }
  function workOutputChanged(prefix) {
    const out=outputById(val(prefix+'WorkOutput'));
    if(out){
      ['Method','Pilot','Process','OutputTitle','OutputStatus','Case'].forEach(k=>set(prefix+'Work'+k,({Method:out.method,Pilot:out.pilotId,Process:out.process,OutputTitle:out.title,OutputStatus:out.status,Case:out.opportunityId})[k]));
      if(el(prefix+'WorkCase'))el(prefix+'WorkCase').innerHTML=caseOptions(formClient(prefix),out.opportunityId);
    }else if(val(prefix+'WorkOutput')==='__new'){
      set(prefix+'WorkOutputTitle','');set(prefix+'WorkOutputStatus','needs_work');
      const p=pilotById(val(prefix+'WorkPilot'));if(p)set(prefix+'WorkProcess',p.process);
    }
    updateContext(prefix);
  }
  function workFieldsChanged(prefix,changedId) {
    if(changedId===prefix+'WorkPilot'){
      const p=pilotById(val(changedId));if(p)set(prefix+'WorkProcess',p.process);
    }
  }
  function workApplyFields(prefix,activity) {
    if(!el(prefix+'WorkFields'))return true;
    const d=formDraft(prefix),clientId=activity.clientId||null,out=outputById(d.Output),pilot=pilotById(d.Pilot),opportunity=caseById(d.Case,clientId);
    const fail=message=>{alert(message);return false;};
    if(d.Case&&(!opportunity||!same(opportunity.clientId,clientId)))return fail('Vyber obchodní případ tohoto klienta, nebo vazbu zruš.');
    if(d.Pilot&&!pilot)return fail('Vybraný pilot už není dostupný. Vyber jej znovu.');
    if(d.Output&&d.Output!=='__new'&&(!out||!same(out.clientId,clientId)))return fail('Výstup musí patřit stejnému klientovi jako aktivita.');
    const timeKind=TIMES[d.TimeKind]?d.TimeKind:'unknown';
    const raw=val(prefix+'Duration').trim(), numeric=raw===''?null:Number(raw.replace(/\s/g,'').replace(',','.'));
    if(raw!==''&&(!Number.isFinite(numeric)||numeric<0))return fail('Délka práce musí být nezáporný počet minut.');
    if(timeKind!=='unknown'&&numeric===null)return fail('Doplň počet minut. Potvrzenou nulu zadej jako 0; bez měření zvol Nezjištěno.');
    const process=(out?.process||d.Process).trim(),method=out?.method||(METHODS[d.Method]?d.Method:'usual');
    if(d.Output&&!process)return fail('Pro společný výstup doplň proces, například zápis po schůzce.');
    if(d.Output&&!d.OutputTitle.trim())return fail('Pojmenuj konkrétní výstup, aby šla připojit i kontrola a opravy.');
    if(out&&out.workLinksUnverified)return fail('Výstup má neověřenou vazbu ze zálohy. Založ nový výstup se správným klientem a případem.');
    // All validation precedes changes; the caller owns persistence and rollback.
    let outputId=out?.id||'';
    if(d.Output==='__new'){
      const record={id:uuid(),pilotId:pilot?.id||'',clientId,opportunityId:opportunity?.id||null,process,method,title:d.OutputTitle.trim(),status:d.OutputStatus==='complete'?'complete':'needs_work',createdAt:now(),updatedAt:now()};
      state.workOutputs=state.workOutputs||[];state.workOutputs.push(record);outputId=record.id;
    }else if(out){out.title=d.OutputTitle.trim();out.status=d.OutputStatus==='complete'?'complete':'needs_work';out.updatedAt=now();}
    activity.duration=numeric;
    if(d.Case||activity.sourceOpportunityId)activity.sourceOpportunityId=opportunity?.id||null;
    const engaged=d.hadWork||d.Area||timeKind!=='unknown'||d.Obstacle||d.Pilot||d.Output||process||d.Method==='new';
    if(engaged)activity.work={area:AREAS[d.Area]?d.Area:'',timeKind,method,obstacle:OBSTACLES[d.Obstacle]?d.Obstacle:'',outputId,pilotId:out?.pilotId||pilot?.id||'',process};
    else delete activity.work;
    if(d.Case||outputId)delete activity.workLinksUnverified;
    return true;
  }

  function workPilotDates(pilotOrId) {
    const p=typeof pilotOrId==='object'?pilotOrId:pilotById(pilotOrId),days=[];
    if(!p||!validDate(p.startDate))return {days,from:'',to:'',baselineEnd:'',testStart:''};
    const d=new Date(p.startDate+'T12:00:00');
    while(days.length<10){if(d.getDay()!==0&&d.getDay()!==6)days.push(localDate(d));d.setDate(d.getDate()+1);}
    return {days,from:days[0],to:days[9],baselineEnd:days[4],testStart:days[5]};
  }
  function activityBucket(a) {
    if(!done(a))return 'planned';
    const time=minutes(a.duration),kind=a.work?.timeKind;
    return time!==null&&['actual','estimate'].includes(kind)?kind:'unknown';
  }
  function workMeasurementSummary(from,to,pilotId='') {
    const rows=uniqueActivities().filter(a=>validDate(a.date)&&a.date>=from&&a.date<=to&&(!pilotId||same(a.work?.pilotId,pilotId)));
    const result={from,to,pilotId,rows,actual:{count:0,minutes:0},estimate:{count:0,minutes:0},unknown:{count:0},planned:{count:0},byArea:{},byObstacle:{},byRoute:{},measuredCount:0};
    Object.keys({...AREAS,unclassified:''}).forEach(k=>result.byArea[k]={count:0,minutes:0,activityIds:[]});
    Object.keys(OBSTACLES).forEach(k=>result.byObstacle[k]={count:0,minutes:0,activityIds:[]});
    ['assistant','automation','self',''].forEach(k=>result.byRoute[k]={count:0,minutes:0,activityIds:[]});
    rows.forEach(a=>{
      const bucket=activityBucket(a);result[bucket].count++;
      if(bucket==='actual'||bucket==='estimate')result[bucket].minutes+=minutes(a.duration);
      if(bucket!=='actual')return;
      const add=target=>{target.count++;target.minutes+=minutes(a.duration);target.activityIds.push(a.id);};
      add(result.byArea[AREAS[a.work?.area]?a.work.area:'unclassified']);
      if(result.byObstacle[a.work?.obstacle])add(result.byObstacle[a.work.obstacle]);
      add(result.byRoute[Object.hasOwn(result.byRoute,a.delegationRoute||'')?a.delegationRoute||'':'']);
    });
    result.measuredCount=result.actual.count;
    return result;
  }
  function workPilotComparison(pilotId,from,to) {
    const p=pilotById(pilotId),period=workPilotDates(p),start=from||period.from,end=to||period.to;
    const result={pilotId,process:p?.process||'',period:{from:start,to:end},usual:{count:0,median:null,minutes:0,outputs:[]},new:{count:0,median:null,minutes:0,outputs:[]},excluded:[],ready:false,savingsMinutes:null,savingsPct:null};
    if(!p)return result;
    const byOutput=new Map();uniqueActivities().forEach(a=>{const id=str(a.work?.outputId);if(!id)return;if(!byOutput.has(id))byOutput.set(id,[]);byOutput.get(id).push(a);});
    (state.workOutputs||[]).filter(o=>same(o.pilotId,pilotId)).forEach(o=>{
      const rows=byOutput.get(str(o.id))||[],reasons=[];
      if(o.status!=='complete')reasons.push('Výstup vyžaduje doplnění nebo opravu');
      if(!rows.length)reasons.push('Bez pracovních bloků');
      if(normalized(o.process)!==normalized(p.process))reasons.push('Jiný proces');
      if(!METHODS[o.method])reasons.push('Postup není určen');
      if(o.workLinksUnverified||rows.some(a=>a.workLinksUnverified))reasons.push('Neověřená vazba ze zálohy');
      if(rows.some(a=>!done(a)))reasons.push('Obsahuje naplánovanou práci');
      if(rows.some(a=>a.work?.timeKind!=='actual'||minutes(a.duration)===null))reasons.push('Chybí skutečné měření některého bloku');
      if(rows.some(a=>!validDate(a.date)||a.date<period.from||a.date>period.to||a.date<start||a.date>end))reasons.push('Část výstupu je mimo vybrané období');
      if(rows.some(a=>!same(a.clientId,o.clientId)||!same(a.work?.pilotId,p.id)||a.work?.method!==o.method||normalized(a.work?.process)!==normalized(o.process)))reasons.push('Neshoduje se klient, proces nebo postup');
      if((o.opportunityId&&!caseById(o.opportunityId,o.clientId))||rows.some(a=>a.sourceOpportunityId&&!caseById(a.sourceOpportunityId,a.clientId)))reasons.push('Případ není ověřený u stejného klienta');
      if(o.opportunityId&&rows.some(a=>!same(a.sourceOpportunityId,o.opportunityId)))reasons.push('Nejednotná vazba na případ');
      const item={id:o.id,title:o.title||o.process,minutes:rows.reduce((n,a)=>n+(minutes(a.duration)||0),0),activityIds:rows.map(a=>a.id)};
      if(reasons.length){result.excluded.push({...item,reasons});return;}
      result[o.method].outputs.push(item);
    });
    ['usual','new'].forEach(k=>{const g=result[k],values=g.outputs.map(o=>o.minutes).sort((a,b)=>a-b),n=values.length;g.count=n;g.minutes=values.reduce((a,b)=>a+b,0);g.median=n?(values[Math.floor(n/2)]+values[Math.ceil(n/2)-1])/2:null;});
    result.ready=result.usual.count>=3&&result.new.count>=3;
    if(result.ready){result.savingsMinutes=result.usual.median-result.new.median;result.savingsPct=result.usual.median>0?result.savingsMinutes/result.usual.median*100:null;}
    return result;
  }
  function verifiedCase(a,activityIndex) {
    const seen=new Set(),owner=a.clientId;let current=a;
    while(current&&!seen.has(str(current.id))){
      seen.add(str(current.id));if(current.workLinksUnverified||!same(current.clientId,owner))return null;
      if(current.sourceOpportunityId){const o=caseById(current.sourceOpportunityId,owner);return o?.id||null;}
      current=current.sourceActivityId?(activityIndex?activityIndex.get(str(current.sourceActivityId)):(state.activities||[]).find(x=>same(x.id,current.sourceActivityId))):null;
    }
    return null;
  }
  function workPilotCaseCoverage(pilotId) {
    const pilot=pilotById(pilotId),rows=[],activities=uniqueActivities(),date=localDate();let closed=0,missing=0;
    const index=new Map((state.activities||[]).map(a=>[str(a.id),a])),byCase=new Map(),uncertainClients=new Set();
    activities.forEach(a=>{const id=verifiedCase(a,index);if(id!=null){const key=str(id);if(!byCase.has(key))byCase.set(key,[]);byCase.get(key).push(a);}else if(!done(a))uncertainClients.add(str(a.clientId));});
    [...new Set((pilot?.caseIds||[]).map(str))].forEach(id=>{
      const o=caseById(id);if(!o){missing++;return;}if(!caseOpen(o)){closed++;return;}
      const linked=(byCase.get(str(o.id))||[]).filter(a=>same(a.clientId,o.clientId)),pending=linked.filter(a=>!done(a)),dated=pending.filter(a=>validDate(a.date)&&str(a.text).trim());
      const overdue=dated.filter(a=>a.date<date),next=[...(overdue.length?overdue:dated)].sort((a,b)=>a.date.localeCompare(b.date))[0];
      const uncertain=!linked.length&&(o.nextContactDate||uncertainClients.has(str(o.clientId)));
      rows.push({caseId:o.id,clientId:o.clientId,title:caseLabel(o),status:overdue.length?'overdue':next?'ready':uncertain?'unverified':'missing',activityId:next?.id||null,date:next?.date||'',text:next?.text||''});
    });
    return {rows,closed,missing,unverifiedImports:(pilot?.importReference?.caseIds||[]).length};
  }

  function panelState() {
    if(!view.from)view.from=localDate().slice(0,7)+'-01';if(!view.to)view.to=localDate();
    if(view.pilotId&&!pilotById(view.pilotId))view.pilotId='';return view;
  }
  function workSetPeriod() {
    const from=val('workFrom'),to=val('workTo');
    if(!validDate(from)||!validDate(to)||from>to){alert('Vyber platné období Od–Do.');return;}
    view.from=from;view.to=to;workRenderAnalysis();
  }
  function workSelectPilot() {
    view.pilotId=val('workPilotSelect');const p=workPilotDates(view.pilotId);
    if(p.from){view.from=p.from;view.to=p.to;}workRenderAnalysis();
  }
  function metric(label,value,note,filter,key='') {
    return `<button type="button" class="work-metric" data-work-filter="${html(filter)}" data-work-key="${html(key)}" onclick="workShowActivities(this.dataset.workFilter,this.dataset.workKey)"><span>${html(label)}</span><b>${html(value)}</b><small>${html(note)}</small></button>`;
  }
  function guideHtml(pilot) {
    const d=workPilotDates(pilot);return `<details class="work-guide"><summary>Jak postupovat během dvou týdnů</summary><div class="work-guide-grid"><div><h4>Prvních 5 pracovních dnů${d.from?` · ${dateLabel(d.from)}–${dateLabel(d.baselineEnd)}`:''}</h4><ol><li>Pracuj běžným způsobem a zapisuj aktivní čas a překážky.</li><li>U vybraných případů ověř další konkrétní krok a termín.</li><li>Na konci vyber jeden proces ke zlepšení.</li></ol></div><div><h4>Dalších 5 pracovních dnů${d.testStart?` · ${dateLabel(d.testStart)}–${dateLabel(d.to)}`:''}</h4><ol><li>U 3–5 podobných výstupů použij stejný nový postup.</li><li>Připoj ke každému výstupu také kontrolu a opravy.</li><li>Porovnej se stejným běžným procesem a rozhodni, co dál.</li></ol></div></div><p class="note">Pracovní dny zde znamenají pondělí–pátek; svátky se automaticky neodečítají. Měř souvislé bloky aktivní práce, ne čekání. Stejnou práci zapisuj pouze jednou. Historické a předvyplněné délky zůstávají bez potvrzeného měření.</p><div class="work-template"><b>Osnova zápisu po schůzce</b><p>Situace klienta → rozhodnutí → chybějící podklady → kdo co udělá → termín.</p></div></details>`;
  }
  function comparisonHtml(pilot) {
    const c=workPilotComparison(pilot.id,view.from,view.to);
    const group=(key,label)=>`<div class="work-comparison-card"><span>${label}</span><b>${minLabel(c[key].median)}</b><small>medián na úplný výstup · ${c[key].count} výstupů</small></div>`;
    return `<section class="work-comparison"><h4>Stejný proces: ${html(pilot.process)}</h4><div class="work-comparison-grid">${group('usual','Běžný postup')}${group('new','Nový postup')}</div><p class="${c.ready?'work-result':'note'}" data-work-comparison-ready="${c.ready}">${c.ready?`Orientační rozdíl mediánů: ${minLabel(c.savingsMinutes)} na výstup${c.savingsPct==null?'':` (${c.savingsPct.toLocaleString('cs-CZ',{maximumFractionDigits:1})} %)`}. Kladná hodnota znamená méně času s novým postupem; výsledek závisí na srovnatelnosti práce.`:'Zatím není dost srovnatelných dat pro vyčíslení úspory. Je potřeba nejméně 3 úplných a plně změřených výstupů každým postupem.'}</p><p class="note">Medián zahrnuje celý aktivní čas včetně kontroly a oprav. Výstup s odhadem, chybějícím měřením, plánem nebo blokem mimo období se nezapočítá ani částečně.</p><details><summary>Výstupy a důvody vyřazení (${c.usual.count+c.new.count+c.excluded.length})</summary><div class="work-output-list">${['usual','new'].flatMap(k=>c[k].outputs.map(o=>`<button class="work-output-row" data-work-output="${html(o.id)}" onclick="workShowOutput(this.dataset.workOutput)"><b>${html(o.title)}</b><span>${METHODS[k]} · ${minLabel(o.minutes)}</span></button>`)).join('')}${c.excluded.map(o=>`<button class="work-output-row" data-work-output="${html(o.id)}" onclick="workShowOutput(this.dataset.workOutput)"><b>${html(o.title)}</b><span>${html(o.reasons.join(' · '))}</span></button>`).join('')||'<p class="note">V pilotu zatím nejsou pracovní výstupy.</p>'}</div></details></section>`;
  }
  function coverageHtml(pilot) {
    const data=workPilotCaseCoverage(pilot.id),labels={ready:'Má další krok',overdue:'Prošlý nedokončený krok',missing:'Chybí konkrétní krok s termínem',unverified:'Vazba není ověřená'};
    return `<details class="work-case-coverage"><summary>Návaznost vybraných případů (${data.rows.length} aktivních)</summary><p class="note">Uzavřené vynechány: ${data.closed}. Nedostupné vazby: ${data.missing+data.unverifiedImports}. Pouhá shoda klienta nebo očekávané datum podpisu nenahrazuje vazbu na úkol.</p><div class="work-case-list">${data.rows.map(r=>`<div class="work-case-row" data-work-case-status="${r.status}"><div><b>${html(r.title)}</b><small>${labels[r.status]}${r.date?' · '+dateLabel(r.date):''}</small>${r.text?`<span>${html(r.text)}</span>`:''}</div><button class="btn slim" data-id="${html(r.caseId)}" data-client="${html(r.clientId)}" onclick="openOpportunityModal(Number(this.dataset.client),Number(this.dataset.id))">Otevřít případ</button></div>`).join('')||'<p class="note">Vyber existující aktivní případy v nastavení pilotu.</p>'}</div></details>`;
  }
  function workRenderAnalysis() {
    const panel=el('workMeasurementPanel');if(!panel)return;panelState();
    const section=el('workMeasurementSection');
    if(section&&!section.dataset.workToggleBound){section.dataset.workToggleBound='1';section.addEventListener('toggle',()=>{if(section.open)workRenderAnalysis();});}
    if(section&&!section.open){panel.replaceChildren();return;}
    const s=workMeasurementSummary(view.from,view.to,view.pilotId),pilot=pilotById(view.pilotId);
    panel.classList.add('work-panel');
    panel.innerHTML=`<div class="work-toolbar"><div class="work-period"><label>Od<input id="workFrom" type="date" value="${html(view.from)}" onchange="workSetPeriod()"></label><label>Do<input id="workTo" type="date" value="${html(view.to)}" onchange="workSetPeriod()"></label><label>Pilot<select id="workPilotSelect" onchange="workSelectPilot()">${pilotOptions(view.pilotId).replace('Bez pilotu','Všechny aktivity')}</select></label></div><div class="actions"><button class="btn" onclick="workOpenPilot()">+ Dvoutýdenní pilot</button>${pilot?`<button class="btn" data-id="${html(pilot.id)}" onclick="workOpenPilot(this.dataset.id)">Nastavení pilotu</button>`:''}</div></div>
      <div class="work-metrics">${metric('Skutečně odpracováno',hours(s.actual.minutes),`${s.actual.count} měřených záznamů`,'actual')}${metric('Odhady zvlášť',hours(s.estimate.minutes),`${s.estimate.count} odhadů`,'estimate')}${metric('Bez měření',s.unknown.count,'historie a nezjištěný čas','unknown')}${metric('Plánované',s.planned.count,'nejsou odpracovaným časem','planned')}</div>
      <p class="note">Čas je oddělený od obchodního úspěchu. I nedovolaný hovor může mít změřenou práci; naplánovaný úkol se do odpracovaného času nepočítá. Součty otevřeš kliknutím.</p>
      <div class="work-breakdowns"><section><h4>Skutečný čas podle oblasti</h4><div class="work-area-list">${Object.entries(s.byArea).map(([key,x])=>`<button data-work-area="${key}" onclick="workShowActivities('area',this.dataset.workArea)"><span>${AREAS[key]||'Bez zařazení'}</span><b>${minLabel(x.minutes)}</b><small>${x.count} záznamů</small></button>`).join('')}</div></section><section><h4>Kandidáti k předání</h4><div class="work-area-list">${[['assistant','Asistentka'],['automation','Automatizace']].map(([key,label])=>`<button data-work-route="${key}" onclick="workShowActivities('route',this.dataset.workRoute)"><span>${label}</span><b>${minLabel(s.byRoute[key].minutes)}</b><small>pouze skutečný čas</small></button>`).join('')}</div><h4>Nejčastější překážky</h4><div class="work-obstacles">${Object.entries(s.byObstacle).filter(([,x])=>x.count).sort((a,b)=>b[1].count-a[1].count).map(([key,x])=>`<button class="btn slim" data-key="${key}" onclick="workShowActivities('obstacle',this.dataset.key)">${OBSTACLES[key]} · ${x.count}</button>`).join('')||'<p class="note">U skutečně měřených aktivit zatím nejsou označené překážky.</p>'}</div></section></div>
      ${pilot?comparisonHtml(pilot)+coverageHtml(pilot):'<p class="note">Pro porovnání stejného procesu založ pilot. Vybereš datum zahájení a přibližně 10 existujících případů. Klienty ani případy CRM nevybírá za tebe.</p>'}${guideHtml(pilot)}${pilot?.decision?`<p class="work-result"><b>Rozhodnutí:</b> ${html({adopt:'Zavést postup',adjust:'Upravit postup',continue:'Měřit déle'}[pilot.decision]||pilot.decision)}${pilot.notes?' · '+html(pilot.notes):''}</p>`:''}`;
  }
  function workOpenAnalysis() {
    if(typeof showView==='function')showView('referrers');const section=el('workMeasurementSection');if(section)section.open=true;workRenderAnalysis();if(section)section.scrollIntoView({block:'start',behavior:'smooth'});
  }
  function ensureModal(id,title) {
    let modal=el(id);if(!modal){modal=document.createElement('div');modal.id=id;modal.className='modal work-modal';document.body.appendChild(modal);}
    modal.innerHTML=`<div class="modal-box wide"><div class="toolbar"><h2>${html(title)}</h2><button class="btn" data-modal="${id}" onclick="closeModal(this.dataset.modal)">Zavřít</button></div><div id="${id}Body"></div></div>`;return el(id+'Body');
  }
  function activityTable(rows) {
    return `<div class="table-wrap"><table class="compact-table work-activity-table"><thead><tr><th>Datum / klient</th><th>Práce</th><th>Čas</th><th>Určení</th><th></th></tr></thead><tbody>${rows.map(a=>`<tr data-work-activity="${html(a.id)}"><td>${html(dateLabel(a.date))}<small>${html(clientLabel(a.clientId))}</small></td><td><b>${html(a.type||'Aktivita')}</b><small>${html(a.text||'')}</small></td><td>${minLabel(minutes(a.duration))}</td><td>${activityBucket(a)==='planned'?'Plán':TIMES[a.work?.timeKind]||'Nezjištěno'}${a.work?.obstacle?`<small>${OBSTACLES[a.work.obstacle]||''}</small>`:''}</td><td><button class="btn slim" data-id="${html(a.id)}" onclick="workEditActivity(this.dataset.id)">Upravit</button></td></tr>`).join('')||'<tr><td colspan="5">Žádné odpovídající aktivity.</td></tr>'}</tbody></table></div>`;
  }
  function renderDrilldown() {
    const body=el('workDrilldownModalBody');if(!body)return;
    const pages=Math.max(1,Math.ceil(drilldown.rows.length/PAGE_SIZE));drilldown.page=Math.max(0,Math.min(drilldown.page,pages-1));
    const controls=`<div class="work-pagination"><button class="btn slim" onclick="workDrillPage(-1)" ${drilldown.page===0?'disabled':''}>← Předchozí</button><span>Strana ${drilldown.page+1} / ${pages} · ${drilldown.rows.length} záznamů</span><button class="btn slim" onclick="workDrillPage(1)" ${drilldown.page===pages-1?'disabled':''}>Další →</button></div>`;
    body.innerHTML=`<p class="note">${html(drilldown.note)}</p>${controls}${activityTable(drilldown.rows.slice(drilldown.page*PAGE_SIZE,(drilldown.page+1)*PAGE_SIZE))}${drilldown.rows.length>PAGE_SIZE?controls:''}`;
  }
  function workDrillPage(change) {drilldown.page+=change;renderDrilldown();}
  function openDrilldown(title,note,rows) {ensureModal('workDrilldownModal',title);Object.assign(drilldown,{rows:rows.slice().sort((a,b)=>str(b.date).localeCompare(str(a.date))),page:0,note});renderDrilldown();openModal('workDrilldownModal');}
  function workShowActivities(filter,key='') {
    panelState();const s=workMeasurementSummary(view.from,view.to,view.pilotId);
    const rows=s.rows.filter(a=>filter==='area'?activityBucket(a)==='actual'&&(a.work?.area||'unclassified')===key:filter==='route'?activityBucket(a)==='actual'&&(a.delegationRoute||'')===key:filter==='obstacle'?activityBucket(a)==='actual'&&a.work?.obstacle===key:activityBucket(a)===filter);
    openDrilldown('Aktivity za vybraným součtem',`${dateLabel(view.from)}–${dateLabel(view.to)}`,rows);
  }
  function workShowOutput(id) {
    const o=outputById(id);if(!o)return;
    openDrilldown(o.title||'Pracovní výstup',`${o.process} · ${METHODS[o.method]||''} · ${o.status==='complete'?'hotový a úplný':'vyžaduje doplnění nebo opravu'}. Zahrnuty jsou všechny bloky včetně kontroly, oprav a bloků mimo vybrané období.`,uniqueActivities().filter(a=>same(a.work?.outputId,id)));
  }
  function workEditActivity(id) {closeModal('workDrilldownModal');const a=(state.activities||[]).find(a=>same(a.id,id));if(a)openActivityModal(a.clientId||null,a.id);}
  function workOpenPilot(id='') {
    const p=pilotById(id),body=ensureModal('workPilotModal',p?'Nastavení pilotu':'Dvoutýdenní pilot');
    el('workPilotModal').dataset.pilotId=p?.id||'';
    const selected=new Set((p?.caseIds||[]).map(str)),cases=(state.opportunities||[]).filter(caseOpen).slice().sort((a,b)=>caseLabel(a).localeCompare(caseLabel(b),'cs-CZ'));
    body.innerHTML=`<div class="form-grid">${field('workPilotStart','Datum zahájení',`<input id="workPilotStart" type="date" value="${html(p?.startDate||'')}">`)}${field('workPilotProcess','Jeden sledovaný proces',`<input id="workPilotProcess" maxlength="180" value="${html(p?.process||DEFAULT_PROCESS)}">`)}<div class="field full"><label for="workPilotSearch">Vybrat přibližně 10 aktivních případů</label><input id="workPilotSearch" placeholder="Filtrovat jméno nebo případ" oninput="workFilterPilotCases()"><p class="note" id="workPilotCaseCount"></p><div class="work-pilot-case-picker">${cases.map(o=>`<label class="work-pilot-case-option" data-work-search="${html(normalized(caseLabel(o)))}"><input type="checkbox" data-work-case="${html(o.id)}" ${selected.has(str(o.id))?'checked':''} onchange="workFilterPilotCases()"><span>${html(caseLabel(o))}</span></label>`).join('')||'<p class="note">Nejsou dostupné aktivní případy.</p>'}</div></div>${field('workPilotDecision','Rozhodnutí po vyhodnocení',select('workPilotDecision',options({adopt:'Zavést postup',adjust:'Upravit postup',continue:'Měřit déle'},p?.decision||'','Zatím nevyhodnoceno')))}${field('workPilotNotes','Poznámka k pilotu',`<textarea id="workPilotNotes" rows="3" maxlength="3000">${html(p?.notes||'')}</textarea>`,true)}</div><p class="note">Případy se pouze připojí odkazem. Nevzniknou jejich kopie ani automatické úkoly. Uzavřené případy zůstanou v historii pilotu, ale nepočítají se mezi aktivní.</p><div class="actions"><button class="btn primary" onclick="workSavePilot()">Uložit pilot</button></div>`;
    workFilterPilotCases();openModal('workPilotModal');
  }
  function workFilterPilotCases() {
    const query=normalized(val('workPilotSearch'));document.querySelectorAll('#workPilotModal [data-work-search]').forEach(row=>row.hidden=query&&!row.dataset.workSearch.includes(query));
    if(el('workPilotCaseCount'))el('workPilotCaseCount').textContent=`Vybráno ${document.querySelectorAll('#workPilotModal [data-work-case]:checked').length} aktivních případů. Výběr provádíš ty; počet nemusí být přesně 10.`;
  }
  function workSavePilot() {
    const startDate=val('workPilotStart'),process=val('workPilotProcess').trim();if(!validDate(startDate))return alert('Vyber datum zahájení pilotu.');if(!process)return alert('Pojmenuj jeden sledovaný proces.');
    const id=el('workPilotModal')?.dataset.pilotId,p=pilotById(id),selected=[...document.querySelectorAll('#workPilotModal [data-work-case]:checked')].map(x=>caseById(x.dataset.workCase)).filter(caseOpen).map(o=>o.id);
    const before=JSON.parse(JSON.stringify(state.workPilots||[])),record={...(p||{}),id:p?.id||uuid(),startDate,process,caseIds:[...new Set([...selected,...(p?.caseIds||[]).filter(id=>!caseOpen(caseById(id)))])],decision:val('workPilotDecision'),notes:val('workPilotNotes').trim(),createdAt:p?.createdAt||now(),updatedAt:now()};
    state.workPilots=state.workPilots||[];const index=state.workPilots.findIndex(x=>same(x.id,record.id));if(index>=0)state.workPilots[index]=record;else state.workPilots.push(record);
    if(typeof persist==='function'&&!persist()){state.workPilots=before;return;}
    view.pilotId=record.id;const d=workPilotDates(record);view.from=d.from;view.to=d.to;closeModal('workPilotModal');workRenderAnalysis();if(typeof saveToast==='function')saveToast('Pilot uložen');
  }
  Object.assign(window,{workFillFields,workCaptureFields,workRestoreFields,workClientChanged,workOutputChanged,workFieldsChanged,workApplyFields,workPilotDates,workMeasurementSummary,workPilotComparison,workPilotCaseCoverage,workRenderAnalysis,workOpenAnalysis,workSetPeriod,workSelectPilot,workShowActivities,workShowOutput,workDrillPage,workEditActivity,workOpenPilot,workFilterPilotCases,workSavePilot});
})();
