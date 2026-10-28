// Synthetic isolated CRM only; never connect to a real browser profile or external service.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const root = path.resolve(__dirname, '../..'), fixture = require('./fixture.cjs');
const PILOT = '11111111-1111-4111-8111-111111111111';
const OUTPUT = '22222222-2222-4222-8222-222222222222';
const PROCESS = 'Zápis ze schůzky';

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport: {width:1440, height:1080}, timezoneId:'Europe/Prague'});
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = path.join(root, decodeURIComponent(url.pathname));
      if (url.hostname === 'crm.test' && file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({body:fs.readFileSync(file), contentType:file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html'});
      }
      return route.abort();
    });
    const data = structuredClone(fixture);
    data.nextId = 1000;
    data.activities = [{id:401, clientId:1, type:'Schůzka', analysisType:'Schůzka stávající klient', date:'2026-10-12', duration:60, text:'Historická předvyplněná délka', outcome:'realized', completed:true}];
    data.analysisEntries = [];
    data.opportunities = [
      {id:301, clientId:1, category:'Hypotéky', product:'QA hypotéka Alfa', status:'Nabídka', nextContactDate:'2026-10-20'},
      {id:302, clientId:1, category:'Investice', product:'QA investice Alfa', status:'Nabídka', nextContactDate:'2026-10-20'},
      {id:303, clientId:2, category:'Život', product:'QA pojištění Beta', status:'Nabídka', nextContactDate:'2026-10-20'},
      {id:304, clientId:1, category:'Život', product:'QA uzavřený případ', status:'Zrušeno', nextContactDate:'2026-10-20'}
    ];
    data.workPilots = [{id:PILOT, startDate:'2026-10-12', process:PROCESS, caseIds:[301,302], title:'QA pilot', createdAt:'2026-10-12T08:00:00Z'}];
    data.workOutputs = [{id:OUTPUT, pilotId:PILOT, clientId:1, opportunityId:301, process:PROCESS, method:'usual', title:'QA existující zápis', status:'complete', createdAt:'2026-10-12T08:00:00Z'}];
    await context.addInitScript(seed => {
      if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1', JSON.stringify(seed));
    }, data);
    const page = await context.newPage(), errors = [], dialogs = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async d => {dialogs.push(d.message()); if (d.type() === 'confirm') await d.accept(); else await d.dismiss();});
    await page.goto('https://crm.test/FILIP-CRM.html');
    await page.waitForFunction(() => typeof workMeasurementSummary === 'function' && typeof openDetailedQuickActivity === 'function');
    const stateSnapshot = () => page.evaluate(() => JSON.stringify(state));
    const saveQuick = () => page.locator('#quickActivityModal').getByRole('button', {name:'Uložit aktivitu', exact:true}).click();
    const saveDetail = () => page.locator('#activityModal').getByRole('button', {name:'Uložit aktivitu', exact:true}).click();
    const openWork = async prefix => {
      const details = page.locator('#' + prefix + 'WorkMeasurement');
      if (!await details.evaluate(el => el.open)) {
        await details.locator('summary').press('Enter');
      }
      assert.equal(await details.evaluate(el => el.open), true, 'measurement disclosure opens using keyboard');
    };
    const setWork = async (prefix, values) => {
      await openWork(prefix);
      for (const [name, value] of Object.entries(values)) {
        const field = page.locator('#' + prefix + 'Work' + name);
        if (await field.evaluate(el => el.tagName === 'SELECT')) await field.selectOption(String(value));
        else await field.fill(String(value));
      }
    };
    const activityNamed = name => page.evaluate(name => state.activities.find(a => a.text === name), name);

    // 1. Historical and untouched defaults never acquire an actual-measurement label.
    await page.evaluate(() => openActivityModal(1,401));
    await openWork('a');
    assert.equal(await page.locator('#aWorkTimeKind').inputValue(), 'unknown');
    assert.equal(await page.locator('#aDuration').inputValue(), '60');
    await saveDetail();
    assert.notEqual((await activityNamed('Historická předvyplněná délka')).work?.timeKind, 'actual');
    await page.evaluate(() => openQuickActivity(1,'phone'));
    assert.equal(await page.locator('#qaWorkTimeKind').inputValue(), 'unknown');
    await page.locator('#qaDate').fill('2026-10-13'); await page.locator('#qaText').fill('Nedotčený nový zápis'); await saveQuick();
    assert.notEqual((await activityNamed('Nedotčený nový zápis')).work?.timeKind, 'actual');

    // 2. Explicit zero is a recorded duration; blank actual time cannot silently become zero.
    await page.evaluate(() => openQuickActivity(1,'phone'));
    await page.locator('#qaDate').fill('2026-10-13'); await page.locator('#qaText').fill('Potvrzená nulová délka');
    await setWork('qa',{Area:'service',TimeKind:'actual'}); await page.locator('#qaDuration').fill('');
    const beforeBlank = await stateSnapshot(); await saveQuick();
    assert.equal(await page.locator('#quickActivityModal').isVisible(), true, 'blank actual duration remains an unsaved draft');
    assert.equal(await stateSnapshot(), beforeBlank, 'invalid actual duration does not change state');
    await page.locator('#qaDuration').fill('0'); await saveQuick();
    assert.equal((await activityNamed('Potvrzená nulová délka')).duration, 0);
    assert.equal((await activityNamed('Potvrzená nulová délka')).work.timeKind, 'actual');
    await page.evaluate(() => openQuickActivity(1,'message'));
    await page.locator('#qaDate').fill('2026-10-13'); await page.locator('#qaDuration').fill(''); await page.locator('#qaText').fill('Délka nebyla zjištěna');
    await setWork('qa',{Area:'recording',TimeKind:'unknown'}); await saveQuick();
    assert.equal((await activityNamed('Délka nebyla zjištěna')).duration, null);
    await page.evaluate(()=>openQuickActivity(1,'phone'));await setWork('qa',{TimeKind:'actual'});await page.locator('#qaDuration').fill('3');
    await page.locator('#quickActivityPresets').getByRole('button',{name:'Schůzka'}).click();
    assert.equal(await page.locator('#qaWorkTimeKind').inputValue(),'unknown','changing preset cannot relabel its default duration as measured');
    await page.evaluate(()=>closeModal('quickActivityModal'));

    // 3. The detailed editor receives the quick draft, including next step and case, without saving twice.
    const draftCount = await page.evaluate(() => state.activities.length);
    await page.evaluate(() => openQuickActivity(1,'phone'));
    await page.locator('#qaDate').fill('2026-10-14'); await page.locator('#qaOutcome').selectOption('no_show');
    await page.locator('#qaDuration').fill('7'); await page.locator('#qaDelegationRoute').selectOption('assistant'); await page.locator('#qaText').fill('QA nedovolání s dohledáním podkladů');
    await setWork('qa',{Area:'followup',TimeKind:'actual',Method:'usual',Obstacle:'documents',Case:'301',Pilot:PILOT});
    await page.locator('#quickActivityModal .quick-activity-follow > summary').click();
    await page.locator('#qaFollowType').selectOption('Telefon'); await page.locator('#qaFollowDate').fill('2026-10-21'); await page.locator('#qaFollowTime').fill('10:15'); await page.locator('#qaFollowText').fill('Potvrdit přesný seznam podkladů');
    await page.locator('#quickActivityModal').getByRole('button',{name:'Podrobný zápis',exact:true}).click();
    assert.equal(await page.locator('#activityModal').isVisible(),true); assert.equal(await page.locator('#quickActivityModal').isVisible(),false);
    assert.equal(await page.evaluate(() => state.activities.length),draftCount);
    for (const [id,value] of Object.entries({aClient:'1',aDate:'2026-10-14',aOutcome:'no_show',aDuration:'7',aDelegationRoute:'assistant',aText:'QA nedovolání s dohledáním podkladů',aFollowType:'Telefon',aFollowDate:'2026-10-21',aFollowTime:'10:15',aFollowText:'Potvrdit přesný seznam podkladů',aWorkTimeKind:'actual',aWorkArea:'followup',aWorkCase:'301',aWorkPilot:PILOT})) assert.equal(await page.locator('#'+id).inputValue(),value,'draft retains '+id);
    await saveDetail();
    const failedCall = await activityNamed('QA nedovolání s dohledáním podkladů');
    assert.equal(failedCall.sourceOpportunityId,301); assert.equal(failedCall.work.timeKind,'actual');
    const nextStep = await page.evaluate(id => state.activities.find(a=>String(a.id)===String(id)),failedCall.followActivityId);
    assert.equal(nextStep.sourceOpportunityId,301,'follow-up inherits the exact case');
    assert.equal(nextStep.outcome,'agreed'); assert.notEqual(nextStep.work?.timeKind,'actual','planned follow-up does not inherit measurement');
    assert.equal(await page.evaluate(() => state.activities.length),draftCount+2,'one worked activity and one explicit follow-up only');
    assert.deepEqual(await page.evaluate(id => {
      const rows=quickAnalysis_rows('2026-10-14','2026-10-14').filter(x=>String(x.sourceActivityId)===String(id));
      const s=quickAnalysis_summary(rows,'calls'); return {count:rows.length,realized:s.realized,noShow:s.noShow};
    },failedCall.id),{count:1,realized:0,noShow:1},'work time cannot promote an unsuccessful call to a successful commercial KPI');

    // 4. Case choices are client-specific. An explicit client change clears unrelated references.
    await page.evaluate(id => openActivityModal(1,id),failedCall.id); await openWork('a');
    const caseChoices = await page.locator('#aWorkCase option').evaluateAll(options=>options.map(o=>o.value));
    assert(caseChoices.includes('301')&&caseChoices.includes('302')); assert(!caseChoices.includes('303'),'foreign client case is not offered');
    await page.locator('#aClient').selectOption('2');
    assert.equal(await page.locator('#aWorkCase').inputValue(),''); assert.equal(await page.locator('#aWorkOutput').inputValue(),'');
    const betaChoices=await page.locator('#aWorkCase option').evaluateAll(options=>options.map(o=>o.value));
    assert(betaChoices.includes('303')); assert(!betaChoices.includes('301'));
    await saveDetail();
    const reassigned=await activityNamed('QA nedovolání s dohledáním podkladů');assert.equal(reassigned.clientId,2);assert.equal(reassigned.sourceOpportunityId,null);assert.equal(reassigned.work.outputId,'');
    await page.evaluate(()=>{
      state.deals.push({id:250,clientId:1,fromOpportunityId:305,category:'Život',product:'QA podepsaný případ',date:'2026-10-15',amount:0});
      state.activities.push({id:410,clientId:1,sourceOpportunityId:305,date:'2026-10-15',type:'Úkol',text:'QA archivní vazba číslem',completed:true,outcome:'realized',duration:3},{id:411,clientId:1,sourceOpportunityId:'deal:250',date:'2026-10-15',type:'Úkol',text:'QA archivní vazba po importu',completed:true,outcome:'realized',duration:4});persist();
    });
    for(const [id,reference] of [[410,'305'],[411,'deal:250']]){
      await page.evaluate(id=>openActivityModal(1,id),id);await openWork('a');assert.equal(await page.locator('#aWorkCase').inputValue(),reference,'preserve verified closed-case association');
      await saveDetail();assert.equal(String(await page.evaluate(id=>state.activities.find(a=>a.id===id).sourceOpportunityId,id)),reference);
    }

    // 5. Internal work remains editable without manufacturing a client relationship.
    await page.evaluate(()=>{openQuickActivity(null,'internal');setVal('qaClient','');});
    await page.locator('#qaDate').fill('2026-10-14');await page.locator('#qaDuration').fill('11');await page.locator('#qaText').fill('QA interní uspořádání dat');
    await setWork('qa',{Area:'data',TimeKind:'actual'});await saveQuick();
    const internal = await activityNamed('QA interní uspořádání dat'); assert.equal(internal.clientId,null);
    await page.evaluate(id=>openActivityModal(null,id),internal.id);assert.equal(await page.locator('#aClient').inputValue(),'');
    await page.locator('#aDuration').fill('13');await saveDetail();
    assert.equal(await page.locator('#activityModal').isVisible(),false);
    const editedInternal=await activityNamed('QA interní uspořádání dat');assert.equal(editedInternal.clientId,null);assert.equal(editedInternal.duration,13);

    // 6. A failed persistence call retains the form and rolls back both new and edited activity state.
    await page.evaluate(()=>{window.__workRealPersist=persist;persist=()=>false;openQuickActivity(1,'phone');});
    await page.locator('#qaText').fill('QA neuložený draft');await page.locator('#qaDuration').fill('17');await setWork('qa',{Area:'service',TimeKind:'actual',Case:'301',Pilot:PILOT,Process:PROCESS,Output:'__new',OutputTitle:'QA neuložený výstup',OutputStatus:'complete'});
    const beforeFailure=await stateSnapshot();await saveQuick();
    assert.equal(await stateSnapshot(),beforeFailure,'failed quick save rolls back both activity and newly created output');assert.equal(await page.locator('#quickActivityModal').isVisible(),true);assert.equal(await page.locator('#qaText').inputValue(),'QA neuložený draft');assert.equal(await page.locator('#qaWorkOutputTitle').inputValue(),'QA neuložený výstup');
    await page.evaluate(()=>{persist=window.__workRealPersist;closeModal('quickActivityModal');});
    await page.evaluate(id=>{openActivityModal(null,id);persist=()=>false;},internal.id);
    await page.locator('#aDuration').fill('99');const beforeEditFailure=await stateSnapshot();await saveDetail();
    assert.equal(await stateSnapshot(),beforeEditFailure,'failed detailed save rolls back state');assert.equal(await page.locator('#activityModal').isVisible(),true);assert.equal(await page.locator('#aDuration').inputValue(),'99');
    await page.evaluate(()=>{persist=window.__workRealPersist;closeModal('activityModal');});

    // 7. Multiple work blocks use the same explicit output rather than a second task register.
    await page.evaluate(()=>openQuickActivity(1,'message'));
    await page.locator('#qaDate').fill('2026-10-14');await page.locator('#qaText').fill('QA příprava výstupu');await page.locator('#qaDuration').fill('20');
    await setWork('qa',{Area:'preparation',TimeKind:'actual',Method:'usual',Case:'301',Pilot:PILOT,Process:PROCESS,Output:'__new',OutputTitle:'QA společný výstup',OutputStatus:'needs_work'});
    await saveQuick();
    const preparation=await activityNamed('QA příprava výstupu');assert(preparation.work.outputId);
    const createdOutput=await page.evaluate(id=>state.workOutputs.find(x=>x.id===id),preparation.work.outputId);
    assert.equal(createdOutput.title,'QA společný výstup');assert.equal(createdOutput.opportunityId,301);assert.equal(createdOutput.clientId,1);assert.equal(createdOutput.status,'needs_work');
    const outputCount=await page.evaluate(()=>state.workOutputs.length);
    await page.evaluate(()=>openQuickActivity(1,'message'));
    await page.locator('#qaDate').fill('2026-10-15');await page.locator('#qaText').fill('QA kontrola a oprava výstupu');await page.locator('#qaDuration').fill('5');
    await setWork('qa',{Area:'recording',TimeKind:'actual',Case:'301',Pilot:PILOT,Output:createdOutput.id,OutputStatus:'complete'});await saveQuick();
    assert.equal((await activityNamed('QA kontrola a oprava výstupu')).work.outputId,createdOutput.id);
    assert.equal(await page.evaluate(()=>state.workOutputs.length),outputCount,'another block does not duplicate its logical output');
    assert.equal(await page.evaluate(id=>state.workOutputs.find(x=>x.id===id).status,createdOutput.id),'complete');

    // 8. Synthetic measured/estimated/unknown blocks and multiple comparable outputs.
    const comparisonSeed={pilot:PILOT,process:PROCESS};
    await page.evaluate(({pilot,process})=>{
      state.activities=[];state.analysisEntries=[];state.workOutputs=[];
      let counter=10000;
      const output=(key,method,status='complete',outputProcess=process)=>{
        const id='33333333-3333-4333-8333-'+String(++counter).padStart(12,'0');
        state.workOutputs.push({id,pilotId:pilot,clientId:1,opportunityId:301,process:outputProcess,method,title:'QA výstup '+key,status});
        return id;
      };
      const activity=(name,duration,extra={})=>{
        const work={area:'recording',timeKind:'actual',method:'usual',pilotId:pilot,process,...extra.work};
        const row={id:++counter,clientId:1,sourceOpportunityId:301,date:'2026-10-14',type:'Úkol',analysisType:'Poznámka',outcome:'realized',completed:true,text:name,duration,...extra,work};
        state.activities.push(row);return row;
      };
      const groups=[['u1','usual',[20,10,5]],['u2','usual',[30]],['u3','usual',[40]],['n1','new',[10,5]],['n2','new',[20]],['n3','new',[25]]];
      for(const [name,method,blocks] of groups){const id=output(name,method);blocks.forEach((minutes,index)=>activity(name+' blok '+index,minutes,{date:method==='new'?'2026-10-21':'2026-10-14',work:{outputId:id,method}}));}
      const unknown=output('unknown','usual');activity('Neúplný výstup známý blok',5,{work:{outputId:unknown}});activity('Neúplný výstup nezměřený blok',30,{work:{outputId:unknown,timeKind:'unknown'}});
      const estimated=output('estimate','usual');activity('Odhadovaný výstup známý blok',2,{work:{outputId:estimated}});activity('Odhadovaný výstup odhad bloku',60,{work:{outputId:estimated,timeKind:'estimate'}});
      const unfinished=output('unfinished','usual','needs_work');activity('Výstup vyžaduje doplnění',8,{work:{outputId:unfinished}});
      const other=output('other-process','new','complete','Jiný proces');activity('Nesrovnatelný jiný proces',11,{work:{outputId:other,process:'Jiný proces',method:'new'}});
      const partial=output('partial-period','usual');activity('Část výstupu před obdobím',30,{date:'2026-10-01',work:{outputId:partial}});activity('Část výstupu v období',5,{work:{outputId:partial}});
      activity('Nedovolání včetně přípravy',6,{type:'Telefon',analysisType:'Volání',outcome:'no_show',work:{area:'followup'}});
      activity('Přesun po skutečné práci',9,{outcome:'moved',work:{area:'followup'}});
      activity('Naměřená nula',0,{work:{area:'service'}});
      activity('Pouhý plán',1000,{outcome:'agreed',completed:false});
      activity('Automatický historický záznam',2000,{recordKind:'history'});
      activity('Starý default bez potvrzení',60,{work:{timeKind:'unknown'}});
      state.analysisEntries.push({id:123456,date:'2026-10-14',type:'Poznámka',minutes:20,sourceActivityId:state.activities[0].id});
      persist();showView('referrers');setVal('analysisMonth','2026-10');renderAnalysis();
    },comparisonSeed);

    const summary=await page.evaluate(pilot=>{
      const s=workMeasurementSummary('2026-10-12','2026-10-23',pilot);
      return {actual:s.actual,estimate:s.estimate,unknown:s.unknown,planned:s.planned,measuredCount:s.measuredCount,recording:s.byArea.recording,followup:s.byArea.followup,service:s.byArea.service,rows:s.rows.length};
    },PILOT);
    assert.deepEqual(summary.actual,{count:17,minutes:211},'sum original measured activities only, including unsuccessful work and explicit zero');
    assert.deepEqual(summary.estimate,{count:1,minutes:60});assert.deepEqual(summary.unknown,{count:2});assert.deepEqual(summary.planned,{count:1});assert.equal(summary.measuredCount,17);assert.equal(summary.rows,21);
    assert.equal(summary.recording.minutes,196);assert.equal(summary.followup.minutes,15);assert.equal(summary.service.count,1);assert.equal(summary.service.minutes,0);
    const comparison=await page.evaluate(pilot=>workPilotComparison(pilot,'2026-10-12','2026-10-23'),PILOT);
    assert.equal(comparison.usual.count,3);assert.equal(comparison.usual.median,35);assert.equal(comparison.usual.minutes,105);
    assert.equal(comparison.new.count,3);assert.equal(comparison.new.median,20);assert.equal(comparison.new.minutes,60);assert.equal(comparison.ready,true);assert.equal(comparison.savingsMinutes,15);assert(Math.abs(comparison.savingsPct-100*15/35)<1e-8);
    assert.equal(comparison.usual.outputs.find(o=>o.title==='QA výstup u1').activityIds.length,3,'preparation, execution and correction stay in the same output');
    assert.equal(comparison.usual.outputs.find(o=>o.title==='QA výstup u1').minutes,35);
    assert.equal(comparison.excluded.length,5);
    for(const name of ['unknown','estimate','unfinished','other-process','partial-period'])assert(comparison.excluded.find(o=>o.title==='QA výstup '+name)?.reasons.length>0,'explicit exclusion reason for '+name);
    const insufficient=await page.evaluate(pilot=>{const o=state.workOutputs.find(o=>o.title==='QA výstup n3');o.status='needs_work';const c=workPilotComparison(pilot,'2026-10-12','2026-10-23');o.status='complete';return c;},PILOT);
    assert.equal(insufficient.new.count,2);assert.equal(insufficient.ready,false);assert.equal(insufficient.savingsMinutes,null);assert.equal(insufficient.savingsPct,null,'no claimed savings from two trial outputs');
    const movedCase=await page.evaluate(pilot=>{
      const c=state.opportunities.find(c=>c.id===301),owner=c.clientId;c.clientId=2;
      const comparison=workPilotComparison(pilot,'2026-10-12','2026-10-23');c.clientId=owner;
      return comparison;
    },PILOT);
    assert.equal(movedCase.usual.count,0);assert.equal(movedCase.new.count,0);assert.equal(movedCase.ready,false);assert.equal(movedCase.savingsMinutes,null);
    for(const name of ['u1','u2','u3','n1','n2','n3'])assert(movedCase.excluded.find(o=>o.title==='QA výstup '+name)?.reasons.some(reason=>reason.includes('stejného klienta')),'stale activity/output ownership cannot hide moved case: '+name);
    assert.equal(await page.evaluate(pilot=>workPilotComparison(pilot,'2026-10-12','2026-10-23').ready,PILOT),true,'restored verified ownership restores valid comparison');
    await page.evaluate(pilot=>{workOpenAnalysis();setVal('workPilotSelect',pilot);workSelectPilot();},PILOT);
    assert.equal(await page.locator('[data-work-comparison-ready="true"]').count(),1);
    await page.locator('[data-work-filter="actual"]').click();assert.equal(await page.locator('#workDrilldownModal [data-work-activity]').count(),17);
    const editId=await page.locator('#workDrilldownModal [data-work-activity]').first().getAttribute('data-work-activity');
    await page.locator('#workDrilldownModal [data-work-activity]').first().getByRole('button',{name:'Upravit',exact:true}).click();
    assert.equal(await page.locator('#activityModal').isVisible(),true);assert.equal(String(await page.evaluate(()=>editingActivityId)),editId);
    await page.evaluate(()=>closeModal('activityModal'));
    await page.locator('#workMeasurementPanel .work-comparison details > summary').click();
    const partialOutput=comparison.excluded.find(o=>o.title==='QA výstup partial-period');
    await page.locator('[data-work-output="'+partialOutput.id+'"]').click();
    assert.equal(await page.locator('#workDrilldownModal [data-work-activity]').count(),2,'drilldown shows the whole output, including the block outside the period');
    assert.match(await page.locator('#workDrilldownModal').innerText(),/před obdobím/);await page.evaluate(()=>closeModal('workDrilldownModal'));

    // 9. Case coverage never infers an exact task from the client or a bare date.
    const coverage=await page.evaluate(pilot=>{
      const p=state.workPilots.find(x=>x.id===pilot);p.caseIds=[301,302,304,999999];
      const before=JSON.stringify({activities:state.activities,opportunities:state.opportunities});
      const coverage=workPilotCaseCoverage(pilot);
      return {coverage,unchanged:before===JSON.stringify({activities:state.activities,opportunities:state.opportunities})};
    },PILOT);
    assert.equal(coverage.unchanged,true);assert.equal(coverage.coverage.closed,1);assert.equal(coverage.coverage.missing,1);assert.equal(coverage.coverage.rows.length,2);
    assert.equal(coverage.coverage.rows.find(o=>o.caseId===301).status,'overdue');
    assert.equal(coverage.coverage.rows.find(o=>o.caseId===302).status,'unverified','another case of the same client cannot borrow the first case task');
    await page.evaluate(pilot=>{state.workPilots.find(x=>x.id===pilot).caseIds=[301,302];workRenderAnalysis();},PILOT);

    // 10. Pilot configuration starts empty; selected references do not create copied cases/tasks.
    const beforePilot=await page.evaluate(()=>({activities:JSON.stringify(state.activities),cases:JSON.stringify(state.opportunities)}));
    await page.evaluate(()=>workOpenPilot());
    assert.equal(await page.locator('#workPilotModal [data-work-case]:checked').count(),0);
    assert.equal(await page.locator('#workPilotModal [data-work-case="304"]').count(),0,'closed cases are excluded from new pilot selection');
    await page.locator('#workPilotStart').fill('2026-10-12');await page.locator('#workPilotProcess').fill('QA příprava podkladů');
    await page.locator('#workPilotModal [data-work-case="302"]').check();await page.locator('#workPilotModal [data-work-case="303"]').check();
    await page.locator('#workPilotModal .modal-box').screenshot({path:'/private/tmp/crm-work-pilot-settings-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert(await page.locator('#workPilotModal .modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'pilot settings fit mobile width');
    await page.locator('#workPilotModal .modal-box').screenshot({path:'/private/tmp/crm-work-pilot-settings-mobile.png'});
    await page.setViewportSize({width:1440,height:1080});
    await page.locator('#workPilotModal').getByRole('button',{name:'Uložit pilot',exact:true}).click();
    const savedPilot=await page.evaluate(()=>state.workPilots.find(p=>p.process==='QA příprava podkladů'));
    assert.deepEqual([...savedPilot.caseIds].sort(),[302,303]);assert.match(savedPilot.id,/^[0-9a-f-]{36}$/i);
    assert.deepEqual(await page.evaluate(()=>({activities:JSON.stringify(state.activities),cases:JSON.stringify(state.opportunities)})),beforePilot);
    await page.reload();
    assert.deepEqual(await page.evaluate(id=>state.workPilots.find(p=>p.id===id).caseIds,savedPilot.id),[302,303]);
    assert.deepEqual(await page.evaluate(pilot=>workMeasurementSummary('2026-10-12','2026-10-23',pilot).actual,PILOT),{count:17,minutes:211});

    // 11. The new disclosure, summary and drilldown fit desktop and a narrow phone viewport.
    await page.evaluate(pilot=>{workOpenAnalysis();setVal('workPilotSelect',pilot);workSelectPilot();},PILOT);
    await page.locator('#workMeasurementPanel').screenshot({path:'/private/tmp/crm-work-measurement-desktop.png'});
    await page.evaluate(()=>openQuickActivity(1,'message'));await page.locator('#qaText').fill('Zápis ze schůzky a kontrola dalších kroků');await page.locator('#qaDuration').fill('12');
    await setWork('qa',{Area:'recording',TimeKind:'actual',Case:'301',Pilot:PILOT,Method:'new',Process:PROCESS,Output:'__new',OutputTitle:'Zápis po schůzce QA',OutputStatus:'complete'});
    await page.locator('#quickActivityModal .modal-box').screenshot({path:'/private/tmp/crm-work-measurement-editor-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    assert(await page.locator('#quickActivityModal .modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'work editor must not overflow on mobile');
    await page.screenshot({path:'/private/tmp/crm-work-measurement-editor-mobile.png'});
    await page.locator('#qaWorkMeasurement').evaluate(e=>e.scrollIntoView({block:'start'}));
    await page.screenshot({path:'/private/tmp/crm-work-measurement-fields-mobile.png'});
    await page.evaluate(()=>closeModal('quickActivityModal'));
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'analysis page must not overflow on mobile');
    for(const id of ['workFrom','workTo'])assert((await page.locator('#'+id).boundingBox()).width>=130,'date must remain readable at 390px: '+id);
    assert((await page.locator('#workPilotSelect').boundingBox()).width>=260,'pilot selector uses enough mobile width to identify the selected process');
    await page.locator('#workMeasurementPanel').screenshot({path:'/private/tmp/crm-work-measurement-mobile.png'});
    await page.locator('[data-work-filter="actual"]').click();
    assert(await page.locator('#workDrilldownModal .modal-box').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'mobile drilldown stays within its dialog');
    assert.equal(await page.locator('#workDrilldownModal [data-work-activity]').count(),17);
    assert.deepEqual(errors,[]);
    console.log('PASS: work measurement provenance and zero/blank validation; quick-to-detail draft and exact case follow-up; unsuccessful calls without commercial success; internal work and rollback; linked output repairs, estimates and partial-output exclusions; same-process medians with minimum sample size; source drilldowns; explicit pilot selection and reload; desktop/mobile keyboard and layout.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
