// Isolated synthetic CRM only; no user profile or network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..'),fixture=require('./fixture.cjs');
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));return u.hostname==='crm.test'&&f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile()?route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'}):route.abort();});
 const seed=structuredClone(fixture);seed.activities=[];seed.opportunities=[];seed.deals=[];
 await context.addInitScript(s=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(s));},seed);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof state==='object');
 const result=await page.evaluate(()=>{
  const T=CrmTasks,W=CrmWorkflow,s=normalizeState({nextId:100,clients:[{id:1,name:'Testovací klient',phone:'123'}],opportunities:[],deals:[],activities:[]});
  const add=(id,category='Hypotéka')=>{const row={id,clientId:1,category,status:'Kompletace'};s.opportunities.push(row);W.attach(s,row,false,'2026-11-14',true);return {row,a:s.activities.at(-1),step:row.automation.steps.find(x=>x.status==='open')};};
  const first=add(1);first.a.calendarLink={eventId:'stable-event'};const sync=first.a.syncId,count=s.activities.length;
  T.assign(s,first.a,'assistant');T.assign(s,first.a,'me');T.assign(s,first.a,'assistant');
  const r={oneVote:T.suggestions(s)[0].total===1,identity:s.activities.length===count&&first.a.syncId===sync&&first.a.calendarLink.eventId==='stable-event',syncedOwner:first.step.spec.assignee==='assistant'};
  for(let i=2;i<=5;i++)T.assign(s,add(i).a,'assistant');const g=T.suggestions(s)[0];r.threshold=g.eligible&&g.total===5;
  const before=add(6);r.notAutomatic=T.owner(before.a)==='me';T.setRule(s,g.key,true);const after=add(7);r.automatic=T.owner(after.a)==='assistant';r.notRetroactive=T.owner(before.a)==='me';const custom=structuredClone(after.step);custom.spec.assignee='me';custom.manualEstimate=true;T.applyRule(s,after.row,custom);r.manualFuture=custom.spec.assignee==='me';r.noSelfLearning=T.suggestions(s)[0].total===5;
  T.assign(s,after.a,'me');W.applyVersion(s,after.row,s.workflowTemplates.find(t=>t.category==='Hypotéka'));W.reconcile(s);r.manualWins=T.owner(after.a)==='me'&&after.step.spec.assignee==='me';
  r.categoryIsolation=T.owner(add(8,'Život').a)==='me';T.setRule(s,g.key,false);r.disabled=T.owner(add(9).a)==='me';
  const forbidden=add(10);forbidden.step.spec.delegate='no';try{T.assign(s,forbidden.a,'assistant');r.forbidden=false;}catch{r.forbidden=true;}
  const copy=normalizeState(JSON.parse(JSON.stringify(s)));r.persisted=T.suggestions(copy)[0].total===6&&copy.settings.taskDelegationRules[g.key].enabled===false;
  const merged=normalizeState({});T.merge(merged,copy);r.merge=merged.settings.taskDelegationRules[g.key].enabled===false;
  // A reversal replaces the task's vote rather than preserving a positive vote.
  T.assign(s,first.a,'me');r.reversal=T.suggestions(s)[0].assistant===4;
  state=s;persist();showView('tasks');return r;
 });
 for(const [key,value]of Object.entries(result))assert.equal(value,true,key);
 const waits=await page.evaluate(()=>{
  const W=CrmWorkflow,s=normalizeState({nextId:1,clients:[{id:1,name:'QA',phone:'123'}],opportunities:[],deals:[],activities:[]}),today=W.day(),due=W.plus(today,3);
  const data={clientId:1,sentDate:today,due,topic:'Podklady',body:'Soukromý obsah',submissionId:'once'},m=W.email(s,data);W.reconcile(s,today);let a=s.activities.find(x=>x.automation?.origin==='email');
  const r={immediate:!!a&&a.date===due&&a.automation.assignee==='assistant',noEarlySms:!a.emailSms,body:m.emailWait.body==='Soukromý obsah'};
  W.email(s,data);W.reconcile(s,today);r.dedup=s.activities.length===2;
  W.reconcile(s,due);r.draft=!!a.emailSms&&!a.emailSms.sentAt&&!a.completed;
  CrmTasks.assign(s,a,'me');W.reconcile(s,due);r.manualOwner=a.automation.assignee==='me';
  a.date=W.plus(due,3);W.reconcile(s,due);r.move=m.emailWait.due===a.date&&!W.smsReady(s,a);
  m.emailWait.status='answered';W.reconcile(s,due);r.reply=a.completed&&a.emailSms.cancelled&&a.outcome!=='realized';
  W.email(s,data);W.reconcile(s,due);r.doubleSubmitResolved=s.activities.length===2;
  const m2=W.email(s,{...data,topic:'Druhý',submissionId:'two'});W.reconcile(s,today);const a2=s.activities.find(x=>x.automation?.waitId===m2.emailWait.id);s.activities=s.activities.filter(x=>x!==a2);W.reconcile(s,today);r.deleted=!s.activities.some(x=>x.automation?.waitId===m2.emailWait.id);
  return r;
 });for(const [key,value]of Object.entries(waits))assert.equal(value,true,'email '+key);

 await page.locator('[data-task-filter="assistant"]').click();assert.ok(await page.locator('#taskCenter article').count()>0);
 await page.locator('[data-task-filter="all"]').click();await page.locator('#taskCenter .task-owner summary').first().click();await page.locator('#taskCenter [data-task-assign][data-owner=me]').first().click();
 await page.reload();await page.evaluate(()=>showView('tasks'));assert.match(await page.locator('#taskCenter .task-owner summary').first().getAttribute('aria-label'),/Filip/);
 await page.getByText('Vzhled avatarů',{exact:true}).click();await page.locator('#taskInitials-me').fill('FS');await page.locator('#taskColor-me').fill('#167d69');await page.getByRole('button',{name:'Uložit vzhled',exact:true}).click();assert.equal(await page.evaluate(()=>state.settings.taskAvatars.me.color),'#167d69');await page.reload();await page.evaluate(()=>showView('tasks'));assert.ok((await page.locator('.task-avatar').first().getAttribute('style')).includes('#167d69'));
 await page.locator('#taskQuery').fill('nenalezeno');assert.equal(await page.locator('#taskCenter .task-owner').count(),0);await page.locator('#taskQuery').fill('');assert.ok(await page.locator('#taskCenter .task-owner').count()>0);
 await page.screenshot({path:'/tmp/crm-tasks-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'mobile no overflow');await page.screenshot({path:'/tmp/crm-tasks-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#taskCenter [data-wf-action=email]').click();await page.locator('#wfChooseClient').selectOption('1');await page.locator('[data-wf-action=choose-mail-client]').click();
 assert.equal(await page.locator('#wfMailDue').inputValue(),await page.evaluate(()=>CrmWorkflow.plus(CrmWorkflow.day(),3)));
 await page.locator('#wfMailTopic').fill('QA dokumenty');await page.locator('#wfMailBody').fill('Soukromá poznámka <b>bez HTML</b>');await page.locator('[data-wf-action=save-email]').click();
 assert.equal(await page.evaluate(()=>state.activities.find(a=>a.automation?.origin==='email').automation.assignee),'assistant');
 await page.locator('#taskCenter [data-wf-action=queue]').click();await page.screenshot({path:'/tmp/crm-email-waiting.png',fullPage:false});
 await page.locator('[data-wf-action=wait][data-result=answered]').click();assert.equal(await page.evaluate(()=>state.activities.find(a=>a.emailWait).emailWait.status),'answered');
 await page.locator('#workflowModal [data-wf-action=close]').click();
 await page.evaluate(()=>{const row={id:999100,clientId:1,category:'Hypotéka',status:'Kompletace'};state.opportunities.push(row);CrmWorkflow.attach(state,row,false,CrmWorkflow.day(),true);persist();showView('tasks');});
 await page.locator('[data-task-filter=all]').click();const linkedId=await page.evaluate(()=>state.activities.find(a=>a.automation?.flowId===state.opportunities.find(r=>r.id===999100).automation.id&&!a.completed).id);await page.locator(`[data-task-complete="${linkedId}"]`).click();
 assert(await page.evaluate(id=>{const a=state.activities.find(a=>a.id===id),row=state.opportunities.find(r=>r.id===999100),step=row.automation.steps.find(s=>s.id===a.automation.stepId);return a.completed&&step.status==='done'&&step.completion.by===a.completion.by;},linkedId));
 const compact=await page.evaluate(()=>{
  const a={id:999001,type:'Úkol',text:'Kontrola provize QA',date:'2026-11-12',completed:false,taskAssignment:{owner:'assistant'}};state.activities.push(a);
  const days=CrmTasks.overdueDays(a,'2026-11-20'),weekend=CrmTasks.overdueDays({...a,date:'2026-11-13'},'2026-11-16'),future=CrmTasks.overdueDays({...a,date:'2026-12-01'},'2026-11-20');
  CrmTasks.complete(a.id);const saved=state.activities.find(x=>x.id===a.id);CrmTasks.complete(a.id);
  return {days,weekend,future,done:saved.completed,by:saved.completion.by,assigned:saved.completion.assigned,date:saved.completedAt,history:saved.completion.history.length,tag:CrmTasks.taskTag(saved)};
 });assert.equal(compact.days,5);assert.equal(compact.weekend,1);assert.equal(compact.future,0);assert(compact.done&&compact.date);assert.equal(compact.by,'assistant');assert.equal(compact.assigned,'assistant');assert.equal(compact.history,1);assert.equal(compact.tag,'Provize');
 await page.evaluate(()=>{closeModal('workflowModal');showView('tasks');});await page.locator('[data-task-filter=all]').click();await page.locator('#taskPeriod').selectOption('done');assert(await page.locator('.task-check[aria-checked=true]').count());
 await page.locator('#taskPeriod').selectOption('open');await page.locator('[data-task-action=burning]').click();assert.equal(await page.locator('#taskPeriod').inputValue(),'burning');await page.locator('#taskOrdering').selectOption('desc');
 await page.setViewportSize({width:1440,height:1000});await page.locator('#taskPeriod').selectOption('open');await page.locator('#taskCenter').screenshot({path:'/private/tmp/crm-compact-tasks.png'});
 assert.deepEqual(errors,[]);console.log('PASS task center: one ledger, assignment, preference evidence, opt-in rules, exceptions, restore, merge, UI and mobile');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
