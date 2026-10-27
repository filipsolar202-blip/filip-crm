// Synthetic, isolated profile: editing a proposal purchase must preserve its identity and redemptions.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const root = path.resolve(__dirname, '../..'), fixture = structuredClone(require('./fixture.cjs'));
fixture.fundValues['qa-position-edit'] = {area:'fki', company:'QA správce', fond:'QA upravený nákup', isin:'QAEDIT000001', nav:100, date:'2026-10-01', typ:'Investiční akcie'};
(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport:{width:1440, height:1000}});
    await context.route('**/*', route => {
      const u = new URL(route.request().url()), file = path.join(root, decodeURIComponent(u.pathname));
      if (u.hostname === 'crm.test' && fs.existsSync(file) && fs.statSync(file).isFile()) return route.fulfill({body:fs.readFileSync(file), contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html'});
      return route.abort();
    });
    await context.addInitScript(data => {if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1', JSON.stringify(data));}, fixture);
    const page = await context.newPage(), errors = [], dialogs = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => {dialogs.push(dialog.message()); await dialog.dismiss();});
    await page.goto('https://crm.test/FILIP-CRM.html');
    const initial = await page.evaluate(() => {
      const deal = {id:uid(), clientId:1, category:'FKI', company:'QA správce', product:'QA upravený nákup', fundKey:'qa-position-edit', isin:'QAEDIT000001', fundIsin:'QAEDIT000001', date:'2026-10-01', amount:200000, source:'investmentScenario', scenarioLinkKey:'qa-forecast|qa-variant|qa-row'};
      state.deals.push(deal); syncSignedInvestmentPosition(deal); syncCrmFkiDealsToRecords();
      const buy = state.investmentRecords.find(r => r._crmScenarioLinkKey === deal.scenarioLinkKey), key = invRecordKey(buy);
      state.investmentRecords.push({Investor:buy.Investor, ClientID:buy.ClientID, 'RČ':buy['RČ'], Fond:buy.Fond, 'Investiční společnost':buy['Investiční společnost'], 'rp.ISIN':buy['rp.ISIN'], 'Typ produktu':'FKI', 'Typ CP':buy['Typ CP'], 'Typ transakce':'Odkup', 'Čistá investice':1000, 'Aktuální hodnota investice':1000, 'Datum připsání platby':'2026-10-10', redemptionSourceRecordKey:key, 'Odkup z nákupu':key});
      openFkRecordModal(1, encodeURIComponent(invPositionKey(buy)), encodeURIComponent(key));
      return {key, qty:invQty(buy)};
    });
    assert.equal(initial.qty, 2000);
    await page.locator('#fkRecQty').fill('1900');
    await page.locator('#fkRecSubscribe').fill('105');
    await page.locator('#fkRecManualCurrent').check();
    await page.locator('#fkRecCurrent').fill('230000');
    await page.evaluate(() => saveFkRecord());
    const read = () => page.evaluate(() => {
      const buy = state.investmentRecords.find(r => r._crmScenarioLinkKey === 'qa-forecast|qa-variant|qa-row'), withdrawal = state.investmentRecords.find(r => invIsin(r) === 'QAEDIT000001' && invIsWithdrawal(r));
      return {count:state.investmentRecords.filter(r => r._crmScenarioLinkKey === 'qa-forecast|qa-variant|qa-row').length, key:invRecordKey(buy), link:withdrawal.redemptionSourceRecordKey, legacyLink:withdrawal['Odkup z nákupu'], qty:invQty(buy), subscribe:invSubscribeValue(buy), current:invCurrentValue(buy), mode:buy.fkiValuationMode, date:invPaymentDate(buy)};
    });
    const edited = await read();
    assert.notEqual(edited.key, initial.key); assert(edited.key.endsWith('|scenario|qa-forecast|qa-variant|qa-row'));
    assert.equal(edited.link, edited.key); assert.equal(edited.legacyLink, edited.key);
    assert.equal(edited.count, 1); assert.equal(edited.qty, 1900); assert.equal(edited.subscribe, 105); assert.equal(edited.current, 230000); assert.equal(edited.mode, 'manual');
    await page.evaluate(() => {state.fundValues['qa-position-edit'].nav = 130; state.fundValues['qa-position-edit'].date = '2026-10-25'; renderAll(); renderAll(); persist();});
    assert.deepEqual(await read(), edited, 'repeated sync/NAV update preserves edited position and redemption links');
    await page.reload();
    assert.deepEqual(await read(), edited, 'storage round-trip preserves the edited scenario purchase');
    assert.deepEqual(errors, []); assert.deepEqual(dialogs, []);
    console.log('PASS proposal FKI position edit: stable purchase identity, both redemption references, manual value and original CP survive NAV refresh, repeated sync and reload.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode = 1;});
