// Settlement regression: synthetic data and an isolated browser, never a live CRM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
const FKI='QASETTLE0001',CLASSIC='QASETTLE0002',NEWFKI='QASETTLE0003',NEWCLASSIC='QASETTLE0004';
const buy=(clientId,amount=100000,dates=true)=>({ClientID:String(clientId),Investor:`QA vypořádání ${clientId}`,'RČ':clientId===1?'9001010007':'9001020006',
 Fond:'QA FKI stávající','rp.ISIN':FKI,'Investiční společnost':'QA správce','Typ produktu':'FKI','Typ transakce':'Platba',
 'Čistá investice':amount,'Aktuální hodnota investice':amount*1.2,'Počet vydaných CP':amount/100,'Upisovací hodnota':100,
 'Datum připsání platby':dates?'2025-01-10':'','Datum emise':dates?'2025-01-15':'','Poslední schválená hodnota CP':120,
 'Poslední schválená hodnota do':'2026-09-30',fkiValuationMode:'nav',_source:'local-fki'});
const fixture={nextId:1000,clients:[{id:1,name:'QA vypořádání 1',birthId:'9001010007'},{id:2,name:'QA vypořádání 2',birthId:'9001020006'}],
 investmentRecords:[buy(1),buy(2,50000)],investmentSnapshots:[{id:50,clientId:1,company:'QA správce',product:'QA klasická stávající',isin:CLASSIC,
 date:'2026-09-30',purchaseDate:'2025-01-10',current:75000,invested:60000,investedBeforeRedemption:60000,manualAumOverride:true,calculationVersion:2}],
 contracts:[],deals:[],opportunities:[],activities:[],providerImports:[],
 fundValues:Object.fromEntries([[FKI,'fki','QA FKI stávající'],[CLASSIC,'investice','QA klasická stávající'],[NEWFKI,'fki','QA FKI nová'],[NEWCLASSIC,'investice','QA klasická nová']]
  .map(([isin,area,fond])=>[(area==='fki'?'isin|':'investment-isin|')+isin.toLowerCase(),{area,company:'QA správce',fond,isin,nav:120,date:'2026-09-30',expectedRate:5}]))};
