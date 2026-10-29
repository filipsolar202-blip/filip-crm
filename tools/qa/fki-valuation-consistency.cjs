// Isolated synthetic Penta position. No client records, live browser or external network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..'),ISIN='CZ0008053691',KEY='isin|cz0008053691',EXPECTED=129198*1.2204;
const purchase={Investor:'QA konzistence ocenění',ClientID:'1','RČ':'9001010007',Fond:'PENTA RE tř.D_CZK','rp.ISIN':ISIN,
 'Investiční společnost':'Codya','Typ produktu':'FKI','Typ transakce':'Platba','Čistá investice':150000,
 'Aktuální hodnota investice':150000,'Počet vydaných CP':129198,'Upisovací hodnota':1.161,
 'Datum připsání platby':'2026-01-22','Datum emise':'2026-04-10',
 codyaImportedCurrent:150000,codyaImportDate:'2026-07-31',_source:'local-fki',_updatedAt:'2026-10-22T10:00:00.000Z'};
const fixture={nextId:1000,clients:[{id:1,name:'QA konzistence ocenění',birthId:'9001010007'}],investmentRecords:[purchase],
 contracts:[],deals:[],activities:[],opportunities:[],investmentSnapshots:[],providerImports:[],
 fundValues:{[KEY]:{area:'fki',company:'Codya',fond:purchase.Fond,isin:ISIN,nav:1.2204,date:'2026-07-31'}}};
const near=(actual,expected,label)=>assert(Math.abs(actual-expected)<.01,`${label}: ${actual} != ${expected}`);

