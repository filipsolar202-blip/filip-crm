const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),fixture=require('./fixture.cjs');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
  await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));if(u.hostname==='crm.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return route.abort();});
  const dashboardFixture=structuredClone(fixture);dashboardFixture.plans['2025']={...dashboardFixture.plans['2026']};
  await context.addInitScript(data=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(data));},dashboardFixture);
  const page=await context.newPage(),errors=[],alerts=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
  await page.clock.install({time:new Date('2026-10-22T10:00:00+02:00')});
  await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof renderDailyPriorities==='function');
  // Main sections have one stable DOM order. Their visual order must agree even after rerenders.
  const dashboardOrder=['daily','weekly','charts','stats','tasks'];
  const dashboardIds=['dashboardDailyPriorities','dashboardWeeklyGoals','dashboardCharts','dashboardStats','dashboardTasks'];
  async function assertDashboardOrder(stage){
    const layout=await page.evaluate(()=>{
      const root=document.getElementById('dashboardLayout'),blocks=[...root.children];
      if(!window.__qaDashboardBlocks)window.__qaDashboardBlocks=blocks;
      return {
        order:blocks.map(el=>el.dataset.dashboardSection),ids:blocks.map(el=>el.id),
        sameNodes:blocks.every((el,index)=>el===window.__qaDashboardBlocks[index]),
        boxes:blocks.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}),
        quickLinksInsideDaily:document.querySelector('.focus-links').closest('[data-dashboard-section]')?.id,
        pendingInsideTasks:document.getElementById('focusUnfinished').closest('[data-dashboard-section]')?.id,
        charts:[...document.querySelectorAll('#bjChart,#investmentChart')].map(el=>el.closest('[data-dashboard-section]')?.id),
        tasksWidth:document.getElementById('dashboardTasks').getBoundingClientRect().width,
        taskChildrenWidths:[...document.querySelectorAll('#dashboardTasks>.card')].map(el=>el.getBoundingClientRect().width),
        statsLabel:document.querySelector('#dashboardStats>summary').textContent.trim()
      };
    });
    assert.deepEqual(layout.order,dashboardOrder,stage+' DOM order');assert.deepEqual(layout.ids,dashboardIds,stage+' unique main sections');
    assert.equal(layout.sameNodes,true,stage+' rendering retains stable section elements');
    assert.ok(layout.boxes.every(b=>b.height>0&&b.width>0),stage+' all five sections remain visible');
    layout.boxes.slice(1).forEach((b,index)=>assert.ok(b.top>=layout.boxes[index].bottom-1,stage+' visual order: '+layout.boxes[index].id+' before '+b.id));
    assert.equal(layout.quickLinksInsideDaily,'dashboardDailyPriorities');assert.equal(layout.pendingInsideTasks,'dashboardTasks');
    assert.deepEqual(layout.charts,['dashboardCharts','dashboardCharts']);assert.equal(layout.statsLabel,'Statistiky, grafy a kontrola dat');
    assert.equal(layout.taskChildrenWidths.length,2);assert.ok(layout.taskChildrenWidths.every(width=>Math.abs(width-layout.tasksWidth)<=1),stage+' task cards fill their wrapper without implicit columns');
  }
  await assertDashboardOrder('Initial dashboard');
  assert.equal(await page.locator('#dailyPrioritiesList .focus-row').count(),3);
  assert.equal(await page.locator('#weeklyGoalsGrid .focus-row').count(),3);
  assert.equal(await page.locator('#dashboardStats').getAttribute('open'),null);
  assert.equal(await page.locator('#dashboardTasks').getAttribute('open'),null);
  assert.equal(await page.locator('#bjChart').isVisible(),true);
  assert.ok(await page.locator('#dashTasks').innerHTML());
  assert.notEqual(await page.locator('#kpiYearBj').textContent(),'0');
  await page.evaluate(()=>renderDashboard());await assertDashboardOrder('renderDashboard');
  await page.evaluate(()=>renderAll());await assertDashboardOrder('renderAll');
  for(const selector of ['#dailyPrioritiesList .focus-row','#weeklyGoalsGrid .focus-row']){
    const boxes=await page.locator(selector).evaluateAll(es=>es.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,left:r.left};}));
    assert.equal(boxes.length,3);assert.equal(boxes[0].top,boxes[1].top);assert.equal(boxes[1].top,boxes[2].top);assert.ok(boxes[0].left<boxes[1].left&&boxes[1].left<boxes[2].left);
  }
  await page.locator('.focus-links').getByRole('button',{name:'Statistiky a grafy',exact:true}).click();
  assert.equal(await page.locator('#dashboardStats').evaluate(el=>el.open),true);await assertDashboardOrder('Expanded statistics');
  for(const id of ['dashDealTypeFilter','dashLeadSourceFilter']){
    const value=await page.locator('#'+id+' option').evaluateAll(options=>options.find(option=>option.value)?.value);
    assert.ok(value,id+' provides a meaningful filter');await page.locator('#'+id).selectOption(value);await assertDashboardOrder(id+' filtered');
  }
  await page.getByRole('button',{name:'Vymazat filtry',exact:true}).click();await assertDashboardOrder('Cleared statistics filters');
  await page.locator('#chartYear').selectOption('2025');await assertDashboardOrder('Chart year filter');await page.locator('#chartYear').selectOption('2026');
  await page.locator('#dashboardStats>summary').click();await assertDashboardOrder('Collapsed statistics');
  await page.locator('.focus-links').getByRole('button',{name:'Běžné úkoly',exact:true}).click();await assertDashboardOrder('Task quick link');
  await page.locator('#dashTaskType').selectOption('Telefon');await page.locator('#dashTaskPeriod').selectOption('all');await page.locator('#dashTaskSort').selectOption('desc');await assertDashboardOrder('Task filters');
  await page.locator('#dashTaskType').selectOption('');await page.locator('#dashTaskPeriod').selectOption('today');await page.locator('#dashTaskSort').selectOption('asc');
  await page.locator('.focus-links').getByRole('button',{name:'Roční cíle',exact:true}).click();assert.equal(await page.locator('#plan').isVisible(),true);
  await page.locator('.tab[data-view=dashboard]').click();await assertDashboardOrder('Annual goals and return');
  await page.locator('.tab[data-view=clients]').click();await page.locator('.tab[data-view=dashboard]').click();await assertDashboardOrder('Client navigation and return');
  await page.locator('.focus-links').getByRole('button',{name:'Historie a vyhodnocení',exact:true}).click();await assertDashboardOrder('Weekly history expanded');
  await page.reload();await assertDashboardOrder('Reload');
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
  const report=await page.evaluate(()=>{const opts={};document.querySelectorAll('.report-section-check').forEach(x=>opts[x.value]=x.checked);const html=clientOutput_xReportHtml(findClient(1),opts,'Poznámka'),doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script').forEach(el=>el.remove());return {text:doc.body.textContent,dipCount:doc.querySelectorAll('.pension-card[data-report-item="pension-contract-901"]').length,dip:doc.querySelector('.pension-card[data-report-item="pension-contract-901"]')?.textContent};});
  assert.match(report.text,/DPS \/ DIP/);assert.equal(report.dipCount,1);assert.match(report.dip,/DIP test/);assert.match(report.dip,/Aktuální hodnota\s*4\s*000 Kč/);assert.doesNotMatch(report.text,/DIP-01|SECRET-TEST|NEEXPORTOVAT|Test klasický fond|Test FKI fond/);assert.doesNotMatch(report.text,/Platba evidovaná u smlouvy/);
  const noPension=await page.evaluate(()=>new DOMParser().parseFromString(clientOutput_xReportHtml(findClient(1),{investments:false,summary:false,pensions:false,insurance:false,loans:false,open:false,notice:true}),'text/html').body.textContent);
  assert.doesNotMatch(noPension,/DIP-01|DPS \/ DIP/);
  const downloadEvent=page.waitForEvent('download');await page.locator('#clientReportModal').getByText(/Stáhnout/).click();const download=await downloadEvent;const downloaded=fs.readFileSync(await download.path(),'utf8');assert.match(downloaded,/DIP test/);assert.match(downloaded,/data-report-item="pension-contract-901"/);assert.doesNotMatch(downloaded,/DIP-01|SECRET-TEST|NEEXPORTOVAT/);
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
  await assertDashboardOrder('Populated dashboard after goal edits, rollover and restore');
  await page.clock.runFor(4000);
  await page.locator('#dashboard').screenshot({path:'/private/tmp/crm-focus-desktop.png'});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/private/tmp/crm-focus-mobile.png',fullPage:true});
  await assertDashboardOrder('Mobile');
  await page.locator('#dashboardStats>summary').click();await assertDashboardOrder('Mobile expanded statistics');
  await page.evaluate(()=>{renderDashboard();renderAll();});await assertDashboardOrder('Mobile rerender with statistics expanded');
  await page.locator('#dashboardStats>summary').click();
  await page.reload();await page.evaluate(()=>showView('dashboard'));await assertDashboardOrder('Mobile reload');
  assert.ok(await page.locator('.focus-score').first().evaluate(el=>el.getBoundingClientRect().width>150));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  assert.deepEqual(errors,[]);assert.deepEqual(alerts,[]);
  console.log('PASS: fixed daily→weekly→charts→statistics→tasks DOM/visual order across render, filters, quick links, navigation, expansion, reload and mobile; compact dashboard; weekly/daily/review drafts; linked task completion; reorder; day/week rollover; explicit carry/cancel/task; review snapshot; annual goals; report selectors, pension dedupe and client isolation; backup/merge; mobile width.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