const near=(a,b,label)=>assert(Math.abs(a-b)<.01,`${label}: ${a} != ${b}`);
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname));
  if(u.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});return route.abort();});
 await context.addInitScript(seed=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));},fixture);
 const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.accept();});
 await page.goto('https://crm.test/FILIP-CRM.html');
 const reset=async(seed=fixture)=>page.evaluate(seed=>{state=normalizeState(seed);renderAll();persist();},seed);
 const reload=async()=>{await page.reload();await page.evaluate(()=>renderAll());};
 const read=()=>page.evaluate(()=>({aum:clientInvestmentSummary(1).total,otherAum:clientInvestmentSummary(2).total,
  pending:investmentPendingRows(1).map(r=>({id:r.id,kind:r.kind,isin:r.isin,area:r.area,amount:r.amount,purchaseDate:r.purchaseDate,emissionDate:r.emissionDate,tradeDate:r.tradeDate})),
  globalPending:investmentPendingRows().reduce((n,r)=>n+r.amount,0),
  report:clientOutput_xClientInvestments(findClient(1)).map(r=>({isin:r.isin,amount:r.amount})),reportPending:clientOutput_xPendingInvestments(findClient(1)).map(r=>({isin:r.isin,amount:r.amount})),
  records:state.investmentRecords.length,snapshots:state.investmentSnapshots.length,deals:state.deals.length,bj:state.deals.reduce((n,d)=>n+(+d.bj||0),0)}));
 const check=async(active,pending,label,other=60000)=>{const s=await read();near(s.aum,active,label+' client AUM');near(s.otherAum,other,label+' other client AUM');
  near(s.pending.reduce((n,r)=>n+r.amount,0),pending,label+' pending principal');near(s.globalPending,pending,label+' global pending');
  near(s.report.reduce((n,r)=>n+(+r.amount||0),0),active,label+' report active AUM');
  near(s.reportPending.reduce((n,r)=>n+(+r.amount||0),0),pending,label+' report pending principal');
  return s;};
 const openFki=async(isin,amount)=>page.evaluate(({isin,amount})=>{const r=investmentRecordsForClient(1).find(r=>invIsin(r)===isin&&invDeposit(r)===amount);if(!r)throw Error('Missing QA FKI position');openFkRecordModal(1,encodeURIComponent(invPositionKey(r)),encodeURIComponent(invRecordKey(r)));},{isin,amount});
 const saveFkiDates=async(isin,amount,purchase,emission)=>{await openFki(isin,amount);await page.locator('#fkRecPaymentDate').fill(purchase);await page.locator('#fkRecEmissionDate').fill(emission);await page.evaluate(()=>saveFkRecord());await reload();};
 const rowDates=amount=>page.evaluate(amount=>{const r=investmentRecordsForClient(1).find(r=>invDeposit(r)===amount);return {payment:r['Datum připsání platby'],emission:r['Datum emise'],pending:investmentRecordIsPending(r)};},amount);

 // A fund quote, manually entered value or a trade date is not proof of settlement.
 const raw=structuredClone(fixture);raw.investmentRecords.push(buy(1,25000,false));await reset(raw);
 await check(195000,25000,'undated raw FKI with valid quantity/NAV');
 await openFki(FKI,25000);assert.equal(await page.locator('#fkRecPaymentDate').inputValue(),'');assert.equal(await page.locator('#fkRecEmissionDate').inputValue(),'');await page.evaluate(()=>saveFkRecord());await reload();
 assert.deepEqual(await rowDates(25000),{payment:'',emission:'',pending:true},'saving/reloading must not silently insert today or the trade date');await check(195000,25000,'unchanged empty dates');
 await saveFkiDates(FKI,25000,'2026-10-29','');await check(195000,25000,'payment date alone is not an issued FKI position');
 await saveFkiDates(FKI,25000,'','2026-10-29');await check(195000,25000,'emission date alone is not a funded FKI position');
 await openFki(FKI,25000);await page.locator('#fkRecPaymentDate').fill('2026-10-28');const beforeFailed=await page.evaluate(()=>({records:JSON.stringify(state.investmentRecords),stored:localStorage.getItem('filip_crm_main_v1')}));await page.evaluate(()=>{window.__qaPersist=persist;persist=()=>false;saveFkRecord();});assert(await page.locator('#fkRecordModal').isVisible(),'failed settlement persistence leaves the entered form open');assert.equal(await page.locator('#fkRecPaymentDate').inputValue(),'2026-10-28');assert.deepEqual(await page.evaluate(()=>({records:JSON.stringify(state.investmentRecords),stored:localStorage.getItem('filip_crm_main_v1')})),beforeFailed,'failed confirmation must not settle an unsaved purchase');await page.evaluate(()=>{persist=window.__qaPersist;delete window.__qaPersist;closeModal('fkRecordModal');});
 await saveFkiDates(FKI,25000,'2026-10-28','2026-10-29');let confirmed=await check(225000,0,'FKI confirmed by both actual dates');
 await saveFkiDates(FKI,25000,'2026-10-28','2026-10-29');let repeated=await check(225000,0,'repeated FKI confirmation');assert.equal(repeated.records,confirmed.records);assert.equal(repeated.deals,confirmed.deals);assert.equal(repeated.bj,confirmed.bj);
 await saveFkiDates(FKI,25000,'2026-10-28','');await check(195000,25000,'clearing emission returns the same FKI principal to pending');
 await page.evaluate(isin=>openFkFundModal(encodeURIComponent('isin|'+isin.toLowerCase())),FKI);await page.locator('#fkFundNav').fill('130');await page.locator('#fkFundDate').fill('2026-10-29');await page.evaluate(()=>saveFkFund());await reload();await check(205000,25000,'a new shared NAV updates only the settled FKI quantity',65000);
 assert.equal((await rowDates(25000)).emission,'','NAV update must not fabricate settlement');

 await reset();await page.evaluate(isin=>openFkRecordModal(1,encodeURIComponent('isin|'+isin.toLowerCase())),NEWFKI);await page.locator('#fkRecDeposit').fill('20000');await page.locator('#fkRecPaymentDate').fill('');await page.locator('#fkRecEmissionDate').fill('');await page.evaluate(()=>saveFkRecord());await reload();await check(195000,20000,'new FKI record can be saved with genuinely unknown dates');assert.deepEqual(await rowDates(20000),{payment:'',emission:'',pending:true});

 const aliases=structuredClone(fixture);delete aliases.investmentRecords[0]['Datum připsání platby'];delete aliases.investmentRecords[0]['Datum emise'];Object.assign(aliases.investmentRecords[0],{paymentDate:'2025-01-10',purchaseDate:'2025-01-10',emissionDate:'2025-01-15'});await reset(aliases);await check(195000,0,'legacy date aliases before edit');await saveFkiDates(FKI,100000,'','');await check(75000,100000,'cleared canonical dates cannot reactivate through legacy aliases');await openFki(FKI,100000);assert.equal(await page.locator('#fkRecPaymentDate').inputValue(),'');assert.equal(await page.locator('#fkRecEmissionDate').inputValue(),'');await page.evaluate(()=>closeModal('fkRecordModal'));

 // The same rule applies to a trade entered directly, without a forecast/case link.
 await reset();await page.evaluate(isin=>{openInvestmentDealModal(1,'FKI');setVal('dCompany','QA správce');setVal('dProduct','QA FKI nová');setVal('dFundIsin',isin);setVal('dFundKey','isin|'+isin.toLowerCase());setVal('dAmount','40000');setVal('dBj','12');setVal('dDate','2026-10-29');setVal('dCreateContract','no');},NEWFKI);await page.evaluate(()=>saveDeal());await reload();let manual=await check(195000,40000,'direct signed FKI is pending until separately confirmed');assert.equal(manual.deals,1);assert.equal(manual.bj,12);assert.equal(await page.evaluate(()=>state.deals[0].date),'2026-10-29');

 // Signing records production immediately, while purchase/emission remain unknown.
 // Three separate cases include an existing classic fund: its previous manual
 // valuation must stay intact while the new top-up is still waiting.
 const proposed=structuredClone(fixture),planned=[{id:30,category:'FKI',isin:NEWFKI,amount:40000,bj:12,product:'QA FKI nová'},
  {id:31,category:'Investice',isin:NEWCLASSIC,amount:30000,bj:13,product:'QA klasická nová'},
  {id:32,category:'Investice',isin:CLASSIC,amount:15000,bj:14,product:'QA klasická stávající'}];
 proposed.opportunities=planned.map(o=>({...o,clientId:1,company:'QA správce',fundIsin:o.isin,fundKey:(o.category==='FKI'?'isin|':'investment-isin|')+o.isin.toLowerCase(),status:'Nabídka',statusDate:'2026-10-20',scenarioLinkKey:'qa-settlement-'+o.id,sourceForecastSyncId:'qa-settlement-forecast',sourceVariantId:'qa-variant',sourceProposalRowId:'qa-row-'+o.id}));
 await reset(proposed);const oldSnapshot=await page.evaluate(()=>JSON.parse(JSON.stringify(state.investmentSnapshots.find(s=>s.id===50))));let pending=0;
 for(const o of proposed.opportunities){
  await page.evaluate(id=>updateOpportunityStatus(id,'Podepsáno'),o.id);assert(await page.locator('#dealModal').isVisible());await page.locator('#dDate').fill('2026-10-29');await page.locator('#dBj').fill(String(o.bj));await page.locator('#dContractNumber').fill('QA-SETTLEMENT-'+o.id);await page.evaluate(()=>saveDeal());pending+=o.amount;await reload();
  const current=await check(195000,pending,'signed '+o.product),deal=await page.evaluate(id=>state.deals.find(d=>String(d.fromOpportunityId)===String(id)),o.id);
  assert.equal(deal.date,'2026-10-29','business date remains the real signing date');assert.equal(current.deals,planned.findIndex(x=>x.id===o.id)+1);assert.equal(current.pending.filter(r=>r.isin===o.isin).length,1,'linked contract/deal/snapshot are not counted twice');
  const wait=current.pending.find(r=>r.isin===o.isin);assert.equal(wait.purchaseDate,'','signing does not fabricate purchase date');if(o.category==='FKI')assert.equal(wait.emissionDate,'','signing does not fabricate emission date');
  assert.deepEqual(await page.evaluate(()=>state.investmentSnapshots.find(s=>s.id===50)),oldSnapshot,'pending classic top-up cannot modify the settled baseline');
  await page.evaluate(o=>openDealFromOpportunity({...o,status:'Podepsáno'}),o);await page.evaluate(()=>saveDeal());await reload();const repeatedSign=await check(195000,pending,'repeated signed save '+o.product);assert.equal(repeatedSign.deals,current.deals);assert.equal(repeatedSign.records,current.records);assert.equal(repeatedSign.snapshots,current.snapshots);assert.equal(repeatedSign.bj,current.bj);
 }
 const signed=await read();assert.equal(signed.deals,3);assert.equal(signed.bj,39);assert.equal(signed.pending.length,3);const businessBefore=await page.evaluate(()=>JSON.parse(JSON.stringify({deals:state.deals,contracts:state.contracts})));
 const economic=state=>({deals:state.deals.map(d=>({id:d.id,date:d.date,amount:d.amount,bj:d.bj,fromOpportunityId:d.fromOpportunityId})),contracts:state.contracts.map(s=>({id:s.id,amount:s.amount,number:s.number}))});
 const assertProduction=async()=>assert.deepEqual(economic(await page.evaluate(()=>({deals:state.deals,contracts:state.contracts}))),economic(businessBefore),'settlement never duplicates or rewrites trade production/BJ');
 const snapshotIds={};for(const isin of [NEWCLASSIC,CLASSIC]){const row=signed.pending.find(r=>r.isin===isin);assert.equal(row.kind,'snapshot','a signed classic purchase has a separately editable purchase position');snapshotIds[isin]=row.id;}
 const classicDate=async(isin,date)=>{await page.evaluate(id=>openInvestmentSnapshotById(id),snapshotIds[isin]);assert.equal(await page.locator('#isSnapshotScope').inputValue(),'purchase','pending top-up editor edits only that purchase, not the total account');await page.locator('#isPurchaseDate').fill(date);await page.evaluate(()=>saveInvestmentSnapshot());await reload();};
 await saveFkiDates(NEWFKI,40000,'2026-10-29','');await check(195000,85000,'signed FKI still needs emission');
 await saveFkiDates(NEWFKI,40000,'2026-10-29','2026-10-29');await check(235000,45000,'signed FKI confirmed');await assertProduction();
 await classicDate(NEWCLASSIC,'2026-10-29');await check(265000,15000,'classic requires purchase date only');await assertProduction();
 await classicDate(CLASSIC,'2026-10-29');confirmed=await check(280000,0,'classic top-up adds only its own principal');await assertProduction();assert.deepEqual(await page.evaluate(()=>state.investmentSnapshots.find(s=>s.id===50)),oldSnapshot,'confirmed purchase leaves the earlier valuation record intact');
 for(let pass=0;pass<2;pass++){await classicDate(CLASSIC,'2026-10-29');await classicDate(NEWCLASSIC,'2026-10-29');await saveFkiDates(NEWFKI,40000,'2026-10-29','2026-10-29');repeated=await check(280000,0,'repeated all-position confirmation');assert.equal(repeated.deals,confirmed.deals);assert.equal(repeated.bj,confirmed.bj);assert.equal(repeated.records,confirmed.records);assert.equal(repeated.snapshots,confirmed.snapshots);await assertProduction();}
 await classicDate(CLASSIC,'');await check(265000,15000,'cleared top-up date restores original settled classic amount');await classicDate(NEWCLASSIC,'');await check(235000,45000,'cleared classic purchase moves whole new position back to pending');await saveFkiDates(NEWFKI,40000,'2026-10-29','');await check(195000,85000,'cleared FKI emission leaves production but removes pending capital from AUM');await assertProduction();

 // Pending rows must be actionable from the ordinary client and global screens,
 // not accessible only through developer-only helpers.
 await page.evaluate(()=>openClientWorkspace(1,'pendingInvestments'));
 const clientPanel=page.locator('.settlement-panel:visible');assert.equal(await clientPanel.count(),1);assert.equal(await clientPanel.locator('[data-pending-id]').count(),3);near(Number(await clientPanel.locator('[data-pending-total]').getAttribute('data-pending-total')),85000,'client pending total shown separately');
 await page.screenshot({path:'/private/tmp/crm-investment-settlement-client.png',fullPage:false});
 const classicRow=clientPanel.locator('[data-pending-id]').filter({hasText:'QA klasická stávající'});await classicRow.getByRole('button',{name:'Doplnit údaje'}).click();assert(await page.locator('#investmentSnapshotModal').isVisible());assert.equal(await page.locator('#isPurchaseDate').inputValue(),'');near(Number(await page.locator('#isInvested').inputValue()),15000,'client row opens the pending top-up, not the earlier 60000 basis');await page.evaluate(()=>closeModal('investmentSnapshotModal'));
 await page.setViewportSize({width:390,height:844});await page.locator('.settlement-panel:visible').scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/crm-investment-settlement-mobile.png',fullPage:false});assert(await page.locator('.settlement-panel:visible').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'pending client screen has no document-wide mobile overflow');await page.setViewportSize({width:1440,height:1100});
 for(const [area,view,pendingAmount,settled]of [['fki','fki',40000,180000],['investice','investments',45000,75000]]){
  await page.evaluate(({area,view})=>{showView(view);if(area==='fki')setFkMode('aum');else setInvestmentMode('aum');setInvestmentSettlementTab(area,'pending');},{area,view});const panel=page.locator(`.settlement-panel[data-settlement-area="${area}"]:visible`);assert(await panel.isVisible());near(Number(await panel.locator('[data-pending-total]').getAttribute('data-pending-total')),pendingAmount,area+' global pending table');near(Number(await page.locator('[data-pending-aum]:visible').first().getAttribute('data-pending-aum')),pendingAmount,area+' global pending AUM label');near(Number(await page.locator('[data-settled-aum]:visible').first().getAttribute('data-settled-aum')),settled,area+' settled AUM excludes pending');
 }
 await page.evaluate(()=>{showView('fki');setInvestmentSettlementTab('fki','pending');});await page.screenshot({path:'/private/tmp/crm-investment-settlement-global.png',fullPage:false});

 // A later producer/account total already contains earlier confirmed purchases.
 // Those deltas must not be added to the whole-fund update for a second time.
 const coverage=structuredClone(fixture);coverage.investmentRecords=coverage.investmentRecords.filter(r=>r.ClientID==='2');const full={...coverage.investmentSnapshots[0],current:100000,invested:100000,investedBeforeRedemption:100000};coverage.investmentSnapshots=[{...full,id:49,date:'2026-08-31',current:90000,invested:90000,investedBeforeRedemption:90000},full,{...full,id:51,scope:'purchase',purchaseId:'qa-coverage-purchase',date:'2026-10-20',purchaseDate:'2026-10-20',current:20000,invested:20000,investedBeforeRedemption:20000}];await reset(coverage);await check(120000,0,'whole-fund baseline plus a separately confirmed purchase');
 await page.evaluate(()=>openInvestmentSnapshotById(50));await page.locator('#isDate').fill('2026-10-29');await page.locator('#isCurrent').fill('130000');await page.locator('#isInvested').fill('120000');await page.evaluate(()=>saveInvestmentSnapshot());await reload();await check(130000,0,'later whole-fund value covers the previous purchase once');
 await page.evaluate(()=>openInvestmentSnapshotById(50));await page.evaluate(()=>saveInvestmentSnapshot());await reload();await check(130000,0,'unchanged full-fund update does not count its covered purchase twice');
 await page.evaluate(()=>openInvestmentSnapshotById(51));assert.equal(await page.locator('#isSnapshotScope').inputValue(),'purchase','an already covered purchase still opens its own edit form');near(Number(await page.locator('#isInvested').inputValue()),20000,'covered purchase editor loads its own amount');await page.locator('#isPurchaseDate').fill('');await page.evaluate(()=>saveInvestmentSnapshot());await reload();await check(130000,20000,'cleared covered-purchase date keeps the confirmed account total authoritative');
 await page.evaluate(()=>openInvestmentSnapshotById(50));await page.locator('#isPurchaseDate').fill('');await page.evaluate(()=>saveInvestmentSnapshot());await reload();const cleared=await check(0,120000,'cleared newest whole-fund valuation retains one pending principal including its covered delta');near(cleared.report.reduce((n,r)=>n+r.amount,0),0,'report must not resurrect the older valuation either');

 // A producer-wide statement covers only its own client's already settled
 // purchases as of that statement date, including across multiple funds.
 const producer=structuredClone(fixture);producer.investmentRecords=producer.investmentRecords.filter(r=>r.ClientID==='2');
 const producerPurchase=(id,clientId,amount,date,company='Edward')=>({id,clientId,purchaseId:'qa-edward-'+id,scope:'purchase',company,product:'QA účet '+id,isin:'QAEDWARD'+String(id).padStart(4,'0'),date:'2026-10-20',purchaseDate:date,current:amount,invested:amount,investedBeforeRedemption:amount,manualAumOverride:true,calculationVersion:2});
 producer.investmentSnapshots=[producerPurchase(61,1,50000,'2026-10-10'),producerPurchase(62,1,20000,''),producerPurchase(63,1,30000,'2026-11-20'),producerPurchase(64,1,10000,'2026-10-10','QA jiný producent'),producerPurchase(65,2,11000,'2026-10-10'),producerPurchase(66,1,7000,'2026-10-25')];await reset(producer);
 const imported=await page.evaluate(()=>{const result=importEdwardAumRows([{'klient - RČ':'9001010007','klient - jméno':'QA','klient - příjmení':'vypořádání 1','accountId':'QA-ONLY','total AUM':'150000','total return':'10000','MWR %':'0.07'}],'2026-10-20');persist();renderAll();return result.updated.length;});assert.equal(imported,1);await reload();await check(167000,50000,'producer total covers its past settled purchase, not other owners/providers or later purchases',71000);
 assert.deepEqual(await page.evaluate(()=>investmentPendingRows(1).map(r=>r.amount).sort((a,b)=>a-b)),[20000,30000],'unknown and future purchases remain individually actionable');
 assert.deepEqual(errors,[]);console.log('PASS investment settlement: blank/legacy dates, pending AUM/report/global UI, direct and case signing, idempotent confirmation/reversal, classic top-up coverage, persistence rollback, NAV and reload.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
