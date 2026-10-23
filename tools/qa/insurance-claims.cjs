// Isolated synthetic data only. Never opens a real browser profile or contacts Google.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const fixture = require('./fixture.cjs');
const root = path.resolve(__dirname, '../..');

function googleRoundTrip(payload) {
  class Sheet {
    constructor() { this.rows = []; }
    getLastRow() { return this.rows.length; }
    appendRow(row) { this.rows.push(row); }
    setFrozenRows() {}
    getRange(row, col, count, width) {
      return {
        getValues: () => Array.from({length: count}, (_, i) => Array.from({length: width}, (_, j) => this.rows[row - 1 + i]?.[col - 1 + j] ?? '')),
        setValues: values => values.forEach((r, i) => {
          this.rows[row - 1 + i] ||= [];
          r.forEach((value, j) => { this.rows[row - 1 + i][col - 1 + j] = value; });
        })
      };
    }
  }
  const sheets = new Map();
  const spreadsheet = {
    getSheetByName: name => sheets.get(name),
    insertSheet(name) { const sheet = new Sheet(); sheets.set(name, sheet); return sheet; }
  };
  const context = {
    SpreadsheetApp: {openById: () => spreadsheet},
    Utilities: {getUuid: () => 'qa-claims-backup'},
    ContentService: {MimeType: {JAVASCRIPT: 'js'}, createTextOutput: text => ({text, setMimeType() { return this; }})},
    HtmlService: {createHtmlOutput: text => ({text})}
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'google-sync/Code.gs'), 'utf8').replace('PASTE_GOOGLE_SHEET_ID_HERE', 'qa-sheet').replace('CHANGE_THIS_PRIVATE_KEY', 'qa-key'), context);
  const saved = context.doPost({parameter: {action: 'save', key: 'qa-key', app: 'filip_crm', payload: JSON.stringify(payload)}});
  assert.match(saved.text, /byla ulozena/);
  const response = context.doGet({parameter: {action: 'load', key: 'qa-key', app: 'filip_crm', callback: 'qa'}}).text;
  const result = JSON.parse(response.slice(3, -2));
  assert.equal(result.ok, true);
  assert.ok(sheets.get('backup_chunks').rows.length > 2, 'attachment must survive the real multi-chunk Google protocol');
  return result.backup;
}

async function financialState(page) {
  return page.evaluate(() => JSON.stringify({
    contracts: state.contracts, deals: state.deals, opportunities: state.opportunities,
    investmentRecords: state.investmentRecords, investmentSnapshots: state.investmentSnapshots,
    fundValues: state.fundValues,
    investmentSummary: [clientInvestmentSummary(1), clientInvestmentSummary(2)],
    pensionSummary: [clientPensionSummary(1), clientPensionSummary(2)]
  }));
}

