const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),fixture=require('./fixture.cjs');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
  await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));if(u.hostname==='crm.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return route.abort();});
  await context.addInitScript(data=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(data));},fixture);
  const page=await context.newPage(),errors=[],alerts=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
  await page.clock.install({time:new Date('2026-10-22T10:00:00+02:00')});
  await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof renderDailyPriorities==='function');
  assert.equal(await page.locator('#dailyPrioritiesList .focus-row').count(),3);
  assert.equal(await page.locator('#weeklyGoalsGrid .focus-row').count(),3);
  assert.equal(await page.locator('#dashboardStats').getAttribute('open'),null);
  assert.equal(await page.locator('#dashboardTasks').getAttribute('open'),null);
  assert.equal(await page.locator('#bjChart').isVisible(),true);
  assert.ok(await page.locator('#dashTasks').innerHTML());
  assert.notEqual(await page.locator('#kpiYearBj').textContent(),'0');
  // Both weekly editor tabs retain unfinished input across reload.
  await page.evaluate(()=>openWeeklyGoalModal(1));await page.locator('#wgTitle').fill('Dopsat postup');
  await page.locator('#weeklyGoalTabs button').nth(1).click();await page.locator('#wgTitle').fill('Investiční příležitosti');
  await page.evaluate(()=>focusFlushDraft());await page.reload();
  await page.evaluate(()=>openWeeklyGoalModal(1));assert.equal(await page.locator('#wgTitle').inputValue(),'Dopsat postup');
  await page.locator('#weeklyGoalModal').getByText('Uložit cíl',{exact:true}).click();
  assert.equal(await page.evaluate(()=>weeklyGoalForSlot(1).target),null);
  await page.locator('#weeklyGoalModal').getByText('Zavřít',{exact:true}).click();
  await page.locator('#weeklyGoalsGrid').getByText('Hotovo',{exact:true}).click();
  assert.equal(await page.evaluate(()=>weeklyGoalForSlot(1).status),'Splněno');
  await page.evaluate(()=>openWeeklyGoalModal(2));assert.equal(await page.locator('#wgTitle').inputValue(),'Investiční příležitosti');
  await page.locator('#wgMetricType').selectOption('investment_volume');await page.locator('#wgTarget').fill('500000');await page.locator('#weeklyGoalModal').getByText('Uložit cíl',{exact:true}).click();
  await page.evaluate(()=>{closeModal('weeklyGoalModal');state.deals.push({id:uid(),clientId:1,category:'Investice',product:'Týdenní investice',date:'2026-10-22',amount:100000,bj:80});persist();openWeeklyGoalModal(3);});
  await page.locator('#wgTitle').fill('Podpisy');await page.locator('#wgMetricType').selectOption('bj');await page.locator('#wgTarget').fill('800');await page.locator('#weeklyGoalModal').getByText('Uložit cíl',{exact:true}).click();
  await page.evaluate(()=>closeModal('weeklyGoalModal'));
  assert.deepEqual(await page.evaluate(()=>[weeklyGoalActual(weeklyGoalForSlot(2)),weeklyGoalActual(weeklyGoalForSlot(3))]),[100000,80]);
  // Daily draft and optional fields, linked task, reorder and completion.
  await page.evaluate(()=>openDailyPriority(1));await page.locator('#fpTitle').fill('Kontrola pěti provizí');await page.locator('#fpTarget').fill('5');await page.locator('#fpUnit').fill('kontrol');await page.evaluate(()=>focusFlushDraft());await page.reload();
  await page.evaluate(()=>openDailyPriority(1));assert.equal(await page.locator('#fpTitle').inputValue(),'Kontrola pěti provizí');
  await page.locator('#fpClient').selectOption('1');await page.locator('#fpGoal').selectOption({label:'Podpisy'});await page.locator('#dailyPriorityModal').getByText('Uložit prioritu',{exact:true}).click();
  await page.evaluate(()=>openDailyPriority(2));await page.locator('#fpActivity').selectOption('40');await page.locator('#dailyPriorityModal').getByText('Uložit prioritu',{exact:true}).click();
  assert.equal(await page.evaluate(()=>state.activities.length),1);
  await page.getByRole('button',{name:'Posunout prioritu 2 výše',exact:true}).click();
  await page.getByRole('button',{name:'Dokončit prioritu 1',exact:true}).click();
  assert.equal(await page.evaluate(()=>state.activities.find(x=>x.id===40).completed),true);
  await page.reload();assert.equal(await page.evaluate(()=>focusPriorityStatus(focusPriorityFor(1))),'Hotovo');
  await page.evaluate(()=>openDailyPriority(3));await page.locator('#fpTitle').fill('Připravit podklady');await page.locator('#dailyPriorityModal').getByText('Uložit prioritu',{exact:true}).click();
  // Review draft survives reload; no phantom AUM change from a single observation.
  await page.locator('#closeWeeklyGoalsBtn').click();await page.locator('#wrSuccess').fill('Pomohlo soustředění');await page.locator('#wrDifferent').fill('Ráno začnu podpisy');await page.locator('#wrCommission').selectOption({label:'Nesrovnalosti k řešení'});await page.evaluate(()=>focusFlushDraft());await page.reload();await page.locator('#closeWeeklyGoalsBtn').click();
  assert.equal(await page.locator('#wrDifferent').inputValue(),'Ráno začnu podpisy');assert.match(await page.locator('#weeklyReviewBusiness').innerText(),/chybí dva uložené stavy/);
  await page.evaluate(()=>closeModal('weeklyReviewModal'));
  // Monday starts empty and unclosed previous week remains available.
  await page.clock.setSystemTime(new Date('2026-10-26T10:00:00+01:00'));await page.reload();
  assert.equal(await page.evaluate(()=>state.dailyPriorities.filter(x=>x.date===dashboardToday()).length),0);
  assert.equal(await page.evaluate(()=>weeklyGoalsFor().length),0);
  assert.equal(await page.evaluate(()=>focusUnfinishedItems().length),4);
  await page.locator('#weeklyGoalsWeekSelect').selectOption('2026-W43');await page.locator('#closeWeeklyGoalsBtn').click();
  assert.equal(await page.locator('#wrSuccess').inputValue(),'Pomohlo soustředění');await page.locator('#weeklyReviewModal').getByText('Uzavřít a archivovat týden',{exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>{const r=weeklyReviewFor('2026-W43');return [r.completed,r.business.bjPlan,r.business.bj,r.business.investment,r.commissionCheck];}),[1,800,80,100000,'Nesrovnalosti k řešení']);
  // Explicit actions only. A repeat cannot duplicate tasks or priorities.
  await page.evaluate(()=>{const p=state.dailyPriorities.find(x=>x.title==='Kontrola pěti provizí');resolveFocusItem('day',p.id,'task');resolveFocusItem('day',p.id,'task');});
  assert.equal(await page.evaluate(()=>state.activities.length),2);
  await page.evaluate(()=>{const p=state.dailyPriorities.find(x=>x.title==='Připravit podklady');resolveFocusItem('day',p.id,'continue');resolveFocusItem('day',p.id,'continue');});
  assert.equal(await page.evaluate(()=>state.dailyPriorities.filter(x=>x.date===dashboardToday()).length),1);
  await page.evaluate(()=>{const g=weeklyGoalForSlot(3,'2026-W43');resolveFocusItem('week',g.id,'continue');});
  assert.equal(await page.evaluate(()=>weeklyGoalForSlot(1,'2026-W44').target),720);
  await page.evaluate(()=>resolveFocusItem('week',weeklyGoalForSlot(2,'2026-W43').id,'cancelled'));
  assert.equal(await page.evaluate(()=>focusUnfinishedItems().length),0);
  assert.equal(await page.evaluate(()=>weeklyReviewFor('2026-W43').business.bj),80);
  // Annual goals reuse existing plan and persist.
  await page.evaluate(()=>showView('plan'));await page.locator('#planAum').fill('19000000');await page.evaluate(()=>focusFlushDraft());await page.reload();await page.evaluate(()=>showView('plan'));assert.equal(await page.locator('#planAum').inputValue(),'19000000');await page.locator('#planTotalBj').fill('8000');await page.locator('#planAum').fill('20000000');await page.getByText('Uložit plán',{exact:true}).click();
  await page.reload();await page.evaluate(()=>showView('plan'));assert.equal(await page.locator('#planAum').inputValue(),'20000000');
  // All required report sections are offered, pensions never leak into investments.
  await page.evaluate(()=>{
   state.contracts.push({id:901,clientId:1,type:'DIP',company:'Test penzijní fond',product:'DIP test',number:'DIP-01',amount:'4000',status:'vyrizeno',fromDealId:902});
   state.deals.push({id:902,clientId:1,category:'Penze',product:'DIP test',company:'Test penzijní fond',contractId:901,contractNumber:'DIP-01',amount:4000,date:'2026-10-01'});
   state.contracts.push({id:903,clientId:2,type:'DPS',company:'Cizí fond',product:'NEEXPORTOVAT',number:'SECRET-TEST',amount:'9999',status:'vyrizeno'});
   openFkClientReportModal(1);
  });
  assert.equal(await page.locator('.report-section-check[value=pensions]').count(),1);
  assert.equal(await page.locator('.report-section-check').count(),8);
  await page.locator('.report-section-check[value=investments]').uncheck();await page.locator('.report-section-check[value=fki]').uncheck();
  const report=await page.evaluate(()=>{const opts={};document.querySelectorAll('.report-section-check').forEach(x=>opts[x.value]=x.checked);const html=clientOutput_xReportHtml(findClient(1),opts,'Poznámka');return new DOMParser().parseFromString(html,'text/html').body.textContent;});
  assert.match(report,/DPS \/ DIP/);assert.match(report,/DIP-01/);assert.equal((report.match(/DIP-01/g)||[]).length,1);assert.doesNotMatch(report,/NEEXPORTOVAT|Test klasický fond|Test FKI fond/);assert.match(report,/Aktuální hodnota účtu/);assert.doesNotMatch(report,/Platba evidovaná u smlouvy/);
  const noPension=await page.evaluate(()=>new DOMParser().parseFromString(clientOutput_xReportHtml(findClient(1),{investments:false,summary:false,pensions:false,insurance:false,loans:false,open:false,notice:true}),'text/html').body.textContent);
  assert.doesNotMatch(noPension,/DIP-01|DPS \/ DIP/);
  const downloadEvent=page.waitForEvent('download');await page.locator('#clientReportModal').getByText(/Stáhnout/).click();const download=await downloadEvent;const downloaded=fs.readFileSync(await download.path(),'utf8');assert.match(downloaded,/DIP-01/);assert.doesNotMatch(downloaded,/NEEXPORTOVAT/);
  // Backup round-trip, merge id remapping and preserving local values.
  const backup=await page.evaluate(()=>googleSyncPayload().state);assert.ok(backup.dailyPriorities.length);assert.ok(backup.weeklyReviews.length);assert.ok(backup.focusSnapshots.length);assert.equal(backup.plans['2026'].totalBj,8000);
  await page.evaluate(data=>{state=normalizeState({...def(),nextId:10000,clients:[],contracts:[],activities:[],deals:[]});mergeIncomingState(data);persist();},backup);
  assert.equal(await page.evaluate(()=>state.dailyPriorities.length),backup.dailyPriorities.length);
  assert.equal(await page.evaluate(()=>state.weeklyGoals.length),backup.weeklyGoals.length);
  assert.equal(await page.evaluate(()=>{const p=state.dailyPriorities.find(x=>x.activityId);return focusActivity(p)?.text;}),'Test hovor');
  await page.evaluate(()=>{closeModal('clientReportModal');showView('dashboard');});
  // Reapplying a Google backup preserves a local draft even if the remote lacks it.
  await page.evaluate(()=>{
    const saved=JSON.parse(JSON.stringify(state));state.focusDrafts.push({id:'day:2026-10-26:3',values:{fpTitle:'Rozpracovaný místní text',fpClient:String(state.clients[0].id)},updatedAt:new Date().toISOString()});
    restoreIncomingStateFromGoogle(saved,'qa');
  });
  assert.equal(await page.evaluate(()=>state.focusDrafts.find(x=>x.id==='day:2026-10-26:3').values.fpTitle),'Rozpracovaný místní text');
  // The new week uses local Monday even before UTC midnight; no carry is triggered.
  await page.clock.setSystemTime(new Date('2026-11-02T00:30:00+01:00'));await page.evaluate(()=>renderDashboard());
  assert.equal(await page.evaluate(()=>weekKey()),'2026-W45');assert.equal(await page.locator('#dailyFocusDate').inputValue(),'2026-11-02');
  // Missing historical AUM remains unavailable, rather than a fabricated zero.
  assert.equal(await page.evaluate(()=>weeklyGoalActual({metricType:'aum',weekKey:'2025-W01',target:100},'2025-W01')),null);
  await page.clock.setSystemTime(new Date('2026-10-26T10:00:00+01:00'));await page.evaluate(()=>renderDashboard());

  await page.locator('#dashboard').screenshot({path:'/private/tmp/crm-focus-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/private/tmp/crm-focus-mobile.png',fullPage:true});
  assert.ok(await page.locator('.focus-score').first().evaluate(el=>el.getBoundingClientRect().width>150));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  assert.deepEqual(errors,[]);assert.deepEqual(alerts,[]);
  console.log('PASS: compact dashboard; weekly/daily/review drafts; linked task completion; reorder; day/week rollover; explicit carry/cancel/task; review snapshot; annual goals; report selectors, pension dedupe and client isolation; backup/merge; mobile width.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
