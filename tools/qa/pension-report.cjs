// Synthetic data only. Tests pension balances/history and the standalone offline report.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),fixture=require('./fixture.cjs');
const root=path.resolve(__dirname,'../..');
// Optional read-only baseline route proves the regression against an earlier revision.
const baselineScript=process.env.CRM_QA_SCRIPT_REF?require('node:child_process').execFileSync('git',['show',process.env.CRM_QA_SCRIPT_REF+':assets/js/crm.js'],{cwd:root,maxBuffer:12*1024*1024}):null;
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));if(u.hostname==='crm.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:baselineScript&&u.pathname==='/assets/js/crm.js'?baselineScript:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return route.abort();});
 const data=structuredClone(fixture);const pension=data.contracts.find(x=>x.id===12);pension.amount='528882';pension.number='PRIVATE-PENSION-CONTRACT-12';
 data.deals.push({id:400,clientId:1,category:'DPS',company:pension.company,product:'DPS',contractId:12,amount:528882,date:'2026-01-01'});
 data.deals.push({id:401,clientId:2,category:'DIP',company:'Test DIP',product:'Dynamický DIP',amount:25000,date:'2026-01-01'});
 data.contracts.push(
  {id:70,clientId:2,type:'auto',company:'QA pojišťovna',product:'QA vozidlo',number:'QA-AUTO',amount:'5062',status:'vyrizeno'},
  {id:71,clientId:2,type:'život',company:'QA pojišťovna',product:'QA život',number:'QA-LIFE',amount:'1200',status:'vyrizeno'},
  {id:72,clientId:2,type:'hypotéka',company:'QA banka',product:'QA hypotéka',number:'QA-LOAN',amount:'2000000',status:'vyrizeno'},
  {id:73,clientId:2,type:'investice',company:'QA investice',product:'QA běžný fond',number:'QA-INV',amount:'10000',status:'vyrizeno'},
  {id:74,clientId:2,type:'DIP',company:'QA DIP',product:'QA penzijní účet',number:'QA-DIP',amount:'500',pensionCurrent:0,pensionInvested:0,pensionMonthlyPayment:500,status:'vyrizeno'}
 );
 await context.addInitScript(data=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(data));},data);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof pensionStoreValuation==='function');
 // Use rendered visibility: hidden=true alone is insufficient when .field overrides display.
 const assertPensionFields=async(visible,label)=>{
  assert.equal(await page.locator('#sPensionFields').isVisible(),visible,label+' rendered visibility');
  assert.equal(await page.locator('#sPensionFields').evaluate(el=>el.hidden),!visible,label+' hidden state');
  const fields=await page.locator('#sPensionFields').evaluate(el=>[...el.querySelectorAll('input,select,textarea')].map(field=>({id:field.id,disabled:field.disabled})));
  assert(fields.length>0);assert(fields.every(field=>field.disabled===!visible),label+' pension inputs enabled only for DPS/DIP: '+JSON.stringify(fields));
 };
 const pensionBaseline=await page.evaluate(()=>({one:clientPensionSummary(1).total,two:clientPensionSummary(2).total,ids:pensions_pItems().map(x=>x.id)}));
 assert.equal(pensionBaseline.one,528882);assert.equal(pensionBaseline.two,25000,'zero-balance DIP and nonpension contracts add no pension assets');
 for(const [id,type] of [[70,'auto'],[71,'život'],[72,'hypotéka'],[73,'investice']]){
  await page.evaluate(id=>openContractModal(2,id),id);assert.equal(await page.locator('#sType').inputValue(),type);
  await assertPensionFields(false,'open '+type);
  for(const field of ['#sPensionCurrent','#sPensionInvested','#sPensionPayment'])assert.equal(await page.locator(field).inputValue(),'','nonpension '+type+' does not prefill '+field+' from its payment');
  await page.locator('#contractModal').getByText('Uložit smlouvu',{exact:true}).click();await page.reload();
  await page.evaluate(id=>openContractModal(2,id),id);await assertPensionFields(false,'saved and reopened '+type);
  assert.deepEqual(await page.evaluate(id=>Object.keys(state.contracts.find(x=>x.id===id)).filter(key=>key.startsWith('pension')),id),[],'saving '+type+' must not add pension properties');
  await page.evaluate(()=>closeModal('contractModal'));
 }
 await page.evaluate(()=>openContractModal(1,12));await assertPensionFields(true,'existing DPS');
 assert.equal(await page.locator('#sPensionCurrent').inputValue(),'528882');
 await page.locator('#sPensionCurrent').fill('543210');await page.locator('#sPensionInvested').fill('400000');
 await page.locator('#sType').selectOption('auto');await assertPensionFields(false,'DPS draft switched to auto');
 await page.locator('#sType').selectOption('DPS');await assertPensionFields(true,'DPS draft restored');
 assert.equal(await page.locator('#sPensionCurrent').inputValue(),'543210');assert.equal(await page.locator('#sPensionInvested').inputValue(),'400000');
 await page.locator('#sType').selectOption('DIP');await assertPensionFields(true,'DPS draft switched to DIP');
 assert.equal(await page.locator('#sPensionCurrent').inputValue(),'543210');await page.evaluate(()=>closeModal('contractModal'));
 await page.evaluate(()=>openContractModal(2,74));await assertPensionFields(true,'existing DIP');assert.equal(await page.locator('#sPensionCurrent').inputValue(),'0');
 await page.locator('#contractModal').getByText('Uložit smlouvu',{exact:true}).click();await page.reload();await page.evaluate(()=>openContractModal(2,74));await assertPensionFields(true,'saved and reopened DIP');assert.equal(await page.locator('#sPensionCurrent').inputValue(),'0');
 await page.evaluate(()=>openContractModal(2,70));await page.locator('#sType').selectOption('DPS');await assertPensionFields(true,'auto temporarily switched to DPS');await page.locator('#sPensionCurrent').fill('999999');
 await page.locator('#sType').selectOption('auto');await assertPensionFields(false,'temporary pension draft hidden again');await page.locator('#contractModal').getByText('Uložit smlouvu',{exact:true}).click();await page.reload();
 const autoSaved=await page.evaluate(()=>({auto:state.contracts.find(x=>x.id===70),one:clientPensionSummary(1).total,two:clientPensionSummary(2).total,ids:pensions_pItems().map(x=>x.id)}));
 assert.equal(autoSaved.auto.type,'auto');assert.equal(autoSaved.auto.amount,'5062');assert.deepEqual(Object.keys(autoSaved.auto).filter(key=>key.startsWith('pension')),[]);
 assert.equal(autoSaved.one,pensionBaseline.one);assert.equal(autoSaved.two,pensionBaseline.two);assert.deepEqual(autoSaved.ids,pensionBaseline.ids,'nonpension saves never enter pension AUM');
 await page.evaluate(()=>openContractModal(2,70));await assertPensionFields(false,'auto after temporary DPS draft reload');assert.equal(await page.locator('#sPensionCurrent').inputValue(),'');
 await page.screenshot({path:'/private/tmp/crm-auto-contract-without-pension.png'});
 await page.setViewportSize({width:390,height:844});await assertPensionFields(false,'mobile auto');await page.screenshot({path:'/private/tmp/crm-auto-contract-without-pension-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>openContractModal(2));assert.equal(await page.locator('#sType').inputValue(),'auto');await assertPensionFields(false,'new default auto contract');await page.evaluate(()=>closeModal('contractModal'));
 assert.equal(await page.evaluate(()=>pensions_pItems().filter(x=>x.clientId===1).length),1,'linked deal must not duplicate a pension');
 const counts=await page.evaluate(()=>[state.contracts.length,state.deals.length,state.activities.length,state.investmentSnapshots.length]);
 await page.evaluate(()=>openContractModal(1,12));
 await page.locator('#sAmount').fill('1700');await page.locator('#sPensionCurrent').fill('540000');await page.locator('#sPensionInvested').fill('400000');await page.locator('#sPensionOther').fill('30000');await page.locator('#sPensionWithdrawn').fill('10000');await page.locator('#sPensionPayment').fill('1700');await page.locator('#sPensionDate').fill('2026-10-22');await page.locator('#sPensionStrategy').fill('Dynamický fond');
 await page.locator('#contractModal').getByText('Uložit smlouvu',{exact:true}).click();await page.reload();
 const first=await page.evaluate(()=>{const s=state.contracts.find(x=>x.id===12);return {s,p:pensionPerformance(s),amount:clientPensionSummary(1).total};});
 assert.equal(first.amount,540000);assert.equal(first.s.amount,'1700');assert.equal(first.p.gain,120000);assert.ok(Math.abs(first.p.pct-120000/430000*100)<1e-10);assert.equal(first.p.complete,true);assert.equal(first.s.pensionStrategy,'Dynamický fond');
 const afterContractCounts=await page.evaluate(()=>[state.contracts.length,state.deals.length,state.activities.length,state.investmentSnapshots.length]);
 assert.deepEqual([afterContractCounts[0],afterContractCounts[1],afterContractCounts[3]],[counts[0],counts[1],counts[3]]);
 assert.equal(first.s.pensionValuationHistory.length,2);assert.equal(first.s.pensionValuationHistory[0].pensionCurrent,528882,'original legacy amount must be captured before a contract amount edit');assert.equal(first.s.pensionValuationHistory[1].pensionCurrent,540000);
 await page.evaluate(()=>openPensionValuation('contract',12));assert.equal(await page.locator('#pvInvested').inputValue(),'400000');assert.equal(await page.locator('#pvOther').inputValue(),'30000');
 await page.locator('#pensionValuationModal').getByText('Uložit hodnoty',{exact:true}).click();assert.equal(await page.evaluate(()=>state.contracts.find(x=>x.id===12).pensionValuationHistory.length),2,'identical save must not append history');
 await page.evaluate(()=>openPensionValuation('contract',12));await page.locator('#pvCurrent').fill('560000');await page.locator('#pvInvested').fill('410000');await page.locator('#pvDate').fill('2026-10-23');await page.locator('#pensionValuationModal').getByText('Uložit hodnoty',{exact:true}).click();await page.reload();
 assert.deepEqual(await page.evaluate(()=>{const s=state.contracts.find(x=>x.id===12);return [s.pensionCurrent,s.pensionInvested,s.pensionValuationHistory.length,pensionPerformance(s).gain];}),[560000,410000,3,130000]);
 assert.deepEqual(await page.evaluate(()=>[state.contracts.length,state.deals.length,state.activities.length,state.investmentSnapshots.length]),afterContractCounts,'valuations do not create duplicate accounts, deals or activity records');
 // Saving on the deal-backed DIP is persisted on the existing record.
 await page.evaluate(()=>openPensionValuation('deal',401));await page.locator('#pvCurrent').fill('40000');await page.locator('#pvInvested').fill('35000');await page.locator('#pvOther').fill('0');await page.locator('#pvDate').fill('2026-10-23');await page.locator('#pensionValuationModal').getByText('Uložit hodnoty',{exact:true}).click();await page.reload();
 assert.deepEqual(await page.evaluate(()=>{const d=state.deals.find(x=>x.id===401);return [d.amount,d.pensionCurrent,pensionPerformance(d,'deal').gain,d.pensionValuationHistory.length];}),[25000,40000,5000,2]);
 // Failed persistence restores the last saved source and keeps the user's draft open.
 await page.evaluate(()=>{window.__realPersist=persist;persist=()=>false;openPensionValuation('contract',12);});await page.locator('#pvCurrent').fill('999999');await page.locator('#pensionValuationModal').getByText('Uložit hodnoty',{exact:true}).click();
 assert.equal(await page.evaluate(()=>state.contracts.find(x=>x.id===12).pensionCurrent),560000);assert.equal(await page.locator('#pvCurrent').inputValue(),'999999');assert.equal(await page.locator('#pensionValuationModal').isVisible(),true);await page.evaluate(()=>{persist=window.__realPersist;closeModal('pensionValuationModal');});
 await page.evaluate(()=>{
  state.contracts.push({id:600,clientId:1,type:'DIP',company:'Test DIP',product:'DIP nula',number:'PRIVATE-ZERO',amount:90000,pensionCurrent:0,pensionInvested:0,pensionOtherContributions:0,pensionMonthlyPayment:0,status:'vyrizeno'});
  state.contracts.push({id:601,clientId:1,type:'DPS',company:'Test penze',product:'DPS bez hodnoty',number:'PRIVATE-UNKNOWN',pensionCurrent:null,pensionInvested:5000,pensionMonthlyPayment:1200,status:'vyrizeno'});
  state.contracts.push({id:602,clientId:1,type:'DPS',company:'Test penze',product:'Příspěvky neznámé',number:'PRIVATE-OTHER',pensionCurrent:10000,pensionInvested:8000,pensionOtherContributions:null,status:'vyrizeno'});
  persist();
 });await page.reload();
 assert.equal(await page.evaluate(()=>clientPensionSummary(1).total),570000);assert.equal(await page.evaluate(()=>pensionPerformance(state.contracts.find(x=>x.id===601)).gain),null);assert.equal(await page.evaluate(()=>pensionPerformance(state.contracts.find(x=>x.id===602)).complete),false);
 await page.evaluate(()=>{showView('pensions');pensions_selectedPensionClientId=1;renderPensions();});await page.screenshot({path:'/private/tmp/crm-pension-desktop.png',fullPage:true});
 await page.evaluate(()=>openPensionValuation('contract',12));await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('#pensionValuationModal .modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'/private/tmp/crm-pension-editor-mobile.png'});await page.evaluate(()=>closeModal('pensionValuationModal'));
 const html=await page.evaluate(()=>clientOutput_xReportHtml(findClient(1),{summary:true,investments:true,fki:true,pensions:true,notice:true}));assert.doesNotMatch(html,/PRIVATE-(?:PENSION|ZERO|UNKNOWN|OTHER)/);
 const report=await context.newPage();report.on('pageerror',e=>errors.push('REPORT '+e.message));await report.setContent(html);
 assert.equal(await report.locator('.pension-card').count(),4);assert.match(await report.locator('[data-report-item=pension-contract-12]').innerText(),/Dynamický fond/);assert.match(await report.locator('[data-report-item=pension-contract-12]').innerText(),/130\s*000/);assert.match(await report.locator('[data-report-item=pension-contract-601]').innerText(),/Neuvedeno/);assert.match(await report.locator('[data-report-item=pension-contract-602]').innerText(),/Rozdíl proti vlastním vkladům/i);
 assert.match(await report.locator('[data-summary-group=total] [data-value=current]').innerText(),/870\s*000/);assert.match(await report.locator('[data-summary-group=pensions] [data-value=gain]').innerText(),/Neuvedeno/);assert.match(await report.locator('[data-summary-group=pensions] [data-value=invested]').innerText(),/453\s*000/);assert.equal(await report.locator('.allocation-slice').count(),2);assert.equal(await report.locator('.timeline-status').innerText(),'Aktuální hodnota');
 assert.equal(await report.evaluate(()=>JSON.parse(decodeURIComponent(document.querySelector('.portfolio-timeline').dataset.model)).funds.length),2,'pensions stay out of investment return charts');
 await report.locator('#reportSelection summary').click();await report.locator('[data-pick-item=pension-contract-601]').uncheck();await report.locator('[data-pick-item=pension-contract-602]').uncheck();
 assert.match(await report.locator('[data-summary-group=pensions] [data-value=gain]').innerText(),/130\s*000/);assert.match(await report.locator('[data-summary-group=pensions]').innerText(),/Zhodnocení/i);assert.equal(await report.locator('[data-report-item=pension-contract-601]').isVisible(),false);
 await report.locator('[data-pick-group=fki]').uncheck();assert.equal(await report.locator('.allocation-slice').count(),1);assert.match(await report.locator('[data-summary-group=total] [data-value=current]').innerText(),/660\s*000/);await report.locator('[data-pick-group=fki]').check();await report.locator('#reportSelection summary').click();
 await report.locator('.allocation-slice').first().focus();assert.equal(await report.locator('.allocation-slice').first().getAttribute('tabindex'),'0');assert.ok(await report.locator('.allocation-slice').first().getAttribute('aria-label'));await report.screenshot({path:'/private/tmp/crm-pension-report-desktop.png',fullPage:true});await report.locator('.timeline-allocation').screenshot({path:'/private/tmp/crm-pension-chart-desktop.png'});
 await report.setViewportSize({width:794,height:1123});await report.emulateMedia({media:'print'});await report.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
 const print=await report.locator('.timeline-donut').evaluate(e=>{const r=e.getBoundingClientRect(),ring=e.querySelector('.timeline-ring').getBoundingClientRect(),mid=e.querySelector('.timeline-center').getBoundingClientRect();return {w:r.width,h:r.height,rw:ring.width,rh:ring.height,contained:mid.left>=r.left&&mid.right<=r.right&&mid.top>=r.top&&mid.bottom<=r.bottom};});assert.equal(print.rw,print.w);assert.equal(print.rh,print.h);assert.ok(print.contained);assert.equal(await report.locator('[data-report-item=pension-contract-601]').isVisible(),false);await report.screenshot({path:'/private/tmp/crm-pension-report-print.png',fullPage:true});await report.evaluate(()=>window.dispatchEvent(new Event('afterprint')));await report.emulateMedia({media:'screen'});assert.equal(await report.locator('.timeline-status').innerText(),'Aktuální hodnota');
 await report.setViewportSize({width:390,height:844});assert.ok(await report.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await report.screenshot({path:'/private/tmp/crm-pension-report-mobile.png'});await report.locator('.portfolio-timeline').screenshot({path:'/private/tmp/crm-pension-chart-mobile.png'});await report.locator('[data-report-item=pension-contract-12]').screenshot({path:'/private/tmp/crm-pension-card-mobile.png'});
 const donutCases=await page.evaluate(()=>{const funds=[{name:'A <test>',color:'#144766'},{name:'B',color:'#29afc0'},{name:'C',color:'#7080a0'}];return [[0,0,0],[10,0,0],[10,20,30],[1000000,.01,0]].map(values=>{const el=document.createElement('div');el.innerHTML=portfolioDonutSvg(funds,values);return {count:el.querySelectorAll('path').length,invalid:/NaN|Infinity|undefined/.test(el.innerHTML),text:el.textContent};});});assert.deepEqual(donutCases.map(x=>x.count),[0,1,3,2]);assert.ok(donutCases.every(x=>!x.invalid));assert.match(donutCases[1].text,/A <test>/);
 assert.deepEqual(errors,[]);console.log('PASS: contract type-specific pension visibility and disabled controls, blank nonpension fields, type switching with retained drafts, auto/life/mortgage/investment/DPS/DIP saves and reloads, no auto premium in pension AUM; pension contract/deal saves, old-value history, idempotent save, reload, rollback, no duplicates, employer/state contributions, unknown vs zero, report selection, no contract numbers, accessible SVG donut, desktop/mobile/print.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
