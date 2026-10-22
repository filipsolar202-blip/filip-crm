const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
const fixture={clients:[{id:1,name:'Test Investice'},{id:2,name:'Test Druhý klient'}],investmentSnapshots:[],fundValues:{}};
const close=(a,b)=>assert(Math.abs(a-b)<.001,`${a} != ${b}`);
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1100}});
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='crm.test'){const p=path.join(root,decodeURIComponent(u.pathname));if(fs.existsSync(p))return route.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'});}return route.abort();});
 await context.addInitScript(f=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(f));},fixture);
 const page=await context.newPage(),errors=[],dialogs=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{dialogs.push(d.message());d.dismiss()});await page.goto('https://crm.test/FILIP-CRM.html');
 async function open(){await page.evaluate(()=>{const s=state.investmentSnapshots[0];openInvestmentSnapshotModal(1,s?encodeURIComponent(investmentSnapshotKeyForSnapshot(s)):'');});}
 async function fill(id,v){await page.locator('#'+id).fill(v);}
 async function save(){await page.evaluate(()=>saveInvestmentSnapshot());assert.deepEqual(dialogs,[]);}
 async function values(){return page.evaluate(()=>{const s=state.investmentSnapshots[0],x=classicInvestmentItemsForClient(1)[0],r=investmentClientRows().find(r=>r.client.id===1),f=clientOutput_xClientInvestments(findClient(1))[0],row=clientOutput_xFundRows(f)[0];return {current:x.amount,gain:investmentReportedGain(x),pct:investmentReportedPct(x),total:r.gainPct,mode:s.manualAumOverride,fields:[s.gainAmount,s.gainPct],schedule:s.investmentSchedule,report:{current:row.current,gain:row.perf.gain,pct:row.perf.pct,pa:row.pa},count:state.investmentSnapshots.length};});}
 await open();await page.evaluate(()=>{setVal('isCompany','Testovací společnost');setVal('isProductName','Testovací OPF');setVal('isIsin','QA0000000055');setVal('isPurchaseDate','2025-01-01');setVal('isFundNavDate','2026-01-01');setVal('isDate','2026-01-01');});
 await fill('isInvested','100000');await fill('isCurrent','123456');await fill('isGainPct','18.7');await fill('isGainAmount','18000');await fill('isAnnualReturnPct','9.2');await page.locator('#isInvestmentSchedule').selectOption('mixed');await fill('isRegularAmount','2000');await page.locator('#isRegularFrequency').selectOption({label:'Měsíčně'});await save();
 let v=await values();close(v.current,123456);close(v.gain,18000);close(v.pct,18.7);close(v.total,18.7);close(v.report.current,123456);close(v.report.gain,18000);close(v.report.pct,18.7);close(v.report.pa,9.2);assert.equal(v.schedule,'mixed');
 await page.reload();await open();assert.equal(await page.locator('#isCurrent').inputValue(),'123456');assert.equal(await page.locator('#isGainPct').inputValue(),'18.7');assert.equal(await page.locator('#isInvestmentSchedule').inputValue(),'mixed');assert.equal(await page.locator('#isRegularAmount').inputValue(),'2000');
 // Missing return fields stay automatic and a regular schedule does not invent an annualized rate.
 await fill('isGainAmount','');await fill('isGainPct','');await fill('isAnnualReturnPct','');await save();v=await values();close(v.gain,23456);close(v.pct,23.456);assert.deepEqual(v.fields,[null,null]);assert.equal(v.report.pa,null);
 // Blank current: calculate from entered return without CP, including a negative return.
 await open();await fill('isCurrent','');await fill('isGainPct','-10');await save();v=await values();close(v.current,90000);close(v.gain,-10000);assert(!v.mode);
 await page.reload();await open();assert.equal(await page.locator('#isCurrent').inputValue(),'');await fill('isGainPct','');await fill('isGainAmount','8000');await save();v=await values();close(v.current,108000);close(v.pct,8);
 // Blank current and gains: CP calculation derives quantity and responds to later NAV updates.
 await open();await fill('isGainAmount','');await fill('isSubscribeValue','100');await fill('isFundNav','120');await save();v=await values();close(v.current,120000);close(v.gain,20000);
 await page.evaluate(()=>{const s=state.investmentSnapshots[0],key=investmentFundKey(investmentSnapshotItem(s));state.fundValues[key].nav=130;persist();});v=await values();close(v.current,130000);close(v.gain,30000);close(v.pct,30);
 await page.reload();await open();assert.equal(await page.locator('#isCurrent').inputValue(),'');assert.equal(await page.locator('#isGainPct').inputValue(),'');
 // Explicit quantity, a redemption counted once, and current zero must survive save/reopen/report.
 await fill('isQty','900');await fill('isRedemptionAmount','10000');await save();v=await values();close(v.current,107000);close(v.gain,17000);
 await open();await fill('isCurrent','95000');await save();v=await values();close(v.current,95000);close(v.gain,5000);
 await open();assert.equal(await page.locator('#isCurrent').inputValue(),'95000');await fill('isCurrent','0');await fill('isGainPct','0');await fill('isGainAmount','0');await save();v=await values();assert.deepEqual([v.current,v.gain,v.pct,v.report.current,v.report.gain,v.report.pct],[0,0,0,0,0,0]);
 await page.reload();await open();assert.equal(await page.locator('#isCurrent').inputValue(),'0');assert.equal(await page.locator('#isGainPct').inputValue(),'0');
 // Single-payment mode clears monthly instructions, preserves purchase date, derives CAGR.
 await page.locator('#isInvestmentSchedule').selectOption('single');assert(await page.locator('#isRegularAmount').isDisabled());await fill('isCurrent','110000');await fill('isRedemptionAmount','');await fill('isGainAmount','');await fill('isGainPct','');await save();v=await values();assert(Math.abs(v.report.pa-10)<.01);assert.equal(await page.evaluate(()=>state.investmentSnapshots[0].regularAmount),0);assert.equal(v.count,1);
 // NAV changes do not replace a client-specific current amount; another client stays independent.
 const independent=await page.evaluate(()=>{const s=state.investmentSnapshots[0];state.investmentSnapshots.push({...s,id:999,clientId:2,current:99999,manualAumOverride:true});state.fundValues[investmentFundKey(investmentSnapshotItem(s))].nav=190;return classicInvestmentItems().map(x=>x.amount).sort((a,b)=>a-b)});assert.deepEqual(independent,[99999,110000]);
 // A deliberate new producer import takes its current amount instead of old CP inputs.
 const imported=await page.evaluate(()=>{const s=state.investmentSnapshots[0];s.manualAumOverride=false;upsertImportedInvestmentSnapshot({...s,current:140000,currentBeforeRedemption:140000,gainAmount:40000,gainPct:40,manualPerformanceOverride:false,date:'2026-02-01'});return investmentSnapshotLiveCurrent(state.investmentSnapshots[0]);});close(imported,140000);
 await open();await page.screenshot({path:'/private/tmp/crm-classic-valuation.png',fullPage:false});
 assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);console.log('PASS classic investment UI: schedules, manual inputs, missing-field calculations, NAV propagation, losses/zero, redemptions, persistence, client isolation and reports.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
