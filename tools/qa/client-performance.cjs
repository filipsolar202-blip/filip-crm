// Reproducible, synthetic large-CRM benchmark. Never opens the user's live CRM.
// CRM_QA_SCRIPT_REF=1683bba replays the same fixture against the previous core.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
const count=Number(process.env.CRM_QA_CLIENTS||300),baseline=process.env.CRM_QA_SCRIPT_REF||'';
const baselineScript=baseline?execFileSync('git',['show',baseline+':assets/js/crm.js'],{cwd:root,maxBuffer:15*1024*1024}):null;
const data={nextId:1000000,clients:[],investmentRecords:[],investmentSnapshots:[],fundValues:{},contracts:[],deals:[],opportunities:[],activities:[],providerImports:[]};
const isin=(type,n)=>'QA'+type+String(n).padStart(8,'0');
for(let j=0;j<16;j++)data.fundValues['isin|'+isin('FK',j).toLowerCase()]={area:'fki',isin:isin('FK',j),company:'QA správce '+(j%4),fond:'QA FKI '+j,nav:120,date:'2026-09-30'};
for(let i=1;i<=count;i++){
 const name='QA klient '+String(i).padStart(4,'0');data.clients.push({id:i,name,birthId:'QA-PERF-'+i,cooperationScope:i%2?'Více oblastí':'Jednotlivý produkt',createdAt:'2025-01-01'});
 for(let j=0;j<13;j++){
  const fund=j<12?(i+Math.floor(j/3))%16:15,pending=j===12,amount=pending?25000:100000/3;
  data.investmentRecords.push({...(j%2?{}:{ClientID:String(i)}),Investor:name,'RČ':'QA-PERF-'+i,Fond:'QA FKI '+fund,'rp.ISIN':isin('FK',fund),'Investiční společnost':'QA správce '+(fund%4),'Typ produktu':'FKI','Typ transakce':'Platba','Čistá investice':amount,'Aktuální hodnota investice':amount*1.2,'Počet vydaných CP':amount/100,'Upisovací hodnota':100,'Datum připsání platby':pending?'':'2025-0'+(j%3+1)+'-10','Datum emise':pending?'':'2025-0'+(j%3+1)+'-15','Poslední schválená hodnota CP':120,'Poslední schválená hodnota do':'2026-09-30',fkiValuationMode:'nav',_source:'local-fki'});
 }
 for(let j=0;j<2;j++)data.investmentSnapshots.push({id:10000+i*2+j,clientId:i,company:'QA klasický správce',product:'QA klasická '+j,isin:isin('CL',j),date:'2026-09-30',purchaseDate:'2025-01-10',current:75000,invested:60000,investedBeforeRedemption:60000,manualAumOverride:true,calculationVersion:2});
 data.contracts.push({id:20000+i,clientId:i,type:'auto',company:'QA pojišťovna',product:'QA auto',amount:'6000',status:'vyrizeno'});
 for(let j=0;j<3;j++)data.opportunities.push({id:30000+i*3+j,clientId:i,category:j?'Pojištění':'Hypotéka',company:'QA společnost',product:'QA případ '+j,amount:100000,bj:20,status:'Nabídka',statusDate:'2026-10-01'});
 for(let j=0;j<8;j++)data.activities.push({id:40000+i*8+j,clientId:i,type:'Telefon',text:'QA poznámka '+j,date:'2026-10-20',done:j<6,outcome:j<6?'realized':'agreed'});
}
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<.01,`${label}: ${actual} != ${expected}`);
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Prague'});
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));if(u.hostname==='crm.test'&&f.startsWith(root+path.sep)&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:baselineScript&&u.pathname==='/assets/js/crm.js'?baselineScript:u.pathname==='/FILIP-CRM.html'&&process.env.CRM_QA_FULL_STARTUP!=='1'?fs.readFileSync(f,'utf8').replace('id="dashboard" class="view active"','id="dashboard" class="view"').replace('id="clients" class="view"','id="clients" class="view active"'):fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':f.endsWith('.png')?'image/png':'text/html'});return route.abort();});
 await context.addInitScript(seed=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));},data);
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const launch=Date.now();await page.goto('https://crm.test/FILIP-CRM.html',{timeout:240000});await page.waitForFunction(()=>typeof selectClient==='function');
 console.log(JSON.stringify({revision:baseline||'working-tree',clients:count,records:data.investmentRecords.length,snapshots:data.investmentSnapshots.length,initialView:process.env.CRM_QA_FULL_STARTUP==='1'?'dashboard':'clients',startupMs:Date.now()-launch}));
 const profileNames=['renderClients','renderClientDetail','clientPortfolio','clientInvestmentSummary','clientDisplayInvestmentItems','clientInvestmentItems','investmentAggregate','investmentRecordClients','investmentRecordsForClient','portfolioRecordClientId','latestInvestmentSnapshots','investmentPendingRows','fundPerformance_clientFunds','fundPerformance_fkiRowsFor','invValuation','fundNavQuote','findClient','clientDirectoryStats','investmentCoveredPurchaseIds'];
 if(process.env.CRM_QA_PROFILE!=='0')await page.evaluate(names=>{window.__qaProfile={};for(const name of names){const fn=window[name];if(typeof fn!=='function')continue;window[name]=function(...args){const t=performance.now();try{return fn.apply(this,args);}finally{const m=window.__qaProfile[name]||={calls:0,ms:0};m.calls++;m.ms+=performance.now()-t;}};}},profileNames);
 const resetProfile=()=>page.evaluate(()=>{window.__qaProfile={};});
 const profile=()=>page.evaluate(()=>Object.entries(window.__qaProfile||{}).map(([name,x])=>({name,calls:x.calls,ms:Math.round(x.ms*10)/10})).sort((a,b)=>b.ms-a.ms));
 const timed=async(label,fn)=>{await resetProfile();const t=Date.now();await fn();const result={label,wallMs:Date.now()-t,profile:await profile()};console.log(JSON.stringify(result));return result;};
 await timed('directory',()=>page.evaluate(()=>openClientDirectory()));
 const opened=await timed('actual-directory-click-overview',()=>page.locator('#clientList tr.client-row').filter({hasText:'QA klient 0001'}).getByRole('button',{name:'Otevřít',exact:true}).click());
 const portfolio=await timed('actual-portfolio-tab',()=>page.locator('#clientDetail .subtab').filter({hasText:/^Portfolio$/}).click());
 const snapshot=()=>page.evaluate(()=>({aum:clientInvestmentSummary(1).total,other:clientInvestmentSummary(2).total,pending:investmentPendingRows(1).reduce((n,x)=>n+x.amount,0),records:state.investmentRecords.length,snapshots:state.investmentSnapshots.length}));
 const original=await snapshot();near(original.aum,630000,'large CRM first client AUM');near(original.other,630000,'second client isolation');near(original.pending,25000,'pending excluded from AUM');if(baseline){assert.deepEqual(errors,[]);console.log('PASS baseline measurements and identical client/pending totals.');return;}
 await timed('repeated-client-overview',()=>page.evaluate(()=>{selectClient(2);selectClient(1);}));
 // Real editor save must invalidate computed views; then switching owners must
 // not leak cached values across clients or retain a previous amount.
 await page.evaluate(()=>openInvestmentSnapshotById(10002));await page.locator('#isCurrent').fill('80000');await timed('save-edited-valuation',()=>page.evaluate(()=>saveInvestmentSnapshot()));
 let after=await snapshot();near(after.aum,635000,'edited amount visible immediately');near(after.other,630000,'other client unchanged by manual valuation');
 await page.evaluate(()=>{selectClient(2);selectClient(1);});after=await snapshot();near(after.aum,635000,'edited amount survives switching clients');assert.equal(after.records,original.records);assert.equal(after.snapshots,original.snapshots);
 // Mutation in the same JavaScript turn followed by an ordinary render is
 // deliberate: import/edit paths mutate existing objects, not only references.
 await page.evaluate(()=>{state.investmentSnapshots.find(s=>s.id===10002).current=81000;renderClients();});after=await snapshot();near(after.aum,636000,'same-object changes visible after render');near(after.other,630000,'same-object changes keep owner isolation');
 assert.deepEqual(errors,[]);assert(await page.locator('#clientDetail').isVisible());
 if(!baseline){assert(opened.wallMs<2500,`opening a client took ${opened.wallMs}ms`);assert(portfolio.wallMs<2500,`opening portfolio took ${portfolio.wallMs}ms`);}
 console.log('PASS client performance: identical synthetic baseline/new fixture, actual directory and portfolio clicks, AUM/pending equality, real save, same-object mutation and owner isolation.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
