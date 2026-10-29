// Transient render indexes must produce the same portfolio data as uncached reads.
// Only synthetic data in an isolated browser; no production CRM is opened.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext();
 await context.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname));return u.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}):route.abort();});
 await context.addInitScript(()=>localStorage.setItem('filip_crm_main_v1',JSON.stringify({clients:[],deals:[],contracts:[],investmentRecords:[],investmentSnapshots:[]})));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto('https://crm.test/FILIP-CRM.html');
 const result=await page.evaluate(()=>{
  const clients=[{id:1,name:'Alice Example',birthId:'9001010011',aliases:'Example Alice, A Example'},{id:2,name:'Bob Example',birthId:'9001010022'},
   {id:3,name:'Duplicate Birth One',birthId:'9001010033'},{id:4,name:'Duplicate Birth Two',birthId:'9001010033'},
   {id:5,name:'Same Name'},{id:6,name:'Name Same'}];
  const record=(id,extra={})=>({ClientID:String(id),Investor:clients.find(c=>c.id===id)?.name||'',Fond:'QA fund','rp.ISIN':'QAPERF000001','Investiční společnost':'QA','Typ produktu':'FKI','Typ transakce':'Platba','Čistá investice':1000,'Počet vydaných CP':10,'Upisovací hodnota':100,'Datum připsání platby':'2026-01-01','Datum emise':'2026-01-02',...extra});
  const records=[record(1,{_crmSourceType:'deal',_crmSourceId:11,_crmContractId:21}),record(1,{'Datum připsání platby':'','Datum emise':'',_crmSourceType:'deal',_crmSourceId:12}),record(2,{_providerClientId:2}),record(2,{_providerClientId:null}),record(1,{'RČ':'9001010033'}),record(99,{Investor:'Example Alice'}),record(99,{Investor:'Same Name'}),record(99,{Investor:''}),record(2,{'Typ transakce':'Odkup','Čistá investice':-100}),record(1,{portfolioReplacedBy:123})];
  const deal=(id,clientId,extra={})=>({id,clientId,company:'QA',product:'QA fund',category:'FKI',date:'2026-01-01',amount:1000,purchaseDate:'',emissionDate:'',...extra});
  const deals=[deal(11,1,{contractId:21}),deal(12,1),deal(13,1,{scenarioLinkKey:'QA-link'}),deal(14,2),deal(15,1,{category:'Investice',purchaseDate:'2026-01-01'})];
  const contracts=[{id:21,clientId:1,company:'QA',product:'QA fund',type:'fki',amount:1000,fromDealId:11},{id:22,clientId:1,company:'QA',product:'Pending only',type:'investice',amount:2000},{id:21,clientId:2,company:'QA',type:'auto'}];
  const snapshots=[{id:31,clientId:1,company:'QA',product:'Classic',isin:'QAPERF000002',date:'2026-10-01',purchaseDate:'2026-01-01',invested:1000,current:1200,manualAumOverride:true,sourceDealId:15},
   {id:32,clientId:2,company:'QA',product:'Classic',isin:'QAPERF000002',date:'2026-10-01',purchaseDate:'',invested:2000,current:2100,manualAumOverride:true,sourceDealId:15}];
  state=normalizeState({...def(),clients,deals,contracts,investmentRecords:records.map((r,i)=>({...r,_providerTransactionKey:'qa-read-context-'+i})),investmentSnapshots:snapshots,fundValues:{'isin|qaperf000001':{isin:'QAPERF000001',nav:115,date:'2026-10-01'},'investment-isin|qaperf000001':{isin:'qaperf000001',nav:120,date:'2026-10-01'},'legacy-fund':{nav:99,date:'2026-09-01'},'no-nav':{nav:0}}});
  const read=()=>({owners:state.investmentRecords.map(portfolioRecordClientId),sources:state.investmentRecords.map(r=>portfolioLinkedSources(r).map(x=>[x.clientId,x.id])),
   represented:state.deals.map(d=>investmentSourceHasRecord(d)),snapshotSource:state.deals.map(d=>investmentSourceHasSnapshot(d,'deal')),contractSnapshot:state.contracts.map(d=>investmentSourceHasSnapshot(d,'contract')),
   pending:[null,...clients.map(c=>c.id)].flatMap(id=>['','fki','investice'].map(area=>investmentPendingRows(id,area).map(r=>[r.id,r.clientId,r.area,r.amount]))),
   latest:[null,1,2].flatMap(id=>[false,true].map(pending=>latestInvestmentSnapshots(id,pending).map(s=>s.id))),
   quotes:['isin|qaperf000001','investment-isin|qaperf000001','legacy-fund','no-nav','missing'].map(key=>fundNavQuote(key)),
   portfolios:clients.map(c=>clientInvestmentItems(c.id).map(x=>({clientId:x.clientId,area:x.area,amount:x.amount,isin:x.isin}))) });
  const original=read(),cached=withPortfolioReadContext(()=>{read();latestInvestmentSnapshots().pop();return read();});
  const coverage=[];const baseline={...state.investmentSnapshots[0],coveredPurchaseIds:['qa-covered'],current:2500},purchase={...state.investmentSnapshots[0],id:33,scope:'purchase',purchaseId:'qa-covered',current:500,invested:500};
  for(const [fullDate,purchaseDate] of [['2026-01-01','2026-01-01'],['2026-01-01',''],['','']]) {state.investmentSnapshots=[{...baseline,purchaseDate:fullDate},{...purchase,purchaseDate}];const direct=[false,true].map(pending=>latestInvestmentSnapshots(1,pending).map(s=>s.id));const scoped=withPortfolioReadContext(()=>[false,true].map(pending=>latestInvestmentSnapshots(1,pending).map(s=>s.id)));coverage.push({direct,scoped});}
  const dateChange=withPortfolioReadContext(()=>{latestInvestmentSnapshots(1);state.investmentSnapshots[0].purchaseDate='2026-01-01';invalidatePortfolioReadContext();return latestInvestmentSnapshots(1).map(s=>s.id);});
  const before=withPortfolioReadContext(()=>fundNavQuote('isin|qaperf000001').nav);state.fundValues['isin|qaperf000001'].nav=130;
  const after=withPortfolioReadContext(()=>fundNavQuote('isin|qaperf000001').nav);
  const invalidated=withPortfolioReadContext(()=>{fundNavQuote('isin|qaperf000001');state.fundValues['isin|qaperf000001'].nav=140;invalidatePortfolioReadContext();return fundNavQuote('isin|qaperf000001').nav;});
  const replaced=withPortfolioReadContext(()=>{fundNavQuote('isin|qaperf000001');state={...state,fundValues:{'isin|qaperf000001':{nav:150,date:'2026-10-01'}}};return fundNavQuote('isin|qaperf000001').nav;});
  const alternate=withPortfolioReadContext(()=>fundNavQuote('isin|qaperf000001','',{fundValues:{'isin|qaperf000001':{nav:160,date:'2026-10-01'}}}).nav);
  let throws=false;try{withPortfolioReadContext(()=>{withPortfolioReadContext(()=>{throw Error('synthetic');});});}catch(e){throws=e.message==='synthetic';}
  return {original,cached,coverage,dateChange,before,after,invalidated,replaced,alternate,throws,clean:portfolioReadContext===null};
 });
 assert.deepEqual(result.cached,result.original,'render indexes preserve all uncached valuation/ownership/source/pending results');
 assert.deepEqual(result.original.owners,['1','1','2','','','1','','','2','1'],'ambiguous identity and explicit unassigned producer records stay isolated');
 result.coverage.forEach(row=>assert.deepEqual(row.scoped,row.direct));assert.deepEqual(result.dateChange,[31]);assert.equal(result.before,115);assert.equal(result.after,130);assert.equal(result.invalidated,140);assert.equal(result.replaced,150);assert.equal(result.alternate,160);assert.equal(result.throws,true);assert.equal(result.clean,true);assert.deepEqual(errors,[]);
 console.log('PASS portfolio read context: equivalence, identity ambiguity, client/source isolation, shared NAV tie-break, pending principal, invalidation, state replacement, alternate state and exception cleanup.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
