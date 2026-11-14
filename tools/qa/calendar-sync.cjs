const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../../assets/js/calendar-sync-core.js');
const {chromium,launchOptions}=require('./runtime.cjs');
const a={syncId:'test-calendar-a',type:'Telefon',date:'2026-11-16',time:'10:00',duration:30,text:'Podklady',completed:false};
const body=C.payload(a,'Test Alfa'),base=C.shape(body);
assert.equal(C.decide(base,body,{...body,summary:'Změna Google'}),'pull');
assert.equal(C.decide(base,{...body,summary:'Změna CRM'},body),'push');
assert.equal(C.decide(base,{...body,summary:'Změna CRM'},{...body,summary:'Změna Google'}),'conflict');
assert.equal(C.decide(base,body,{status:'cancelled'}),'removed');
assert.equal(C.shape({...body,start:{dateTime:'2026-07-01T08:00:00Z'},end:{dateTime:'2026-07-01T08:30:00Z'}}).start,'2026-07-01T10:00');
assert.equal(C.payload({...a,time:'',date:'2026-12-31'},'Test').end.date,'2027-01-01');
assert.throws(()=>C.pull(a,{...body,start:{date:'2026-11-16'},end:{date:'2026-11-19'}}));
assert.equal(C.pull(a,{...body,summary:'✓ Hotovo'}).completed,true);
const root=path.resolve(__dirname,'../..'),fixture=structuredClone(require('./fixture.cjs'));
fixture.activities=[{...a,id:40,clientId:1,recordKind:'activity'}];
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1280,height:1000}}),events=new Map();let writes=0,version=1,failNextPatch=false;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.hostname==='crm.test'){const f=path.join(root,decodeURIComponent(u.pathname));if(f.startsWith(root+path.sep)&&fs.existsSync(f))return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});}
  if(u.hostname==='www.googleapis.com'){
   const send=(o,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(o)});
   if(u.pathname.endsWith('calendarList'))return send({items:[{id:'4c5sjddqejkk65ghl68dd1tl64@group.calendar.google.com',summary:'Test kalendář',accessRole:'owner'}]});
   const id=u.pathname.split('/events/')[1];
   if(req.method()==='GET')return id?send(events.get(id)||{},events.has(id)?200:404):send({items:[...events.values()].filter(e=>e.status!=='cancelled'&&(u.searchParams.has('privateExtendedProperty')?e.extendedProperties?.private?.filipCrmApp==='filip-crm-v1':(e.start?.date||e.start?.dateTime||'').slice(0,10)===u.searchParams.get('timeMin')?.slice(0,10)))});
   const data=req.postDataJSON();writes++;
   if(req.method()==='POST'){if(events.has(data.id))return send({},409);const e={...data,etag:'v'+version++,htmlLink:'https://calendar.google.com/calendar/event?eid=test'};events.set(data.id,e);return send(e);}
   if(req.method()==='PATCH'){
    if(failNextPatch){failNextPatch=false;return send({},412);}
    if(req.headers()['if-match']!==events.get(id)?.etag)return send({},412);
    const e={...events.get(id),...data,etag:'v'+version++};events.set(id,e);return send(e);
   }
  }
  return route.abort();
 });
 await context.addInitScript(seed=>{
  if(location.hostname!=='crm.test')return;
  if(!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));
  localStorage.setItem('filip_crm_calendar_connection_v1',JSON.stringify({clientId:'test.apps.googleusercontent.com',calendarId:'4c5sjddqejkk65ghl68dd1tl64@group.calendar.google.com',calendarName:'Test kalendář'}));
  window.google={accounts:{oauth2:{initTokenClient:opts=>({requestAccessToken:()=>opts.callback({access_token:'synthetic',expires_in:3600})})}}};
 },fixture);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.goto('https://crm.test/FILIP-CRM.html');await page.evaluate(()=>showView('settings'));
 await page.evaluate(()=>CrmCalendar.connect());await page.waitForFunction(()=>document.querySelector('#calendarSyncStatus').textContent.startsWith('Připojeno'));
 const review=()=>page.evaluate(()=>CrmCalendar.review());
 const status=()=>page.locator('#calendarSyncStatus').innerText();
 await review();assert.match(await page.locator('#calendarSyncPreview').innerText(),/Vytvořit/);assert.equal(writes,0);
 // A nearly full browser store must not require another copy of the whole CRM.
 await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='filip_crm_calendar_before_sync'&&v.length>50000)throw new DOMException('Quota exceeded','QuotaExceededError');return original.call(this,k,v);};state.calendarQuotaTestPadding='x'.repeat(60000);});
 await page.evaluate(()=>CrmCalendar.apply(0));assert.equal(events.size,1);assert.equal(writes,1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('filip_crm_calendar_before_sync')).activity.syncId),'test-calendar-a');
 const id=[...events.keys()][0];assert.ok(/^fc[0-9a-f]{64}$/.test(id));
 await review();await page.evaluate(()=>CrmCalendar.apply(0));assert.equal(writes,1,'idempotent repeated sync');
 // Calendar moves are reflected in CRM, with persistent stable link.
 const e=events.get(id);events.set(id,{...e,start:{dateTime:'2026-11-17T11:00:00+01:00'},end:{dateTime:'2026-11-17T11:30:00+01:00'},etag:'v'+version++});
 await review();assert.match(await page.locator('#calendarSyncPreview').innerText(),/Google → CRM/);
 await page.evaluate(()=>CrmCalendar.apply(0));assert.equal(await page.evaluate(()=>state.activities[0].date),'2026-11-17');
 await page.reload();await page.evaluate(()=>showView('settings'));assert.equal(await page.evaluate(()=>state.activities[0].calendarLink.eventId),id);
 await page.evaluate(()=>CrmCalendar.connect());await page.waitForFunction(()=>document.querySelector('#calendarSyncStatus').textContent.startsWith('Připojeno'));
 await page.evaluate(()=>{state.activities[0].text='Změna CRM';persist();});await review();await page.evaluate(()=>CrmCalendar.apply(0));assert.equal(events.get(id).description,'Změna CRM');
 // Concurrent changes require explicit source choice.
 await page.evaluate(()=>{state.activities[0].text='Lokální konflikt';persist();});events.set(id,{...events.get(id),description:'Vzdálený konflikt',etag:'v'+version++});
 await review();assert.match(await page.locator('#calendarSyncPreview').innerText(),/Změny na obou/);const before=writes;
 await page.evaluate(()=>CrmCalendar.apply(0));assert.equal(writes,before);
 await page.evaluate(()=>CrmCalendar.apply(0,'pull'));assert.equal(await page.evaluate(()=>state.activities[0].text),'Vzdálený konflikt');
 // A change after preview cannot overwrite the current Google event.
 await page.evaluate(()=>{state.activities[0].text='Nový text';persist();});await review();events.set(id,{...events.get(id),etag:'v'+version++});
 await page.evaluate(()=>CrmCalendar.apply(0));assert.match(await status(),/mezitím změnila/);
 await review();failNextPatch=true;await page.evaluate(()=>CrmCalendar.apply(0));assert.match(await status(),/mezitím změnila/);
 // Deletion does not recreate, mark done or remove CRM data.
 events.set(id,{...events.get(id),status:'cancelled',etag:'v'+version++});await review();assert.match(await page.locator('#calendarSyncPreview').innerText(),/Smazáno v Google/);assert.equal(await page.evaluate(()=>state.activities[0].completed),false);
 // Existing manual event is offered for explicit pairing, not inserted twice.
 await page.evaluate(()=>{state.activities.push({id:90,syncId:'second',clientId:2,type:'Telefon',date:'2026-11-20',time:'',text:'Test',completed:false,recordKind:'activity'});persist();});
 events.set('manual',{id:'manual',summary:'Telefon · Testovací klient Beta',description:'Test',start:{date:'2026-11-20'},end:{date:'2026-11-21'},etag:'manual-v1'});
 await review();assert.match(await page.locator('#calendarSyncPreview').innerText(),/Možná existující/);
 await page.evaluate(()=>CrmCalendar.pair(1,0));await page.evaluate(()=>CrmCalendar.apply(1));assert.equal(await page.evaluate(()=>state.activities[1].calendarLink.eventId),'manual');
 // Changes made locally after preview are never overwritten.
 await review();await page.evaluate(()=>{state.activities[1].text='Edit during preview';persist();});await page.evaluate(()=>CrmCalendar.apply(1));assert.match(await status(),/mezitím změnil/);
 // Opt-in automatic export includes only newly created steps, not the historical backlog.
 await page.evaluate(()=>{CrmCalendar.toggleNew(true);state.activities.push({id:91,syncId:'auto-new',clientId:2,type:'Úkol',date:'2026-12-10',time:'',text:'Nový krok',completed:false,recordKind:'activity'});persist();});
 await page.waitForFunction(()=>state.activities.find(a=>a.syncId==='auto-new')?.calendarLink,{timeout:10000});
 assert.equal([...events.values()].filter(e=>e.extendedProperties?.private?.filipCrmActivity==='auto-new').length,1);
 assert.equal([...events.values()].some(e=>e.attendees?.length),false,'never sends invitations');
 await page.evaluate(()=>CrmCalendar.toggleAuto());
 // End-to-end: phase transition -> native tasks -> automatic calendar export.
 events.clear();
 await page.evaluate(()=>{state.activities=[];state.opportunities=[];state.deals=[];CrmCalendar.toggleNew(true);state.opportunities.push({id:500,clientId:1,category:'Hypotéka',status:'Opportunity',product:'QA workflow'});updateOpportunityStatus(500,'Podpis');});
 await page.waitForFunction(()=>state.activities.filter(a=>a.automation).length===2&&state.activities.filter(a=>a.automation).every(a=>a.calendarLink),{timeout:15000});
 assert.equal(events.size,2,'two distinct phase steps for same client are not mistaken for duplicate events');
 const phaseIds=await page.evaluate(()=>state.activities.filter(a=>a.automation).map(a=>a.calendarLink.eventId));
 const callId=await page.evaluate(()=>state.activities.find(a=>a.type==='Telefon').calendarLink.eventId);
 // Remote rescheduling updates the same linked workflow step, then survives a phase change.
 events.set(callId,{...events.get(callId),start:{dateTime:'2026-11-19T13:00:00+01:00'},end:{dateTime:'2026-11-19T13:10:00+01:00'},etag:'v'+version++});
 await page.evaluate(()=>CrmCalendar.changed());
 await page.waitForFunction(()=>state.activities.find(a=>a.type==='Telefon').time==='13:00',{timeout:15000});
 assert.equal(await page.evaluate(()=>state.activities.find(a=>a.type==='Telefon').automation.manualDate),true);
 await page.evaluate(()=>{state.opportunities[0].automation.paused=true;persist();});
 await page.waitForFunction(()=>state.activities.filter(a=>a.automation).every(a=>a.calendarLink.base.summary.startsWith('⏸ ')),{timeout:15000});
 assert(phaseIds.every(id=>events.get(id).transparency==='transparent'));
 await page.evaluate(()=>{state.opportunities[0].automation.paused=false;persist();});
 await page.waitForFunction(()=>state.activities.filter(a=>a.automation).every(a=>!a.calendarLink.base.summary.startsWith('⏸ ')),{timeout:15000});
 // Repeated save does not generate another task or event.
 await page.evaluate(()=>{updateOpportunityStatus(500,'Podpis');persist();});
 await review();assert.equal(events.size,2);
 await page.evaluate(()=>updateOpportunityStatus(500,'Zrušeno'));
 await page.waitForFunction(()=>state.activities.filter(a=>a.automation).every(a=>a.calendarLink.base.summary.startsWith('× ')),{timeout:15000});
 assert.equal(events.size,2);assert(phaseIds.every(id=>events.get(id).transparency==='transparent'));
 assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.automation).some(a=>a.outcome==='realized')),false,'cancel is not performed work');
 // Email follow-up is scheduled immediately, assigned to assistant and synced once.
 const waitId=await page.evaluate(()=>{const mail=CrmWorkflow.email(state,{clientId:1,sentDate:CrmWorkflow.day(),due:CrmWorkflow.plus(CrmWorkflow.day(),3),topic:'QA čekání',body:'PRIVATE BODY MUST STAY LOCAL',submissionId:'qa-email'});persist();return mail.emailWait.id;});
 await page.waitForFunction(id=>state.activities.find(a=>a.syncId==='email-reminder:'+id)?.calendarLink,waitId,{timeout:15000});
 const emailEvent=await page.evaluate(id=>state.activities.find(a=>a.syncId==='email-reminder:'+id).calendarLink.eventId,waitId);
 assert.equal(events.size,3);assert.equal(await page.evaluate(id=>state.activities.find(a=>a.syncId==='email-reminder:'+id).automation.assignee,waitId),'assistant');
 assert(!JSON.stringify(events.get(emailEvent)).includes('PRIVATE BODY'));
 assert.equal(await page.evaluate(id=>!!state.activities.find(a=>a.syncId==='email-reminder:'+id).emailSms,waitId),false);
 const moved=await page.evaluate(()=>CrmWorkflow.plus(CrmWorkflow.day(),5));
 const movedEnd=await page.evaluate(d=>CrmWorkflow.plus(d,1),moved);
 events.set(emailEvent,{...events.get(emailEvent),start:{date:moved},end:{date:movedEnd},etag:'v'+version++});
 await page.evaluate(()=>CrmCalendar.changed());await page.waitForFunction(({id,date})=>state.activities.find(a=>a.emailWait?.id===id).emailWait.due===date,{id:waitId,date:moved},{timeout:15000});
 await page.evaluate(id=>{state.activities.find(a=>a.emailWait?.id===id).emailWait.status='answered';persist();},waitId);
 await page.waitForFunction(id=>state.activities.find(a=>a.syncId==='email-reminder:'+id).calendarLink.base.summary.startsWith('× '),waitId,{timeout:15000});
 assert.equal(events.size,3);assert.equal(events.get(emailEvent).transparency,'transparent');
 // Document checklist uses the same bidirectional ledger and stable calendar IDs.
 const checklistId=await page.evaluate(()=>{const row={id:700,clientId:1,category:'Hypotéka',status:'Opportunity'};state.opportunities.push(row);const c=CrmDocuments.init(state,row);CrmDocuments.change(state,row,c.items[0].id,'requested');persist();return c.id;});
 await page.waitForFunction(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='admin')?.calendarLink,checklistId,{timeout:15000});
 const adminEvent=await page.evaluate(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='admin').calendarLink.eventId,checklistId);assert.equal(events.size,4);
 await page.evaluate(()=>{const row=state.opportunities.find(x=>x.id===700);CrmDocuments.change(state,row,row.documentChecklist.items[1].id,'requested');persist();persist();});await review();assert.equal(events.size,4,'one admin event for several requested documents');
 events.set(adminEvent,{...events.get(adminEvent),start:{date:moved},end:{date:movedEnd},etag:'v'+version++});await page.evaluate(()=>CrmCalendar.changed());
 await page.waitForFunction(date=>state.opportunities.find(x=>x.id===700).documentChecklist.due===date,moved,{timeout:15000});
 await page.evaluate(()=>{const row=state.opportunities.find(x=>x.id===700);for(const i of row.documentChecklist.items){CrmDocuments.change(state,row,i.id,'received');CrmDocuments.change(state,row,i.id,'checked');}persist();});
 await page.waitForFunction(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='expert')?.calendarLink,checklistId,{timeout:15000});assert.equal(events.size,5);
 await page.waitForFunction(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='admin').calendarLink.base.summary.startsWith('✓ '),checklistId,{timeout:15000});
 const expertEvent=await page.evaluate(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='expert').calendarLink.eventId,checklistId);
 await page.evaluate(()=>{const row=state.opportunities.find(x=>x.id===700);CrmDocuments.change(state,row,row.documentChecklist.items[0].id,'missing');persist();});
 await page.waitForFunction(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='expert').calendarLink.base.summary.startsWith('⏸ '),checklistId,{timeout:15000});assert.equal(events.size,5);assert.equal(events.get(expertEvent).transparency,'transparent');
 await page.evaluate(()=>{const row=state.opportunities.find(x=>x.id===700);CrmDocuments.change(state,row,row.documentChecklist.items[0].id,'received');CrmDocuments.change(state,row,row.documentChecklist.items[0].id,'checked');persist();persist();});
 await page.waitForFunction(id=>!state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='expert').calendarLink.base.summary.startsWith('⏸ '),checklistId,{timeout:15000});assert.equal(events.size,5);assert.equal(await page.evaluate(id=>state.activities.find(a=>a.documentCheck?.id===id&&a.documentCheck.kind==='expert').calendarLink.eventId,checklistId),expertEvent);
 await page.evaluate(()=>CrmCalendar.toggleAuto());
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/tmp/filip-calendar-qa.png',fullPage:true});
 console.log('PASS: preview without writes, deterministic IDs, idempotency, both sync directions, reload, conflicts, ETag race, deletion, explicit duplicate pairing, local concurrent edit, all-day and Prague timezone. Synthetic data; no real Google requests.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
