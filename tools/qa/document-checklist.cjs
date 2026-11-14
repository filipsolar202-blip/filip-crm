// Isolated synthetic records; no live browser profile, mail or Google requests.
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
  const D=CrmDocuments,W=CrmWorkflow,s=normalizeState({nextId:100,clients:[{id:1,name:'Testovací klient'}],opportunities:[],deals:[],activities:[]}),r={};
  const row={id:10,clientId:1,category:'Hypotéka',status:'Opportunity'};s.opportunities.push(row);D.reconcile(s);r.noBackfill=!row.documentChecklist&&s.activities.length===0;
  const c=D.init(s,row),n=c.items.length;D.reconcile(s);r.noInitialTasks=s.activities.length===0&&n===4;
  try{D.change(s,row,c.items[0].id,'checked');r.noPremature=false;}catch{r.noPremature=true;}
  D.change(s,row,c.items[0].id,'requested','2026-11-14');D.reconcile(s);let admin=s.activities.find(a=>a.syncId===c.adminSyncId);admin.calendarLink={eventId:'stable'};
  r.assistant=admin.automation.assignee==='assistant'&&admin.date==='2026-11-17';
  D.change(s,row,c.items[1].id,'requested','2026-11-15');D.reconcile(s);r.dedup=s.activities.length===1&&admin.date==='2026-11-17';
  CrmTasks.assign(s,admin,'me');D.reconcile(s);r.manual=admin.automation.assignee==='me';
  admin.date='2026-11-20';D.reconcile(s);r.move=c.due===admin.date&&admin.calendarLink.eventId==='stable';
  for(const i of c.items)D.change(s,row,i.id,'received');D.reconcile(s);r.receivedOnly=!c.expertSyncId&&!admin.completed;
  for(const i of c.items)D.change(s,row,i.id,'checked');D.reconcile(s);const expert=s.activities.find(a=>a.syncId===c.expertSyncId);r.ready=admin.completed&&expert.automation.assignee==='me'&&s.activities.length===2;
  try{CrmTasks.assign(s,expert,'assistant');r.expertGuard=false;}catch{r.expertGuard=true;}
  expert.completed=true;expert.automation.status='done';D.change(s,row,c.items[0].id,'missing');D.reconcile(s);r.reopen=!expert.completed&&expert.automation.status==='paused'&&!admin.completed;
  D.change(s,row,c.items[0].id,'received');D.change(s,row,c.items[0].id,'checked');D.reconcile(s);r.sameIds=s.activities.length===2&&expert.automation.status==='open';
  row.status='Zrušeno';D.reconcile(s);r.closed=expert.automation.status==='cancelled';row.status='Opportunity';D.reconcile(s);r.reopened=expert.automation.status==='open';
  s.activities=s.activities.filter(a=>a!==expert);D.reconcile(s);r.deletedNotRebuilt=s.activities.length===1;
  // Adopt one unambiguous existing workflow task, retaining calendar and manual owner.
  const old={id:20,clientId:1,category:'Život',status:'Opportunity'};s.opportunities.push(old);W.attach(s,old);delete old.documentChecklist;W.emit(s,old,'documents','2026-11-14');const st=old.automation.steps.find(x=>x.key==='documents'),existing=s.activities.find(a=>a.syncId===st.activitySyncId);existing.calendarLink={eventId:'old-event'};CrmTasks.assign(s,existing,'me');
  const oc=D.init(s,old);D.change(s,old,oc.items[0].id,'requested');const before=s.activities.length;D.reconcile(s);r.adopt=oc.adminSyncId===existing.syncId&&s.activities.length===before&&existing.calendarLink.eventId==='old-event'&&existing.automation.assignee==='me';
  W.reconcile(s);D.reconcile(s);r.planLink=st.activitySyncId===existing.syncId&&st.spec.assignee==='me';
  old.automation.paused=true;W.reconcile(s);D.reconcile(s);r.pause=existing.automation.status==='paused';old.automation.paused=false;W.reconcile(s);D.reconcile(s);r.resume=existing.automation.status==='open';
  const ambiguous={id:30,clientId:1,category:'Investice',status:'Opportunity'};s.opportunities.push(ambiguous);const ac=D.init(s,ambiguous);for(const id of ['a','b'])s.activities.push({id:s.nextId++,syncId:id,clientId:1,sourceOpportunityId:30,text:'Zkontrolovat doručení podkladů',completed:false});D.change(s,ambiguous,ac.items[0].id,'requested');const count=s.activities.length;D.reconcile(s);r.ambiguous=!!ac.warning&&!ac.adminSyncId&&s.activities.length===count;
  const snapshot=normalizeState(JSON.parse(JSON.stringify(s)));D.reconcile(snapshot);r.restore=snapshot.activities.length===count&&snapshot.opportunities[0].documentChecklist.items[0].status==='checked';
  const merged=normalizeState({clients:[{id:1,name:'QA'}],opportunities:[{id:77}],deals:[],activities:[]});D.merge(merged,s,{opportunities:new Map([['10',77]]),deals:new Map()});r.merge=merged.opportunities[0].documentChecklist.id===c.id;
  const deal={id:50,clientId:1,category:'Život'};s.deals.push(deal);W.transfer(s,old,deal);s.opportunities=s.opportunities.filter(x=>x!==old);D.merge(s,{opportunities:[],deals:[]},{opportunities:new Map(),deals:new Map()});D.reconcile(s);r.transfer=deal.documentChecklist.id===oc.id&&existing.sourceOpportunityId===null&&existing.calendarLink.eventId==='old-event';
  // New plan: requesting all documents must produce one ledger entry, not the old generic duplicate.
  const fresh={id:60,clientId:1,category:'Hypotéka',status:'Opportunity'};s.opportunities.push(fresh);W.attach(s,fresh);const baseline=s.activities.length;W.emit(s,fresh,'documents','2026-11-14');W.reconcile(s);D.reconcile(s);W.emit(s,fresh,'documents','2026-11-14');W.reconcile(s);D.reconcile(s);r.planDedup=s.activities.length===baseline+1&&fresh.automation.steps.find(x=>x.key==='documents').activitySyncId===fresh.documentChecklist.adminSyncId;
  // UI fixture with an actual linked library record, no personal data.
  state=normalizeState({nextId:100,clients:[{id:1,name:'Testovací klient',documents:[{id:'doc1',title:'Podklad k příjmům'},{id:'doc2',title:'Opravený podklad'}]}],opportunities:[{id:10,clientId:1,category:'Hypotéka',product:'Testovací hypotéka',status:'Opportunity'}],deals:[],activities:[]});persist();openCaseDetail(10);return r;
 });
 for(const [k,v]of Object.entries(result))assert.equal(v,true,k);
 await page.locator('[data-doc-enable]').click();assert.equal(await page.locator('#documentChecklist .doc-items article').count(),4);
 await page.locator('[data-doc-action=requested]').first().click();assert.equal(await page.evaluate(()=>state.activities.filter(a=>a.documentCheck).length),1);
 await page.locator('[data-doc-action=received]').first().click();await page.locator('[data-doc-action=checked]').first().click();
 await page.locator('[data-doc-link]').first().selectOption('doc1');assert.equal(await page.evaluate(()=>state.opportunities[0].documentChecklist.items[0].status),'received','relinked file needs recheck');
 await page.locator('[data-doc-action=checked]').first().click();
 await page.locator('[aria-label="Další potřebný podklad"]').fill('Doplnit potvrzení banky');await page.locator('[data-doc-action=add]').click();assert.equal(await page.locator('#documentChecklist .doc-items article').count(),5);
 await page.locator('[data-doc-date]').fill('2026-11-23');assert.equal(await page.evaluate(()=>state.activities.find(a=>a.documentCheck?.kind==='admin').date),'2026-11-23');
 await page.evaluate(()=>{const snap=structuredClone(state),before=state.activities.length;mergeIncomingState(snap);persist();if(state.activities.length!==before)throw Error('Restore duplicated activities');const counts=criticalBackupCounts(state);if(counts.documentChecklistItems!==5||counts.documentChecklists!==1)throw Error('Checklist backup protection absent');});
 await page.evaluate(()=>showView('tasks'));await page.locator('[data-task-filter=assistant]').click();await page.locator('#taskCenter [data-doc-open]').first().click();
 await page.locator('#documentChecklistModal [data-doc-action=received]').first().click();assert.equal(await page.locator('#documentChecklistModal [data-doc-action=checked]').count(),1,'dialog refreshed after status change');
 await page.locator('[data-doc-close]').click();await page.evaluate(()=>openCaseDetail(10));
 await page.locator('#documentChecklist').screenshot({path:'/tmp/crm-document-checklist-desktop.png'});
 await page.reload();await page.evaluate(()=>openCaseDetail(10));assert.equal(await page.locator('#documentChecklist .doc-items article').count(),5);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'mobile overflow');await page.locator('#documentChecklist').screenshot({path:'/tmp/crm-document-checklist-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS document checklist: status boundaries, task reuse, delegation, dependencies, deletion, reopen, pause, merge, transfer, persistence and UI.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
