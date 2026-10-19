const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const fixture = require('./fixture.cjs');
const root = path.resolve(__dirname, '../..');

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1100}, timezoneId:'Europe/Prague'});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'crm.test') {
        const file = path.join(root, decodeURIComponent(url.pathname));
        if (fs.existsSync(file)) return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
      }
      return route.abort();
    });
    await context.addInitScript(data => {
      if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1', JSON.stringify(data));
    }, fixture);
    const page = await context.newPage(), errors = [], alerts = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async dialog => {alerts.push(dialog.message());await dialog.dismiss();});
    await page.clock.install({time:new Date('2026-10-18T18:00:00+02:00')});
    await page.goto('https://crm.test/FILIP-CRM.html');
    await page.waitForFunction(() => typeof renderWeeklyGoals === 'function');
    await page.evaluate(() => {
      state.weeklyGoals = []; state.weeklyReviews = []; state.analysisEntries = []; state.activities = [];
      const key = weekKey(), range = weekRange(key);
      state.weeklyGoals.push(
        {id:99101,weekKey:key,slot:1,title:'Kontaktovat 20 klientů',why:'Nové příležitosti',metricType:'manual',kpiLabel:'klientů',target:20,manualActual:12,dueDate:range.end},
        {id:99102,weekKey:key,slot:2,title:'Pět schůzek',why:'Rozvoj',metricType:'meetings',target:5,dueDate:range.end},
        {id:99103,weekKey:key,slot:3,title:'Hotový postup',why:'Úspora času',metricType:'manual',target:1,manualActual:1,dueDate:range.end}
      );
      state.analysisEntries.push({id:99110,date:range.start,type:'Schůzka stávající klient',count:2,outcome:'realized'});
      persist();renderWeeklyGoals();
    });
    assert.match(await page.locator('#weeklyGoalsGrid').innerText(), /Kontaktovat 20 klientů/);
    // Monday after reopening: old goals must still be discoverable without closing Sunday.
    await page.clock.setSystemTime(new Date('2026-10-19T08:00:00+02:00'));
    await page.reload();
    await page.locator('#weeklyGoalsPending button').click();
    assert.equal(await page.locator('#weeklyGoalsWeekSelect').inputValue(), '2026-W42');
    assert.match(await page.locator('#weeklyGoalsGrid').innerText(), /12 \/ 20/);
    assert.equal(await page.evaluate(() => weeklyGoalActual(weeklyGoalForSlot(2, '2026-W42'))), 2);
    await page.locator('#weeklyGoalsGrid .weekly-goal').first().getByText('Aktualizovat', {exact:true}).click();
    await page.locator('#wgManualActual').fill('14');
    await page.locator('#weeklyGoalModal').getByText('Uložit cíl', {exact:true}).click();
    await page.locator('#weeklyGoalModal').getByText('Zavřít', {exact:true}).click();
    assert.deepEqual(await page.evaluate(() => [weeklyGoalForSlot(1,'2026-W42').manualActual,weeklyGoalsFor('2026-W43').length]), [14,0]);
    // A new-week activity must not change the previous week's automatic result.
    await page.evaluate(() => { state.analysisEntries.push({id:99111,date:'2026-10-19',type:'Schůzka stávající klient',count:1,outcome:'realized'});renderWeeklyGoals(); });
    assert.equal(await page.evaluate(() => weeklyGoalActual(weeklyGoalForSlot(2,'2026-W42'))), 2);
    await page.locator('#weeklyGoalsGrid .weekly-goal').first().getByText('Přenést zbývajících 6 do aktuálního týdne', {exact:true}).click();
    await page.evaluate(() => carryWeeklyGoalForward(1));
    assert.deepEqual(await page.evaluate(() => ({count:weeklyGoalsFor('2026-W43').length,target:weeklyGoalForSlot(1,'2026-W43').target,actual:weeklyGoalForSlot(1,'2026-W43').manualActual,source:weeklyGoalForSlot(1,'2026-W42').manualActual})), {count:1,target:6,actual:0,source:14});
    // Late closure and immutable review snapshot.
    await page.locator('#closeWeeklyGoalsBtn').click();
    await page.locator('#wrSuccess').fill('Dokončený postup, 14 kontaktů a dvě schůzky.');
    await page.locator('#wrCarry').fill('Dokončit zbývajících šest kontaktů.');
    await page.locator('#weeklyReviewModal').getByText('Uzavřít a archivovat týden', {exact:true}).click();
    assert.equal(await page.evaluate(() => weeklyReviewFor('2026-W42').totalPct), 70);
    await page.evaluate(() => {state.analysisEntries.push({id:99112,date:'2026-10-13',type:'Schůzka stávající klient',count:9,outcome:'realized'});persist();renderWeeklyGoals();});
    assert.equal(await page.evaluate(() => weeklyGoalActual(weeklyGoalForSlot(2,'2026-W42'))), 2);
    await page.locator('#closeWeeklyGoalsBtn').click();
    assert.equal(await page.locator('#wrSuccess').inputValue(), 'Dokončený postup, 14 kontaktů a dvě schůzky.');
    assert.equal(await page.locator('#wrSuccess').isDisabled(), true);
    await page.locator('#weeklyReviewModal').getByText('Zavřít', {exact:true}).click();
    await page.reload();
    await page.locator('#weeklyGoalsWeekSelect').selectOption('2026-W42');
    assert.match(await page.locator('#closeWeeklyGoalsBtn').innerText(), /Zobrazit vyhodnocení/);
    assert.match(await page.locator('#weeklyGoalsGrid').innerText(), /14 \/ 20/);
    // Carry an automatic goal, preserving the old result and using only current-week events.
    await page.locator('#weeklyGoalsGrid .weekly-goal').nth(1).getByText('Přenést zbývajících 3 do aktuálního týdne', {exact:true}).click();
    assert.deepEqual(await page.evaluate(() => {const g=weeklyGoalForSlot(2,'2026-W43');return [g.target,weeklyGoalActual(g)];}), [3,1]);
    await page.evaluate(() => {
      state.weeklyGoals.push({id:99200,weekKey:'2026-W41',slot:1,title:'Starší neuzavřený cíl',why:'Test',metricType:'manual',target:10,manualActual:4});
      state.weeklyGoals.push({id:99201,weekKey:'2026-W43',slot:3,title:'Obsazená priorita',metricType:'manual',target:1,manualActual:0});
      selectWeeklyGoalsWeek('2026-W41');carryWeeklyGoalForward(1);
    });
    assert.match(alerts.at(-1), /už má 3 cíle/);
    assert.equal(await page.evaluate(() => weeklyGoalForSlot(3,'2026-W43').title), 'Obsazená priorita');
    // A partial plan can still be closed, with an honest denominator.
    await page.locator('#closeWeeklyGoalsBtn').click();
    assert.match(await page.locator('#weeklyReviewAutoSummary').innerText(), /z 1 nastavených cílů/);
    await page.locator('#weeklyReviewModal').getByText('Uzavřít a archivovat týden', {exact:true}).click();
    assert.equal(await page.evaluate(() => weeklyReviewFor('2026-W41').totalPct), 40);
    await page.evaluate(() => {selectWeeklyGoalsWeek('2026-W43');byId('weeklyReviewSummary').dataset.weekKey='2026-W43';closeWeeklyGoals();selectWeeklyGoalsWeek('2026-W42');});
    const before = await page.evaluate(() => state.weeklyGoals.length);
    await page.evaluate(() => {state.weeklyGoals=state.weeklyGoals.filter(g=>g.id!==99201);selectWeeklyGoalsWeek('2026-W41');carryWeeklyGoalForward(1);});
    assert.match(alerts.at(-1), /již uzavřený/);
    assert.equal(await page.evaluate(() => state.weeklyGoals.length), before - 1);
    assert.deepEqual(await page.evaluate(() => [shiftWeeklyGoalWeek('2026-W01',-1),shiftWeeklyGoalWeek('2026-W53',1),validWeeklyGoalWeek('2026-W54')]), ['2025-W52','2027-W01',false]);
    // Older than 12 weeks remains available, and Analysis opens the selected week's goals.
    await page.evaluate(() => {
      state.weeklyGoals.push({id:99300,weekKey:'2025-W01',slot:1,title:'Starý plán',metricType:'manual',target:1,manualActual:0});
      showView('referrers');setVal('analysisWeek','2026-W42');openWeeklyGoalsFromAnalysis();
    });
    assert.equal(await page.locator('#weeklyGoalsWeekSelect').inputValue(), '2026-W42');
    assert.equal(await page.locator('#weeklyGoalsWeekSelect option[value="2025-W01"]').count(), 1);
    // A modal keeps the week it was opened for even if the dashboard selection changes.
    await page.evaluate(() => {selectWeeklyGoalsWeek('2025-W01');openWeeklyGoalModal(1);selectWeeklyGoalsWeek('2026-W43');setVal('wgWhy','Uložená zpětná úprava');setVal('wgManualActual','1');saveWeeklyGoal();closeModal('weeklyGoalModal');});
    assert.equal(await page.evaluate(() => weeklyGoalForSlot(1,'2025-W01').manualActual), 1);
    await page.evaluate(() => selectWeeklyGoalsWeek('2026-W42'));
    await page.locator('.weekly-focus-card').screenshot({path:'/private/tmp/crm-weekly-goals-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.locator('.weekly-focus-card').screenshot({path:'/private/tmp/crm-weekly-goals-mobile.png'});
    assert.deepEqual(errors, []);
    console.log('PASS: Sunday → Monday + reload; open history; late edits/closure; immutable snapshots; carry remaining work once; capacity/closed guards; partial plans; ISO year boundary; Analysis link; editor week binding.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
