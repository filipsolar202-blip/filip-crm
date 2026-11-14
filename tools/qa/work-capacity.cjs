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
  const C=CrmCapacity,W=CrmWorkflow,T=CrmTasks,s=normalizeState({nextId:100,clients:[{id:1,name:'Testovací klient'}],opportunities:[],deals:[],activities:[]});
  const row={id:10,clientId:1,category:'Hypotéka',product:'Testovací hypotéka',status:'Opportunity'};s.opportunities.push(row);W.attach(s,row);
  const step=row.automation.steps.find(x=>x.key==='prepare'),a=s.activities[0];Object.assign(step.spec,{solo:60,assistant:75,residual:10,delegate:'yes'});a.calendarLink={eventId:'keep-event'};a.date='2026-11-16';a.time='13:00';
  const before=JSON.stringify(s),entries=C.entries(s),t=C.total(entries),r={readOnly:before===JSON.stringify(s),oneLedger:entries.filter(x=>x.a===a).length===1,openOnly:t.me===60&&t.saving===50&&t.candidateAssistant===75&&t.assistant===0&&t.actualCount===0,futureSeparate:t.future>0};
  T.assign(s,a,'assistant');let after=C.total(C.entries(s));r.assigned=after.me===10&&after.assistant===75&&after.saving===0;r.calendarUntouched=a.date==='2026-11-16'&&a.time==='13:00'&&a.calendarLink.eventId==='keep-event'&&s.activities.length===1;
  a.completed=true;a.outcome='realized';a.automation.status='done';C.reconcile(s);after=C.total(C.entries(s));r.doneNotPotential=after.me===0&&after.assistant===0&&after.saving===0&&after.doneEstimate===60&&after.actualCount===0;
  step.spec.solo=900;step.spec.assistant=900;r.frozen=C.entries(s).find(x=>x.a===a).estimate.solo===60;
  a.duration=0;a.work={timeKind:'actual'};after=C.total(C.entries(s));r.actualZero=after.actualCount===1&&after.actual===0;
  a.duration=20;after=C.total(C.entries(s));r.actualSeparate=after.actual===20&&after.doneEstimate===60;
  a.work.timeKind='unknown';r.noFalseActual=C.total(C.entries(s)).actualCount===0;
  a.completed=false;a.completedAt='';a.automation.status='open';C.reconcile(s);r.reopenHistory=!a.capacitySnapshot&&a.capacityEstimateHistory[0].solo===60;
  T.assign(s,a,'me');C.setEstimate(s,a,{solo:40,assistant:45,residual:5,delegate:'yes'});after=C.total(C.entries(s));r.override=after.me===40&&after.saving===35&&after.candidateAssistant===45;
  try{C.setEstimate(s,a,{solo:'',assistant:45,residual:5,delegate:'yes'});r.invalid=false;}catch{r.invalid=true;}
  row.automation.paused=true;r.paused=C.total(C.entries(s)).saving===0;row.automation.paused=false;
  a.automation.status='cancelled';a.completed=true;a.outcome='agreed';after=C.total(C.entries(s));r.cancelled=after.doneEstimate===0&&after.saving===0;a.automation.status='open';a.completed=false;
  const expert={id:200,syncId:'expert',clientId:1,sourceOpportunityId:10,type:'Úkol',text:'Odborné posouzení',date:'2026-11-16',recordKind:'activity',completed:false,documentCheck:{id:row.documentChecklist.id,kind:'expert'},automation:{status:'open',assignee:'me'}};s.activities.push(expert);
  try{C.setEstimate(s,expert,{solo:30,assistant:30,residual:5,delegate:'yes'});r.expertGuard=false;}catch{r.expertGuard=true;}
  const mail={id:201,syncId:'mail-follow',clientId:1,sourceOpportunityId:10,type:'Úkol',text:'Kontrola odpovědi',recordKind:'activity',completed:false,automation:{origin:'email',status:'open',assignee:'assistant'}};s.activities.push(mail);
  const manual={id:202,syncId:'manual',clientId:1,type:'Telefon',text:'Ruční hovor bez vazby',recordKind:'activity',completed:false,duration:90};s.activities.push(manual);const m=C.entries(s).find(x=>x.a===manual);r.noClientGuess=!m.src&&m.estimate.solo===10&&m.estimate.delegate==='unknown';
  r.includesExtra=C.entries(s).find(x=>x.a===expert).estimate.delegate==='no'&&C.entries(s).find(x=>x.a===mail).estimate.assistant===10;
  const linkedBefore=C.entries(s).filter(x=>x.src?.row===row).length;const deal={...structuredClone(row),id:50};s.deals.push(deal);r.transferDedup=C.entries(s).filter(x=>x.src?.row===deal).length===linkedBefore&&C.entries(s).filter(x=>x.a===a).length===1;s.deals=[];
  const transferCopy=normalizeState(JSON.parse(JSON.stringify(s))),source=transferCopy.opportunities[0],dest={id:55,clientId:1,category:'Hypotéka'};transferCopy.deals.push(dest);W.transfer(transferCopy,source,dest);transferCopy.opportunities=[];r.manualTransfer=C.entries(transferCopy).find(x=>x.a?.syncId==='mail-follow').src?.row===dest;
  const restored=normalizeState(JSON.parse(JSON.stringify(s)));r.restore=restored.activities[0].workEstimate.solo===40&&C.total(C.entries(restored)).saving===35;
  const history={id:333,syncId:'measured-history',type:'Telefon',recordKind:'history',completed:true,outcome:'no_show',duration:6,work:{timeKind:'actual'}};restored.activities.push(history);r.explicitHistoricalTime=C.total(C.entries(restored)).actual===6;
  const counts=criticalBackupCounts(restored);r.backupProtection=counts.workEstimates===1&&counts.capacitySnapshots===1;
  state=s;persist();showView('tasks');return r;
 });
 for(const [k,v]of Object.entries(result))assert.equal(v,true,k);
 await page.getByRole('button',{name:'Čas a delegování',exact:true}).click();assert.equal(await page.locator('#capacityModal').isVisible(),true);
 await page.locator('#capacityModal [data-capacity-action=assign]').first().click();assert.match(await page.locator('#capacityModal').innerText(),/Žádné další otevřené úkoly/);
 assert.equal(await page.evaluate(()=>state.activities[0].automation.assignee),'assistant');assert.equal(await page.evaluate(()=>state.activities[0].calendarLink.eventId),'keep-event');
 await page.locator('#capacityModal summary').click();await page.locator('#capacityModal [data-capacity-action=estimate]').first().click();await page.locator('#capacitySolo').fill('50');await page.locator('#capacityAssistant').fill('55');await page.locator('#capacityResidual').fill('8');await page.locator('[data-capacity-action=save]').click();assert.equal(await page.evaluate(()=>state.activities[0].workEstimate.solo),50);
 await page.screenshot({path:'/tmp/crm-capacity-desktop.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#capacityModal .box').evaluate(x=>x.scrollWidth<=x.clientWidth+1),true,'mobile dialog overflow');await page.screenshot({path:'/tmp/crm-capacity-mobile.png',fullPage:false});
 await page.reload();await page.evaluate(()=>showView('tasks'));await page.getByRole('button',{name:'Čas a delegování',exact:true}).click();assert.equal(await page.evaluate(()=>state.activities[0].workEstimate.solo),50);
 await page.evaluate(()=>{const snapshot=structuredClone(state),n=state.activities.length;mergeIncomingState(snapshot);persist();if(state.activities.length!==n)throw Error('Merge duplicated activities');if(state.activities[0].workEstimate.solo!==50)throw Error('Merge lost custom estimate');});
 assert.deepEqual(errors,[]);console.log('PASS capacity: estimates vs actual/zero/unknown, open vs completed/future/paused, delegation costs, stable task/calendar IDs, snapshot/reopen, expertise guard, transfer dedup, persistence/merge and responsive UI.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
