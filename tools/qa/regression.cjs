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
 // Report rendering must retain all data and calculations while application assets move.
 assert.equal(b.report,a.report);results.push('Client report HTML matches released version');
 console.log('baseline errors',old.errors);
 const {page,context,errors}=current;
 for(const view of await page.locator('.tab[data-view]').evaluateAll(xs=>xs.map(x=>x.dataset.view))){await page.locator(`.tab[data-view="${view}"]`).click();assert(await page.locator('#'+view).isVisible());}
 results.push('14 populated views');
 await page.evaluate(()=>{showView('clients');selectClient(1);clientSection='overview';renderClientDetail()});
 const aum=await page.evaluate(()=>{const pension=clientPensionSummary(1).total,total=clientInvestmentSummary(1).total+pension,text=byId('clientDetail').innerText;return{pension,total,hasLabel:text.includes('AUM klienta celkem'),hasTotal:text.includes(money(total))}});
 assert.equal(aum.pension,1500);assert(aum.hasLabel);assert(aum.hasTotal);results.push('Client AUM includes pensions separately');
 const clientContact=await page.evaluate(()=>{const c=findClient(1);c.address='Testovací 1, Praha';renderClientDetail();return{age:clientAgeFromBirthId(c.birthId),ageText:byId('clientDetail').querySelector('.client-age')?.textContent||'',phoneCopies:byId('clientDetail').querySelectorAll('.contact-grid .contact-value').length,phoneCall:byId('clientDetail').querySelector('a[href^="tel:"]')?.textContent,emailCopy:[...byId('clientDetail').querySelectorAll('.contact-actions .copy-btn')].some(x=>x.textContent==='Kopírovat'),addressMap:byId('clientDetail').querySelector('.contact-actions a[href^="https://maps.google.com/"]')?.textContent}});
 assert(clientContact.age!==null);assert(clientContact.ageText.includes(String(clientContact.age)));assert.equal(clientContact.phoneCopies,3);assert.equal(clientContact.phoneCall,'Volat');assert(clientContact.emailCopy);assert.equal(clientContact.addressMap,'Mapa');results.push('Client age and contact copy actions');
 const campaign=await page.evaluate(()=>{showView('campaigns');setVal('campaignSenderEmail','advisor@example.test');setVal('campaignName','Test investiční kampaně');setVal('campaignSubject','Test investiční novinky');setVal('campaignBody','Dobrý den, toto je testovací zpráva.');setVal('campaignSegment','investice');renderCampaignRecipients(true);const candidates=campaignRecipientRows.map(x=>x.client.id);window.__campaignMailto='';campaignLaunchMailto=url=>window.__campaignMailto=url;confirmCampaignEmail();const saved=state.campaigns.at(-1);return{candidates,saved,activity:state.activities.find(x=>x.campaignId===saved?.id),mailto:window.__campaignMailto,history:byId('campaignHistory').innerText}});
 assert.deepEqual(campaign.candidates,[1]);assert.deepEqual(campaign.saved.recipientIds,[1]);assert.equal(campaign.activity.type,'Smart emailing');assert(campaign.mailto.startsWith('mailto:advisor%40example.test?'));assert(campaign.mailto.includes('bcc=alfa%40example.test'));assert(campaign.history.includes('Test investiční kampaně'));results.push('Campaign selection, BCC handoff and client history');
 await page.screenshot({path:'/private/tmp/crm-unified-campaigns.png',fullPage:true});
 for(const expr of ["selectClient(1)","selectInvestmentClient(1)","selectFkClient(1)","selectPensionClient(1)","openClientModal(1)","openContractModal(1,10)","openDealModal(1,20)","openOpportunityModal(1,30)","openActivityModal(1,40)","openInvestmentFundModal()","openFkFundModal()","openInvestmentScenarioModal(1,'FKI')"]){await page.evaluate(expr);await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(x=>x.classList.remove('show')))}
 results.push('Client, investment, pension and editing dialogs');
 // Exercise real downloads; generated reports must be usable as independent files.
 for(const [name,action] of [['client',"openClientReportModal(1);downloadClientReport()"],['fki',"downloadFkClientReport(1)"],['scenario',"openInvestmentScenarioModal(1,'FKI');investmentScenario.rows=[{key:'test-fki',area:'FKI',company:'Test FKI',product:'Test FKI fond',isin:'TEST00000002',amount:50000,rate:7,minRate:4,maxRate:9}];downloadInvestmentScenario()"]]){
  const pending=page.waitForEvent('download');await page.evaluate(action);const download=await pending;assert(download.suggestedFilename().endsWith('.html'));
  const report=fs.readFileSync(await download.path(),'utf8');assert(report.includes('Testovací klient Alfa'));assert(!report.includes('NaN'));assert(!report.includes('undefined'));
  const reportPage=await context.newPage();await reportPage.setContent(report);await reportPage.waitForTimeout(150);assert((await reportPage.locator('body').innerText()).length>100);const pdf=await reportPage.pdf({format:'A4',printBackground:true});assert(pdf.length>10000);await reportPage.close();
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
 console.log('current errors',errors);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:results},null,2));
 fs.writeFileSync('/private/tmp/crm-regression-results.json',JSON.stringify({passed:results},null,2));
 await old.context.close();await context.close();
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
