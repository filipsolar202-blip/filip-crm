// Synthetic, isolated CRM only. Never use a live profile or real client records.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..'),STORE='filip_crm_main_v1';
const fixture=structuredClone(require('./fixture.cjs'));
fixture.deals[0].isin='TEST00000001';fixture.deals[0].fundIsin='TEST00000001';fixture.deals[0].fundKey='test-classic';
fixture.investmentSnapshots=[{id:80,clientId:1,company:'Test invest',product:'Test klasický fond',isin:'TEST00000001',mergeKey:'test-classic',date:'2026-10-01',invested:100000,current:120000,gainAmount:20000,gainPct:20,purchaseDate:'2026-01-10',source:'QA původní ocenění'}];
fixture.externalInvestments=[{id:81,clientId:1,company:'QA jiný správce',product:'QA mimo správu',current:450000,invested:400000,monthly:2000,expectedRate:4,managed:false}];
fixture.opportunities.push({id:31,clientId:2,category:'FKI',company:'QA FKI správce',product:'QA FKI Alfa',isin:'QAPROP000001',fundIsin:'QAPROP000001',amount:99000,status:'Kompletace',statusDate:'2026-10-10',note:'Jiný klient – zachovat'});
fixture.deals.push({id:22,clientId:2,category:'Investice',company:'QA jiný správce',product:'QA Beta původní fond',date:'2026-01-10',amount:40000,bj:0});
const funds=[
 {key:'qa-proposal-fki-a',area:'fki',company:'QA FKI správce',fond:'QA FKI Alfa',isin:'QAPROP000001'},
 {key:'qa-proposal-fki-b',area:'fki',company:'QA FKI správce',fond:'QA FKI Beta',isin:'QAPROP000002'},
 {key:'qa-proposal-classic',area:'investice',company:'Test invest',fond:'QA klasický druhý fond',isin:'QAPROP000003'},
 {key:'qa-alternative-fki',area:'fki',company:'QA alternativa',fond:'QA nevybraná FKI alternativa',isin:'QAPROP000004'},
 {key:'qa-alternative-classic',area:'investice',company:'QA alternativa',fond:'QA nevybraná klasická alternativa',isin:'QAPROP000005'}
];
for(const f of funds){const {key,...data}=f;fixture.fundValues[key]={...data,typ:f.area==='fki'?'Investiční akcie':'Podílový list',expectedRate:5,entryCommissionPct:1,trailPct:.4};}
const selected=[
 {isin:'QAPROP000001',amount:200000,monthly:0},
 {isin:'QAPROP000002',amount:300000,monthly:0},
 {isin:'TEST00000001',amount:75000,monthly:1500},
 {isin:'QAPROP000003',amount:125000,monthly:0}
],selectedTotal=selected.reduce((n,r)=>n+r.amount,0);

