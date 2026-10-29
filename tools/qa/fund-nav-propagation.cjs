// Isolated synthetic portfolios; no real clients, live browser profile or external requests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..'),FKI='CZ0008053691',CLASSIC='CZ0008473139',OTHER='CZ0008053642';
const fki=(clientId,isin,quantity,company,fund)=>({ClientID:String(clientId),Investor:`QA NAV ${clientId}`,'RČ':clientId===1?'9001010007':'9001020006',
 Fond:fund,'rp.ISIN':isin,'Investiční společnost':company,'Typ produktu':'FKI','Typ transakce':'Platba',
 'Čistá investice':quantity,'Aktuální hodnota investice':quantity,'Počet vydaných CP':quantity,'Upisovací hodnota':1,
 'Datum připsání platby':'2025-01-10','Datum emise':'2025-01-15','Poslední schválená hodnota CP':1.1,
 'Poslední schválená hodnota do':'2026-07-31',fkiValuationMode:'nav',_source:'local-fki'});
const classic=(id,clientId,isin,quantity,company,product)=>({id,clientId,isin,company,product,fundType:'Investice',date:'2026-07-31',purchaseDate:'2025-01-10',
 quantity,qty:quantity,subscribeValue:1,calculationVersion:2,manualAumOverride:false,current:quantity*1.1,invested:quantity,
 investedBeforeRedemption:quantity,currentBeforeRedemption:quantity*1.1,redemptionAmount:0,investmentSchedule:'single',gainAmount:null,gainPct:null,annualReturnPct:null,manualPerformanceOverride:false});
