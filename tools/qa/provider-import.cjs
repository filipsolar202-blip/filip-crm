// Synthetic local files and an isolated browser; never use a live CRM or client report.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const root = path.resolve(__dirname, '../..');
const ISIN = 'CZ0008040193', OTHER_ISIN = 'CZ0008049012';
const avant = (patch={}) => ({
  Investor:'QA Alfa Investor','RČ':'9001010007',ISIN,Fond:'QA Přesný fond A',
  'Pokyn':'1001','Typ transakce':'Platba',
  'Datum připsání platby/datum podání žádosti o odkup':'2025-01-10','Datum emise/zpětného odkupu':'2025-02-01','Poslední schválená hodnota do':'2026-09-30',
  'Čistá investice':100000,'Počet vydaných CP/Počet odkupovaných CP':1000,'Emisní kurs Platba/Odkup':100,
  'Poslední schválená hodnota CP':120,'Aktuální hodnota investice':120000,Měna:'CZK',...patch
});
const legacy = (patch={}) => ({
  Investor:'QA Alfa Investor',ClientID:'1','RČ':'9001010007','rp.ISIN':ISIN,Fond:'QA Přesný fond A',
  'Investiční společnost':'Avant','Typ produktu':'FKI','Typ transakce':'Platba',
  'Datum připsání platby':'2025-01-10','Datum emise':'2025-02-01',
  'Čistá investice':100000,'Počet vydaných CP':1000,'Upisovací hodnota':100,'Aktuální hodnota investice':110000,
  _source:'local-fki',_updatedAt:'2026-10-20T10:00:00.000Z',fkiValuationMode:'manual',fkiManualCurrent:130000,...patch
});
const fixture = {
  nextId:1000,
  clients:[
    {id:1,name:'QA Alfa Investor',birthId:'9001010007'},
    {id:2,name:'QA Beta Investor',birthId:'9102020003'}
  ],
  investmentRecords:[], investmentSnapshots:[], providerImports:[],
  contracts:[], deals:[], opportunities:[], activities:[],
  fundValues:{}, settings:{bjCoef:150}
};

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1080},timezoneId:'Europe/Prague'});
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = path.join(root, decodeURIComponent(url.pathname));
      if (url.hostname === 'crm.test' && file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
      }
      return route.abort();
    });
    await context.addInitScript(seed => {
      if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1',JSON.stringify(seed));
    },fixture);
    const page = await context.newPage(), errors = [], dialogs = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',async dialog=>{dialogs.push(dialog.message());if(dialog.type()==='confirm')await dialog.accept();else await dialog.dismiss();});
    await page.goto('https://crm.test/FILIP-CRM.html');
    await page.waitForFunction(()=>typeof providerImportBuildPlan==='function'&&typeof providerImportOpenFile==='function');
    const reset = async (patch={}) => page.evaluate(seed=>{
      state=normalizeState(seed);clientInvestmentSummaryCache.clear();clientPensionSummaryCache.clear();clientDirectoryStatsCache=null;
      persist();if(document.getElementById('providerImportModal'))closeModal('providerImportModal');
    },{...structuredClone(fixture),...patch});
    const snapshot = () => page.evaluate(()=>JSON.stringify(state));
    const portfolio = () => page.evaluate(()=>state.clients.map(c=>({id:c.id,items:investmentPortfolioForClient(c.id)})));
    const build = (rows,opts={}) => page.evaluate(({rows,opts})=>providerImportBuildPlan(state,providerImportParseAvant(rows,{fileName:'qa-report.xlsx',reportDate:'2026-10-15',...opts})),{rows,opts});
    const commit = batch => page.evaluate(batch=>providerImportCommit(batch),batch);
    const resolve = (batchId,entryId,action) => page.evaluate(({batchId,entryId,action})=>providerImportResolve(batchId,entryId,action),{batchId,entryId,action});
    const records = () => page.evaluate(()=>state.investmentRecords.map(r=>({raw:r,value:invCurrentValue(r),key:invRecordKey(r),client:r._providerClientId,isin:invIsin(r)})));
    const openWorkbook = async (rows,provider='avant',fileName='synthetic-report.xlsx',date1904=false) => page.evaluate(async ({rows,provider,fileName,date1904})=>{
      const workbook=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),'Report');
      workbook.Workbook={WBProps:{date1904}};
      const bytes=XLSX.write(workbook,{bookType:'xlsx',type:'array'});
      await providerImportOpenFile(new File([bytes],fileName,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),provider,'fki');
    },{rows,provider,fileName,date1904});

    // Assertions below exercise the public parser, plan/commit API and the actual XLSX UI.

    // 1. Parsing preserves source dates, blank/zero distinctions and decimal CP precision.
    const parsing = await page.evaluate(({row})=>{
      const regular=providerImportParseAvant([row],{fileName:'qa.xlsx',reportDate:'2026-10-15'});
      const matrix=providerImportParseAvant([Object.keys(row),Object.values(row)],{fileName:'qa.xlsx',reportDate:'2026-10-15'});
      const excel=providerImportParseAvant([{...row,'Datum připsání platby/datum podání žádosti o odkup':44560,'Datum emise/zpětného odkupu':44582,'Poslední schválená hodnota do':45200}],{date1904:true,fileName:'qa-1904.xlsx',reportDate:'2026-10-15'});
      const empty=providerImportParseAvant([{...row,'Aktuální hodnota investice':''},{...row,'Pokyn':'1003','Aktuální hodnota investice':0}],{reportDate:'2026-10-15'});
      return {regular,matrix,excel,empty};
    },{row:avant({'Čistá investice':'100 000,00','Počet vydaných CP/Počet odkupovaných CP':'1 000,000001','Poslední schválená hodnota CP':'120,123456','Aktuální hodnota investice':'120 123,45612'})});
    assert.equal(parsing.regular.rows.length,1);assert.deepEqual(parsing.regular.errors,[]);
    const parsed=parsing.regular.rows[0];
    assert.equal(parsed.isin,ISIN);assert.equal(parsed.amount,100000);assert.equal(parsed.units,1000.000001);
    assert.equal(parsed.nav,120.123456);assert.equal(parsed.current,120123.45612);assert.equal(parsed.valuationDate,'2026-09-30');
    assert.equal(parsing.matrix.rows[0].key,parsed.key,'object and AoA import formats retain the same transaction identity');
    assert.equal(parsing.excel.rows[0].paymentDate,'2025-12-31','1904 Excel date system is honoured');
    assert.equal(parsing.excel.rows[0].emissionDate,'2026-01-22');assert.equal(parsing.excel.rows[0].valuationDate,'2027-10-02');
    assert.equal(parsing.empty.rows[0].current,null,'an absent current amount must not become a zero balance');
    assert.equal(parsing.empty.rows[1].current,0,'an explicit numeric zero is retained');

    // 2. Preview is read-only; one client/ISIN may have multiple distinct purchases.
    const initialRows=[avant(),avant({'Pokyn':'1002','Datum připsání platby/datum podání žádosti o odkup':'2025-05-10','Datum emise/zpětného odkupu':'2025-06-01','Čistá investice':50000,'Počet vydaných CP/Počet odkupovaných CP':500,'Aktuální hodnota investice':60000}),avant({Investor:'QA Beta Investor','RČ':'9102020003','Pokyn':'2001','Čistá investice':70000,'Počet vydaných CP/Počet odkupovaných CP':700,'Aktuální hodnota investice':84000})];
    const beforePreview=await snapshot(),initialPlan=await build(initialRows);
    assert.equal(await snapshot(),beforePreview,'building a preview cannot mutate any CRM data');
    assert.equal(initialPlan.entries.length,3);assert(initialPlan.entries.every(e=>e.status==='pending'&&e.canAccept),'new positions require an explicit review');
    const first=await commit(initialPlan);assert.equal(first.ok,true);assert.equal((await records()).length,0,'committing review cannot create unapproved new positions');
    for(const entry of initialPlan.entries)assert.equal((await resolve(initialPlan.id,entry.id,'accept')).ok,true);
    let imported=await records();assert.equal(imported.length,3);assert.equal(imported.filter(r=>String(r.client)==='1').length,2);assert.equal(imported.filter(r=>String(r.client)==='2').length,1);
    assert.deepEqual(imported.filter(r=>String(r.client)==='1').map(r=>r.value).sort((a,b)=>a-b),[60000,120000]);
    assert.equal(new Set(imported.map(r=>r.raw._providerTransactionKey)).size,3,'separate purchases and clients retain independent transaction keys');
    assert.deepEqual(await page.evaluate(()=>({contracts:state.contracts,deals:state.deals,fundValues:state.fundValues})),{contracts:[],deals:[],fundValues:{}},'provider import does not create signed deals or change public fund NAVs');
    const baselinePortfolio=await portfolio();
    const repeatedPlan=await build(initialRows,{fileName:'renamed-same-content.xlsx'});
    assert.equal(repeatedPlan.fingerprint,initialPlan.fingerprint,'duplicate detection is based on content, not the filename');
    const repeat=await commit(repeatedPlan);assert.equal(repeat.ok,true);assert.equal(repeat.duplicate,true);assert.equal((await records()).length,3);assert.deepEqual(await portfolio(),baselinePortfolio);
    const fewer=await build([initialRows[0]],{fileName:'same-filename.xlsx',reportDate:'2026-10-16'});assert.equal((await commit(fewer)).ok,true);
    assert.equal((await records()).length,3,'absence in a report is never a sale or deletion');

    // 3. A later manual balance is preserved until a person resolves the precise discrepancy.
    await reset({investmentRecords:[legacy(),legacy({Investor:'QA Beta Investor',ClientID:'2','RČ':'9102020003','Investiční společnost':'Cyrrus',fkiManualCurrent:150000})]});
    const manualBefore=await records(),manualPlan=await build([avant()]);
    assert.equal(manualPlan.entries.length,1);assert.equal(manualPlan.entries[0].status,'pending');assert.equal(manualPlan.entries[0].canAccept,true);
    assert.equal((await commit(manualPlan)).ok,true);assert.deepEqual(await records(),manualBefore,'pending manual conflict leaves all holdings untouched');
    assert.equal(await page.evaluate(isin=>providerImportNeedsReview(1,isin),ISIN),true);
    assert.equal(await page.evaluate(isin=>providerImportNeedsReview(2,isin),ISIN),false,'red badge cannot leak to another client holding the same ISIN');
    const exactMark=await page.evaluate(()=>{const r=state.investmentRecords[0];return {row:providerImportRecordNeedsReview(1,r),field:providerImportFieldClass(1,invIsin(r),'current',invRecordKey(r))};});
    assert.equal(exactMark.row,true);assert.equal(exactMark.field,'provider-diff-value','the exact affected current-value field is highlighted');
    const keep=await resolve(manualPlan.id,manualPlan.entries[0].id,'keep');assert.equal(keep.ok,true);assert.deepEqual(await records(),manualBefore);
    assert.equal(await page.evaluate(isin=>providerImportNeedsReview(1,isin),ISIN),false);
    assert.equal(await page.evaluate(id=>state.providerImports.find(b=>b.id===id).entries[0].status,manualPlan.id),'kept');
    await page.reload();assert.equal(await page.evaluate(isin=>providerImportNeedsReview(1,isin),ISIN),false,'resolved review stays resolved after reload');
    assert.deepEqual(await records(),manualBefore);
    const newer=await build([avant({'Aktuální hodnota investice':125000,'Poslední schválená hodnota CP':125,'Poslední schválená hodnota do':'2026-10-15'})],{fileName:'qa-report.xlsx',reportDate:'2026-10-21'});
    assert.notEqual(newer.fingerprint,manualPlan.fingerprint,'a changed report with the same filename is a new review');
    assert.equal((await commit(newer)).ok,true);const accepted=await resolve(newer.id,newer.entries[0].id,'accept');assert.equal(accepted.ok,true);
    imported=await records();assert.equal(imported[0].value,125000);assert.deepEqual(imported[1],manualBefore[1]);
    assert.equal(imported.length,2,'accepting a report updates the existing purchase, not a duplicate investment');
    const acceptedState=await snapshot();assert.equal((await resolve(newer.id,newer.entries[0].id,'accept')).ok,true);assert.equal(await snapshot(),acceptedState,'repeated approval is idempotent');
    const old=await build([avant({'Aktuální hodnota investice':105000,'Poslední schválená hodnota do':'2026-01-31'})],{fileName:'old.xlsx',reportDate:'2026-02-01'});
    assert.notEqual(old.entries[0].status,'auto','an older valuation cannot silently replace a newer accepted one');
    assert.equal((await commit(old)).ok,true);assert.equal((await records())[0].value,125000);

    // 4. Strong identity wins over names; unresolved and ambiguous owners never create clients/assets.
    await reset({clients:[...fixture.clients,{id:3,name:'QA Alfa Investor',birthId:'9203030009'}]});
    const unlinked=await build([
      avant({Pokyn:'3001','RČ':'9901011234'}),
      avant({Pokyn:'3002','RČ':''}),
      avant({Pokyn:'3003','RČ':'9102020003',Investor:'QA Alfa Investor'}),
      avant({Pokyn:'3004','RČ':'9001010007',IČO:'12345678'})
    ]);
    assert.equal(unlinked.entries[0].clientId,null);assert.equal(unlinked.entries[0].canAccept,false);
    assert.equal(unlinked.entries[1].clientId,null);assert.equal(unlinked.entries[1].canAccept,false);
    assert.equal(unlinked.entries[2].clientId,2,'report name cannot redirect a known strong identity to a namesake');
    assert.equal(unlinked.entries[3].canAccept,false,'contradictory personal/company identifiers require review');
    assert.equal((await commit(unlinked)).ok,true);assert.equal((await records()).length,0);
    assert.equal(await page.evaluate(()=>state.clients.length),3,'unknown identities never create anonymous clients');
    assert.equal((await resolve(unlinked.id,unlinked.entries[0].id,'accept')).ok,false);
    await reset({clients:[...fixture.clients,{id:3,name:'QA Duplicate RC',birthId:'9001010007'}]});
    const ambiguous=await build([avant()]);assert.equal(ambiguous.entries[0].clientId,null);assert.equal(ambiguous.entries[0].canAccept,false);

    // 5. Only unchanged investment basis with a newer statement may update automatically.
    const automatic=legacy({_source:'historical-import',_updatedAt:undefined,fkiValuationMode:'statement',fkiManualCurrent:undefined,codyaImportDate:'2026-08-31','Poslední schválená hodnota CP':110});
    await reset({investmentRecords:[automatic]});
    const autoPlan=await build([avant()]);assert.equal(autoPlan.entries[0].status,'auto');
    assert.equal((await commit(autoPlan)).applied,1);assert.equal((await records())[0].value,120000);
    const basisPlan=await build([avant({'Čistá investice':105000,'Počet vydaných CP/Počet odkupovaných CP':1050,'Aktuální hodnota investice':126000,'Poslední schválená hodnota do':'2026-10-15'})],{reportDate:'2026-10-20'});
    assert.equal(basisPlan.entries[0].status,'pending');assert(basisPlan.entries[0].changes.some(c=>c.field==='amount'));
    const beforeBasis=await records();assert.equal((await commit(basisPlan)).ok,true);assert.deepEqual(await records(),beforeBasis);
    // Editing the CRM while a preview is open invalidates all application of that preview.
    await reset({investmentRecords:[automatic]});
    const stale=await build([avant()]);
    await page.evaluate(()=>{state.investmentRecords[0].fkiValuationMode='manual';state.investmentRecords[0].fkiManualCurrent=145000;});
    const afterManual=await snapshot();assert.equal((await commit(stale)).ok,false);assert.equal(await snapshot(),afterManual);
    // Atomic persistence failure leaves both the value and the review ledger unchanged.
    await reset({investmentRecords:[automatic]});const failedPlan=await build([avant()]);const beforeFailed=await snapshot();
    const failed=await page.evaluate(batch=>{const save=persist;try{persist=()=>false;return providerImportCommit(batch);}finally{persist=save;}},failedPlan);
    assert.equal(failed.ok,false);assert.equal(await snapshot(),beforeFailed);
    await reset({investmentRecords:[legacy()]});const failedReviewPlan=await build([avant()]);assert.equal((await commit(failedReviewPlan)).ok,true);
    const beforeFailedReview=await snapshot();
    const failedReview=await page.evaluate(({batchId,entryId})=>{const save=persist;try{persist=()=>false;return providerImportResolve(batchId,entryId,'accept');}finally{persist=save;}},{batchId:failedReviewPlan.id,entryId:failedReviewPlan.entries[0].id});
    assert.equal(failedReview.ok,false);assert.equal(await snapshot(),beforeFailedReview);
    assert.equal(await page.evaluate(isin=>providerImportNeedsReview(1,isin),ISIN),true,'failed save cannot clear the warning');
    // A pending review also rechecks its target after manual edits, even when imported earlier.
    await page.evaluate(()=>state.investmentRecords[0].fkiManualCurrent=155000);
    const afterReviewEdit=await snapshot();assert.equal((await resolve(failedReviewPlan.id,failedReviewPlan.entries[0].id,'accept')).ok,false);assert.equal(await snapshot(),afterReviewEdit);
    assert.equal((await resolve(failedReviewPlan.id,failedReviewPlan.entries[0].id,'keep')).ok,true,'the adviser may confirm the newly corrected CRM value');

    // 6. A redemption reduces current assets by CP value while actual paid cash stays separate.
    await reset();
    const cashRows=[avant({'Čistá investice':1000000,'Počet vydaných CP/Počet odkupovaných CP':10000,'Aktuální hodnota investice':1200000}),avant({Pokyn:'4002','Typ transakce':'Odkup','Čistá investice':-200000,'Počet vydaných CP/Počet odkupovaných CP':-2000,'Aktuální hodnota investice':-240000,'Datum připsání platby/datum podání žádosti o odkup':'2026-08-01','Datum emise/zpětného odkupu':'2026-08-15'})];
    const orphanRedemption=await build([cashRows[1]]);assert.equal(orphanRedemption.entries[0].canAccept,false,'a redemption without a known purchase cannot silently create a negative portfolio');
    await reset({investmentRecords:[
      {...automatic,'Čistá investice':1000000,'Počet vydaných CP':10000,'Aktuální hodnota investice':1100000},
      {...automatic,'Typ transakce':'Odkup','Čistá investice':-200000,'Počet vydaných CP':-2000,'Aktuální hodnota investice':-200000,'Datum připsání platby':'2026-08-01','Datum emise':'2026-08-15'}
    ]});
    const cashPlan=await build(cashRows);assert.equal((await commit(cashPlan)).ok,true);
    for(const entry of cashPlan.entries)assert.equal((await resolve(cashPlan.id,entry.id,'accept')).ok,true);
    const cash=await page.evaluate(()=>{
      const rows=investmentRecordsForClient(1),out=rows.find(invIsWithdrawal),portfolio=investmentPortfolioForClient(1);
      return {count:rows.length,current:rows.reduce((sum,r)=>sum+invCurrentValue(r),0),debit:invCurrentValue(out),cash:invWithdrawalValue(out),portfolioCurrent:portfolio.reduce((sum,p)=>sum+p.current,0),totalGain:portfolio.reduce((sum,p)=>sum+p.gain,0)};
    });
    assert.equal(cash.count,2);assert.equal(cash.current,960000);assert.equal(cash.debit,-240000);assert.equal(cash.cash,200000);assert.equal(cash.portfolioCurrent,960000);
    const repeatCash=await build(cashRows,{fileName:'same-redemption-renamed.xlsx'});assert.equal((await commit(repeatCash)).duplicate,true);assert.equal((await records()).length,2);
    const complicated=await build([avant({Pokyn:'5001','Typ transakce':'Konverze'}),avant({Pokyn:'5002','Typ transakce':'Převod'}),avant({Pokyn:'5003',Měna:'EUR'})]);
    assert(complicated.entries.filter(e=>!e.incoming.missing).every(e=>e.status==='pending'&&!e.canAccept),'conversion, transfer and foreign currency need explicit manual reconciliation');
    const cashBefore=await records();assert.equal((await commit(complicated)).ok,true);assert.deepEqual(await records(),cashBefore);

    // 7. Codya uses the whole share-class name and never distributes an aggregate across lots.
    const codyaRecord=(name,patch={})=>legacy({Fond:name,'Investiční společnost':'Codya',fkiValuationMode:'statement',fkiManualCurrent:undefined,_source:'historical-import',_updatedAt:undefined,codyaImportDate:'2026-08-31',...patch});
    await reset({investmentRecords:[codyaRecord('QA PENTA tř.D_CZK'),codyaRecord('QA PENTA tř.A_CZK',{'rp.ISIN':OTHER_ISIN,'Datum připsání platby':'2025-03-01','Datum emise':'2025-04-01'})]});
    const codyaRow={'RODNÉ ČÍSLO':'9001010007','JMÉNO':'QA Alfa','PŘIJMENÍ':'Investor','QA PENTA tř.D_CZK':125000,'QA PENTA tř.A_CZK':''};
    const codya=await page.evaluate(row=>providerImportBuildPlan(state,providerImportParseCodya([row],{fileName:'codya.xlsx',reportDate:'2026-10-01',area:'fki'})),codyaRow);
    assert.equal(codya.entries.find(e=>e.fund==='QA PENTA tř.D_CZK').status,'auto');
    assert.equal(codya.entries.find(e=>e.fund==='QA PENTA tř.A_CZK').canAccept,false);
    assert.equal((await commit(codya)).ok,true);imported=await records();assert.equal(imported[0].value,125000);assert.equal(imported[1].value,110000,'blank A-class value cannot zero an existing investment');
    const codyaZero=await page.evaluate(row=>providerImportBuildPlan(state,providerImportParseCodya([{...row,'QA PENTA tř.D_CZK':0}],{reportDate:'2026-10-02',area:'fki'})),codyaRow);
    const zeroEntry=codyaZero.entries.find(e=>e.fund==='QA PENTA tř.D_CZK');assert.equal(zeroEntry.status,'pending');assert.equal(zeroEntry.canAccept,true);
    assert.equal((await commit(codyaZero)).ok,true);assert.equal((await records())[0].value,125000);assert.equal((await resolve(codyaZero.id,zeroEntry.id,'accept')).ok,true);assert.equal((await records())[0].value,0);
    await reset({investmentRecords:[codyaRecord('QA PENTA tř.D_CZK'),codyaRecord('QA PENTA tř.D_CZK',{'Datum připsání platby':'2025-03-01','Datum emise':'2025-04-01'})]});
    const codyaMulti=await page.evaluate(row=>providerImportBuildPlan(state,providerImportParseCodya([row],{reportDate:'2026-10-01',area:'fki'})),codyaRow);
    assert.equal(codyaMulti.entries[0].status,'pending');assert.equal(codyaMulti.entries[0].canAccept,false);
    const codyaBefore=await records();assert.equal((await commit(codyaMulti)).ok,true);assert.deepEqual(await records(),codyaBefore);
    const fuzzy=await page.evaluate(()=>providerImportBuildPlan(state,providerImportParseCodya([{'RODNÉ ČÍSLO':'9001010007','JMÉNO':'QA Alfa','PŘIJMENÍ':'Investor','QA PENTA tř.C_CZK':120000}],{reportDate:'2026-10-01',area:'fki'})));
    assert.equal(fuzzy.entries[0].canAccept,false,'similar fund names cannot assign the wrong class');

    // 8. Re-import checks changed CRM state, even when the provider file is byte-for-byte identical.
    await reset({investmentRecords:[automatic]});
    const beforeLocalEdit=await build([avant()]);assert.equal((await commit(beforeLocalEdit)).ok,true);
    await page.evaluate(()=>{state.investmentRecords[0].fkiValuationMode='manual';state.investmentRecords[0].fkiManualCurrent=139000;});
    const sameFileAfterEdit=await build([avant()],{fileName:'same-content-after-manual-edit.xlsx'});
    assert.equal(sameFileAfterEdit.fingerprint,beforeLocalEdit.fingerprint);assert.equal(sameFileAfterEdit.entries[0].status,'pending');
    assert.equal((await commit(sameFileAfterEdit)).ok,true);assert.equal((await records())[0].value,139000);
    assert.equal(await page.evaluate(()=>state.providerImports.length),1,'refreshing a stale file review does not duplicate the import ledger');
    assert.equal((await resolve(sameFileAfterEdit.id,sameFileAfterEdit.entries[0].id,'keep')).ok,true);
    await page.evaluate(()=>state.investmentRecords[0].fkiManualCurrent=141000);
    const sameKeptAfterEdit=await build([avant()]);assert.equal(sameKeptAfterEdit.entries[0].status,'pending','an old keep decision cannot hide a newly edited CRM discrepancy');
    // Value, NAV and valuation date form one coherent imported observation.
    for(const date of ['2026-08-31','2026-09-30']){
      await reset({investmentRecords:[{...automatic,'Aktuální hodnota investice':120000,'Poslední schválená hodnota CP':120,codyaImportDate:date}]});
      const adoption=await build([avant()]);assert.equal(adoption.entries[0].status,'auto');
      assert.deepEqual(adoption.entries[0].changes.map(c=>c.field),date==='2026-08-31'?['valuationDate']:[]);
      assert.equal((await commit(adoption)).ok,true);
      const saved=(await records())[0];assert.equal(saved.value,120000);
      assert.deepEqual(saved.raw.providerValuation,{provider:'avant',current:120000,nav:120,date:'2026-09-30'},'adoption must store a full valuation tuple even when the amount did not change');
    }
    // The catalog may identify a fund solely through its dictionary key.
    await reset({investmentRecords:[automatic],fundValues:{['isin|'+ISIN.toLowerCase()]:{nav:140,date:'2026-10-15'}}});
    const newerCatalog=await build([avant()]);assert.equal(newerCatalog.entries[0].status,'pending');
    assert.equal(newerCatalog.entries[0].changes.find(c=>c.field==='current').before,140000,'comparison displays the actual NAV-derived CRM value');
    assert.equal((await commit(newerCatalog)).ok,true);assert.equal((await records())[0].value,140000);
    await page.evaluate(isin=>state.fundValues['isin|'+isin.toLowerCase()].nav=145,ISIN);
    const changedCatalog=await snapshot();assert.equal((await resolve(newerCatalog.id,newerCatalog.entries[0].id,'accept')).ok,false);assert.equal(await snapshot(),changedCatalog,'a NAV change after review creation requires a fresh comparison');
    // Partial selection cannot attach a new date to an unrelated old amount or NAV.
    await reset({investmentRecords:[legacy()]});const partialPlan=await build([avant()]);assert.equal((await commit(partialPlan)).ok,true);
    const partialBefore=await snapshot();
    for(const fields of [[],['current'],['valuationDate'],['nav','current'],['notAnImportField']]){
      const result=await page.evaluate(({batchId,entryId,fields})=>providerImportResolve(batchId,entryId,'accept',fields),{batchId:partialPlan.id,entryId:partialPlan.entries[0].id,fields});
      assert.equal(result.ok,false);assert.equal(await snapshot(),partialBefore,'invalid partial acceptance changes neither ledger nor holdings');
    }
    const failTuple=await page.evaluate(({batchId,entryId})=>{
      const save=persist;try{persist=()=>{state.settings.qaFailedWrite='must-roll-back';return false;};return providerImportResolve(batchId,entryId,'accept',['current','nav','valuationDate']);}finally{persist=save;}
    },{batchId:partialPlan.id,entryId:partialPlan.entries[0].id});
    assert.equal(failTuple.ok,false);assert.equal(await snapshot(),partialBefore,'failure restores all state touched during persistence, not only the investment array');
    const fullTuple=await page.evaluate(({batchId,entryId})=>providerImportResolve(batchId,entryId,'accept',['current','nav','valuationDate']),{batchId:partialPlan.id,entryId:partialPlan.entries[0].id});
    assert.equal(fullTuple.ok,true);assert.equal((await records())[0].value,120000);

    // Adoption gives legacy records stable provider identities. Internal link rewrites cannot
    // make another entry from the same preview look as though the user edited it concurrently.
    const linkedLegacy=[
      {...automatic,'Čistá investice':1000000,'Počet vydaných CP':10000,'Aktuální hodnota investice':1100000},
      {...automatic,'Typ transakce':'Odkup','Čistá investice':-200000,'Počet vydaných CP':-2000,'Aktuální hodnota investice':-200000,'Datum připsání platby':'2026-08-01','Datum emise':'2026-08-15'}
    ];
    const linkWithdrawal=()=>page.evaluate(()=>{
      const buy=state.investmentRecords.find(r=>!invIsWithdrawal(r)),out=state.investmentRecords.find(invIsWithdrawal);
      out.redemptionSourceRecordKey=invRecordKey(buy);out['Odkup z nákupu']=invRecordKey(buy);
      return invRecordKey(buy);
    });
    const assertLinked=async batchId=>{
      const links=await page.evaluate(batchId=>{
        const buy=state.investmentRecords.find(r=>!invIsWithdrawal(r)),out=state.investmentRecords.find(invIsWithdrawal),batch=state.providerImports.find(b=>b.id===batchId);
        return {buyKey:invRecordKey(buy),linked:out.redemptionSourceRecordKey,linkedAlias:out['Odkup z nákupu'],targets:batch.entries.map(e=>e.targetKey?.key),keys:state.investmentRecords.map(invRecordKey),current:state.investmentRecords.reduce((sum,r)=>sum+invCurrentValue(r),0)};
      },batchId);
      assert.equal(links.linked,links.buyKey);assert.equal(links.linkedAlias,links.buyKey);
      assert.deepEqual(links.targets.slice().sort(),links.keys.slice().sort(),'both ledger entries reference their final adopted records');assert.equal(links.current,960000);
      return links.buyKey;
    };
    await reset({investmentRecords:linkedLegacy});const oldLinkedBuy=await linkWithdrawal();
    const linkedAuto=await build(cashRows);assert(linkedAuto.entries.every(e=>e.status==='auto'));
    const linkedCommit=await commit(linkedAuto);assert.equal(linkedCommit.ok,true,'one automatic batch must survive its own purchase→withdrawal link rewrite: '+JSON.stringify(linkedCommit));
    assert.notEqual(await assertLinked(linkedAuto.id),oldLinkedBuy,'adopting a provider key really exercised the identity rewrite');
    await reset({investmentRecords:linkedLegacy.map(r=>({...r,_source:'local-fki',_updatedAt:'2026-10-20T10:00:00.000Z'}))});await linkWithdrawal();
    const linkedReview=await build(cashRows);assert(linkedReview.entries.every(e=>e.status==='pending'&&e.canAccept));assert.equal((await commit(linkedReview)).ok,true);
    const reviewBuy=linkedReview.entries.find(e=>e.incoming.transactionType==='Platba'),reviewOut=linkedReview.entries.find(e=>e.incoming.transactionType==='Odkup');
    assert.equal((await resolve(linkedReview.id,reviewBuy.id,'accept')).ok,true);
    const reviewOutResult=await resolve(linkedReview.id,reviewOut.id,'accept');assert.equal(reviewOutResult.ok,true,'accepting the linked redemption must not require a reload caused by our own purchase adoption: '+JSON.stringify(reviewOutResult));
    await assertLinked(linkedReview.id);
    await reset({investmentRecords:linkedLegacy.map(r=>({...r,_source:'local-fki',_updatedAt:'2026-10-20T10:00:00.000Z'}))});await linkWithdrawal();
    const concurrentlyEdited=await build(cashRows);assert.equal((await commit(concurrentlyEdited)).ok,true);
    await page.evaluate(()=>state.investmentRecords.find(invIsWithdrawal)['Aktuální hodnota investice']=-210000);
    assert.equal((await resolve(concurrentlyEdited.id,concurrentlyEdited.entries.find(e=>e.incoming.transactionType==='Platba').id,'accept')).ok,true);
    const afterInternalRemap=await snapshot(),editedOut=concurrentlyEdited.entries.find(e=>e.incoming.transactionType==='Odkup');
    assert.equal((await resolve(concurrentlyEdited.id,editedOut.id,'accept')).ok,false,'known internal remap cannot conceal a real intervening user edit on the linked withdrawal');assert.equal(await snapshot(),afterInternalRemap);
    // A genuinely new manual transaction inserted after review creation is not an internal remap.
    await reset();const pendingNew=await build([avant()]);assert.equal(pendingNew.entries[0].canAccept,true);assert.equal((await commit(pendingNew)).ok,true);
    await page.evaluate(record=>state.investmentRecords.push(record),legacy());
    const beforeManualDuplicate=await snapshot(),manualDuplicate=await resolve(pendingNew.id,pendingNew.entries[0].id,'accept');
    assert.equal(manualDuplicate.ok,false,'a newly entered legacy transaction prevents a duplicate provider insertion');assert.equal(await snapshot(),beforeManualDuplicate);

    // 9. Actual XLSX import, visible client/field warnings, keyboard decisions and failure recovery.
    await reset({investmentRecords:[legacy()]});
    const unsafeFund='QA <img src=x onerror="window.__providerXss=1"> fond';
    const uiRow=avant({Fond:unsafeFund});
    const beforeFile=await snapshot();await openWorkbook([uiRow]);
    assert.equal(await page.locator('#providerImportModal').isVisible(),true);
    assert.equal(await snapshot(),beforeFile,'reading a workbook only renders a preview');
    assert.equal(await page.locator('#providerImportBody img').count(),0,'untrusted fund text remains text');
    assert.equal(await page.evaluate(()=>window.__providerXss),undefined);
    assert.equal(await page.locator('#providerImportCommitButton').isEnabled(),true);
    await page.evaluate(()=>{window.__qaOriginalPersist=persist;persist=()=>false;});
    try{await page.locator('#providerImportCommitButton').click();}finally{await page.evaluate(()=>{persist=window.__qaOriginalPersist;delete window.__qaOriginalPersist;});}
    assert.equal(await snapshot(),beforeFile);assert.equal(await page.locator('#providerImportCommitButton').isVisible(),true,'failed file commit retains the preview for retry');
    await page.locator('#providerImportCommitButton').click();
    assert.equal(await page.locator('#providerImportBody .provider-review-entry').count(),1);
    assert.equal(await page.locator('#providerImportBody .provider-diff-value').count()>0,true);
    await page.screenshot({path:'/private/tmp/crm-provider-import-review-desktop.png',fullPage:false});
    await page.setViewportSize({width:390,height:844});
    const mobileBounds=await page.locator('#providerImportModal .modal-box').evaluate(box=>({left:box.getBoundingClientRect().left,right:box.getBoundingClientRect().right,width:innerWidth,scroll:box.scrollWidth,client:box.clientWidth}));
    assert(mobileBounds.left>=-1&&mobileBounds.right<=mobileBounds.width+1,'mobile review fits the viewport');
    assert(mobileBounds.scroll<=mobileBounds.client+1,'mobile review does not horizontally overflow');
    await page.screenshot({path:'/private/tmp/crm-provider-import-review-mobile.png',fullPage:false});
    // Failure while resolving keeps both the warning and the entered data, not just the modal.
    const beforeUiResolution=await snapshot();await page.evaluate(()=>{window.__qaOriginalPersist=persist;persist=()=>false;});
    try{await page.locator('#providerImportBody').getByRole('button',{name:'Přijmout údaje reportu',exact:true}).click();}finally{await page.evaluate(()=>{persist=window.__qaOriginalPersist;delete window.__qaOriginalPersist;});}
    assert.equal(await snapshot(),beforeUiResolution);assert.equal(await page.locator('#providerImportBody').getByRole('button',{name:'Přijmout údaje reportu',exact:true}).isVisible(),true);
    await page.evaluate(()=>{closeModal('providerImportModal');showView('clients');openClientDirectory();});
    const clientRow=page.locator('.client-directory-row').filter({hasText:'QA Alfa Investor'});
    assert.equal(await clientRow.locator('.provider-review-badge').count(),1);assert.match(await clientRow.getAttribute('class'),/provider-needs-review/);
    await clientRow.locator('.provider-review-badge').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#providerImportModal').isVisible(),true,'client warning opens through the keyboard');
    await page.evaluate(()=>{closeModal('providerImportModal');showView('fki');selectFkClient(1);});
    assert.equal(await page.locator('.provider-position-review').count()>0,true,'the affected FKI transaction is visibly marked');
    await page.evaluate(()=>providerImportOpenReviews(1));
    await page.locator('#providerImportBody').getByRole('button',{name:'Potvrdit správnost CRM',exact:true}).focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#providerImportBody .provider-review-entry').count(),0);assert.equal((await records())[0].value,130000);
    await page.reload();assert.equal(await page.evaluate(isin=>providerImportNeedsReview(1,isin),ISIN),false);
    await page.evaluate(()=>providerImportOpenReviews(1));await page.locator('.provider-history input').check();
    assert.match(await page.locator('#providerImportBody').innerText(),/Potvrzeno CRM/,'the review decision is retained in history');
    await page.setViewportSize({width:1440,height:1080});
    // Codya requires a user-supplied actual report date, not the upload date.
    await reset({investmentRecords:[codyaRecord('QA PENTA tř.D_CZK')]});await openWorkbook([codyaRow],'codya');
    assert.equal(await page.locator('#providerReportDate').inputValue(),'');assert.equal(await page.locator('#providerImportCommitButton').isDisabled(),true);
    await page.locator('#providerReportDate').fill('2026-10-01');await page.locator('#providerReportDate').dispatchEvent('change');
    assert.equal(await page.locator('#providerImportCommitButton').isEnabled(),true);await page.locator('#providerImportCommitButton').click();
    assert.equal((await records())[0].value,125000);assert.equal((await records())[0].raw.providerValuation.date,'2026-10-01');

    assert.deepEqual(errors,[],'no JavaScript errors in the isolated CRM');
    assert(dialogs.every(message=>/Uložení se nezdařilo/.test(message)),'only deliberately simulated persistence failures may show a dialog: '+JSON.stringify(dialogs));
    console.log('PASS: Avant/Codya parsing and source dates, identity/class/transaction isolation, protected manual values, reviewed new positions, idempotence, stale-preview and persistence rollback, redemption value vs cash, real XLSX UI, client/field warnings, keyboard and mobile review.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
