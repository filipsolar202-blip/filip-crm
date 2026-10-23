const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),fixture=require('./fixture.cjs');
const root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch(launchOptions);try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),errors=[];
 await context.route('**/*',route=>{const u=new URL(route.request().url()),f=path.join(root,decodeURIComponent(u.pathname));if(u.hostname==='crm.test'&&fs.existsSync(f)&&fs.statSync(f).isFile())return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'});return route.abort();});
 const data=structuredClone(fixture);data.clients.push({id:500,name:'Následná provize',systemRole:'commission',note:'Technická karta pro souhrn následných provizí z provizních výpisů.'});
 data.deals.push({id:501,clientId:500,category:'Následná provize',company:'Penta',product:'FKI',amount:12757,bj:20,actualCommission:12757,commissionPaid:true,date:'2026-10-22'});
 data.investmentRecords.push({_crmSourceType:'deal',_crmSourceId:501,_crmDealId:501,'ID klienta':'500',amount:12757});
 data.contracts.find(x=>x.id===12).amount='528882';
 await context.addInitScript(data=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(data));},data);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof renderDailyPriorities==='function');
 assert.deepEqual(await page.evaluate(()=>{const d=state.deals.find(x=>x.id===501);return [state.clients.some(x=>x.id===500),d.clientId,dealActualCommission(d),dealBJ(d),dealVolume(d),areaForDeal(d),state.investmentRecords.some(x=>x._crmSourceId===501),state.settings.commissionLegacyArchive.clients.length];}),[false,null,12757,0,0,'provize',false,1]);
 await page.reload();assert.equal(await page.evaluate(()=>state.settings.commissionLegacyArchive.clients.length),1);
 await page.evaluate(()=>{showView('deals');setVal('dealYear','2026');selectedMonth=9;renderDeals();});
 assert.match(await page.locator('#recurringCommissions').innerText(),/12\s*757/);assert.doesNotMatch(await page.locator('#dealsTable').innerText(),/Penta/);
 await page.evaluate(()=>openRecurringCommissionModal());await page.locator('#rcAmount').fill('6000');await page.locator('#rcCompany').fill('Penta');await page.locator('#rcNote').fill('Správa říjen');await page.locator('#rcDate').fill('2026-10-22');await page.locator('#recurringCommissionModal').getByText('Uložit provizi',{exact:true}).click();
 await page.reload();assert.equal(await page.evaluate(()=>state.deals.filter(isInternalCommission).length),2);assert.equal(await page.evaluate(()=>state.clients.length),2);
 // Existing balances are used, explicit values and zero survive save/reload.
 await page.evaluate(()=>openContractModal(1,12));assert.equal(await page.locator('#sPensionCurrent').inputValue(),'528882');
 await page.locator('#sPensionCurrent').fill('540000');await page.locator('#sPensionPayment').fill('1700');await page.locator('#sPensionDate').fill('2026-10-01');await page.locator('#contractModal').getByText('Uložit smlouvu',{exact:true}).click();await page.reload();
 assert.equal(await page.evaluate(()=>clientPensionSummary(1).total),540000);
 await page.evaluate(()=>{state.contracts.push({id:600,clientId:1,type:'DIP',company:'Test DIP',product:'DIP nula',number:'ZERO',amount:90000,pensionCurrent:0,status:'vyrizeno'});state.contracts.push({id:601,clientId:1,type:'DPS',company:'Test penze',product:'DPS bez hodnoty',number:'UNKNOWN',status:'vyrizeno'});});
 const html=await page.evaluate(()=>clientOutput_xReportHtml(findClient(1),{summary:true,investments:true,fki:true,pensions:true,insurance:true,loans:true,notice:true}));
 fs.writeFileSync('/private/tmp/crm-interactive-report.html',html);
 const report=await context.newPage();report.on('pageerror',e=>errors.push('REPORT '+e.message));await report.setContent(html);
 const base=await report.locator('[data-summary-group=total] [data-value=current]').innerText();assert.match(base,/840\s*000/);
 assert.match(await report.locator('[data-report-section=pensions]').innerText(),/540\s*000/);assert.match(await report.locator('[data-report-section=pensions]').innerText(),/1\s*700/);assert.match(await report.locator('[data-summary-group=total] [data-unknown]').innerText(),/1 položk/i);
 assert.equal(await report.evaluate(()=>JSON.parse(decodeURIComponent(document.querySelector('.portfolio-timeline').dataset.model)).funds.length),2);
 assert.match(await report.locator('.timeline-value').innerText(),/300\s*000/);
 await report.locator('#reportSelection summary').click();
 await report.locator('[data-pick-group=fki]').uncheck();assert.match(await report.locator('[data-summary-group=total] [data-value=current]').innerText(),/640\s*000/);assert.equal(await report.locator('.report-area-fki').isVisible(),false);assert.match(await report.locator('.timeline-value').innerText(),/100\s*000/);
 await report.locator('[data-pick-group=classic]').uncheck();assert.equal(await report.locator('.portfolio-timeline').isVisible(),false);assert.match(await report.locator('[data-summary-group=total] [data-value=current]').innerText(),/540\s*000/);
 await report.locator('[data-pick-item=pension-contract-12]').uncheck();assert.match(await report.locator('[data-summary-group=total] [data-value=current]').innerText(),/^0 Kč$/);assert.equal(await report.locator('[data-report-item=pension-contract-12]').isVisible(),false);
 await report.locator('[data-pick-group=fki]').check();assert.equal(await report.locator('.portfolio-timeline').isVisible(),true);assert.match(await report.locator('.timeline-value').innerText(),/200\s*000/);
 await report.locator('[data-pick-section=insurance]').uncheck();assert.equal(await report.locator('[data-report-section=insurance]').isVisible(),false);
 await report.locator('[data-pick-section=charts]').uncheck();assert.equal(await report.locator('.portfolio-timeline').isVisible(),false);await report.locator('[data-pick-section=charts]').check();
 await report.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));assert.equal(await report.locator('[data-report-item=pension-contract-12]').isVisible(),false);await report.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
 await report.locator('[data-pick-group=classic]').check();await report.locator('[data-pick-group=pensions]').check();await report.locator('#reportSelection summary').click();await report.screenshot({path:'/private/tmp/crm-report-updated.png',fullPage:true});
 await report.setViewportSize({width:390,height:844});assert.ok(await report.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Desktop cards really are side by side and graphs precede activities.
 await page.evaluate(()=>{showView('dashboard');renderDashboard();});
 for(const selector of ['#dailyPrioritiesList .focus-row','#weeklyGoalsGrid .focus-row']){const boxes=await page.locator(selector).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};}));assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[1].y,boxes[2].y);assert.ok(boxes[1].x>boxes[0].x);}
 assert.equal(await page.locator('#bjChart').isVisible(),true);assert.ok((await page.locator('#bjChart').boundingBox()).y<(await page.locator('#dashTasks').boundingBox()).y);
 await page.screenshot({path:'/private/tmp/crm-dashboard-updated.png',fullPage:true});

 const backed=await page.evaluate(()=>googleSyncPayload().state);
 await page.evaluate(data=>{state=normalizeState({...def(),clients:[],deals:[],contracts:[],nextId:2000});mergeIncomingState(data);mergeIncomingState(data);},backed);
 assert.equal(await page.evaluate(()=>state.deals.filter(isInternalCommission).length),2);
 assert.equal(await page.evaluate(()=>state.deals.filter(isInternalCommission).reduce((sum,d)=>sum+dealActualCommission(d),0)),18757);
 assert.equal(await page.evaluate(()=>state.settings.commissionLegacyArchive.clients.length),1);
 assert.deepEqual(errors,[]);console.log('PASS: side-by-side focus and visible charts; pension balance persistence; offline report toggles, totals, chart exclusion and print; technical commission migration, preservation, no AUM or clients, dedicated entry.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
