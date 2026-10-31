// Synthetic fixtures only. No connection to live CRM, user profile, local storage service or inbox.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..'),fixture=require('./fixture.cjs');
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1050},timezoneId:'Europe/Prague'});
  await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));return u.hostname==='crm.test'&&f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'}):route.abort();});
  const seed=structuredClone(fixture);seed.nextId=1000;seed.activities=[];seed.opportunities=[{id:301,clientId:1,category:'Hypotéka',product:'QA původní případ',status:'Opportunity',history:[]}];seed.deals=[];
  await context.addInitScript(s=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(s));},seed);
  const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{dialogs.push(d.message());await d.dismiss();});
  await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof CrmWorkflow==='object'&&typeof state==='object');
  assert.equal(await page.evaluate(()=>!!state.opportunities[0].automation),false,'existing cases never adopted automatically');
  const engine=await page.evaluate(()=>{
   const W=CrmWorkflow,s=normalizeState({clients:[{id:1,name:'QA Alfa'},{id:2,name:'QA Beta'}],nextId:1000,activities:[],deals:[],opportunities:[]}),o={id:3,clientId:1,category:'Hypotéka',product:'QA hypotéka',status:'Opportunity'};s.opportunities.push(o);
   const p=W.attach(s,o,false,'2026-10-23'),initial=s.activities.length;W.reconcile(s,'2026-10-23');W.reconcile(s,'2026-10-23');
   const result={initial,noDuplicate:s.activities.length===initial,notCompleted:W.totals(W.rows(s)).done===0};
   o.status='Nabídka';W.reconcile(s,'2026-10-23');const proposal=p.steps.find(x=>x.key==='proposal');W.emit(s,o,'offer','2026-10-23',{key:'one-offer'});result.offerCompleted=proposal.status==='done';result.follow=s.activities.find(a=>a.automation?.stepId===p.steps.find(x=>x.key==='follow').id).date;
   W.emit(s,o,'offer','2026-10-23',{key:'one-offer'});const count=s.activities.length;W.reconcile(s,'2026-10-24');result.eventDedup=s.activities.length===count;
   o.nextContactDate='2026-10-29';W.reconcile(s,'2026-10-24');const contact=p.steps.find(x=>x.key==='contact'),a=s.activities.find(a=>a.syncId===contact.activitySyncId);a.date='2026-11-05';a.text='Ruční text';W.reconcile(s,'2026-10-24');o.nextContactDate='2026-10-30';W.reconcile(s,'2026-10-24');result.manual=a.date==='2026-11-05'&&a.text==='Ruční text';
   const completed=structuredClone(proposal.completedEstimate);const t=s.workflowTemplates.find(t=>t.category==='Hypotéka');t.version++;t.steps.forEach(x=>x.solo=999);W.applyVersion(s,o,t);result.historyLocked=JSON.stringify(proposal.completedEstimate)===JSON.stringify(completed);
   s.activities.push({id:9999,clientId:1,text:'Ruční úkol',completed:false});o.status='Zrušeno';W.reconcile(s,'2026-10-24');result.cancelled=p.steps.every(x=>['done','cancelled'].includes(x.status));result.manualTask=!s.activities.find(a=>a.id===9999).completed;o.status='Opportunity';W.reconcile(s,'2026-10-25');result.reopened=p.steps.some(x=>x.key==='prepare'&&x.status==='open');
   p.paused=true;W.reconcile(s,'2026-10-25');result.paused=p.steps.some(x=>x.status==='paused');p.paused=false;W.reconcile(s,'2026-10-25');result.resumed=p.steps.some(x=>x.status==='open');
   const mail=W.email(s,{clientId:1,sourceId:'case:3',sentDate:'2026-10-23',due:'2026-10-26',topic:'Citlivé téma 500000 Kč',thread:'thread-1'});W.email(s,{clientId:1,sourceId:'case:3',sentDate:'2026-10-23',due:'2026-10-26',topic:'Citlivé téma 500000 Kč',thread:'thread-1'});result.mailDedup=s.activities.filter(a=>a.emailWait).length===1;
   W.reconcile(s,'2026-10-25');result.noEarlyReminder=!s.activities.some(a=>a.emailSms);W.reconcile(s,'2026-10-26');W.reconcile(s,'2026-10-26');const reminders=s.activities.filter(a=>a.emailSms);result.oneReminder=reminders.length===1;result.safeSms=!reminders[0].emailSms.text.includes('500000')&&!reminders[0].emailSms.sentAt;
   mail.emailWait.status='answered';W.reconcile(s,'2026-10-26');result.replyCloses=reminders[0].emailSms.cancelled&&reminders[0].automation.status==='cancelled';
   const other={id:4,clientId:1,category:'Investice',product:'QA investice',status:'Opportunity'};s.opportunities.push(other);W.attach(s,other);const second=W.email(s,{clientId:1,sourceId:'case:4',sentDate:'2026-10-23',due:'2026-10-26',topic:'Jiný případ',thread:'thread-1'});result.caseIsolation=second.emailWait.status==='waiting'&&second.emailWait.id!==mail.emailWait.id;
   const d={id:5,clientId:1,category:'Hypotéka',product:o.product,date:'2026-10-26'};s.deals.push(d);W.transfer(s,o,d,d.date);s.opportunities=s.opportunities.filter(x=>x!==o);W.reconcile(s,'2026-10-26');result.signed=d.automation.steps.some(x=>x.spec.trigger==='signed'&&x.status==='open');result.identity=d.automation.id===p.id;
   result.weekend=W.plus('2026-10-23',3,true);result.calendar=W.plus('2026-10-23',3,false);result.dst=W.plus('2026-03-27',3,true);result.prague=W.day(new Date('2026-10-24T22:30:00Z'));
   const spec=W.defaultTemplate('Ostatní').steps[0];spec.solo=30;spec.assistant=35;spec.residual=5;spec.delegate='yes';spec.assignee='assistant';const tiny=normalizeState({nextId:1,activities:[],opportunities:[{id:10,clientId:1,category:'Ostatní',status:'Opportunity'}],deals:[],clients:[{id:1,name:'QA'}]});tiny.workflowTemplates.find(t=>t.category==='Ostatní').steps=[spec];W.attach(tiny,tiny.opportunities[0]);result.math=W.totals(W.rows(tiny));
   const restored=normalizeState(JSON.parse(JSON.stringify(s)));W.reconcile(restored,'2026-10-26');const n=restored.activities.length;W.reconcile(restored,'2026-10-26');result.restoreStable=restored.activities.length===n;
   return result;
  });
  for(const k of ['noDuplicate','notCompleted','offerCompleted','eventDedup','manual','historyLocked','cancelled','manualTask','reopened','paused','resumed','mailDedup','noEarlyReminder','oneReminder','safeSms','replyCloses','caseIsolation','signed','identity','restoreStable'])assert.equal(engine[k],true,k);
  assert.equal(engine.follow,'2026-10-26');assert.equal(engine.weekend,'2026-10-28');assert.equal(engine.calendar,'2026-10-26');assert.equal(engine.dst,'2026-04-01');assert.equal(engine.prague,'2026-10-25');assert.equal(engine.math.saving,25);assert.equal(engine.math.assistant,35);assert.equal(engine.math.chosenMe,5);assert.equal(engine.math.done,0);
  // Real UI creates a new case; existing one remains untouched.
  await page.evaluate(()=>openOpportunityModal(1));await page.locator('#oCategory').selectOption('Život');await page.locator('#oProduct').fill('QA automatizované životní pojištění');await page.evaluate(()=>saveOpportunity());
  const id=await page.evaluate(()=>state.opportunities.find(o=>o.product==='QA automatizované životní pojištění').id);
  assert.equal(await page.evaluate(id=>!!state.opportunities.find(o=>o.id===id).automation,id),true);
  await page.evaluate(id=>openCaseDetail(id),id);await page.locator('#workflowCase').waitFor();
  await page.locator('#workflowCase [data-wf-action="event"][data-event="offer"]').click();await page.locator('#workflowModal [data-wf-action="save-event"]').click();
  await page.locator('#workflowCase [data-wf-action="email"]').click();await page.locator('#wfMailTopic').fill('QA kontrola nabídky');await page.locator('#wfMailSent').fill('2026-10-23');await page.locator('#wfMailDue').fill('2026-10-26');await page.locator('[data-wf-action="save-email"]').click();
  assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.emailSms).length),1);
  await page.locator('#workflowCase [data-wf-action="sms"]').click();await page.locator('#wfSmsText').fill('QA ručně upravená zpráva');await page.locator('[data-wf-action="save-sms"]').click();
  assert.equal(await page.evaluate(()=>state.activities.find(a=>a.emailSms).emailSms.text),'QA ručně upravená zpráva');
  await page.locator('#workflowCase [data-wf-action="wait"][data-result="answered"]').click();await page.locator('#workflowModal [data-wf-action="close"]').click();
  assert.equal(await page.evaluate(()=>state.activities.find(a=>a.emailSms).emailSms.cancelled),true);
  // Confirming SMS is separate from copying; scheduling another check preserves the sent history.
  await page.evaluate(id=>{const o=state.opportunities.find(o=>o.id===id);CrmWorkflow.email(state,{clientId:1,sourceId:'case:'+id,sentDate:'2026-10-23',due:'2026-10-26',topic:'QA druhá kontrola',thread:'QA thread 2'});persist();renderActiveView();},id);
  await page.locator('#workflowCase [data-wf-action="sms"]').click();
  await page.locator('[data-wf-action="sent-sms"]').click();
  assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.type==='SMS').length),1);
  await page.locator('#workflowModal [data-wf-action="defer"]').click();await page.locator('#wfDefer').fill('2026-11-10');await page.locator('[data-wf-action="save-defer"]').click();
  assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.type==='SMS').length),1);
  // Saving a new email fails atomically; form remains available and no phantom task/contact is added.
  const beforeFailure=await page.evaluate(()=>JSON.stringify(state));
  await page.locator('#workflowCase [data-wf-action="email"]').click();await page.locator('#wfMailTopic').fill('QA nesmí být uloženo');
  await page.evaluate(()=>{window.qaOriginalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='filip_crm_main_v1')throw Error('QA disk full');return qaOriginalSet.call(this,k,v);};});
  await page.locator('[data-wf-action="save-email"]').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),beforeFailure,'failed save rolls back steps, contacts and IDs');
  assert.equal(await page.locator('#wfMailTopic').inputValue(),'QA nesmí být uloženo');
  await page.evaluate(()=>{Storage.prototype.setItem=qaOriginalSet;});await page.locator('#workflowModal [data-wf-action="close"]').click();
  assert.equal(dialogs.filter(x=>x.includes('nepovedlo uložit')).length,1);dialogs.length=0;
  // A template edit is versioned and does not rewrite existing plans until preview/apply.
  const planVersion=await page.evaluate(id=>state.opportunities.find(o=>o.id===id).automation.version,id);
  await page.locator('#workflowCase [data-wf-action="templates"]').click();
  await page.locator('#wfTemplateSteps details').first().locator('summary').click();await page.locator('#wft0solo').fill('45');await page.locator('[data-wf-action="save-template"]').click();
  assert.equal(await page.evaluate(id=>state.opportunities.find(o=>o.id===id).automation.version,id),planVersion);
  await page.locator('#workflowCase [data-wf-action="preview"]').click();await page.locator('[data-wf-action="apply-preview"]').click();
  assert.equal(await page.evaluate(id=>state.opportunities.find(o=>o.id===id).automation.version,id),planVersion+1);
  // Backup merge twice preserves stable workflow/task identities.
  const merged=await page.evaluate(()=>{const backup=structuredClone(state),before=state.activities.length;mergeIncomingState(backup);mergeIncomingState(backup);persist();return {before,after:state.activities.length,flows:state.opportunities.filter(o=>o.automation).length};});assert.equal(merged.before,merged.after);assert.equal(merged.flows,1);
  const remapped=await page.evaluate(()=>{
    const incoming=structuredClone(state),before=state.activities.length,flows=state.opportunities.length;
    const bump=x=>x==null?x:Number(x)+50000;
    incoming.clients.forEach(c=>c.id=bump(c.id));
    for(const key of ['contracts','opportunities','deals','activities'])incoming[key].forEach(x=>{x.id=bump(x.id);if(x.clientId!=null)x.clientId=bump(x.clientId);if(x.sourceOpportunityId!=null)x.sourceOpportunityId=bump(x.sourceOpportunityId);});
    mergeIncomingState(incoming);persist();return {stableActivities:state.activities.length===before,stableCases:state.opportunities.length===flows,correctLinks:state.activities.filter(a=>a.automation?.flowId).every(a=>state.opportunities.some(o=>o.automation?.id===a.automation.flowId&&o.clientId===a.clientId)||state.deals.some(o=>o.automation?.id===a.automation.flowId&&o.clientId===a.clientId))};
  });assert.deepEqual(remapped,{stableActivities:true,stableCases:true,correctLinks:true});
  await page.reload();await page.waitForFunction(()=>typeof state==='object');assert.equal(await page.evaluate(()=>state.opportunities.filter(o=>o.automation).length),1);
  await page.evaluate(id=>openCaseDetail(id),id);await page.screenshot({path:'/private/tmp/crm-workflow-desktop.png',fullPage:false});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:'/private/tmp/crm-workflow-mobile.png',fullPage:false});
  
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'mobile no horizontal overflow');
  await page.evaluate(()=>showView('dashboard'));assert.deepEqual(await page.locator('[data-dashboard-section]').evaluateAll(xs=>xs.map(x=>x.dataset.dashboardSection)),['daily','weekly','charts','stats','tasks']);
  assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
  console.log(JSON.stringify({ok:true,engine,merged,screenshots:['/private/tmp/crm-workflow-desktop.png','/private/tmp/crm-workflow-mobile.png']},null,2));
 } finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
