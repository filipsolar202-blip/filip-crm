const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const fixture=require('./fixture.cjs');
const root=path.resolve(__dirname,'../..'),baseline='released';
const baselineHtml=require('node:child_process').execFileSync('git',['show','d332145:FILIP-CRM.html'],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
(async()=>{
const browser=await chromium.launch(launchOptions);
const results=[];
async function session(dir){
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const errors=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))errors.push(m.text())});p.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());});
 await context.route('**/*',async route=>{
 const u=new URL(route.request().url());
 if(u.hostname==='crm.test'){if(dir===baseline&&u.pathname==='/FILIP-CRM.html')return route.fulfill({body:baselineHtml,contentType:'text/html'});const p=path.join(dir===baseline?root:dir,decodeURIComponent(u.pathname));if(fs.existsSync(p))return route.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html'});}
 if(u.hostname==='cdn.jsdelivr.net'){const file=u.pathname.includes('xlsx')?'xlsx.full.min.js':'chart.umd.min.js';return route.fulfill({body:fs.readFileSync(path.join(root,'assets/vendor',file)),contentType:'text/javascript'});}
 if(u.hostname==='127.0.0.1')return route.fulfill({status:503,body:'isolated'});
 return route.abort();
 });
 await context.addInitScript(data=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(data))},fixture);
 const page=await context.newPage();await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForTimeout(1800);
 return{context,page,errors};
}
async function snapshot(page){return page.evaluate(()=>{
 renderAll();return{counts:{clients:state.clients.length,contracts:state.contracts.length,deals:state.deals.length,records:state.investmentRecords.length},deals:state.deals.map(d=>({id:d.id,bj:dealBJ(d),cash:dealCash(d),commission:dealActualCommission(d)})),classic:classicInvestmentItems().map(x=>({amount:x.amount,invested:investmentInvestedAmount(x),product:x.product})),fki:fkClientRows().map(x=>({aum:x.aum,invested:x.invested})),report:clientOverviewReportHtml(findClient(1),{summary:true,open:true,insurance:true,loans:true,investments:true,notice:true},'Test report')};})}