(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Prague'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='crm.test'){const p=path.join(root,decodeURIComponent(u.pathname));if(fs.existsSync(p)&&fs.statSync(p).isFile())return route.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html'});}return route.abort();});
  await context.addInitScript(({fixture,STORE})=>{if(location.hostname==='crm.test'&&!localStorage.getItem(STORE))localStorage.setItem(STORE,JSON.stringify(fixture));},{fixture,STORE});
  const page=await context.newPage(),errors=[],dialogs=[],checks=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
  await page.goto('https://crm.test/FILIP-CRM.html');
  await page.evaluate(()=>{renderAll();persist();});
  const snapshot=()=>page.evaluate(()=>JSON.parse(JSON.stringify({
   deals:state.deals,contracts:state.contracts,records:state.investmentRecords,snapshots:state.investmentSnapshots,
   opportunities:state.opportunities,external:state.externalInvestments,
   aum:clientInvestmentSummary(1).total,otherAum:clientInvestmentSummary(2).total
  })));
  const baseline=await snapshot();
  assert.equal(baseline.aum,320000,'fixture includes an existing classic valuation and FKI holding');
  assert.equal(baseline.otherAum,40000);
  const openSaved=async id=>{
   await page.evaluate(id=>openSavedInvestmentForecast(id),id);
   await page.waitForFunction(()=>byId('investmentScenarioModal').classList.contains('show')&&val('scenarioForecastName')==='QA vybraná varianta'&&investmentScenario.variants?.length===2);
   // Modal initialization and saved-data restoration use zero-delay callbacks.
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  };
  const save=async mode=>{await page.locator(mode==='forecast'?'#scenarioSaveForecastBtn':'#scenarioSaveBtn').click();};

  await page.evaluate(()=>openInvestmentScenarioModal(1,'FKI'));
  await page.waitForFunction(()=>investmentScenario.variants?.length===1);
  const setup=await page.evaluate(selected=>{
   const make=(isin,amount,monthly=0)=>{
    const fund=scenario_catalog().find(f=>f.isin===isin);if(!fund)throw Error('Missing QA catalog fund '+isin);
    return {...fund,amount,monthly,rate:5,funding:'new'};
   };
   setVal('scenarioForecastName','QA vybraná varianta');setVal('scenarioYears','8');
   investmentScenario.rows=[make('QAPROP000004',110000),make('QAPROP000005',35000)];
   scenario_renameVariant('QA alternativa A');scenario_syncActiveVariant();
   scenario_addVariant();scenario_renameVariant('QA vybraná B');
   investmentScenario.rows=selected.map(r=>make(r.isin,r.amount,r.monthly));
   renderInvestmentScenario();scenario_syncActiveVariant();
   return {active:investmentScenario.activeVariantId,variants:investmentScenario.variants.map(v=>({id:v.id,name:v.name})),positions:scenario_currentPositions().map(p=>p.product)};
  },selected);
  assert(setup.positions.includes('QA mimo správu'));assert(setup.positions.includes('Test klasický fond'));
  await page.locator('#miniToast').waitFor({state:'hidden'});
  await page.screenshot({path:'/private/tmp/crm-investment-proposal-editor.png'});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#scenarioSaveForecastBtn').scrollIntoViewIfNeeded();
  const mobile=await page.evaluate(()=>{
   const modal=byId('investmentScenarioModal'),box=modal.querySelector('.modal-box'),footer=byId('scenarioSaveBtn').parentElement,
    bounds=box.getBoundingClientRect(),buttons=[...footer.querySelectorAll('button')].map(el=>({text:el.textContent,rect:el.getBoundingClientRect().toJSON()}));
   const overflow=[...box.querySelectorAll('*')].filter(el=>!el.closest('.table-wrap')&&el.getBoundingClientRect().right>bounds.right+1).slice(0,12).map(el=>({tag:el.tagName,id:el.id,class:el.className,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width}));
   return {viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,modalWidth:modal.clientWidth,modalScroll:modal.scrollWidth,boxWidth:box.clientWidth,boxScroll:box.scrollWidth,bounds:bounds.toJSON(),buttons,overflow};
  });
  assert(mobile.documentWidth<=mobile.viewport+1,'mobile document does not overflow horizontally');
  assert(mobile.modalScroll<=mobile.modalWidth+1,'mobile modal does not overflow horizontally');
  await page.screenshot({path:'/private/tmp/crm-investment-proposal-mobile.png'});
  assert(mobile.buttons.some(b=>b.text==='Uložit prognózu'));assert(mobile.buttons.some(b=>b.text==='Založit obchodní případy'));
  for(const button of mobile.buttons){assert(button.rect.left>=mobile.bounds.left-1&&button.rect.right<=mobile.bounds.right+1,'footer button fits mobile editor: '+button.text);assert(button.rect.height>=30,'footer button remains tappable');}
  await page.screenshot({path:'/private/tmp/crm-investment-proposal-mobile.png'});
  await page.setViewportSize({width:1440,height:1000});
  checks.push('Distinct forecast/proposal buttons remain readable and within the 390px mobile editor');
  await save('forecast');
  const saved=await page.evaluate(()=>JSON.parse(JSON.stringify(state.investmentForecasts.at(-1))));
  assert.equal(saved.variants.length,2);assert.equal(saved.externalRows.length,1);
  assert.deepEqual(await snapshot(),baseline,'forecast-only must not create cases/deals or change any portfolio');
  checks.push('Forecast-only stores both variants without cases, trades, AUM or portfolio mutations');
  await page.reload();await openSaved(saved.id);
  const restored=await page.evaluate(()=>({active:investmentScenario.activeVariantId,rows:investmentScenario.rows.map(r=>r.isin),mode:val('scenarioSaveMode')}));
  assert.equal(String(restored.active),String(setup.active),'reopen restores the selected alternative');
  assert.deepEqual(restored.rows,selected.map(r=>r.isin));assert.equal(restored.mode,'forecast');

  // Fail the real browser persistence boundary, not the business function itself.
  const failedBefore=await page.evaluate(STORE=>({stored:localStorage.getItem(STORE),forecasts:state.investmentForecasts.length,rows:JSON.stringify(investmentScenario.rows),name:val('scenarioForecastName')}),STORE);
  await page.evaluate(STORE=>{window.__qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===STORE)throw new DOMException('QA storage failure','QuotaExceededError');return window.__qaSetItem.call(this,key,value);};},STORE);
  await save('proposal');
  const failed=await page.evaluate(STORE=>({open:byId('investmentScenarioModal').classList.contains('show'),stored:localStorage.getItem(STORE),rows:JSON.stringify(investmentScenario.rows),name:val('scenarioForecastName'),forecasts:state.investmentForecasts.length}),STORE);
  assert(failed.open,'failed save must leave the scenario form available');
  assert.equal(failed.stored,failedBefore.stored,'failed save must not alter persisted data');
  assert.equal(failed.rows,failedBefore.rows,'failed save must retain the entered rows');assert.equal(failed.name,failedBefore.name);
  assert.deepEqual(await snapshot(),baseline,'failed proposal persistence rolls back business records and portfolio');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__qaSetItem;delete window.__qaSetItem;});
  checks.push('Persistence failure retains the form, rows and previously saved data; retry remains available');

  await save('proposal');
  let cases=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.filter(o=>o.clientId===1&&['FKI','Investice'].includes(o.category)))));
  assert.equal(cases.length,4,'one case per fund, not one per provider and not both alternatives');
  assert.deepEqual(cases.map(o=>o.isin||o.fundIsin).sort(),selected.map(r=>r.isin).sort());
  for(const r of selected){const o=cases.find(o=>(o.isin||o.fundIsin)===r.isin);assert.equal(o.amount,r.amount);assert.equal(o.status,'Nabídka');}
  const proposed=await snapshot();
  for(const key of ['deals','contracts','records','snapshots','external','aum','otherAum'])assert.deepEqual(proposed[key],baseline[key],'proposal must not change '+key);
  assert.deepEqual(proposed.opportunities.find(o=>o.id===31),baseline.opportunities.find(o=>o.id===31),'other client case is untouched');
  assert.equal(await page.evaluate(()=>state.investmentForecasts.length),1,'conversion updates the same saved forecast');
  checks.push('Explicit conversion creates four independent selected-variant cases; other alternative, clients and existing/external assets excluded');

  await page.evaluate(()=>openInvestmentScenarioModal(1,'FKI'));
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
  assert.equal(await page.evaluate(()=>investmentScenario.rows.length),0,'new forecast must not silently import existing open cases');
  await page.evaluate(()=>closeModal('investmentScenarioModal'));

  const advanced=cases[0];
  await page.evaluate(id=>updateOpportunityStatus(id,'Schvalování'),advanced.id);
  const advancedBefore=await page.evaluate(id=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.id===id))),advanced.id);
  await openSaved(saved.id);await save('proposal');
  const repeated=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.filter(o=>o.clientId===1&&['FKI','Investice'].includes(o.category)))));
  assert.deepEqual(repeated.map(o=>o.id).sort(),cases.map(o=>o.id).sort(),'repeat conversion reuses the same four cases');
  const advancedAfter=repeated.find(o=>o.id===advanced.id);
  assert.equal(advancedAfter.status,'Schvalování');assert.equal(advancedAfter.statusDate,advancedBefore.statusDate);
  assert.deepEqual(advancedAfter.history,advancedBefore.history,'unchanged conversion does not fabricate a new case-stage history');
  await page.reload();await openSaved(saved.id);await save('proposal');
  assert.equal(await page.evaluate(()=>state.opportunities.filter(o=>o.clientId===1&&['FKI','Investice'].includes(o.category)).length),4);
  checks.push('Repeated conversion and reload preserve case IDs, advanced stages and history without duplicates');
  await page.evaluate(()=>openClientWorkspace(1,'opportunities'));
  await page.screenshot({path:'/private/tmp/crm-investment-proposal-cases.png',fullPage:true});

  let signedTotal=0;
  for(const o of cases){
   const r=selected.find(r=>r.isin===(o.isin||o.fundIsin));
   await page.evaluate(id=>updateOpportunityStatus(id,'Podepsáno'),o.id);
   assert(await page.locator('#dealModal').isVisible());
   assert.equal(await page.locator('#dFundIsin').inputValue(),r.isin,'signing retains the selected fund identity');
   await page.locator('#dDate').fill('2026-10-27');
   await page.locator('#dContractNumber').fill('QA-PROPOSAL-'+o.id);
   await page.evaluate(()=>saveDeal());
   signedTotal+=r.amount;
   const result=await page.evaluate(id=>({trades:state.deals.filter(d=>String(d.fromOpportunityId)===String(id)).map(d=>({id:d.id,amount:d.amount,isin:d.isin||d.fundIsin,category:d.category})),aum:clientInvestmentSummary(1).total,otherAum:clientInvestmentSummary(2).total}),o.id);
   assert.equal(result.trades.length,1,'closure creates exactly one trade');assert.equal(result.trades[0].amount,r.amount);assert.equal(result.trades[0].isin,r.isin);
   assert.equal(result.aum,baseline.aum+signedTotal,'AUM adds the purchased principal once, keeping previous valuations');assert.equal(result.otherAum,baseline.otherAum);
   // Reopening and saving the already closed case must edit its existing trade.
   await page.evaluate(o=>openDealFromOpportunity({...o,status:'Podepsáno'}),o);
   await page.evaluate(()=>saveDeal());
   assert.equal(await page.evaluate(()=>clientInvestmentSummary(1).total),baseline.aum+signedTotal,'repeat closure does not add capital twice');
   assert.equal(await page.evaluate(id=>state.deals.filter(d=>String(d.fromOpportunityId)===String(id)).length,o.id),1);
  }
  const final=await snapshot();
  assert.equal(final.aum,baseline.aum+selectedTotal);
  assert.deepEqual(final.external,baseline.external);
  for(const before of baseline.deals)assert.deepEqual(final.deals.find(d=>d.id===before.id),before,'original deals stay intact');
  for(const before of baseline.snapshots)assert.deepEqual(final.snapshots.find(s=>s.id===before.id),before,'historical valuations stay intact');
  for(const before of baseline.records){assert(final.records.some(r=>JSON.stringify(r)===JSON.stringify(before)),'original FKI source records stay intact');}
  const holdings=await page.evaluate(()=>clientDisplayInvestmentItems(1).map(x=>({product:x.product,company:x.company,isin:x.isin,amount:x.amount,invested:investmentInvestedAmount(x)})));
  for(const r of selected){const matches=holdings.filter(h=>h.isin===r.isin);assert.equal(matches.length,1,'one holding per exact fund '+r.isin);assert.equal(matches[0].amount,r.amount+(r.isin==='TEST00000001'?120000:0));}
  checks.push('Closing FKI and classic cases creates separate holdings once; top-up preserves existing valuation and history');

  await page.reload();await openSaved(saved.id);await save('proposal');
  assert.equal(await page.evaluate(()=>state.opportunities.filter(o=>o.clientId===1&&['FKI','Investice'].includes(o.category)).length),0,'already signed rows must not reopen as fresh cases');
  assert.equal(await page.evaluate(()=>clientInvestmentSummary(1).total),baseline.aum+selectedTotal);
  assert.equal(await page.evaluate(()=>state.deals.length),baseline.deals.length+4);
  assert.equal(await page.evaluate(()=>state.investmentForecasts.length),1);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.id===31)))),baseline.opportunities.find(o=>o.id===31));
  checks.push('Saved forecast remains idempotent after signing, storage round-trip and another conversion');

  // Each distinct edge case starts from the same synthetic state, never from user data.
  const reset=async(data=fixture)=>{await page.evaluate(({data,STORE})=>localStorage.setItem(STORE,JSON.stringify(data)),{data,STORE});await page.reload();await page.evaluate(()=>{renderAll();persist();});};
  const openNew=async(clientId=1,area='Investice')=>{await page.evaluate(({clientId,area})=>openInvestmentScenarioModal(clientId,area),{clientId,area});};
  const setRows=async(rows,name)=>page.evaluate(({rows,name})=>{
   investmentScenario.rows=rows.map(r=>{const fund=scenario_catalog().find(f=>f.isin===r.isin);if(!fund)throw Error('Missing QA fund '+r.isin);return {...fund,amount:r.amount||0,monthly:r.monthly||0,rate:5,funding:'new'};});
   setVal('scenarioForecastName',name);renderInvestmentScenario();scenario_syncActiveVariant();
  },{rows,name});
  const closeCase=async(o,number)=>{
   await page.evaluate(id=>updateOpportunityStatus(id,'Podepsáno'),o.id);
   await page.locator('#dDate').fill('2026-10-27');await page.locator('#dContractNumber').fill(number);
   await page.evaluate(()=>saveDeal());
  };

  await reset();await openNew();
  const monthlyKey=await page.evaluate(()=>scenario_catalog().find(f=>f.isin==='QAPROP000003').key);
  await page.locator('#scenarioFund').selectOption(monthlyKey);
  await page.locator('#scenarioAmount').fill('0');await page.locator('#scenarioMonthly').fill('2500');
  await page.locator('#investmentScenarioModal button[onclick="addInvestmentScenarioFund()"]').click();
  assert.equal(await page.evaluate(()=>investmentScenario.rows.length),1,'monthly-only fund can be added through the visible form');
  await save('proposal');
  const monthlyCase=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.clientId===1&&o.isin==='QAPROP000003'))));
  assert(monthlyCase);assert.equal(monthlyCase.amount,0);assert.equal(monthlyCase.regularAmount,2500);assert.equal(monthlyCase.investmentSchedule,'regular');
  await closeCase(monthlyCase,'QA-MONTHLY');
  const monthlyResult=await page.evaluate(id=>({deal:state.deals.find(d=>String(d.fromOpportunityId)===String(id)),aum:clientInvestmentSummary(1).total,items:clientDisplayInvestmentItems(1).filter(x=>x.isin==='QAPROP000003')}),monthlyCase.id);
  assert.equal(monthlyResult.deal.amount,0);assert.equal(monthlyResult.deal.regularAmount,2500);assert.equal(monthlyResult.deal.investmentSchedule,'regular');
  assert.equal(monthlyResult.aum,baseline.aum,'future monthly contributions are not already invested capital');
  assert(monthlyResult.items.every(x=>(+x.amount||0)===0),'monthly plan cannot create an up-front holding value');
  checks.push('Monthly-only classic investment can be entered, proposed and closed without counting future payments as AUM');

  await reset();const transferBaseline=await snapshot();await openNew();
  await page.evaluate(()=>{
   const source=scenario_currentPositions().find(p=>p.isin==='TEST00000001'),target=scenario_catalog().find(f=>f.isin==='QAPROP000002');
   if(!source||!target)throw Error('Transfer fixture missing');
   investmentScenario.rows=[];investmentScenario.dispositions={[source.positionId]:{action:'transfer',amount:50000,targetKey:target.key}};
   setVal('scenarioForecastName','QA pouze plánovaný přesun');renderInvestmentScenario();scenario_syncActiveVariant();
  });
  await save('forecast');
  const transferId=await page.evaluate(()=>state.investmentForecasts[0].id);
  await page.reload();await page.evaluate(id=>openSavedInvestmentForecast(id,'proposal'),transferId);await save('proposal');
  const transferCase=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.clientId===1&&o.isin==='QAPROP000002'))));
  assert(transferCase);assert.equal(transferCase.amount,50000);
  const transferAfter=await snapshot();
  for(const key of ['deals','contracts','records','snapshots','external','aum','otherAum'])assert.deepEqual(transferAfter[key],transferBaseline[key],'planned transfer does not execute a sale or alter '+key);
  await page.evaluate(id=>updateOpportunityStatus(id,'Zrušeno'),transferCase.id);
  const cancelled=await page.evaluate(id=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.id===id))),transferCase.id);
  await page.reload();await page.evaluate(id=>openSavedInvestmentForecast(id,'proposal'),transferId);await save('proposal');
  assert.deepEqual(await page.evaluate(id=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.id===id))),transferCase.id),cancelled,'cancelled linked case stays cancelled and unchanged');
  assert.equal(await page.evaluate(()=>state.opportunities.filter(o=>o.clientId===1&&o.isin==='QAPROP000002').length),1,'transfer identity survives reload without new cases');
  checks.push('Transfer-only variant creates one target case without selling assets; cancelled linked case remains cancelled after reconversion');

  await reset();await openNew();await setRows([{isin:'QAPROP000001',amount:21000},{isin:'QAPROP000003',amount:14000}],'QA přímé sjednání');
  await page.locator('#scenarioSaveMode').selectOption('signed');await page.locator('#scenarioSignedDate').fill('2026-10-27');await save('proposal');
  const direct=await page.evaluate(()=>({id:state.investmentForecasts[0].id,syncId:state.investmentForecasts[0].syncId,projectionCurrent:state.investmentForecasts[0].projection.current,baselineCurrent:state.investmentForecasts[0].baselineProjection.current,managedCurrent:state.investmentForecasts[0].managedRows.reduce((n,r)=>n+(+r.current||0),0),rows:state.deals.filter(d=>d.source==='investmentScenario').map(d=>({id:d.id,isin:d.isin,amount:d.amount})),aum:clientInvestmentSummary(1).total,opps:state.opportunities.length}));
  assert.equal(direct.rows.length,2);assert.equal(direct.aum,baseline.aum+35000);assert.equal(direct.opps,baseline.opportunities.length);
  assert.equal(direct.projectionCurrent,baseline.aum+450000,'archived direct-signed forecast keeps its pre-signature portfolio baseline');
  assert.equal(direct.baselineCurrent,baseline.aum+450000);assert.equal(direct.managedCurrent,baseline.aum);
  await page.reload();await page.evaluate(id=>openSavedInvestmentForecast(id),direct.id);
  await page.locator('#scenarioSaveMode').selectOption('signed');await save('proposal');
  assert.deepEqual(await page.evaluate(()=>state.deals.filter(d=>d.source==='investmentScenario').map(d=>({id:d.id,isin:d.isin,amount:d.amount}))),direct.rows);
  assert.equal(await page.evaluate(()=>clientInvestmentSummary(1).total),direct.aum);
  assert.deepEqual(await page.evaluate(()=>({current:state.investmentForecasts[0].projection.current,baseline:state.investmentForecasts[0].baselineProjection.current})),{current:direct.projectionCurrent,baseline:direct.baselineCurrent});
  checks.push('Direct signed save creates only the selected purchases and remains idempotent after reload');

  await page.evaluate(id=>openSavedInvestmentForecast(id),direct.id);
  const originalForecast=await page.evaluate(id=>JSON.parse(JSON.stringify(state.investmentForecasts.find(f=>f.id===id))),direct.id);
  await page.locator('#scenarioClient').selectOption('2');
  const switched=await page.evaluate(()=>({client:val('scenarioClient'),forecastId:investmentScenario.forecastId||'',syncId:investmentScenario.syncId||'',rows:investmentScenario.rows,managedOverride:investmentScenario.managedRowsOverride||null,external:investmentScenario.externalRows,positions:scenario_currentPositions().map(p=>p.product)}));
  assert.equal(switched.client,'2');assert.equal(switched.forecastId,'');assert.notEqual(switched.syncId,direct.syncId);assert.deepEqual(switched.rows,[]);
  assert.equal(switched.managedOverride,null);assert.deepEqual(switched.external,[]);assert(!switched.positions.includes('Test klasický fond'));assert(switched.positions.includes('QA Beta původní fond'));
  await setRows([{isin:'QAPROP000003',amount:9000}],'QA pouze klient Beta');await save('proposal');
  const switchedResult=await page.evaluate(id=>({original:state.investmentForecasts.find(f=>f.id===id),other:state.investmentForecasts.find(f=>f.clientId===2),cases:state.opportunities.filter(o=>o.clientId===2&&o.isin==='QAPROP000003'),aum1:clientInvestmentSummary(1).total,aum2:clientInvestmentSummary(2).total}),direct.id);
  assert.deepEqual(switchedResult.original,originalForecast);assert(switchedResult.other);assert.notEqual(switchedResult.other.id,direct.id);assert.notEqual(switchedResult.other.syncId,direct.syncId);
  assert.equal(switchedResult.cases.length,1);assert.equal(switchedResult.cases[0].sourceForecastSyncId,switchedResult.other.syncId);
  assert.equal(switchedResult.aum1,direct.aum);assert.equal(switchedResult.aum2,baseline.otherAum);
  checks.push('Changing client clears saved forecast ownership, source links and old portfolio; save creates an independent client proposal');

  const raw=structuredClone(fixture);
  raw.deals=[];raw.opportunities=[];raw.investmentRecords=[];raw.investmentSnapshots=[];raw.externalInvestments=[];
  raw.contracts=[
   {id:60,clientId:1,type:'investice',company:'Test invest',product:'Test klasický fond',isin:'TEST00000001',number:'QA-RAW-A',amount:'40000',status:'vyrizeno'},
   {id:61,clientId:1,type:'investice',company:'QA alternativa',product:'QA nevybraná klasická alternativa',isin:'QAPROP000005',number:'QA-RAW-B',amount:'60000',status:'vyrizeno'}
  ];
  await reset(raw);const rawBefore=await snapshot();assert.equal(rawBefore.aum,100000);
  await openNew();await setRows([{isin:'QAPROP000003',amount:10000}],'QA nový fond ke smlouvám');await save('proposal');
  const rawNew=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities[0])));await closeCase(rawNew,'QA-RAW-C');
  assert.equal(await page.evaluate(()=>clientInvestmentSummary(1).total),110000,'a new deal does not hide unrelated raw-contract holdings');
  await openNew();await setRows([{isin:'TEST00000001',amount:15000}],'QA dokup ke smlouvě');await save('proposal');
  const rawTopup=await page.evaluate(()=>JSON.parse(JSON.stringify(state.opportunities.find(o=>o.isin==='TEST00000001'))));await closeCase(rawTopup,'QA-RAW-TOPUP');
  const rawFinal=await page.evaluate(()=>({aum:clientInvestmentSummary(1).total,items:clientDisplayInvestmentItems(1).map(x=>({isin:x.isin,amount:x.amount})),contracts:state.contracts.filter(s=>[60,61].includes(s.id))}));
  assert.equal(rawFinal.aum,125000);assert.deepEqual(rawFinal.contracts,rawBefore.contracts);
  for(const [isin,amount] of [['TEST00000001',55000],['QAPROP000005',60000],['QAPROP000003',10000]])assert.equal(rawFinal.items.filter(x=>x.isin===isin).reduce((sum,x)=>sum+x.amount,0),amount,'raw-contract portfolio retains '+isin);
  checks.push('New deals and top-ups preserve unrelated raw-contract holdings and their original records');
  assert(mobile.boxScroll<=mobile.boxWidth+1,'mobile editor does not overflow horizontally: '+JSON.stringify(mobile));
  assert.deepEqual(errors,[],'no browser JavaScript errors');
  assert(dialogs.some(text=>/uložit|ulož|save/i.test(text)),'storage failure was surfaced');
  console.log('PASS investment-proposal: '+checks.join('; '));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
