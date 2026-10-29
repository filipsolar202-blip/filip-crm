// Pure aggregation edge cases; all records are synthetic and network is blocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext();await context.route('**/*',route=>{const u=new URL(route.request().url()),file=path.join(root,decodeURIComponent(u.pathname));return u.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile()?route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'}):route.abort();});
 await context.addInitScript(()=>localStorage.setItem('filip_crm_main_v1',JSON.stringify({clients:[],deals:[],contracts:[],investmentRecords:[],investmentSnapshots:[]})));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());await page.goto('https://crm.test/FILIP-CRM.html');
 const results=await page.evaluate(()=>{
  const reset=extra=>state=normalizeState({...def(),nextId:1000,clients:[{id:1,name:'Synthetic settlement',birthId:'9001010007'}],deals:[],contracts:[],investmentRecords:[],investmentSnapshots:[],fundValues:{},...extra});
  const base={id:10,clientId:1,company:'QA',product:'QA fund',isin:'QAEDGE000001',date:'2026-10-20',purchaseDate:'2026-01-10',invested:100000,current:100000,manualAumOverride:true};
  const purchase={...base,id:11,scope:'purchase',purchaseId:'qa-purchase-11',date:'2026-10-21',purchaseDate:'2026-10-21',invested:20000,current:20000,sourceDealId:5};
  const deal={id:5,clientId:1,category:'Investice',company:'QA',product:'QA fund',fundIsin:'QAEDGE000001',date:'2026-10-20',purchaseDate:'2026-10-21',amount:20000,volume:20000};
  const read=()=>({aum:classicInvestmentItemsForClient(1).reduce((n,x)=>n+x.amount,0),pending:investmentPendingRows(1).reduce((n,x)=>n+x.amount,0)});
  reset({investmentSnapshots:[base,purchase],deals:[deal]});const activeLinked=read();
  state.investmentSnapshots[1].purchaseDate='';const pendingLinked=read();
  state.investmentSnapshots[0].coveredPurchaseIds=['qa-purchase-11'];state.investmentSnapshots[0].current=130000;state.investmentSnapshots[0].invested=120000;state.investmentSnapshots[0].date='2026-10-29';const coveredPending=read();
  state.investmentSnapshots[0].purchaseDate='';state.investmentSnapshots[0].coveredPurchaseIds=investmentCoveredPurchaseIds(state.investmentSnapshots[0]);const allPending=read();
  const retainedCoverage=state.investmentSnapshots[0].coveredPurchaseIds.slice();
  const providerPurchase={...purchase,company:'Edward',product:'Edward strategy',isin:'QAEDGE000010',sourceDealId:undefined,purchaseDate:'2026-10-21'},
    providerTotal={...base,id:12,company:'Edward',product:'Edward portfolio',isin:'',scope:'provider-total',providerKey:'edward',date:'2026-10-29',purchaseDate:'',current:150000,invested:150000},
    laterPurchase={...providerPurchase,id:13,purchaseId:'qa-later',purchaseDate:'2026-10-29',date:'2026-10-29',current:30000,invested:30000};
  reset({investmentSnapshots:[providerPurchase,providerTotal]});
  state.investmentSnapshots[1].coveredPurchaseIds=investmentCoveredPurchaseIds(state.investmentSnapshots[1]);const providerCovered=read();
  state.investmentSnapshots.push(laterPurchase);const providerLater=read();
  reset({investmentRecords:[{ClientID:'1',Investor:'Synthetic settlement','RČ':'9001010007',Fond:'QA explicit classic','rp.ISIN':'QAEDGE000002','Typ produktu':'Investice','Typ transakce':'Platba','Investiční společnost':'QA','Čistá investice':10000,'Aktuální hodnota investice':12000,'Datum připsání platby':'2026-01-10','Datum emise':''}]});
  const classicRaw={pending:investmentPendingRows(1).length,classic:classicInvestmentItemsForClient(1).reduce((n,x)=>n+x.amount,0),fki:fkItemsForClient(1).reduce((n,x)=>n+x.amount,0)};
  const invalidDates=['2026-02-30','2026-13-01','n/a'].map(investmentSettlementDate), future=investmentSettlementInfo({purchaseDate:'2099-01-01'}).pending;
  return {activeLinked,pendingLinked,coveredPending,allPending,retainedCoverage,providerCovered,providerLater,classicRaw,invalidDates,future};
 });
 assert.deepEqual(results.activeLinked,{aum:120000,pending:0});
 assert.deepEqual(results.pendingLinked,{aum:100000,pending:20000},'a pending linked purchase cannot resurrect its source deal as active capital');
 assert.deepEqual(results.coveredPending,{aum:130000,pending:20000});
 assert.deepEqual(results.allPending,{aum:0,pending:120000},'a pending total includes its covered purchase exactly once');
 assert.deepEqual(results.retainedCoverage,['qa-purchase-11']);
 assert.deepEqual(results.providerCovered,{aum:150000,pending:0},'a confirmed provider total covers only explicitly recorded purchase IDs');
 assert.deepEqual(results.providerLater,{aum:180000,pending:0},'a later uncovered purchase remains additive without inferring coverage on read');
 assert.deepEqual(results.classicRaw,{pending:0,classic:12000,fki:0});assert.deepEqual(results.invalidDates,['','','']);assert.equal(results.future,true);assert.deepEqual(errors,[]);
 const fkiCleared=await page.evaluate(()=>{
  state=normalizeState({...def(),nextId:1000,clients:[{id:1,name:'Synthetic settlement',birthId:'9001010007'}],investmentRecords:[],investmentSnapshots:[],contracts:[],fundValues:{},
    deals:[{id:5,clientId:1,category:'FKI',product:'QA FKI explicit source',company:'QA',fundIsin:'QAEDGE000020',date:'2026-10-01',amount:25000,volume:25000}]});
  if(!settleInvestmentPurchase('deal',5,'2026-10-20','2026-10-21'))throw Error('Failed synthetic FKI settlement');
  const active=clientInvestmentSummary(1).total,record=state.investmentRecords[0];
  openFkRecordModal(1,encodeURIComponent(invPositionKey(record)),encodeURIComponent(invRecordKey(record)));byId('fkRecEmissionDate').value='';saveFkRecord();
  return {active,current:clientInvestmentSummary(1).total,pending:investmentPendingRows(1).reduce((n,r)=>n+r.amount,0),sourceStillSettled:state.deals[0].purchaseDate};
 });
 assert.deepEqual(fkiCleared,{active:25000,current:0,pending:25000,sourceStillSettled:'2026-10-20'},'clearing a raw FKI date cannot resurrect the settled source deal');assert.deepEqual(errors,[]);
 console.log('PASS investment settlement core: source suppression, exact purchase coverage, raw classic classification and date validity.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