(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
 await context.route('**/*',route=>{const url=new URL(route.request().url()),file=path.join(root,decodeURIComponent(url.pathname));
  if(url.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
  return route.abort();});
 await context.addInitScript(seed=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));},fixture);
 const page=await context.newPage(),errors=[],dialogs=[],reportDates=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss();});
 await page.goto('https://crm.test/FILIP-CRM.html');
 const reset=async(record,nav={nav:1.2204,date:'2026-07-31'})=>page.evaluate(({seed,nav,key})=>{
  state=normalizeState(seed);state.fundValues[key]={...state.fundValues[key],...nav};persist();renderAll();
 },{seed:{...structuredClone(fixture),investmentRecords:[record]},nav,key:KEY});
 const openEditor=()=>page.evaluate(()=>{const r=state.investmentRecords[0];openFkRecordModal(1,encodeURIComponent(invPositionKey(r)),encodeURIComponent(invRecordKey(r)));});
 const values=()=>page.evaluate(()=>{
  const record=state.investmentRecords[0],client=findClient(1),portfolio=investmentPortfolioForClient(1)[0],fki=fkClientRows().find(x=>x.client.id===1),report=clientOutput_xClientInvestments(client)[0],rows=clientOutput_xFundRows(report);
  return {record:invCurrentValue(record),position:invPositionValue(record),portfolio:portfolio.current,fki:fki.aum,report:report.amount,reportPosition:rows[0].current,
   gain:investmentPerformanceGain(portfolio.current,portfolio.invested,portfolio.realized),qty:invQty(record),subscription:invSubscribeValue(record),purchase:invPaymentDate(record),emission:invEmissionDate(record),mode:record.fkiValuationMode||'',stored:invCurrent(record),reportDate:report.valueDate};
 });
 const checkValues=async(expected,label)=>{const result=await values();for(const field of ['record','position','portfolio','fki','report','reportPosition'])near(result[field],expected,`${label} / ${field}`);near(result.gain,expected-150000,label+' / gain');return result;};
 const reportPage=await context.newPage();reportPage.on('pageerror',error=>errors.push(error.message));
 const renderReport=async()=>{const html=await page.evaluate(()=>clientOutput_xReportHtml(findClient(1),{summary:true,fki:true,investments:true,notice:false}));await reportPage.setContent(html);return reportPage.locator('.report-fund-detail').filter({hasText:purchase.Fond});};

 // Original failure: the same unmodified position displayed 150000 on cards/report but 157673.24 in the editor.
 await page.evaluate(()=>{showView('fki');selectFkClient(1);});
 const initial=await values();await openEditor();const initialEditor=Number(await page.locator('#fkRecCurrent').inputValue());
 console.log('Synthetic initial valuation:',JSON.stringify({...initial,editor:initialEditor}));
 near(initialEditor,EXPECTED,'Penta CP editor preview');assert.equal(await page.locator('#fkRecManualCurrent').isChecked(),false);
 await checkValues(EXPECTED,'untouched legacy CP position');
 assert.match(await page.locator('#fkDetail .fki-work-card').filter({hasText:purchase.Fond}).innerText(),/157[\s\u00a0]*673/);
 let exported=await renderReport();assert.match(await exported.locator('.metrics').innerText(),/157[\s\u00a0]*673/);assert.match(await exported.locator('.metrics').innerText(),/7[\s\u00a0]*673/);
 await page.screenshot({path:'/private/tmp/crm-fki-valuation-editor.png',fullPage:false});
 // Save without a checkbox toggle or retyping the calculated current value.
 await page.evaluate(()=>saveFkRecord());await page.reload();const saved=await checkValues(EXPECTED,'save without manual toggle and reload');
 assert.equal(saved.qty,129198);assert.equal(saved.subscription,1.161);assert.equal(saved.purchase,'2026-01-22');assert.equal(saved.emission,'2026-04-10');
 await openEditor();near(Number(await page.locator('#fkRecCurrent').inputValue()),EXPECTED,'reopened editor');assert.equal(await page.locator('#fkRecManualCurrent').isChecked(),false);
 await page.evaluate(()=>closeModal('fkRecordModal'));
 await page.evaluate(()=>{showView('clients');selectedClientId=1;clientDirectoryMode=false;clientSection='portfolio';renderClients();});
 assert.match(await page.locator('#clientDetail').innerText(),/157[\s\u00a0]*673/);
 await page.screenshot({path:'/private/tmp/crm-fki-valuation-client.png',fullPage:false});
 exported=await renderReport();await reportPage.screenshot({path:'/private/tmp/crm-fki-valuation-report.png',fullPage:false});
 assert.match(await exported.locator('.metrics').innerText(),/157[\s\u00a0]*673/);

 // Old Codya imports stamped the upload date, not the statement date. They are only a fallback
 // when CP calculation is unavailable, including old rows labelled "statement".
 const inferred={...purchase,'Počet vydaných CP':0};await reset(inferred);await checkValues(150000/1.161*1.2204,'legacy placeholder with inferred CP');
 const legacyStatement={...purchase,_source:'codya-import',_updatedAt:'2026-10-22T10:00:00.000Z',fkiValuationMode:'statement',codyaImportDate:'2026-10-22',codyaImportedCurrent:154321,'Aktuální hodnota investice':154321};
 await reset(legacyStatement);await checkValues(EXPECTED,'legacy upload date does not override calculable CP');
 await reset({...legacyStatement,'Počet vydaných CP':0,'Upisovací hodnota':0});await checkValues(154321,'legacy statement fallback without a calculable CP quantity');
 await reset({...purchase,'Poslední schválená hodnota CP':1.24,'Poslední schválená hodnota do':'2026-08-31'});const latestRow=await checkValues(129198*1.24,'newer row NAV wins over stale global NAV');reportDates.push(latestRow.reportDate.replace(/\s/g,''));
 const provider={...purchase,_source:'provider-import',_providerClientId:1,_providerTransactionKey:'qa:penta:1001',fkiValuationMode:'statement',providerValuation:{provider:'codya',date:'2026-08-31',current:154321,nav:1.194455}};
 await reset(provider);await checkValues(154321,'newer verified provider statement');
 await openEditor();assert.equal(await page.locator('#fkRecManualCurrent').isChecked(),false);near(Number(await page.locator('#fkRecCurrent').inputValue()),154321,'opening a verified statement preserves its amount in the editor');
 const beforeUnchanged=await page.evaluate(()=>JSON.stringify(state.investmentRecords[0].providerValuation));
 await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(154321,'saving an unchanged verified statement');
 assert.equal(await page.evaluate(()=>JSON.stringify(state.investmentRecords[0].providerValuation)),beforeUnchanged,'an unchanged save preserves provider valuation provenance');
 await openEditor();await page.evaluate(()=>{setVal('fkRecCurrent','');saveFkRecord();});await page.reload();await checkValues(154321,'blank untouched readonly field cannot discard the verified statement');
 await openEditor();await page.locator('#fkRecNote').fill('QA nefinanční poznámka');await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(154321,'editing a note does not implicitly switch valuation mode');
 await openEditor();assert.equal(await page.locator('#fkRecUseNav').isVisible(),true);await page.locator('#fkRecUseNav').click();
 near(Number(await page.locator('#fkRecCurrent').inputValue()),129198*1.194455,'explicit CP switch uses the newest dated CP quote');
 await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(129198*1.194455,'explicit CP choice persists');
 // A genuine statement may equal the original deposit; equality alone must not discard it.
 await reset({...provider,providerValuation:{...provider.providerValuation,current:150000}});await checkValues(150000,'verified flat provider statement');
 await reset(provider,{nav:1.3,date:'2026-09-30'});await checkValues(129198*1.3,'newer NAV after provider statement');
 await reset({...provider,'Poslední schválená hodnota CP':1.3,'Poslední schválená hodnota do':'2026-09-30'});const afterRow=await checkValues(129198*1.3,'newer row NAV after provider statement');reportDates.push(afterRow.reportDate.replace(/\s/g,''));
 exported=await renderReport();assert.match(await exported.locator('.fund-tags').innerText(),/30\.\s*9\.\s*2026/,'rendered fund tag shows the date of the value it displays');await exported.screenshot({path:'/private/tmp/crm-fki-valuation-dated-report.png'});
 await openEditor();assert.equal(await page.locator('#fkRecNavDate').inputValue(),'2026-09-30');near(Number(await page.locator('#fkRecNav').inputValue()),1.3,'editor NAV and date remain paired');await page.evaluate(()=>closeModal('fkRecordModal'));
 await reset({...provider,providerValuation:{provider:'codya',date:'2026-08-31',current:0,nav:1.194455}});await checkValues(0,'explicit provider zero');
 await reset({...legacyStatement,codyaImportedCurrent:0,'Aktuální hodnota investice':0});await checkValues(0,'explicit legacy zero remains closed until adviser opts in');
 await openEditor();assert.equal(await page.locator('#fkRecCurrent').inputValue(),'0');await page.locator('#fkRecUseNav').click();await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(EXPECTED,'explicit CP opt-in from a legacy zero');
 // Explicit manual values, including zero, survive later NAV and report refreshes.
 await reset({...provider,fkiValuationMode:'manual',fkiManualCurrent:160123},{nav:1.5,date:'2026-10-15'});await checkValues(160123,'manual valuation remains authoritative');
 await reset({...provider,fkiValuationMode:'manual',fkiManualCurrent:0},{nav:1.5,date:'2026-10-15'});await checkValues(0,'manual zero remains authoritative');
 await openEditor();assert.equal(await page.locator('#fkRecManualCurrent').isChecked(),true);assert.equal(await page.locator('#fkRecCurrent').inputValue(),'0');
 await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(0,'manual zero saved and reloaded');
 await openEditor();await page.locator('#fkRecManualCurrent').uncheck();near(Number(await page.locator('#fkRecCurrent').inputValue()),129198*1.5,'manual opt-out returns to CP');await page.evaluate(()=>saveFkRecord());await page.reload();await checkValues(129198*1.5,'manual opt-out remains CP after reload');
 // Redemption dates follow the mark-to-market amount; cash paid is a separate immutable fact.
 await reset(purchase);
 const withdrawalDates=await page.evaluate(base=>{
  const out={...base,'Typ transakce':'Odkup','Čistá investice':-20000,'Počet vydaných CP':-20000,'Aktuální hodnota investice':-24000,'Datum připsání platby':'2026-08-01',fkiValuationMode:'statement',providerValuation:{provider:'avant',current:-24000,redemptionValue:20000,date:'2026-08-31'}};
  const before={...invValuation(out),cash:invWithdrawalValue(out)};
  out['Poslední schválená hodnota CP']=1.3;out['Poslední schválená hodnota do']='2026-09-30';
  return {before,after:{...invValuation(out),cash:invWithdrawalValue(out)}};
 },purchase);
 assert.deepEqual(withdrawalDates,{before:{value:-24000,date:'2026-08-31',kind:'withdrawal',cash:20000},after:{value:-26000,date:'2026-09-30',kind:'withdrawal',cash:20000}});
 assert.deepEqual(reportDates,['31.8.2026','30.9.2026'],'report date belongs to the NAV used for calculation');assert.deepEqual(errors,[]);assert.deepEqual(dialogs,[]);
 console.log('PASS FKI valuation consistency: Penta CP calculation on client/card/editor/report, untouched and saved/reloaded, legacy placeholders vs verified statements, inferred CP, newer NAV/provider precedence and explicit zero.');
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
