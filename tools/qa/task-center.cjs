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
 await page.locator('[data-task-filter="assistant"]').click();assert.ok(await page.locator('#taskCenter article').count()>0);
 await page.locator('[data-task-filter="all"]').click();const dropdown=page.locator('#taskCenter [data-task-owner]').first();await dropdown.selectOption('me');
 await page.reload();await page.locator('[data-view="tasks"]').click();assert.equal(await page.locator('#taskCenter [data-task-owner]').first().inputValue(),'me');
 await page.screenshot({path:'/tmp/crm-tasks-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'mobile no overflow');await page.screenshot({path:'/tmp/crm-tasks-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS task center: one ledger, assignment, preference evidence, opt-in rules, exceptions, restore, merge, UI and mobile');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