const fixture={nextId:1000,clients:[{id:1,name:'QA NAV 1',birthId:'9001010007'},{id:2,name:'QA NAV 2',birthId:'9001020006'}],
 investmentRecords:[fki(1,FKI,1000,'Codya','QA Penta RE'),fki(2,FKI,500,'CODIA investiční společnost','QA Penta RE třída D'),fki(2,OTHER,200,'Codya','QA Penta RE')],
 investmentSnapshots:[classic(10,1,CLASSIC,2000,'Atris','QA Realita'),classic(11,2,CLASSIC,700,'ATRIS investiční společnost','QA Realita OPF'),classic(12,2,OTHER,300,'Atris','QA Realita')],
 contracts:[],deals:[],activities:[],opportunities:[],providerImports:[],
 fundValues:{['isin|'+FKI.toLowerCase()]:{area:'fki',company:'Codya',fond:'QA Penta RE',isin:FKI,nav:1.1,date:'2026-07-31'},
  ['investment-isin|'+CLASSIC.toLowerCase()]:{area:'investice',company:'Atris',fond:'QA Realita',isin:CLASSIC,nav:1.1,date:'2026-07-31'},
  ['isin|'+OTHER.toLowerCase()]:{area:'fki',company:'Codya',fond:'QA Penta RE',isin:OTHER,nav:1.1,date:'2026-07-31'},
  ['investment-isin|'+OTHER.toLowerCase()]:{area:'investice',company:'Atris',fond:'QA Realita',isin:OTHER,nav:1.1,date:'2026-07-31'}}};
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<.01,`${label}: ${actual} != ${expected}`);
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
 await context.route('**/*',route=>{const url=new URL(route.request().url()),file=path.join(root,decodeURIComponent(url.pathname));
  if(url.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  return route.abort();});
 await context.addInitScript(seed=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));},fixture);
 const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',error=>errors.push(error.message));
 page.on('dialog',async dialog=>{dialogs.push(dialog.message());if(dialog.type()==='prompt')await dialog.accept('1');else await dialog.accept();});
 await page.goto('https://crm.test/FILIP-CRM.html');
 const reset=async(seed=fixture)=>page.evaluate(seed=>{state=normalizeState(seed);persist();renderAll();},seed);
 const read=()=>page.evaluate(()=>({
  fki:state.investmentRecords.map(r=>({clientId:state.clients.find(c=>investmentRecordsForClient(c.id).includes(r))?.id,isin:invIsin(r),value:invCurrentValue(r),date:invValuation(r).date,qty:invQty(r),deposit:invDeposit(r),purchase:invPaymentDate(r),company:r['Investiční společnost'],fund:r.Fond,area:r['Typ produktu']})),
  classic:state.investmentSnapshots.map(s=>({id:s.id,clientId:s.clientId,isin:s.isin,value:investmentSnapshotLiveCurrent(s),qty:s.quantity,deposit:s.invested,purchase:s.purchaseDate,company:s.company,fund:s.product,area:s.fundType})),
  reports:[1,2].map(id=>({id,items:clientOutput_xClientInvestments(findClient(id)).map(x=>({isin:x.isin,area:x.area,amount:x.amount,date:x.valueDate}))}))
 }));
 const check=async({fkiNav=1.1,classicNav=1.1,fkiDate='2026-07-31',classicDate='2026-07-31'},label)=>{
  const data=await read();
  for(const row of data.fki){const nav=row.isin===FKI?fkiNav:1.1;near(row.value,row.qty*nav,label+` FKI client ${row.clientId} ${row.isin}`);assert.equal(row.date,row.isin===FKI?fkiDate:'2026-07-31',label+' FKI date');assert.equal(row.deposit,row.qty);assert.equal(row.purchase,'2025-01-10');}
  for(const row of data.classic){const nav=row.isin===CLASSIC?classicNav:1.1;near(row.value,row.qty*nav,label+` classic client ${row.clientId} ${row.isin}`);assert.equal(row.deposit,row.qty);assert.equal(row.purchase,'2025-01-10');}
  for(const report of data.reports)for(const item of report.items){const row=(item.area==='FKI'?data.fki:data.classic).find(x=>x.clientId===report.id&&x.isin===item.isin);assert(row,`${label}: report item has a position ${JSON.stringify({report,item,fki:data.fki,classic:data.classic})}`);near(item.amount,row.value,label+` report ${report.id} ${item.isin}`);
   const date=item.isin===FKI?fkiDate:item.isin===CLASSIC?classicDate:'2026-07-31';assert.equal(String(item.date).replace(/\s/g,''),date.split('-').reverse().map(Number).join('.'),label+' report date');}
  return data;
 };
 const openFki=(clientId=1,isin=FKI)=>page.evaluate(({clientId,isin})=>{const r=investmentRecordsForClient(clientId).find(r=>invIsin(r)===isin);openFkRecordModal(clientId,encodeURIComponent(invPositionKey(r)),encodeURIComponent(invRecordKey(r)));},{clientId,isin});
 const editFki=async(nav,date,clientId=1)=>{await openFki(clientId);await page.locator('#fkRecNav').fill(String(nav));await page.locator('#fkRecNavDate').fill(date);await page.evaluate(()=>saveFkRecord());};
 const openClassic=(id=10)=>page.evaluate(id=>{const s=state.investmentSnapshots.find(s=>s.id===id);openInvestmentSnapshotModal(s.clientId,encodeURIComponent(investmentSnapshotKeyForSnapshot(s)));},id);
 const editClassic=async(nav,date,id=10)=>{await openClassic(id);assert.equal(await page.locator('#isCurrent').inputValue(),'','automatic CP mode stays automatic');await page.locator('#isFundNav').fill(String(nav));await page.locator('#isFundNavDate').fill(date);await page.evaluate(()=>saveInvestmentSnapshot());};
 const globalFki=async(nav,date)=>{await page.evaluate(isin=>openFkFundModal(encodeURIComponent('isin|'+isin.toLowerCase())),FKI);await page.locator('#fkFundNav').fill(String(nav));await page.locator('#fkFundDate').fill(date);await page.evaluate(()=>saveFkFund());};
 const globalClassic=async(nav,date)=>{await page.evaluate(isin=>openInvestmentFundModal(encodeURIComponent('investment-isin|'+isin.toLowerCase())),CLASSIC);await page.locator('#invFundNav').fill(String(nav));await page.locator('#invFundDate').fill(date);await page.evaluate(()=>saveInvestmentFund());};

 await check({},'baseline');
 await editFki(1.3,'2026-09-30');await page.reload();await check({fkiNav:1.3,fkiDate:'2026-09-30'},'client FKI edit shared with second client after reload');
 // This was the original reproducible stale-overwrite bug: editing older NAV on client 2
 // rewrote every holder and reduced client 1 from 1300 to 1150.
 await editFki(1.15,'2026-08-31',2);await page.reload();
 await check({fkiNav:1.3,fkiDate:'2026-09-30'},'older client FKI quote cannot replace newer shared NAV');
 await globalFki(1.4,'2026-10-15');await page.reload();await check({fkiNav:1.4,fkiDate:'2026-10-15'},'global FKI edit');
 await globalFki(1.2,'2026-08-31');await page.reload();await check({fkiNav:1.4,fkiDate:'2026-10-15'},'older global FKI quote');
 await editFki(1.42,'2026-10-15',2);await page.reload();await check({fkiNav:1.42,fkiDate:'2026-10-15'},'explicit same-date FKI correction');

 await reset();await editClassic(1.3,'2026-09-30');await page.reload();await check({classicNav:1.3,classicDate:'2026-09-30'},'client classic edit shared with second client after reload');
 await editClassic(1.15,'2026-08-31',11);await page.reload();await check({classicNav:1.3,classicDate:'2026-09-30'},'older client classic quote');
 await globalClassic(1.4,'2026-10-15');await page.reload();await check({classicNav:1.4,classicDate:'2026-10-15'},'global classic edit');
 await globalClassic(1.2,'2026-08-31');await page.reload();await check({classicNav:1.4,classicDate:'2026-10-15'},'older global classic quote');
 await editClassic(1.42,'2026-10-15',11);await page.reload();await check({classicNav:1.42,classicDate:'2026-10-15'},'explicit same-date classic correction');

 // One ISIN has one quote even across the FKI/classic views. Quote propagation must not
 // canonicalize the other area's product metadata, holdings or classification.
 const mixed=structuredClone(fixture);mixed.investmentSnapshots.push(classic(13,2,FKI,400,'QA jiná společnost','QA jiné jméno stejné emise'));
 await reset(mixed);await editFki(1.5,'2026-10-20');await page.reload();let data=await read();
 let cross=data.classic.find(x=>x.id===13);near(cross.value,600,'FKI NAV propagates into classic same-ISIN holding');assert.equal(cross.company,'QA jiná společnost');assert.equal(cross.fund,'QA jiné jméno stejné emise');assert.equal(cross.area,'Investice');
 await editClassic(1.6,'2026-10-25',13);await page.reload();data=await read();for(const row of data.fki.filter(x=>x.isin===FKI))near(row.value,row.qty*1.6,'classic NAV propagates into every FKI same-ISIN holding');
 assert.deepEqual(data.fki.map(x=>({company:x.company,fund:x.fund,area:x.area})),mixed.investmentRecords.map(r=>({company:r['Investiční společnost'],fund:r.Fond,area:r['Typ produktu']})),'client NAV edit does not rewrite FKI metadata');

 // Shared NAV is not authority to resurrect explicit zero/manual balances or override a
 // newer verified statement. Neither position ownership nor quantities may be copied.
 const protectedSeed=structuredClone(fixture);
 protectedSeed.investmentRecords[1]={...protectedSeed.investmentRecords[1],fkiValuationMode:'manual',fkiManualCurrent:0};
 protectedSeed.investmentSnapshots[1]={...protectedSeed.investmentSnapshots[1],manualAumOverride:true,current:0};
 await reset(protectedSeed);await editFki(1.5,'2026-10-20');await editClassic(1.5,'2026-10-20');await page.reload();data=await read();near(data.fki[1].value,0,'manual FKI zero');near(data.classic.find(x=>x.id===11).value,0,'manual classic zero');
 for(const protectedRecord of [
  {...fixture.investmentRecords[1],fkiValuationMode:'statement',providerValuation:{provider:'codya',date:'2026-10-25',current:0,nav:1.5}},
  {...fixture.investmentRecords[1],fkiValuationMode:'statement',codyaImportedCurrent:0,codyaImportDate:'2026-10-25'},
  {...fixture.investmentRecords[1],fkiValuationMode:'statement',providerValuation:{provider:'codya',date:'2026-10-25',current:812.34,nav:1.5}}
 ]){const seed=structuredClone(fixture);seed.investmentRecords[1]=protectedRecord;await reset(seed);await editFki(1.4,'2026-10-15');await page.reload();data=await read();near(data.fki[1].value,protectedRecord.providerValuation?.current||0,'newer verified or explicit zero holding remains authoritative');
  await editFki(1.6,'2026-10-28');await page.reload();data=await read();near(data.fki[1].value,protectedRecord.providerValuation?.current?800:0,'new quote updates a nonzero statement but never resurrects an explicit zero');}

 const verified=structuredClone(fixture);verified.investmentSnapshots[1]={...verified.investmentSnapshots[1],current:812.34,date:'2026-10-25',_providerImportedAt:'2026-10-28T08:00:00.000Z',providerValuation:{provider:'codya',date:'2026-10-25',current:812.34,nav:1.2}};
 await reset(verified);await editClassic(1.4,'2026-10-15');await page.reload();data=await read();near(data.classic.find(x=>x.id===11).value,812.34,'newer verified classic statement');
 await openClassic(11);await page.locator('#isNote').fill('QA poznámka bez změny ceny');await page.evaluate(()=>saveInvestmentSnapshot());await page.reload();data=await read();near(data.classic.find(x=>x.id===11).value,812.34,'notes-only save retains verified classic amount');
 assert.deepEqual(await page.evaluate(()=>state.investmentSnapshots.find(s=>s.id===11).providerValuation),verified.investmentSnapshots[1].providerValuation,'notes-only save retains provider provenance');
 near(data.classic.find(x=>x.id===10).value,2800,'notes-only save does not publish the other client\'s private statement');
 await editClassic(1.5,'2026-10-25');await page.reload();data=await read();near(data.classic.find(x=>x.id===11).value,1050,'explicit same-date quote entered after statement receipt updates automatic balance');
 const zeroClassic=structuredClone(verified);zeroClassic.investmentSnapshots[1].current=0;zeroClassic.investmentSnapshots[1].providerValuation.current=0;await reset(zeroClassic);await editClassic(1.6,'2026-10-28');await page.reload();data=await read();near(data.classic.find(x=>x.id===11).value,0,'verified classic zero cannot be resurrected by newer shared NAV');
 const legacyVerified=structuredClone(verified);delete legacyVerified.investmentSnapshots[1].calculationVersion;delete legacyVerified.investmentSnapshots[1].manualAumOverride;
 await reset(legacyVerified);await openClassic(11);await page.locator('#isNote').fill('QA starší výpis, pouze poznámka');await page.evaluate(()=>saveInvestmentSnapshot());await page.reload();
 const legacySaved=await page.evaluate(()=>state.investmentSnapshots.find(s=>s.id===11));assert.equal(legacySaved.manualAumOverride,false,'legacy verified statement must not become a manual override during a note edit');near(legacySaved.current,812.34,'legacy statement amount retained');assert.deepEqual(legacySaved.providerValuation,legacyVerified.investmentSnapshots[1].providerValuation);

 // Legacy fund-value aliases are a shared quote source. Client-only imported statements
 // remain private until an adviser explicitly publishes a new quote through an editor.
 const alias=structuredClone(fixture);alias.fundValues['legacy-qa-fki']={area:'fki',company:'QA alias',fond:'QA alias',isin:FKI,nav:1.7,date:'2026-10-26'};
 alias.fundValues['legacy-qa-classic']={area:'investice',company:'QA alias',fond:'QA alias',isin:CLASSIC,nav:1.8,date:'2026-10-26'};
 await reset(alias);await check({fkiNav:1.7,fkiDate:'2026-10-26',classicNav:1.8,classicDate:'2026-10-26'},'latest dated same-ISIN legacy aliases');
 await openFki(2);near(Number(await page.locator('#fkRecNav').inputValue()),1.7,'FKI editor uses latest shared quote');assert.equal(await page.locator('#fkRecNavDate').inputValue(),'2026-10-26');await page.evaluate(()=>closeModal('fkRecordModal'));
 await openClassic(11);near(Number(await page.locator('#isFundNav').inputValue()),1.8,'classic editor uses latest shared quote');assert.equal(await page.locator('#isFundNavDate').inputValue(),'2026-10-26');await page.evaluate(()=>closeModal('investmentSnapshotModal'));
 const rows=structuredClone(fixture);rows.investmentRecords[1]['Poslední schválená hodnota CP']=1.75;rows.investmentRecords[1]['Poslední schválená hodnota do']='2026-10-27';await reset(rows);
 data=await read();near(data.fki[0].value,1100,'another client\'s imported quote does not silently publish a shared NAV');near(data.fki[1].value,875,'own imported row may use its newer quote');
 await editFki(1.76,'2026-10-27',2);await page.reload();await check({fkiNav:1.76,fkiDate:'2026-10-27'},'explicit edit publishes the previously client-only quote');

 // Restoring an older backup of the very same valuation date must retain the later
 // explicit correction, including the totals consumers actually show to the adviser/client.
 const corrected=structuredClone(fixture),older=structuredClone(fixture);
 for(const [key,nav]of [['isin|'+FKI.toLowerCase(),1.6],['investment-isin|'+CLASSIC.toLowerCase(),1.7]]){
  corrected.fundValues[key]={...corrected.fundValues[key],nav,date:'2026-10-26',_navUpdatedAt:'2026-10-29T10:00:00.000Z'};
  older.fundValues[key]={...older.fundValues[key],nav:1.2,date:'2026-10-26',_navUpdatedAt:'2026-10-29T08:00:00.000Z'};
 }
 await reset(corrected);await check({fkiNav:1.6,fkiDate:'2026-10-26',classicNav:1.7,classicDate:'2026-10-26'},'later same-day correction before backup merge');
 const totalsBefore=await page.evaluate(()=>[1,2].map(id=>({aum:clientInvestmentSummary(id).total,report:clientOutput_xClientInvestments(findClient(id)).reduce((sum,x)=>sum+x.amount,0)})));
 await page.evaluate(incoming=>{mergeIncomingState(normalizeState(incoming));persist();renderAll();},{fundValues:older.fundValues});await page.reload();
 await check({fkiNav:1.6,fkiDate:'2026-10-26',classicNav:1.7,classicDate:'2026-10-26'},'older same-date backup cannot revert a later correction');
 assert.deepEqual(await page.evaluate(()=>[1,2].map(id=>({aum:clientInvestmentSummary(id).total,report:clientOutput_xClientInvestments(findClient(id)).reduce((sum,x)=>sum+x.amount,0)}))),totalsBefore,'backup merge preserves current client AUM and report totals');

 const noCp=structuredClone(fixture);noCp.investmentRecords[1]={...noCp.investmentRecords[1],'Počet vydaných CP':0,'Upisovací hodnota':0,'Aktuální hodnota investice':777,codyaImportedCurrent:777};
 noCp.investmentSnapshots[1]={...noCp.investmentSnapshots[1],quantity:0,qty:0,subscribeValue:0,calculationVersion:1,current:888};
 await reset(noCp);await editFki(1.8,'2026-10-28');await editClassic(1.9,'2026-10-28');await page.reload();data=await read();
 near(data.fki[1].value,777,'NAV alone cannot manufacture FKI balance without CP or subscription price');near(data.classic.find(x=>x.id===11).value,888,'NAV alone cannot manufacture classic balance without CP or subscription price');
 assert.equal(data.fki[1].qty,0);assert.equal(data.classic.find(x=>x.id===11).qty,0);
 const unchangedInputs=await page.evaluate(()=>({fki:state.investmentRecords[1]['Aktuální hodnota investice'],classic:state.investmentSnapshots.find(s=>s.id===11).current}));assert.deepEqual(unchangedInputs,{fki:777,classic:888});

 // Exercise the generated standalone HTML, not only the report's data helper.
 await reset();await editFki(1.5,'2026-10-20');await editClassic(1.6,'2026-10-25');await page.reload();
 await page.evaluate(()=>{showView('clients');selectedClientId=2;clientDirectoryMode=false;clientSection='portfolio';renderClients();});
 await page.screenshot({path:'/private/tmp/crm-fund-nav-propagation-client.png',fullPage:false});
 const report=await context.newPage();report.on('pageerror',error=>errors.push(error.message));
 for(const id of [1,2]){const html=await page.evaluate(id=>clientOutput_xReportHtml(findClient(id),{summary:true,fki:true,investments:true,notice:false}),id);await report.setContent(html);
  const cards=report.locator('.report-fund-detail');for(const [isin,expected]of [[FKI,id===1?1500:750],[CLASSIC,id===1?3200:1120]]){
   const text=await cards.filter({hasText:isin}).locator('.metrics').innerText();assert(text.replace(/\s/g,'').includes(String(expected)),`HTML report client ${id} ${isin} reflects shared NAV`);}
 }
 await report.screenshot({path:'/private/tmp/crm-fund-nav-propagation-report.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('PASS fund NAV propagation: same ISIN across clients/areas, UI/global edits, dated precedence and same-date corrections, reload and HTML reports, alias quotes, manual/statement zeros and unrelated holdings preserved.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