async function run() {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}, acceptDownloads: true});
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const file = path.join(root, decodeURIComponent(url.pathname));
      if (url.hostname === 'crm.test' && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'});
      }
      return route.abort();
    });
    const data = structuredClone(fixture);
    await context.addInitScript(value => {
      if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1', JSON.stringify(value));
    }, data);
    const page = await context.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => { dialogs.push(dialog.message()); dialog.dismiss(); });
    await page.goto('https://crm.test/FILIP-CRM.html');
    await page.waitForFunction(() => typeof openInsuranceClaim === 'function');
    const baseline = await financialState(page);

    // A claim starts on the client's own card, using their existing policy.
    await page.evaluate(() => openClientWorkspace(1, 'insuranceClaims'));
    await page.locator('#clientDetail').getByRole('button', {name: '+ Pojistná událost', exact: true}).first().click();
    assert.equal(await page.locator('#icClient').inputValue(), '1');
    await page.locator('#icContract').selectOption('10');
    await page.locator('#icTitle').fill('Úraz na kole <bez HTML>');
    const firstCategory = await page.locator('#icCategory option').evaluateAll(options => options.find(x => x.value)?.value);
    await page.locator('#icCategory').selectOption(firstCategory);
    await page.locator('#icStatus').selectOption('collecting');
    await page.locator('#icIncidentDate').fill('2026-10-10');
    await page.locator('#icRecordedDate').fill('2026-10-20');
    await page.locator('#icReportedDate').fill('2026-10-21');
    await page.locator('#icDescription').fill('Pád z kola. <img src=x onerror="window.claimXss=1"> Lékařské zprávy čekají na doplnění.');
    await page.locator('#icClaimNumber').fill('QA-PU-2026-01');
    await page.locator('#icRequestedAmount').fill('25 000');
    await page.locator('#icNextStep').fill('Doplnit lékařskou zprávu');
    await page.locator('#icNextDate').fill('2026-10-25');
    await page.locator('#icEventDate').fill('2026-10-20');
    await page.locator('#icEventNote').fill('Událost převzata od klienta.');
    const document = Buffer.from('%PDF-1.4\n% Synthetic QA document\n' + '% No real medical or client data.\n'.repeat(2200) + '%%EOF\n');
    await page.locator('#icAttachmentInput').setInputFiles({name: 'qa-podklad.pdf', mimeType: 'application/pdf', buffer: document});
    await page.locator('#insuranceClaimModal').getByText('qa-podklad.pdf', {exact: false}).first().waitFor();
    await page.locator('#icSave').click();
    await page.waitForFunction(() => state.insuranceClaims.length === 1);
    const claimId = await page.evaluate(() => state.insuranceClaims[0].id);
    await page.reload();
    const claim = await page.evaluate(id => state.insuranceClaims.find(x => x.id === id), claimId);
    assert.equal(claim.clientId, 1);
    assert.equal(claim.contractId, 10);
    assert.equal(claim.title, 'Úraz na kole <bez HTML>');
    assert.equal(claim.status, 'collecting');
    assert.equal(claim.requestedAmount, 25000);
    assert.equal(claim.paidAmount, null, 'a missing payout must not become zero');
    assert.equal(claim.incidentDate, '2026-10-10');
    assert.equal(claim.recordedDate, '2026-10-20');
    assert.equal(claim.reportedDate, '2026-10-21');
    assert.equal(claim.nextDate, '2026-10-25');
    assert.equal(claim.attachments.length, 1);
    assert.equal(claim.attachments[0].name, 'qa-podklad.pdf');
    assert.equal(Buffer.from(claim.attachments[0].dataUrl.split(',')[1], 'base64').toString(), document.toString());
    assert.ok(claim.history.some(x => x.text.includes('Událost převzata')));
    assert.equal(await page.evaluate(() => window.claimXss), undefined);
    // A restored Google backup can contain both the portable payload and an old
    // desktop-only reference. The embedded document must remain downloadable.
    await page.evaluate(id => {
      openInsuranceClaim(1, id);
      insuranceClaimEditor.record.attachments[0].fileRef = 'stale-desktop-only-reference.pdf';
    }, claimId);
    const downloadPending = page.waitForEvent('download');
    await page.locator('#icAttachments').getByRole('button', {name: 'Stáhnout', exact: true}).click();
    const downloaded = await downloadPending;
    assert.deepEqual(fs.readFileSync(await downloaded.path()), document);
    await page.evaluate(() => closeInsuranceClaim(true));
    await page.evaluate(() => openClientWorkspace(2, 'insuranceClaims'));
    assert.doesNotMatch(await page.locator('#clientDetail').innerText(), /Úraz na kole/);
    await page.evaluate(() => openClientWorkspace(1, 'insuranceClaims'));
    assert.match(await page.locator('#clientDetail').innerText(), /Úraz na kole <bez HTML>/);

    // A different client's rejected claim retains an explicitly recorded zero payout.
    await page.evaluate(() => openInsuranceClaim(2));
    await page.locator('#icTitle').fill('Poškozené sklo Beta');
    const secondCategory = await page.locator('#icCategory option').evaluateAll((options, first) => options.find(x => x.value && x.value !== first)?.value || first, firstCategory);
    await page.locator('#icCategory').selectOption(secondCategory);
    await page.locator('#icStatus').selectOption('rejected');
    await page.locator('#icInsurer').fill('QA Pojišťovna Beta');
    await page.locator('#icIncidentDate').fill('2026-10-01');
    await page.locator('#icRecordedDate').fill('2026-10-02');
    await page.locator('#icResolvedDate').fill('2026-10-20');
    await page.locator('#icPaidAmount').fill('0');
    await page.locator('#icOutcome').fill('Pojišťovna zamítla plnění; klient informován.');
    await page.locator('#icSave').click();
    await page.waitForFunction(() => state.insuranceClaims.length === 2);
    await page.reload();
    assert.deepEqual(await page.evaluate(() => { const x = state.insuranceClaims.find(x => x.clientId === 2); return [x.status, x.paidAmount, x.resolvedDate]; }), ['rejected', 0, '2026-10-20']);
    await page.evaluate(() => showView('insuranceClaims'));
    assert.match(await page.locator('#insuranceClaims').innerText(), /Úraz na kole/);
    assert.equal(await page.locator('#insuranceClaims .insurance-claim-title').filter({hasText: 'Poškozené sklo Beta'}).count(), 0, 'closed claims stay out of the open workflow');
    await page.locator('#icFilterScope').selectOption('all');
    await page.locator('#icFilterQuery').fill('Poškozené sklo Beta');
    assert.equal(await page.locator('#insuranceClaims .insurance-claim-title').count(), 1);
    assert.match(await page.locator('#insuranceClaims .insurance-claim-title').innerText(), /Poškozené sklo Beta/);
    await page.locator('#icFilterQuery').fill('');
    await page.locator('#icFilterStatus').selectOption('collecting');
    assert.equal(await page.locator('#insuranceClaims .insurance-claim-title').count(), 1);
    await page.locator('#icFilterStatus').selectOption('');
    await page.locator('#icFilterCategory').selectOption(secondCategory);
    if (firstCategory !== secondCategory) assert.equal(await page.locator('#insuranceClaims .insurance-claim-title').count(), 1);
    await page.locator('#icFilterCategory').selectOption('');
    await page.locator('#icFilterSort').selectOption('incident');
    await page.locator('#insuranceClaims').screenshot({path: '/private/tmp/crm-claims-desktop.png'});

    // Each stage update preserves documents and the prior dated journal.
    await page.evaluate(id => openInsuranceClaim(1, id), claimId);
    await page.evaluate(id => {
      const file = state.insuranceClaims.find(x => x.id === id).attachments[0];
      file.fileRef = 'qa-disk-reference.pdf';
      file.storage = 'disk';
      file.savedAt = '2026-10-23T12:00:00.000Z';
    }, claimId);
    await page.locator('#icStatus').selectOption('sent');
    await page.locator('#icSentDate').fill('2026-10-22');
    await page.locator('#icEventDate').fill('2026-10-22');
    await page.locator('#icEventNote').fill('Kompletní podklady odeslány pojišťovně.');
    await page.locator('#icSave').click();
    await page.waitForFunction(id => state.insuranceClaims.find(x => x.id === id)?.status === 'sent', claimId);
    await page.reload();
    const sent = await page.evaluate(id => state.insuranceClaims.find(x => x.id === id), claimId);
    assert.equal(sent.sentDate, '2026-10-22');
    assert.ok(sent.history.length > claim.history.length);
    assert.ok(sent.history.some(x => x.text.includes('Událost převzata')));
    assert.ok(sent.history.some(x => x.text.includes('Kompletní podklady')));
    assert.equal(sent.attachments[0].dataUrl, claim.attachments[0].dataUrl);
    assert.equal(sent.attachments[0].fileRef, 'qa-disk-reference.pdf', 'disk autosave metadata is preserved without falsely conflicting with an open editor');

    // A real concurrent edit must instead be detected without losing either copy.
    await page.evaluate(id => { openInsuranceClaim(1, id); window.qaClaimBeforeConflict = structuredClone(state.insuranceClaims.find(x => x.id === id)); }, claimId);
    await page.locator('#icOutcome').fill('Rozepsaný návrh po hovoru s klientem');
    await page.evaluate(id => {
      const record = state.insuranceClaims.find(x => x.id === id);
      record.outcome = 'Novější výsledek z druhého zařízení';
      record.updatedAt = new Date(Date.now() + 10000).toISOString();
    }, claimId);
    await page.locator('#icSave').click();
    assert.match(await page.locator('#icError').innerText(), /mezitím změnila/);
    assert.equal(await page.locator('#icOutcome').inputValue(), 'Rozepsaný návrh po hovoru s klientem');
    assert.equal(await page.evaluate(id => state.insuranceClaims.find(x => x.id === id).outcome, claimId), 'Novější výsledek z druhého zařízení');
    await page.evaluate(id => {
      state.insuranceClaims = state.insuranceClaims.map(x => x.id === id ? window.qaClaimBeforeConflict : x);
      closeInsuranceClaim(true);
    }, claimId);

    // Failed writes keep the last persisted record intact and leave the draft open.
    await page.evaluate(id => { window.qaRealPersist = persist; persist = () => false; openInsuranceClaim(1, id); }, claimId);
    await page.locator('#icOutcome').fill('Rozpracované vyjádření, které se nesmí ztratit.');
    await page.locator('#icSave').click();
    assert.equal(await page.locator('#insuranceClaimModal').isVisible(), true);
    assert.equal(await page.locator('#icOutcome').inputValue(), 'Rozpracované vyjádření, které se nesmí ztratit.');
    assert.notEqual(await page.evaluate(id => state.insuranceClaims.find(x => x.id === id).outcome, claimId), 'Rozpracované vyjádření, které se nesmí ztratit.');
    assert.ok((await page.locator('#icError').innerText()).trim());
    await page.evaluate(() => { persist = window.qaRealPersist; });
    await page.locator('#icStatus').selectOption('resolved');
    await page.locator('#icResolvedDate').fill('2026-10-23');
    await page.locator('#icPaidAmount').fill('18 500');
    await page.locator('#icOutcome').fill('Vyplaceno klientovi na účet.');
    await page.locator('#icEventDate').fill('2026-10-23');
    await page.locator('#icEventNote').fill('Vyřízeno a klientovi potvrzena výplata.');
    await page.locator('#icSave').click();
    await page.waitForFunction(id => state.insuranceClaims.find(x => x.id === id)?.paidAmount === 18500, claimId);
    await page.reload();
    assert.deepEqual(await page.evaluate(id => { const x = state.insuranceClaims.find(x => x.id === id); return [x.status, x.paidAmount, x.resolvedDate]; }, claimId), ['resolved', 18500, '2026-10-23']);
    assert.equal(await financialState(page), baseline, 'claim payments must never become revenue or managed assets');
    await page.evaluate(() => { const previous = editingClientId; editingClientId = 1; deleteClient(); editingClientId = previous; });
    assert.match(dialogs.pop(), /Klienta nelze smazat/);
    await page.evaluate(() => { const previous = editingContractId; editingContractId = 10; fkiSync_before_deleteContract(); editingContractId = previous; });
    assert.match(dialogs.pop(), /Smlouvu nelze smazat/);
    assert.equal(await financialState(page), baseline, 'resolved claims still protect their client and linked policy');

    // JSON and the actual Google Apps Script chunking protocol preserve all content.
    const payload = await page.evaluate(() => googleSyncPayload());
    const returned = googleRoundTrip(JSON.parse(JSON.stringify(payload)));
    assert.deepEqual(returned.state.insuranceClaims, payload.state.insuranceClaims);
    const backup = await page.evaluate(value => {
      const normalized = normalizeState(value.state), counts = criticalBackupCounts(normalized);
      const missing = normalizeState({...value.state, insuranceClaims: []});
      const partial = normalizeState({...value.state, insuranceClaims: value.state.insuranceClaims.map(x => ({...x, history: [], attachments: []}))});
      return {claims: normalized.insuranceClaims, counts, drops: backupCountDrops(criticalBackupCounts(missing), counts), partialDrops: backupCountDrops(criticalBackupCounts(partial), counts)};
    }, returned);
    assert.deepEqual(backup.claims, payload.state.insuranceClaims);
    assert.equal(backup.counts.insuranceClaims, 2);
    assert.ok(backup.counts.claimHistory >= 3);
    assert.equal(backup.counts.claimAttachments, 1);
    assert.ok(backup.drops.some(x => x.key === 'insuranceClaims'));
    assert.ok(backup.drops.some(x => x.key === 'claimAttachments'));
    assert.ok(backup.partialDrops.some(x => x.key === 'claimHistory'));
    assert.ok(backup.partialDrops.some(x => x.key === 'claimAttachments'));
    assert.ok(!backup.partialDrops.some(x => x.key === 'insuranceClaims'), 'history and attachments are protected even when claim count is unchanged');
    const normalization = await page.evaluate(() => {
      const value = normalizeState({insuranceClaims: [{id: 1, history: [{id: 9001}], attachments: [{id: 9002}]}]});
      return value.nextId;
    });
    assert.ok(normalization > 9002, 'IDs inside saved history and attachments also reserve the global ID counter');

    // Additive import resolves references by identity, updates the same stable record,
    // and does not duplicate old journal entries or attachments on repeated imports.
    const mergeResult = await page.evaluate(value => {
      const saved = structuredClone(state);
      try {
        const local = state.insuranceClaims.find(x => x.clientId === 1);
        const imported = structuredClone(local);
        imported.id = 990;
        imported.clientId = 501;
        imported.contractId = 510;
        imported.updatedAt = '2027-01-02T12:00:00.000Z';
        imported.outcome = 'Doplněno z novější zálohy';
        imported.history.push({id: 'qa-import-note', at: imported.updatedAt, date: '2027-01-02', status: 'resolved', text: 'Nový záznam z importu.'});
        const incoming = {clients: [{...state.clients.find(x => x.id === 1), id: 501}], contracts: [{...state.contracts.find(x => x.id === 10), id: 510, clientId: 501}], insuranceClaims: [imported]};
        const count1 = mergeIncomingState(incoming);
        const count2 = mergeIncomingState(incoming);
        const updated = structuredClone(state.insuranceClaims.find(x => x.id === local.id));
        const total = state.insuranceClaims.length;
        const stale = structuredClone(incoming);
        stale.insuranceClaims[0].updatedAt = '2020-01-01T00:00:00.000Z';
        stale.insuranceClaims[0].outcome = 'Starší výsledek';
        mergeIncomingState(stale);
        const afterOld = state.insuranceClaims.find(x => x.id === local.id).outcome;
        const foreign = structuredClone(incoming);
        foreign.clients = [{...state.clients.find(x => x.id === 2), id: 501}];
        foreign.contracts = [];
        foreign.insuranceClaims[0].contractId = null;
        foreign.insuranceClaims[0].title = 'Cizí stejný synchronizační identifikátor';
        mergeIncomingState(foreign);
        mergeIncomingState(foreign);
        const foreignRows = state.insuranceClaims.filter(x => x.title === 'Cizí stejný synchronizační identifikátor');
        const ownAfterCollision = state.insuranceClaims.find(x => x.id === local.id).clientId;
        const orphan = {createdAt: '2026-01-01', clients: [], insuranceClaims: [{...imported, syncId: 'qa-orphan', clientId: 1, contractId: 10, title: 'Nepřiřazená importovaná událost'}]};
        mergeIncomingState(orphan);
        mergeIncomingState(orphan);
        const orphanRows = state.insuranceClaims.filter(x => x.syncId === 'qa-orphan');
        restoreIncomingStateFromGoogle(value.state, 'qa-claims-roundtrip');
        const restored = structuredClone(state.insuranceClaims);
        return {updated, total, count1, count2, afterOld, restored, foreignRows, ownAfterCollision, orphanRows};
      } finally { state = saved; }
    }, returned);
    assert.equal(mergeResult.total, 2);
    assert.equal(mergeResult.updated.clientId, 1);
    assert.equal(mergeResult.updated.contractId, 10);
    assert.equal(mergeResult.updated.outcome, 'Doplněno z novější zálohy');
    assert.equal(mergeResult.updated.history.filter(x => x.id === 'qa-import-note').length, 1);
    assert.equal(mergeResult.updated.attachments.length, 1);
    assert.equal(mergeResult.afterOld, 'Doplněno z novější zálohy');
    assert.equal(mergeResult.foreignRows.length, 1);
    assert.equal(mergeResult.foreignRows[0].clientId, 2);
    assert.equal(mergeResult.ownAfterCollision, 1, 'a reused sync ID cannot reassign the original claim');
    assert.equal(mergeResult.orphanRows.length, 1);
    assert.equal(mergeResult.orphanRows[0].clientId, null, 'unresolved foreign ID cannot bind to the same numeric local client ID');
    assert.equal(mergeResult.orphanRows[0].contractId, null);
    assert.ok(mergeResult.orphanRows[0].importReference);
    assert.deepEqual(mergeResult.restored, returned.state.insuranceClaims);

    const clientMerge = await page.evaluate(() => {
      const saved = structuredClone(state), savedStorage = localStorage.getItem(STORE), previousConfirm = window.confirm;
      try {
        // A second client's policy becomes a duplicate after joining the cards.
        state.contracts.push({...state.contracts.find(x => x.id === 10), id: 700, clientId: 2});
        state.insuranceClaims.find(x => x.clientId === 2).contractId = 700;
        openClientMergeModal([1, 2]);
        byId('mergeMaster').value = '1';
        window.confirm = () => true;
        mergeClientsFromModal();
        const beforeDedupe = state.insuranceClaims.map(x => ({clientId: x.clientId, contractId: x.contractId}));
        // Policy deduplication is a separate operation; test its reference repair too.
        dedupeMasterContracts(1);
        return {clients: state.clients.length, beforeDedupe, claims: state.insuranceClaims.map(x => ({clientId: x.clientId, contractId: x.contractId})), contracts: state.contracts.map(x => x.id)};
      } finally {
        window.confirm = previousConfirm;
        state = saved;
        localStorage.setItem(STORE, savedStorage);
      }
    });
    assert.match(dialogs.pop(), /Karty jsou sloučené/);
    assert.equal(clientMerge.clients, 1);
    assert.ok(clientMerge.beforeDedupe.every(x => x.clientId === 1));
    assert.ok(clientMerge.beforeDedupe.some(x => x.contractId === 700), 'joining client cards keeps their original policy linkage');
    assert.ok(clientMerge.claims.every(x => x.clientId === 1));
    assert.ok(clientMerge.claims.every(x => x.contractId === 10));
    assert.ok(!clientMerge.contracts.includes(700), 'duplicate policy merge remaps claim linkage to the preserved policy');
    await page.reload();

    await page.evaluate(() => showView('insuranceClaims'));
    await page.locator('#icFilterScope').selectOption('all');
    await page.setViewportSize({width: 390, height: 844});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'the board scrolls internally on mobile');
    await page.screenshot({path: '/private/tmp/crm-claims-mobile.png'});
    await page.evaluate(id => openInsuranceClaim(1, id), claimId);
    assert.ok(await page.locator('#insuranceClaimModal .modal-box').evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'mobile editor must fit its viewport');
    await page.screenshot({path: '/private/tmp/crm-claim-editor-mobile.png'});
    assert.equal((await page.locator('#icPaidAmount').inputValue()).replace(/\s/g, ''), '18500');
    await page.evaluate(() => closeInsuranceClaim());

    assert.equal(await financialState(page), baseline, 'claims must not change sales, commissions or client AUM');
    assert.deepEqual(errors, []);
    assert.deepEqual(dialogs, []);
    console.log('PASS: client-bound claim create/edit/reload, dates and stage history, per-client isolation, attachments, filters, zero payout, failed-write draft, JSON and Google chunk roundtrip, ID-remapping merge, stale backup protection, mobile, no changes to sales/commissions/AUM.');
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