try{
 const old=await session(baseline),current=await session(root);
 const a=await snapshot(old.page),b=await snapshot(current.page);
 assert.deepEqual({...b,report:undefined},{...a,report:undefined});results.push('Portfolio, totals and commissions match released version');
 // Report rendering must retain the released client data while allowing corrected calculations and presentation.
 assert(b.report.includes('Testovací klient Alfa'));results.push('Client report retains released client data');
 assert(b.report.includes('Investiční portfolio celkem')&&b.report.includes('Běžné investice')&&b.report.includes('Fondy kvalifikovaných investorů'));
 assert(b.report.indexOf('Přehled běžných investic')<b.report.indexOf('Souhrn všech FKI'));
 assert(b.report.includes('Investiční společnost')&&b.report.includes('Test FKI'));
 results.push('Client report separates total, classic investments and FKI grouped by investment company');
 console.log('baseline errors',old.errors);
 const {page,context,errors}=current;
 const edwardImport=await page.evaluate(()=>{
   const client={id:99001,name:'Lenka Pešková',birthId:'900101/1234',email:'lenka.qa@example.cz'}, beforeFki=(state.investmentRecords||[]).length;
   state.clients.push(client);state.investmentSnapshots=state.investmentSnapshots||[];
   state.investmentSnapshots.push({id:99002,clientId:client.id,company:'Wood',product:'Edward stará pozice',current:12345,invested:10000,date:'2026-09-01'});
   const positive={'klient - příjmení':'Pešková','klient - jméno':'Lenka','klient - RČ':'900101/1234','klient - e-mail':'lenka.qa@example.cz','název účtu':'Investiční účet','accountId':'QA-1','pravidelný vklad':'30000,00','total AUM':'728227,97','total return':'133327,97','MWR %':'0,12'},zero={...positive,accountId:'QA-0','total AUM':'0,00','total return':'0,00'};
   const first=importEdwardAumRows([positive,zero],'2026-10-05'),items=classicInvestmentItems().filter(x=>String(x.clientId)===String(client.id)),snap=items[0]?.snapshot;
   const importedAnnual=snap?.annualReturnPct;snap.manualPerformanceOverride=true;snap.annualReturnPct=11.74;snap.gainPct=22.4;
   importEdwardAumRows([{...positive,'total AUM':'730000,00','total return':'135100,00','MWR %':'0,13'}],'2026-11-05');
   const after=classicInvestmentItems().filter(x=>String(x.clientId)===String(client.id)),final=after[0]?.snapshot;
   state.clients=state.clients.filter(x=>x.id!==client.id);state.investmentSnapshots=state.investmentSnapshots.filter(x=>x.clientId!==client.id);
   return {updated:first.updated.length,skipped:first.skippedZero,count:items.length,current:snap?.current,invested:snap?.invested,gain:snap?.gainAmount,importedAnnual,finalCurrent:final?.current,finalAnnual:final?.annualReturnPct,finalPct:final?.gainPct,fkiUnchanged:beforeFki===(state.investmentRecords||[]).length};
 });
 assert(Math.abs(edwardImport.importedAnnual-12)<1e-9);delete edwardImport.importedAnnual;
 assert.deepEqual(edwardImport,{updated:1,skipped:1,count:1,current:728227.97,invested:594900,gain:133327.97,finalCurrent:730000,finalAnnual:11.74,finalPct:22.4,fkiUnchanged:true});
 results.push('Edward CSV skips zero AUM, replaces older Edward positions and preserves manual performance overrides');
 const sharedInvestmentNav=await page.evaluate(()=>{
   const first={company:'QA invest',product:'Sdílený fond',isin:'QA-SHARED-NAV',fundType:'Investice',quantity:10,current:900,manualAumOverride:false,purchaseDate:'2025-01-15'},key=investmentFundKeyFromParts(first.company,first.product,first.isin,first.fundType),original=state.fundValues[key];
   const second={...first,quantity:20,purchaseDate:'2025-02-20'};
   const manual={...first,quantity:30,current:777,manualAumOverride:true};
   state.fundValues[key]={area:'investice',nav:100,date:'2026-09-30'};
   const before=[investmentSnapshotLiveCurrent(first),investmentSnapshotLiveCurrent(second),investmentSnapshotLiveCurrent(manual)];
   state.fundValues[key]={area:'investice',nav:125,date:'2026-10-07'};
   const after=[investmentSnapshotLiveCurrent(first),investmentSnapshotLiveCurrent(second),investmentSnapshotLiveCurrent(manual)];
   if(original)state.fundValues[key]=original;else delete state.fundValues[key];
   return{before,after,purchaseDates:[first.purchaseDate,second.purchaseDate]};
 });
 assert.deepEqual(sharedInvestmentNav,{before:[1000,2000,777],after:[1250,2500,777],purchaseDates:['2025-01-15','2025-02-20']});
 results.push('One classic-fund NAV update recalculates every client position while manual AUM remains unchanged');
 const reinvestmentReport=await page.evaluate(()=>{
   const managed=[{key:'qa-source',product:'Původní fond',company:'Správce A',current:100000,invested:90000,monthly:0,expectedRate:5,area:'Investice'}],sourceId=scenario_positionId(managed[0],'managed',0),row={key:'Investice|qa-target',area:'Investice',company:'Správce B',product:'Cílový fond',isin:'CZ0008477593',amount:60000,monthly:0,rate:8,minRate:6,maxRate:10,funding:'reinvest',salePositionId:sourceId,newTaxTest:true},dispositions={[sourceId]:{action:'sell',amount:60000,targetKey:'',autoReinvest:true}},model={years:5,rows:[row],dispositions,managedRowsOverride:managed,externalRows:[]},projection=scenario_projection(model),variant={name:'Přesun',rows:[row],dispositions,projection},record={name:'QA',createdAt:'2026-10-08',years:5,managedRows:managed,externalRows:[],variants:[],baselineProjection:scenario_projection({years:5,rows:[],dispositions:{},managedRowsOverride:managed,externalRows:[]})},changes=investmentComparisonChanges(record,variant),impact=investmentComparisonImpact(record,variant),profile=clientOutput_xFundProfileHtml({area:'Investice',key:'qa-target',isin:'CZ0008477593'});
   return{newMoney:projection.newMoney,reinvested:projection.reinvestedTotal,starting:projection.startingValue,change:changes[0]?.text,kind:changes[0]?.kind,impact,profile};
 });
 assert.equal(reinvestmentReport.newMoney,0);assert.equal(reinvestmentReport.reinvested,60000);assert.equal(reinvestmentReport.starting,100000);
 assert.equal(reinvestmentReport.change,'Původní fond → Cílový fond');assert.equal(reinvestmentReport.kind,'transfer');
 assert(reinvestmentReport.impact.includes('Dopad na celé portfolio')&&reinvestmentReport.impact.includes('Nové peníze')&&reinvestmentReport.impact.includes('0 Kč'));
 assert(reinvestmentReport.profile.includes('Výstupní poplatek')&&reinvestmentReport.profile.includes('CZ0008477593')===false&&reinvestmentReport.profile.includes('Oficiální informace fondu'));
 results.push('Reinvestment names source and target funds, preserves portfolio value and is excluded from new money');
 const producerImports=await page.evaluate(()=>{
   const client={id:99011,name:'Ing. Testovací Jan - Praha',birthId:'800101/1234'};state.clients.push(client);state.investmentSnapshots=state.investmentSnapshots||[];state.investmentRecords=state.investmentRecords||[];state.contracts.push({id:99012,clientId:client.id,category:'Investice',company:'Vigo Public',product:'OPF',volume:700,date:'2025-01-01'});
   const wood=woodImportRows([{'Příjmení, Jméno':'Testovací, Jan','Datum narození':'01.01.1980','Objem aktiv':'125000.50','Čistý objem vkladů':'100000','Zisk / ztráta':'25000.50'}],'2026-10-06');
   const fki={Investor:client.name,'RČ':normalizeStrongId(client.birthId),ClientID:'RC_'+normalizeStrongId(client.birthId),'Investiční společnost':'Codya',Fond:'PENTA RE tř.D_CZK','Typ produktu':'FKI','Typ transakce':'Platba','Čistá investice':100,'Počet vydaných CP':10,'Datum emise':'2025-01-01'};state.investmentRecords.push(fki);state.fundValues[invPositionKey(fki)]={area:'fki',nav:10,date:'2026-09-30'};
   const row={'RODNÉ ČÍSLO':'8001011234','JMÉNO':'Jan','PŘIJMENÍ':'Testovací','VIGO PUBLIC I.PODFOND tř.A_CZK':'777','PENTA RE tř.D_CZK':'250'};
   const inv=importCodyaRows([row],'investice','2026-10-06'),fk=importCodyaRows([row],'fki','2026-10-06'),woodItem=classicInvestmentItems().find(x=>String(x.clientId)===String(client.id)&&norm(x.isin)===norm('CZ0008477551')),codyaItem=classicInvestmentItems().find(x=>String(x.clientId)===String(client.id)&&norm(x.company).includes('vigo public')),clientClassicCount=classicInvestmentItems().filter(x=>String(x.clientId)===String(client.id)&&/vigo public/.test(norm([x.company,x.product].join(' ')))).length,override=invCurrentValue(fki);state.fundValues[invPositionKey(fki)]={area:'fki',nav:30,date:'2026-10-07'};const automatic=invCurrentValue(fki);
   state.clients=state.clients.filter(x=>x.id!==client.id);state.investmentSnapshots=state.investmentSnapshots.filter(x=>String(x.clientId)!==String(client.id));state.investmentRecords=state.investmentRecords.filter(x=>String(invClientIdentity(x))!==normalizeStrongId(client.birthId));delete state.fundValues[invPositionKey(fki)];
   state.contracts=state.contracts.filter(x=>x.id!==99012);return {woodUpdated:wood.updated,woodAum:woodItem?.amount,woodIsin:woodItem?.isin,invUpdated:inv.updated,invAum:codyaItem?.amount,invCompany:codyaItem?.company,clientClassicCount,fkiUpdated:fk.updated,fkiOverride:override,fkiAutomatic:automatic};
 });
 assert.deepEqual(producerImports,{woodUpdated:1,woodAum:125000.5,woodIsin:'CZ0008477551',invUpdated:1,invAum:777,invCompany:'Vigo Public',clientClassicCount:1,fkiUpdated:1,fkiOverride:250,fkiAutomatic:300});
 results.push('WOOD matches by ISIN and Codya separates OPF/FKI while newer FKI NAV regains priority');
 const fkiCanonicalMerge=await page.evaluate(()=>{
   const isin='QA0000000001',keyA='legacy-fki-a',keyB='legacy-fki-b',newKey='isin|qa0000000001',backup={fundValues:state.fundValues,trailSettings:state.trailSettings,lockedFunds:state.lockedFunds,records:state.investmentRecords,deals:state.deals,contracts:state.contracts,opportunities:state.opportunities,forecasts:state.investmentForecasts};
   state.fundValues={[keyA]:{area:'fki',company:'Stará společnost',fond:'Starý fond',isin,comment:'Zachovaný komentář',exitFee:'5 %'},[keyB]:{area:'fki',company:'Správná společnost',fond:'Správný fond',isin,nav:125,date:'2026-10-08'}};state.trailSettings={[keyA]:{trailPct:1.2},[keyB]:{trailPct:1.2}};state.lockedFunds={[fkiGlobalLockKey(keyA)]:true};state.investmentRecords=[{Investor:'Klient A',ClientID:'A',Fond:'Starý fond','Investiční společnost':'Stará společnost','Typ produktu':'FKI','Čistá investice':100,'Datum emise':'2025-01-01','rp.ISIN':isin},{Investor:'Klient B',ClientID:'B',Fond:'Správný fond','Investiční společnost':'Správná společnost','Typ produktu':'FKI','Čistá investice':200,'Datum emise':'2025-02-01','rp.ISIN':isin}];state.deals=[{id:1,category:'FKI',company:'Stará společnost',product:'Starý fond',isin}];state.contracts=[];state.opportunities=[{id:2,category:'FKI',company:'Stará společnost',product:'Starý fond',isin}];state.investmentForecasts=[{variants:[{rows:[{area:'FKI',company:'Stará společnost',product:'Starý fond',isin}]}]}];
   const changed=commissions_applyFkFundMerge(new Set([keyA,keyB,newKey]),newKey,{area:'fki',company:'Správná společnost',fond:'Správný fond',product:'FKI',isin,typ:'Investiční akcie',nav:125,date:'2026-10-08',trailPct:1.2}),result={changed,keys:Object.keys(state.fundValues),fund:state.fundValues[newKey],recordNames:state.investmentRecords.map(x=>x.Fond),deal:state.deals[0],opportunity:state.opportunities[0],forecast:state.investmentForecasts[0].variants[0].rows[0],oldTrail:state.trailSettings[keyA],locked:state.lockedFunds[fkiGlobalLockKey(newKey)]};
   Object.assign(state,{fundValues:backup.fundValues,trailSettings:backup.trailSettings,lockedFunds:backup.lockedFunds,investmentRecords:backup.records,deals:backup.deals,contracts:backup.contracts,opportunities:backup.opportunities,investmentForecasts:backup.forecasts});return result;
 });
 assert.deepEqual(fkiCanonicalMerge.keys,['isin|qa0000000001']);assert.equal(fkiCanonicalMerge.fund.comment,'Zachovaný komentář');assert.equal(fkiCanonicalMerge.fund.exitFee,'5 %');assert.deepEqual(fkiCanonicalMerge.recordNames,['Správný fond','Správný fond']);assert.equal(fkiCanonicalMerge.deal.product,'Správný fond');assert.equal(fkiCanonicalMerge.opportunity.product,'Správný fond');assert.equal(fkiCanonicalMerge.forecast.product,'Správný fond');assert.equal(fkiCanonicalMerge.oldTrail,undefined);assert.equal(fkiCanonicalMerge.locked,true);
 results.push('FKI merge keeps one canonical ISIN fund and rewrites clients, business records and saved forecasts');
 const fkiSharedFundNotConflict=await page.evaluate(()=>{
   const isin='QA0000000002',key='isin|qa0000000002',backup={fundValues:state.fundValues,records:state.investmentRecords};
   state.fundValues={[key]:{area:'fki',company:'Správná společnost',fond:'Jeden fond',product:'Investiční akcie',isin,typ:'Investiční akcie'}};
   state.investmentRecords=[{Investor:'Klient A',ClientID:'A',Fond:'Jeden fond','Investiční společnost':'Správná společnost','Typ produktu':'FKI','Typ CP':'Investiční akcie','Čistá investice':100,'Datum emise':'2025-01-01','rp.ISIN':isin},{Investor:'Klient B',ClientID:'B',Fond:'Jeden fond','Investiční společnost':'Správná společnost','Typ produktu':'FKI','Typ CP':'Investiční akcie','Čistá investice':200,'Datum emise':'2025-02-01','rp.ISIN':isin}];
   const conflicts=fkiIsinConflicts().map(x=>x.isin);Object.assign(state,{fundValues:backup.fundValues,investmentRecords:backup.records});return conflicts;
 });
 assert.deepEqual(fkiSharedFundNotConflict,[]);
 results.push('Multiple FKI clients sharing one canonical ISIN are not reported as duplicate funds');
 const redemptionReport=await page.evaluate(()=>{
   const key='qa-liquidity-report';state.fundValues[key]={area:'investice',taxMonths:36,redemptionFrequency:'quarterly',settlementMonths:2};
   const fund={area:'Investice',key,product:'Test likvidity',amount:100000,invested:100000};
   const row=(start,i=0)=>({r:{product:'Nákup'},i,taxStart:start,current:50000,taxInfo:liquidity_liquidityInfo('investice',key,'',start)});
   const rows=[row('2024-02-29'),row('2025-06-15',1)];
   const future=clientOutput_xRedemptionPlan(fund,rows,'2026-09-28');
   const matured=clientOutput_xRedemptionPlan(fund,[row('2020-01-10')],'2026-09-28');
   state.fundValues[key].expectedRate=8;
   rows[0].valueDate='2026-03-31';rows[0].pa=8;
   const estimate=clientOutput_xRedemptionEstimate(fund,future.positions[0]);
   const delayed=clientOutput_xRedemptionEstimate(fund,{...future.positions[0],payout:'2030-01-31'});
   const html=clientOutput_xRedemptionHtml(fund,rows);
   const chart=clientOutput_xHistoryChart([{...fund,rows:[{sourceType:'deal',date:'2023-01-10',purchaseDate:'2023-01-10',invested:100000,current:110000}]}]);
   delete state.fundValues[key].settlementMonths;
   const missing=clientOutput_xRedemptionPlan(fund,rows,'2026-09-28');
   delete state.fundValues[key];
   return{future,matured,missing,html,estimate,delayed,chart};
 });
 assert.equal(redemptionReport.future.positions[0].taxReady,'2027-02-28');
 assert.equal(redemptionReport.future.positions[0].redemption,'2027-03-31');
 assert.equal(redemptionReport.future.positions[0].payout,'2027-05-31');
 assert.equal(redemptionReport.future.positions[1].payout,'2028-08-31');
 assert.equal(redemptionReport.matured.positions[0].redemption,'2026-09-30');
 assert.equal(redemptionReport.matured.positions[0].payout,'2026-11-30');
 assert(redemptionReport.missing.positions.every(x=>!x.payout));
 assert(redemptionReport.html.includes('Kdy můžete mít prostředky zpět'));
 assert(Math.abs(redemptionReport.estimate.amount-54000)<10);
 assert.equal(redemptionReport.estimate.amount,redemptionReport.delayed.amount);
 assert(!redemptionReport.html.includes('<table'));assert(redemptionReport.html.includes('Odhad hodnoty odkupu'));
 assert(redemptionReport.chart.includes('10. 1. 2023'));assert(redemptionReport.chart.includes('nikoli skutečná průběžná ocenění'));
 results.push('Report redemption dates include 36-month test, next future window, settlement and missing settings');

 const connectedChart=await page.evaluate(()=>{
 const funds=[{area:'Investice',amount:166627,rows:[{sourceType:'deal',purchaseDate:'2023-09-20',invested:130000,current:166627}]},{area:'Investice',amount:146487,rows:[{sourceType:'deal',purchaseDate:'2023-09-20',invested:120000,current:146487}]}];
 const parse=html=>{const el=document.createElement('div');el.innerHTML=html;return {history:el.querySelector('[data-series="history"]').getAttribute('points').split(' '),forecast:el.querySelector('[data-series="forecast"]').getAttribute('points').split(' ')};};
 const html=clientOutput_xHistoryChart(funds), normal=parse(html);
 funds[1].rows[0].purchaseDate='2024-09-20';const topup=parse(clientOutput_xHistoryChart(funds));
 return {normal,topup,html};
 });
 assert.equal(connectedChart.normal.history.length,2);
 assert.equal(connectedChart.normal.history.at(-1),connectedChart.normal.forecast[0]);
 assert(Number(connectedChart.normal.history[0].split(',')[1])>Number(connectedChart.normal.history[1].split(',')[1]));
 assert.equal(connectedChart.topup.history[1].split(',')[0],connectedChart.topup.history[2].split(',')[0]);
 assert.equal(connectedChart.topup.history.at(-1),connectedChart.topup.forecast[0]);
 const chartPreview=await context.newPage();await chartPreview.setContent('<style>body{font-family:Arial;max-width:1000px}.sim-chart{width:100%}.chart-label{font-size:12px;fill:#64748b}</style>'+connectedChart.html);await chartPreview.screenshot({path:'/private/tmp/crm-connected-chart.png'});await chartPreview.close();
 results.push('History aggregates initial deposits, connects to current value and preserves later top-up jumps');
 const interactive=await page.evaluate(()=>{
   const now=liquidity_localDate(today()).getTime(), earlier=liquidity_localDate('2023-09-20').getTime();
   const model={start:earlier,now,end:liquidity_addMonths(new Date(now),108).getTime(),funds:[{name:'Fond A',current:166627,rate:8,color:'#0b3558',positions:[{date:earlier,invested:130000,current:166627}]},{name:'Fond B',current:146487,rate:4,color:'#2aa7b8',positions:[{date:earlier,invested:120000,current:146487}]}]};
   const base=portfolioTimelineValue(model,now),future=portfolioTimelineValue(model,model.end),past=portfolioTimelineValue(model,earlier);
   const funds=model.funds.map((f,i)=>({area:'Investice',key:'qa-'+i,product:f.name,company:'Společnost '+i,amount:f.current,invested:f.positions[0].invested,valueDate:today(),rows:[{sourceType:'deal',date:'2023-09-20',purchaseDate:'2023-09-20',current:f.current,invested:f.positions[0].invested}]}));
   const html='<!doctype html><html><head><style>'+clientOutput_xCss()+portfolioTimelineCss()+'</style></head><body><div class="wrap">'+portfolioTimelineHtml(funds)+'</div><script>'+portfolioTimelineValue.toString()+'\n'+portfolioTimelineSelect.toString()+'</'+'script></body></html>';
   return {base,future,past,html};
 });
 assert.equal(interactive.base.total,313114);assert.equal(interactive.past.total,250000);assert(interactive.future.total>interactive.base.total);
 assert(interactive.future.values[0]/interactive.future.total>interactive.base.values[0]/interactive.base.total);
 const offline=await context.newPage();await offline.setContent(interactive.html);
 const initialDonut=await offline.locator('.timeline-donut').getAttribute('style');
 await offline.locator('input[type=range]').evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.equal(await offline.locator('.timeline-status').innerText(),'Prognóza');assert.notEqual(await offline.locator('.timeline-donut').getAttribute('style'),initialDonut);
 assert.equal(await offline.locator('.timeline-total').innerText(),await offline.locator('.timeline-value').innerText());
 const svgBox=await offline.locator('svg').boundingBox();await offline.mouse.move(svgBox.x+svgBox.width*.75,svgBox.y+svgBox.height*.5);
 assert.equal(await offline.locator('.timeline-status').innerText(),'Prognóza');
 await offline.screenshot({path:'/private/tmp/crm-interactive-timeline.png',fullPage:true});
 await offline.locator('.timeline-reset').click();assert.equal(await offline.locator('.timeline-value').innerText(),'313 114 Kč');
 await offline.locator('input[type=range]').focus();await offline.keyboard.press('ArrowRight');assert.equal(await offline.locator('.timeline-status').innerText(),'Prognóza');await offline.close();
 const providerFiltering=await page.evaluate(()=>{
   const added={...state.deals.find(d=>d.id===20),id:991,company:'Druhá společnost',product:'Druhý fond',amount:50000};state.deals.push(added);
   showView('investments');selectInvestmentClient(1);
   setClientProvider('investice',1,encodeURIComponent('Druhá společnost'));
   const filtered=byId('investmentDetail').querySelector('.fki-work-list').innerText;
   setClientProvider('investice',1,'');const all=byId('investmentDetail').querySelector('.fki-work-list').innerText;
   showView('clients');selectClient(1);clientSection='portfolio';renderClients();setClientProvider('portfolio',1,encodeURIComponent('Druhá společnost'));
   const card=byId('clientDetail').querySelector('.portfolio-grid').innerText;setClientProvider('portfolio',1,'');
   showView('pensions');selectPensionClient(1);const pensions=byId('pensionDetail').querySelector('.provider-filter').innerText;
   state.deals=state.deals.filter(d=>d.id!==991);renderAll();return {filtered,all,card,pensions};
 });
 assert(providerFiltering.filtered.includes('Druhý fond'));assert(!providerFiltering.filtered.includes('Test klasický fond'));assert(providerFiltering.all.includes('Test klasický fond'));assert(providerFiltering.card.includes('Druhý fond'));assert(!providerFiltering.card.includes('Test klasický fond'));assert(providerFiltering.pensions.includes('Všechny společnosti'));
 results.push('Offline linked timeline hover, slider, reset, allocations and per-client provider filters');
 const overviewUpdates=await page.evaluate(()=>{
   const ordered=['Oportunita','Ve schvalování','Schváleno','Čekám na podklady'].map(status=>({o:{status},c:findClient(1)})).sort(compareOpportunities).map(x=>x.o.status);
   showView('contracts');setContractSection('hypoteky');
   const metrics=[...byId('contractMetrics').children].map(x=>Math.round(x.getBoundingClientRect().top));
   const rateWidth=byId('mortgageRatePanel').getBoundingClientRect().width;
   showView('pensions');setPensionMode('companies');
   const company=byId('pensionDetail').querySelector('details.company-portfolio');
   company.querySelector('summary').click();
   const pensionExpanded=company.open, pensionClients=company.querySelector('.company-clients').innerText;
   company.querySelector('.company-clients button').click();
   const pensionSelected=pensions_selectedPensionClientId;
   showView('investments');setInvestmentMode('aum');
   const investmentCompanies=byId('investmentDetail').querySelectorAll('details.company-portfolio').length;
   const fund=investmentFundItems()[0];selectedInvestmentFundKey=null;selectInvestmentFund(encodeURIComponent(fund.key));
   const fundClients=byId('investmentDetail').textContent.includes('Klienti ve fondu');
   return {ordered,metrics,rateWidth,pensionExpanded,pensionClients,pensionSelected,investmentCompanies,fundClients};
 });
 await page.screenshot({path:'/private/tmp/crm-company-overview.png'});
 assert.deepEqual(overviewUpdates.ordered,['Schváleno','Ve schvalování','Čekám na podklady','Oportunita']);
 assert.equal(new Set(overviewUpdates.metrics).size,1);assert(overviewUpdates.rateWidth<400);
 assert(overviewUpdates.pensionExpanded);assert(overviewUpdates.pensionClients.includes('Testovací klient'));assert(overviewUpdates.pensionSelected);
 assert(overviewUpdates.investmentCompanies>0);assert(overviewUpdates.fundClients,JSON.stringify({overviewUpdates,errors}));
 results.push('Compact contract summary, priority opportunities and company/fund client drill-downs');

 for(const view of await page.locator('.tab[data-view]').evaluateAll(xs=>xs.map(x=>x.dataset.view))){await page.locator(`.tab[data-view="${view}"]`).click();assert(await page.locator('#'+view).isVisible());}
 results.push('14 populated views');
 await page.evaluate(()=>{showView('clients');selectClient(1);clientSection='overview';renderClientDetail()});
 const aum=await page.evaluate(()=>{const pension=clientPensionSummary(1).total,total=clientInvestmentSummary(1).total+pension,text=byId('clientDetail').innerText;return{pension,total,hasLabel:text.includes('AUM klienta celkem'),hasTotal:text.includes(money(total))}});
 assert.equal(aum.pension,1500);assert(aum.hasLabel);assert(aum.hasTotal);results.push('Client AUM includes pensions separately');
 const clientContact=await page.evaluate(()=>{const c=findClient(1);c.address='Testovací 1, Praha';renderClientDetail();return{age:clientAgeFromBirthId(c.birthId),ageText:byId('clientDetail').querySelector('.client-age')?.textContent||'',phoneCopies:byId('clientDetail').querySelectorAll('.contact-grid .contact-value').length,phoneCall:byId('clientDetail').querySelector('a[href^="tel:"]')?.textContent,emailCopy:[...byId('clientDetail').querySelectorAll('.contact-actions .copy-btn')].some(x=>x.textContent==='Kopírovat'),addressMap:byId('clientDetail').querySelector('.contact-actions a[href^="https://maps.google.com/"]')?.textContent}});
 assert(clientContact.age!==null);assert(clientContact.ageText.includes(String(clientContact.age)));assert.equal(clientContact.phoneCopies,3);assert.equal(clientContact.phoneCall,'Volat');assert(clientContact.emailCopy);assert.equal(clientContact.addressMap,'Mapa');results.push('Client age and contact copy actions');
 const referralLinks=await page.evaluate(()=>{const source=findClient(1),target=findClient(2);target.leadType='tipar';target.leadSource=clientName(source);target.leadDate='2026-03-01';state.referrals.push({id:51,from:clientName(source),to:'Nováková Eva',topic:'Doporučení na investice',date:'2026-04-02'});selectedClientId=1;clientSection='overview';renderClientDetail();const overview=byId('clientDetail').innerText;const chip=[...byId('clientDetail').querySelectorAll('.chips button')].find(x=>x.textContent.includes('Natipoval'));chip.click();const recommendations=byId('clientDetail').innerText;clientSection='overview';renderClientDetail();const openTarget=[...byId('clientDetail').querySelectorAll('.referral-overview button')].find(x=>x.textContent==='Otevřít klienta');openTarget.click();return{overview,recommendations,targetOverview:byId('clientDetail').innerText,selected:selectedClientId,tipCount:clientTiparLeads(source),recommendationCount:clientGivenRecommendations(source)}});
 assert(referralLinks.overview.includes('Testovací klient Beta'));assert(referralLinks.overview.includes('Nováková Eva'));assert(referralLinks.recommendations.includes('Koho klient doporučil nebo natipoval'));assert(referralLinks.recommendations.includes('Testovací klient Beta'));assert(referralLinks.targetOverview.includes('Klienta přivedl typař'));assert(referralLinks.targetOverview.includes('Testovací klient Alfa'));assert.equal(referralLinks.selected,2);assert.equal(referralLinks.tipCount,1);assert.equal(referralLinks.recommendationCount,1);results.push('Client card lists and opens named tips and recommendations');
 const productLinks=await page.evaluate(()=>{showView('clients');selectClient(1);clientSection='portfolio';renderClientDetail();byId('clientDetail').querySelector('[data-portfolio-area="fki"] button').click();const fki={visible:byId('fki').classList.contains('active'),selected:selectedFkClientId,detail:byId('fkDetail').innerText,hidden:byId('fki').querySelector('.investment-shell').classList.contains('clients-hidden'),button:byId('fkClientListToggle').textContent};toggleInvestmentClientList('fki');fki.revealed=!byId('fki').querySelector('.investment-shell').classList.contains('clients-hidden');showView('clients');clientSection='portfolio';renderClientDetail();byId('clientDetail').querySelector('[data-portfolio-area="investice"] button').click();return{fki,investment:{visible:byId('investments').classList.contains('active'),selected:selectedInvestmentClientId,detail:byId('investmentDetail').innerText,hidden:byId('investments').querySelector('.investment-shell').classList.contains('clients-hidden'),button:byId('investmentClientListToggle').textContent}}});
 assert(productLinks.fki.visible);assert.equal(productLinks.fki.selected,1);assert(productLinks.fki.detail.includes('Testovací klient Alfa'));assert(productLinks.fki.hidden);assert.equal(productLinks.fki.button,'Zobrazit klienty');assert(productLinks.fki.revealed);assert(productLinks.investment.visible);assert.equal(productLinks.investment.selected,1);assert(productLinks.investment.detail.includes('Testovací klient Alfa'));assert(productLinks.investment.hidden);assert.equal(productLinks.investment.button,'Zobrazit klienty');results.push('Client product links retain the selected client and hide other clients');
 const taxTests=await page.evaluate(()=>{const classicKey=investmentFundKey(classicInvestmentItems().find(x=>String(x.clientId||x.client?.id)==='1'));const fkiRow=fkClientRows().find(r=>String(r.client?.id)==='1');const fkiItem=fkiRow.items[0];state.fundValues[classicKey]={...(state.fundValues[classicKey]||{}),area:'investice',taxMonths:36};state.fundValues[fkiItem.key]={...(state.fundValues[fkiItem.key]||{}),area:'fki',taxMonths:36};showView('investments');selectInvestmentClient(1);const investmentText=byId('investmentDetail').innerText;showView('fki');selectFkClient(1);const fkiText=byId('fkDetail').innerText;const items=clientOutput_xClientInvestments(findClient(1));const classic=items.find(x=>x.area==='Investice');const reportFund=clientOutput_xFundDetail(classic,0,false);return{leap:liquidity_liquidityInfo('investice',classicKey,classic.isin,'2024-02-29').taxReady,regular:liquidity_liquidityInfo('investice',classicKey,classic.isin,'2026-01-10').taxReady,unknown:liquidity_investmentTaxStart({sourceType:'snapshot',date:'2026-09-01',snapshot:{date:'2026-09-01'}}),investmentText,fkiText,reportFund}});
 assert.equal(taxTests.leap,'2027-02-28');assert.equal(taxTests.regular,'2029-01-10');assert.equal(taxTests.unknown,'');assert(taxTests.investmentText.includes('10. 1. 2029'));assert(taxTests.fkiText.includes('10. 2. 2029'));assert(taxTests.reportFund.includes('10. 1. 2029'));assert(!taxTests.reportFund.includes('<small>Časový test</small><b>k '));results.push('36-month tax test uses purchase date in client cards and report');
 const forecastBase=await page.evaluate(()=>{const managedBefore=clientInvestmentSummary(1).total,reportBefore=reportInvestmentItems().reduce((s,x)=>s+(+x.amount||0),0);selectedClientId=1;openExternalInvestmentModal(1);setVal('externalProduct','Externí portfolio');setVal('externalCompany','Jiný správce');setVal('externalCurrent','500000');setVal('externalInvested','450000');setVal('externalMonthly','2000');setVal('externalRate','4');setVal('externalAsset','Smíšené');saveExternalInvestment();openInvestmentScenarioModal(1,'Investice');return{managedBefore,managedAfter:clientInvestmentSummary(1).total,reportBefore,reportAfter:reportInvestmentItems().reduce((s,x)=>s+(+x.amount||0),0)}});await page.waitForTimeout(100);
 const forecastSetup={...forecastBase,...await page.evaluate(()=>{setVal('scenarioForecastName','Test klientských variant');setVal('scenarioYears','10');setVal('scenarioSaveMode','forecast');investmentScenario.rows=[{key:'Investice|test-classic',area:'Investice',company:'Test invest',product:'Test nový nákup',amount:100000,monthly:1500,rate:6,minRate:4,maxRate:8,funding:'new'},{key:'FKI|test-fki',area:'FKI',company:'Test FKI',product:'Test nový nákup FKI',amount:300000,monthly:0,rate:8,minRate:6,maxRate:10,funding:'new'}];const positions=scenario_currentPositions(),external=positions.find(x=>x.sourceType==='external'),managed=positions.find(x=>x.sourceType==='managed'),targets=scenario_catalog().slice(0,2);investmentScenario.rows.push({...targets[0],amount:60000,monthly:0,funding:'reinvest',salePositionId:external.positionId,newTaxTest:true,source:'Nový nákup z odprodeje Externí portfolio'},{...targets[1],amount:40000,monthly:0,funding:'reinvest',salePositionId:external.positionId,newTaxTest:true,source:'Nový nákup z odprodeje Externí portfolio'});investmentScenario.dispositions={[managed.positionId]:{action:'transfer',amount:50000,targetKey:targets[0].key}};scenario_reconcileReinvestments();renderInvestmentScenario();scenario_syncActiveVariant();const first=investmentScenario.variants[0];first.name='Alternativa A';const pA=scenario_projection({years:10,rows:first.rows,dispositions:first.dispositions,externalRows:investmentScenario.externalRows});scenario_addVariant();scenario_renameVariant('Alternativa B');scenario_syncActiveVariant();const oldAlert=window.alert;window.alert=()=>{};scenario_addVariant();window.alert=oldAlert;const p=scenario_projection();return{external:p.externalAum,current:p.current,improvement:p.improvement,start:p.totalSeries[0],today:p.yearRows[0].total,weighted:p.weighted,plannedExisting:p.plannedExistingCapital,plannedNew:p.plannedNewCapital,variantA:{sold:pA.soldTotal,transfer:pA.transferTotal,newMoney:pA.newMoney,reinvested:pA.reinvestedTotal,start:pA.startingValue},variantCount:investmentScenario.variants.length,chartLabels:investmentScenarioChartInstance.data.datasets.map(x=>x.label),panel:byId('scenarioAdvancedControls').textContent,minRateField:!!byId('scenarioMinRate'),rangeBlock:!!byId('scenarioRangeBlock'),positionPlan:byId('scenarioCurrentPortfolio').textContent,opps:state.opportunities.length,deals:state.deals.length}})};
 assert.equal(forecastSetup.managedAfter,forecastSetup.managedBefore);assert.equal(forecastSetup.reportAfter,forecastSetup.reportBefore);assert.equal(forecastSetup.external,500000);assert(forecastSetup.current>forecastSetup.managedBefore);assert.equal(forecastSetup.start,forecastSetup.current+400000);assert.equal(forecastSetup.today,forecastSetup.start);assert(forecastSetup.weighted>0&&forecastSetup.weighted<20);assert(forecastSetup.plannedExisting>0);assert(forecastSetup.plannedNew>0);assert.equal(forecastSetup.variantCount,2);assert.equal(forecastSetup.variantA.sold,100000);assert.equal(forecastSetup.variantA.transfer,50000);assert.equal(forecastSetup.variantA.newMoney,400000);assert.equal(forecastSetup.variantA.reinvested,100000);assert.equal(forecastSetup.variantA.start,forecastSetup.current-100000+500000);assert.deepEqual(forecastSetup.chartLabels,['Očekávaný vývoj']);assert(forecastSetup.panel.includes('Průměrné očekávané zhodnocení'));assert(forecastSetup.panel.includes('nový časový test'));assert(forecastSetup.positionPlan.includes('rozděleno do nových nákupů'));assert(!forecastSetup.panel.includes('Optimisticky'));assert.equal(forecastSetup.minRateField,false);assert.equal(forecastSetup.rangeBlock,false);assert(forecastSetup.improvement>0);await page.screenshot({path:'/private/tmp/crm-investment-forecast.png',fullPage:true});
 const forecastSaved=await page.evaluate(before=>{saveInvestmentScenario();const saved=state.investmentForecasts.at(-1);return{saved,opps:state.opportunities.length,deals:state.deals.length,activity:state.activities.find(x=>x.type==='Investiční prognóza'&&x.clientId===1),panel:byId('clientDetail').innerText}},forecastSetup);
 assert(forecastSaved.saved);assert.equal(forecastSaved.saved.variants.length,2);assert.equal(forecastSaved.opps,forecastSetup.opps);assert.equal(forecastSaved.deals,forecastSetup.deals);assert(forecastSaved.activity);assert(forecastSaved.panel.includes('Test klientských variant'));results.push('External assets stay outside AUM and saved variants create no business');
 const forecastDownload=page.waitForEvent('download');await page.evaluate(id=>downloadSavedInvestmentForecast(id),forecastSaved.saved.id);const forecastFile=await forecastDownload;const forecastHtml=fs.readFileSync(await forecastFile.path(),'utf8');assert(forecastHtml.includes('Aktuální portfolio'));assert(forecastHtml.includes('Fondy'));assert(forecastHtml.includes('Segmenty'));assert(forecastHtml.includes('Likvidita'));assert(forecastHtml.includes('Alternativa A'));assert(forecastHtml.includes('Alternativa B'));assert(forecastHtml.includes('novými časovými testy'));assert(forecastHtml.includes('Dopad na celé portfolio'));assert(forecastHtml.includes('Původní fond')||forecastHtml.includes('Externí portfolio →'));const forecastPage=await context.newPage();await forecastPage.setViewportSize({width:850,height:1180});await forecastPage.setContent(forecastHtml);await forecastPage.screenshot({path:'/private/tmp/crm-investment-variants-report.png',fullPage:true});const forecastPdf=await forecastPage.pdf({path:'/private/tmp/crm-investment-variants-report.pdf',format:'A4',printBackground:true});assert(forecastPdf.length>10000);assert.equal(forecastPdf.subarray(0,4).toString(),'%PDF');await forecastPage.close();results.push('Saved investment variants download as a detailed portrait comparison');
 await page.evaluate(id=>openSavedInvestmentForecast(id),forecastSaved.saved.id);await page.waitForTimeout(100);const reopenedForecast=await page.evaluate(()=>({open:byId('investmentScenarioModal').classList.contains('show'),name:val('scenarioForecastName'),external:(investmentScenario.externalRows||[]).length,proposal:(investmentScenario.rows||[]).length,variants:(investmentScenario.variants||[]).length,dispositions:Object.keys(investmentScenario.dispositions||{}).length}));assert(reopenedForecast.open);assert.equal(reopenedForecast.name,'Test klientských variant');assert.equal(reopenedForecast.external,1,'saved external rows');assert.equal(reopenedForecast.proposal,4,'saved proposal rows');assert.equal(reopenedForecast.variants,2,'saved variants');assert(reopenedForecast.dispositions>=2,'saved sale and transfer');await page.evaluate(()=>closeModal('investmentScenarioModal'));results.push('Saved investment variants reopen for further client work');
 const familyCheck=await page.evaluate(()=>{selectedClientId=1;openFamilyLink(1);setVal('familyPerson','2');setVal('familyType','child');byId('familyManaged').checked=true;saveFamilyLink();const forward=findClient(1).familyLinks[0],reverse=findClient(2).familyLinks[0];openFamilyLink(1);setVal('familyName','Test dítě rodiny');saveFamilyLink();const created=state.clients.find(c=>c.name==='Test dítě rodiny');const restored=normalizeState(JSON.parse(JSON.stringify(state)));return {forward,reverse,created:!!created,preserved:restored.clients.find(c=>c.id===1).familyLinks.length};});
 assert.equal(familyCheck.forward.type,'child');assert.equal(familyCheck.reverse.type,'parent');assert(familyCheck.forward.managedByParent);assert(familyCheck.created);assert.equal(familyCheck.preserved,2);results.push('Family links are reciprocal, support new clients and survive backup normalization');
 const payoutCheck=await page.evaluate(()=>{const d=state.deals[0];d.owner='Test tipař';d.ownerType='tipar';d.ownerPaid=false;openOwnerLedger('Test tipař');const before=byId('ownerLedgerModal').innerText;setVal('ownerDate'+d.id,'2026-09-20');setVal('ownerNote'+d.id,'Ověřeno v bankovním výpisu');recordOwnerPayment(d.id,true);const result={before,paid:d.ownerPaid,date:d.ownerPaidDate,history:d.ownerPaymentHistory.length,after:byId('ownerLedgerModal').innerText};closeModal('ownerLedgerModal');return result;});assert(payoutCheck.before.includes('Bez záznamu výplaty'));assert(payoutCheck.paid);assert.equal(payoutCheck.date,'2026-09-20');assert.equal(payoutCheck.history,1);assert(payoutCheck.after.includes('Vyplaceno'));results.push('Referrer payment ledger records date and audit history');
 await page.setViewportSize({width:1920,height:1080});assert(await page.locator('.app').evaluate(el=>el.getBoundingClientRect().width>1850));await page.screenshot({path:'/private/tmp/crm-family-wide.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const campaign=await page.evaluate(()=>{showView('campaigns');setVal('campaignSenderEmail','advisor@example.test');setVal('campaignName','Test investiční kampaně');setVal('campaignSubject','Test investiční novinky');setVal('campaignBody','Dobrý den, toto je testovací zpráva.');setVal('campaignSegment','investice');renderCampaignRecipients(true);const candidates=campaignRecipientRows.map(x=>x.client.id);window.__campaignMailto='';campaignLaunchMailto=url=>window.__campaignMailto=url;confirmCampaignEmail();const saved=state.campaigns.at(-1);return{candidates,saved,activity:state.activities.find(x=>x.campaignId===saved?.id),mailto:window.__campaignMailto,history:byId('campaignHistory').innerText}});
 assert.deepEqual(campaign.candidates,[1]);assert.deepEqual(campaign.saved.recipientIds,[1]);assert.equal(campaign.activity.type,'Smart emailing');assert(campaign.mailto.startsWith('mailto:advisor%40example.test?'));assert(campaign.mailto.includes('bcc=alfa%40example.test'));assert(campaign.history.includes('Test investiční kampaně'));results.push('Campaign selection, BCC handoff and client history');
 await page.screenshot({path:'/private/tmp/crm-unified-campaigns.png',fullPage:true});
 await page.evaluate(()=>openInvestmentSnapshotModal(1));
 assert(await page.locator('#investmentSnapshotModal').innerText().then(t=>t.includes('Datum investice klienta')&&t.includes('Aktuální hodnota CP')&&t.includes('Ruční AUM')));
 assert.equal(await page.locator('#isFundNavDate').getAttribute('type'),'date');
 await page.screenshot({path:'/private/tmp/crm-investment-position-modal.png',fullPage:true});
 await page.evaluate(()=>closeModal('investmentSnapshotModal'));
 for(const expr of ["selectClient(1)","selectInvestmentClient(1)","selectFkClient(1)","selectPensionClient(1)","openClientModal(1)","openContractModal(1,10)","openDealModal(1,20)","openOpportunityModal(1,30)","openActivityModal(1,40)","openInvestmentFundModal()","openFkFundModal()","openInvestmentScenarioModal(1,'FKI')"]){await page.evaluate(expr);await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(x=>x.classList.remove('show')))}
 results.push('Client, investment, pension and editing dialogs');
 // Exercise real downloads; generated reports must be usable as independent files.
 for(const [name,action] of [['client',"openClientReportModal(1);downloadClientReport()"],['fki',"downloadFkClientReport(1)"],['scenario',"openInvestmentScenarioModal(1,'FKI');investmentScenario.rows=[{key:'test-fki',area:'FKI',company:'Test FKI',product:'Test FKI fond',isin:'TEST00000002',amount:50000,rate:7,minRate:4,maxRate:9}];downloadInvestmentScenario()"]]){
  const pending=page.waitForEvent('download');await page.evaluate(action);const download=await pending;assert(download.suggestedFilename().endsWith('.html'));
  const report=fs.readFileSync(await download.path(),'utf8');assert(report.includes('Testovací klient Alfa'));assert(!report.includes('NaN'));assert(!report.includes('undefined'));
  if(name==='scenario'){assert(report.includes('Skladba nového nákupu'));assert(report.includes('Model vývoje portfolia'));assert(report.includes('Navržené fondy'));assert(report.includes('Test FKI fond'));}
  const reportPage=await context.newPage();await reportPage.setContent(report);await reportPage.waitForTimeout(150);assert((await reportPage.locator('body').innerText()).length>100);if(name==='client'){assert(await reportPage.locator('.report-fund-overview').count());assert.equal(await reportPage.locator('.report-transactions').first().getAttribute('open'),null);await reportPage.locator('.report-transactions summary').first().click();assert(await reportPage.locator('.fund-transactions').first().isVisible());await reportPage.locator('.report-transactions summary').first().click();await reportPage.locator('.portfolio-timeline input').evaluate(el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}));});await reportPage.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await reportPage.locator('.timeline-date').innerText(),new Date().toLocaleDateString('cs-CZ'));assert(await reportPage.locator('.fund-transactions').first().isVisible());await reportPage.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await reportPage.locator('.timeline-status').innerText(),'Prognóza');}if(name==='client')await reportPage.locator('.report-fund-detail').first().screenshot({path:'/private/tmp/crm-compact-fund.png'});if(name==='client'||name==='fki'){assert(report.includes('Kdy můžete mít prostředky zpět'));await reportPage.locator('.report-redemption').first().screenshot({path:'/private/tmp/crm-redemption-'+name+'.png'});}if(name==='scenario')await reportPage.screenshot({path:'/private/tmp/crm-investment-purchase-report.png',fullPage:true});const pdf=await reportPage.pdf({format:'A4',printBackground:true,...(name==='client'?{path:'/private/tmp/crm-client-layout.pdf'}:{})});assert(pdf.length>10000);await reportPage.close();
  results.push(name+' HTML download opens independently');
 }
 await page.evaluate(()=>{document.querySelectorAll('.modal.show').forEach(x=>x.classList.remove('show'));showView('referrers');setVal('quickCallDate','2026-09-16');setVal('quickCallOutcome','realized');setVal('quickCallNext','Schůzka');setVal('quickCallNextDate','2026-09-23');saveQuickAnalysis('call')});
 const dates=await page.evaluate(()=>state.analysisEntries.slice(-2).map(x=>x.date));assert.deepEqual(dates,['2026-09-16','2026-09-23']);results.push('Call and follow-up use separate dates');

 // Create and edit a client through the production form handlers.
 const newId=await page.evaluate(()=>{openClientModal();setVal('cName','Test nový klient');setVal('cEmail','new@example.test');saveClient();return state.clients.find(c=>c.name==='Test nový klient').id});
 assert(newId);await page.evaluate(id=>{openClientModal(id);setVal('cPhone','123456789');saveClient()},newId);
 assert.equal(await page.evaluate(id=>findClient(id).phone,newId),'123456789');results.push('Client creation and edit persist');
 const proposal=await page.evaluate(()=>{openInvestmentScenarioModal(1,'FKI');investmentScenario.rows=[{key:'test-fki',area:'FKI',company:'Test FKI',product:'Test návrh FKI',isin:'TEST00000003',amount:75000,rate:6}];setVal('scenarioSaveMode','proposal');const before=state.deals.length;saveInvestmentScenario();return {dealDelta:state.deals.length-before,found:state.opportunities.some(o=>o.product==='Test návrh FKI')}});
 assert.equal(proposal.dealDelta,0);assert(proposal.found);results.push('Investment proposal stays out of completed trades');
 const signed=await page.evaluate(()=>{openInvestmentScenarioModal(2,'FKI');investmentScenario.rows=[{key:'test-fki',area:'FKI',company:'Test FKI',product:'Test sjednané FKI',isin:'TEST00000004',amount:80000,rate:6}];setVal('scenarioSaveMode','signed');setVal('scenarioSignedDate','2026-09-16');const before=state.deals.length;saveInvestmentScenario();return {dealDelta:state.deals.length-before,records:investmentRecordsForClient(2).length}});
 assert.equal(signed.dealDelta,1);assert(signed.records>0);results.push('Signed FKI creates trade and linked holding');
 const restore=await page.evaluate(()=>{const saved=JSON.parse(JSON.stringify(state));const expected=state.clients.length;state.clients.push({id:999,name:'Temporary test'});restoreIncomingStateFromGoogle(saved,'qa');return state.clients.length===expected});assert(restore);results.push('Backup restore preserves complete state schema');
 const queue=await page.evaluate(async()=>{
  clearTimeout(diskSaveTimer);diskLoadDone=true;diskSaveInFlight=false;diskSavePending=false;
  const originalFetch=window.fetch;let respond;const bodies=[];
  window.fetch=async(url,opts)=>{bodies.push(JSON.parse(opts.body).state);return new Promise(resolve=>respond=()=>resolve({ok:true,json:async()=>({ok:true,state:bodies[bodies.length-1],counts:{}})}))};
  const request=saveStateToDisk('test');state.clients[0].note='new edit during slow save';await saveStateToDisk('second edit');respond();await request;
  const retained=state.clients[0].note==='new edit during slow save';
  clearTimeout(diskSaveTimer);const follow=saveStateToDisk('follow-up');respond();await follow;window.fetch=originalFetch;diskLoadDone=false;
  return {retained,latest:bodies[1].clients[0].note};
 });assert(queue.retained);assert.equal(queue.latest,'new edit during slow save');results.push('Slow disk response cannot overwrite newer edits');
 await page.evaluate(()=>{showView('dashboard');const a=state.activities.find(x=>x.id===40);a.completed=false;a.date=today();renderDashboard()});
 await page.locator('[data-dash-action="done"][data-id="40"]').click();assert.equal(await page.evaluate(()=>state.activities.find(x=>x.id===40).outcome),'realized');results.push('Dashboard uses the shared activity completion action');
 await page.evaluate(()=>{showView('fki');selectFkClient(1)});await page.screenshot({path:'/private/tmp/crm-unified-fki.png',fullPage:true});
 await page.setViewportSize({width:834,height:1112});await page.screenshot({path:'/private/tmp/crm-unified-ipad.png',fullPage:true});results.push('iPad viewport rendered');

 const replacementSession=await session(root),rp=replacementSession.page;
 const replacement=await rp.evaluate(()=>{
   state.contracts.push({id:88001,clientId:1,type:'hypotéka',company:'Původní banka',product:'Hypotéka',number:'OLD',amount:'2500000',rate:'2.59',anniv:'2027-11-23',status:'',note:'Původní podmínky',log:[]});
   const count=state.contracts.length;
   startReplacementCase(88001);setVal('oProduct','Nová hypotéka');setVal('oCompany','Nová banka');setVal('oAmount','2500000');setVal('oBj','100');setVal('oContractRate','5.39');setVal('oContractAnniv','2030-11-23');setVal('oDealDate',today());saveOpportunity();
   const o=state.opportunities.at(-1),linkedOriginal=String(o.replacesContractId)==='88001';
   updateOpportunityStatus(o.id,'Podepsáno');
   const prefill={rate:val('dContractRate'),fix:val('dContractAnniv'),date:val('dDate'),bj:val('dBj')};
   setVal('dReplacementContract','88001');setVal('dReplacementEffective','2099-01-01');setVal('dContractNumber','NEW');setVal('dContractStatus','podepsano');setVal('dCreateContract','yes');saveDeal();
   const d=state.deals.find(x=>x.fromOpportunityId===o.id),current=state.contracts.find(x=>String(x.id)===String(d.contractId));
   const after={number:current.number,rate:current.rate,fix:current.anniv,effective:current.effectiveDate,count:state.contracts.length,history:current.replacementHistory[0].contract,oldRemoved:!state.contracts.some(x=>x.id===88001),done:!d.pendingContract};
   return {linkedOriginal,prefill,after,count,historyCount:current.replacementHistory.length,today:today(),newContractId:current.id};
 });
 assert(replacement.linkedOriginal);assert.deepEqual(replacement.prefill,{rate:'5.39',fix:'2030-11-23',date:replacement.today,bj:'100'});
 assert.equal(replacement.after.number,'NEW');assert.equal(replacement.after.count,replacement.count);assert.equal(replacement.after.rate,'5.39');assert.equal(replacement.after.fix,'2030-11-23');assert.equal(replacement.after.effective,'2099-01-01');assert.equal(replacement.after.history.number,'OLD');assert.equal(replacement.after.history.rate,'2.59');assert.equal(replacement.after.history.anniv,'2027-11-23');assert(replacement.after.oldRemoved);assert(replacement.after.done);assert.equal(replacement.historyCount,1);
 await rp.evaluate(id=>{persist();openContractModal(1,id)},replacement.newContractId);await rp.screenshot({path:'/private/tmp/crm-new-replacement.png',fullPage:true});
 await rp.reload();await rp.waitForTimeout(700);assert.equal(await rp.evaluate(()=>state.contracts.find(x=>x.number==='NEW').replacementHistory.length),1);

 const later=await rp.evaluate(replacedId=>{
   openDealModal(1);setVal('dCategory','Hypotéky');setVal('dCompany','Třetí banka');setVal('dProduct','Nové refinancování');setVal('dAmount','2400000');setVal('dBj','120');setVal('dCreateContract','yes');setVal('dContractType','hypotéka');setVal('dContractStatus','podepsano');setVal('dContractNumber','LATER');saveDeal();
   const d=state.deals.at(-1),standalone=d.contractId,count=state.contracts.length;
   openDealModal(1,d.id);setVal('dReplacementContract',String(replacedId));setVal('dReplacementEffective',today());saveDeal();
   const current=state.contracts.find(x=>x.number==='LATER');
   return {count:state.contracts.length,expected:count-1,standaloneGone:!state.contracts.some(x=>x.id===standalone),replacedGone:!state.contracts.some(x=>x.id===replacedId),current:current?.number,linked:d.contractId,dealId:d.id,history:current?.replacementHistory?.at(-1)?.contract?.number};
 },replacement.newContractId);
 assert.equal(later.count,later.expected);assert(later.standaloneGone);assert(later.replacedGone);assert.equal(later.current,'LATER');assert.equal(later.history,'NEW');assert.notEqual(later.linked,replacement.newContractId);
 await rp.evaluate(id=>openDealModal(1,id),later.dealId);await rp.screenshot({path:'/private/tmp/crm-independent-trade-form.png',fullPage:true});
 assert.deepEqual(replacementSession.errors,[]);await replacementSession.context.close();
 results.push('Replacement case links the original contract, replaces it immediately and preserves its history with a future effective date');
 const savedCases=await page.evaluate(()=>JSON.stringify(state));
 await page.evaluate(()=>{
   state.opportunities=[{id:99001,clientId:1,product:'Hypotéka QA',category:'Hypotéka',status:'Oportunita',amount:2500000,updatedAt:'2026-09-01',history:[]},{id:99002,clientId:1,product:'Investice QA',category:'Investice',status:'Schváleno',amount:300000,updatedAt:'2026-09-15',history:[]}];
   window.businessCaseFilters={query:'QA',category:'',status:'',sort:'status'};showView('opportunities');
 });
 assert.equal(await page.locator('#opportunityTable tbody tr').first().getAttribute('data-case-id'),'99002');
 assert.equal(await page.evaluate(()=>caseDays({updatedAt:'2026-09-01'},'2026-09-30')),29);
 assert.equal(await page.evaluate(()=>caseDays({})),null);
 assert.equal(await page.evaluate(()=>state.opportunities[0].status),'Oportunita');
 assert.equal(await page.locator('#opportunityTable [data-case-id="99001"] select').inputValue(),'Opportunity');
 await page.evaluate(()=>showView('pipeline'));
 assert.equal(await page.locator('#pipelineBoard .pipeline-column').count(),7);
 assert.equal(await page.locator('#pipelineBoard [data-stage="Opportunity"] [data-case-id="99001"]').count(),1);
 await page.locator('#pipelineBoard [data-case-id="99001"] select').selectOption('Scoring');
 assert.equal(await page.locator('#pipelineBoard [data-stage="Scoring"] [data-case-id="99001"]').count(),1);
 await page.locator('#pipelineBoard [data-case-id="99001"] select').selectOption('K zadání (BeTy)');
 assert.equal(await page.locator('#pipelineBoard [data-case-id="99001"] select').inputValue(),'K zadání (BeTy)');
 await page.setViewportSize({width:1800,height:1100});
 await page.locator('#pipelineBoard [data-case-id="99001"]').dragTo(page.locator('#pipelineBoard [data-stage="Kompletace"] header'));
 assert.equal(await page.evaluate(()=>state.opportunities[0].status),'Kompletace');
 await page.locator('#pipelineCategoryFilter').selectOption('Investice');
 assert.equal(await page.locator('#pipelineBoard .pipeline-card').count(),1);
 assert.equal(await page.locator('#oppCategoryFilter').inputValue(),'Investice');
 await page.evaluate(()=>{setCaseFilter('category','');updateOpportunityStatus(99001,'Podepsáno');closeModal('dealModal');renderAll()});
 assert.equal(await page.evaluate(()=>state.opportunities[0].status),'Kompletace');
 await page.evaluate(()=>{openOpportunityModal(1,99001);setVal('oStatus','Podepsáno');saveOpportunity();closeModal('dealModal');closeModal('opportunityModal');renderAll()});
 assert.equal(await page.evaluate(()=>state.opportunities[0].status),'Kompletace');
 assert.equal(await page.evaluate(()=>caseDays(state.opportunities[0])),0);
 const leadTracking=await page.evaluate(()=>{
   openOpportunityModal(1);const initial={status:val('oStatus'),next:val('oNextContactDate')};
   setVal('oProduct','Opportunity QA');setVal('oLastContactDate','2026-10-05');setVal('oLastContactMethod','Telefon');setVal('oNextContactDate','2026-10-12');setVal('oNote','Klient projevil zájem.');saveOpportunity();
   const o=state.opportunities.find(x=>x.product==='Opportunity QA');return {initial,contact:o.lastContactDate,method:o.lastContactMethod,next:o.nextContactDate,history:o.history.at(-1).t};
 });
 assert.deepEqual(leadTracking,{initial:{status:'Opportunity',next:''},contact:'2026-10-05',method:'Telefon',next:'2026-10-12',history:'Kontakt s klientem · Telefon'});
 results.push('Opportunity starts before an offer and records contact, next term and contact history');
 const serviceCases=await page.evaluate(()=>{
   const before=JSON.stringify(state.contracts);
   state.contracts.push({id:99881,clientId:1,type:'majetek',product:'QA původní byt',company:'Původní pojišťovna',amount:4269,status:'prepojistit',statuses:['prepojistit'],log:[]});
   state.contractOpportunityStatuses[99881]='Scoring';
   state.opportunities.push({id:99882,clientId:1,category:'Nemovitost',product:'QA nový byt',company:'Nová pojišťovna',amount:3800,bj:29,status:'Scoring'});
   const contract=JSON.stringify(state.contracts.at(-1));renderAll();
   const result={generated:allOpenOpportunities().some(o=>o.isContractOpportunity),newCount:allOpenOpportunities().filter(o=>o.id===99882).length,clientCount:clientOpenOpportunities(1).filter(o=>o.id===99882).length,serviceActive:isActiveContract(state.contracts.at(-1)),unchanged:JSON.stringify(state.contracts.at(-1))===contract};
   startReplacementCase(99881);result.category=val('oCategory');result.client=val('oClient');closeModal('opportunityModal');
   result.cancelCount=state.opportunities.filter(o=>o.id===99882).length;
   state.contracts=JSON.parse(before);state.opportunities=state.opportunities.filter(o=>o.id!==99882);delete state.contractOpportunityStatuses[99881];renderAll();
   return result;
 });
 assert.deepEqual(serviceCases,{generated:false,newCount:1,clientCount:1,serviceActive:true,unchanged:true,category:'Nemovitost',client:'1',cancelCount:1});
 assert.equal(await page.locator('#pipelineBoard [data-case-id^="contract_"]').count(),0);
 assert.equal(await page.locator('#opportunityTable [data-case-id^="contract_"]').count(),0);
 results.push('Service contracts stay outside pipeline and cases; explicit cases remain once; property category and original contract preserved');
 const volumes=await page.evaluate(()=>{
   const o=contractOpportunities().find(isOpenOpportunity), source=state.contracts.find(x=>String(x.id)===String(o.contractId)),original=source.amount;
   caseSetVolume(o.id,'2,5 mil');
   const amount=opportunityFromContract(source).amount;
   openContractModal(source.clientId,source.id);const form=val('sCaseVolume');closeModal('contractModal');
   openDealFromContract(source);const deal=val('dAmount');closeModal('dealModal');
   let invalid=false;try{caseSetVolume(o.id,'2.500.000 chybně')}catch{invalid=true}
   const untouched=source.amount===original;
   caseSetVolume(99001,'2 500 000 Kč');
   openOpportunityModal(1,99001);setVal('oAmount','2,5 mil');saveOpportunity();
   return {amount,form,deal,untouched,invalid,manual:state.opportunities[0].amount,zero:caseVolumeInput('0')};
 });
 assert.deepEqual(volumes,{amount:2500000,form:'2500000',deal:'2500000',untouched:true,invalid:true,manual:2500000,zero:0});
 results.push('Case volume accepts millions and spaced CZK, preserves contract payment and prefills trade volume');

 const management=await page.evaluate(()=>{
   const original=JSON.stringify(state),client=state.clients[0];
   client.managementPartnerId='mantra';
   state.deals.push({id:99931,clientId:client.id,managementPartnerId:'mantra',category:'Investice',product:'Mantra QA',date:'2026-10-04',amount:100000,bj:20,actualCommission:10000});
   const partner=managementPartner('mantra');partner.acquisitionSharePct=40;partner.trailSharePct=25;
   state.managementPayouts.push({id:99932,partnerId:'mantra',date:'2026-10-04',amount:3000,type:'acquisition'});
   showView('management');renderManagement();
   const result={defaultPartner:normalizeState({...def(),clients:[{id:91,name:'Starý klient'}]}).clients[0].managementPartnerId,ownAum:managementInvestmentItems(ownManagementId()).reduce((s,x)=>s+(+x.amount||0),0),mantraAum:managementInvestmentItems('mantra').reduce((s,x)=>s+(+x.amount||0),0),claim:managementClaimForDeal(state.deals.at(-1),partner),received:(state.managementPayouts||[]).filter(x=>x.partnerId==='mantra').reduce((s,x)=>s+(+x.amount||0),0),clientRows:document.querySelectorAll('#managementClientsTable tbody tr').length,dealRows:document.querySelectorAll('#managementDealsTable tbody tr').length};
   showView('clients');setVal('clientManagementFilter','mantra');renderClients();result.filteredClientRows=document.querySelectorAll('#clientList .client-row').length;result.filterValue=val('clientManagementFilter');
   state=JSON.parse(original);renderAll();return result;
 });
 assert.equal(management.defaultPartner,'filip');assert.equal(management.claim,4000);assert.equal(management.received,3000);assert(management.clientRows>=1);assert(management.dealRows>=1);assert.equal(management.filteredClientRows,1);assert.equal(management.filterValue,'mantra');assert(management.mantraAum>=0);assert(management.ownAum>=0);
 results.push('Management separates partner clients, trade claims, AUM and received payouts while migrating existing clients to Filip');

 await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>showView('pipeline'));await page.screenshot({path:'/private/tmp/crm-pipeline-desktop.png',fullPage:true});
 await page.setViewportSize({width:834,height:1112});await page.screenshot({path:'/private/tmp/crm-pipeline-ipad.png',fullPage:true});
 await page.evaluate(data=>{state=JSON.parse(data);window.businessCaseFilters={query:'',category:'',status:'',sort:'status'};renderAll()},savedCases);
 results.push('Business cases: legacy mapping, ordering, age, shared filters, two-way stages, drag/drop, service separation and cancelled conversion');
 console.log('current errors',errors);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:results},null,2));
 fs.writeFileSync('/private/tmp/crm-regression-results.json',JSON.stringify({passed:results},null,2));
 await old.context.close();await context.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
