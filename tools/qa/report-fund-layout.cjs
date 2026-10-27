// Synthetic, isolated browser only: concise offline reports and consistent company/fund ordering.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, launchOptions} = require('./runtime.cjs');
const fixture = require('./fixture.cjs');
const root = path.resolve(__dirname, '../..');
const classicNames = ['Alfa běžná', 'Zebra běžná', 'Beta běžná', 'Omega běžná'];
const fkiNames = ['Beta Avant', 'Zebra Avant', 'Alfa Codya', 'Omega Codya', 'Beta Cyrrus', 'Zebra Cyrrus'];

(async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url()), file = path.join(root, decodeURIComponent(url.pathname));
      if (url.hostname === 'crm.test' && fs.existsSync(file) && fs.statSync(file).isFile()) {
        return route.fulfill({body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'});
      }
      return route.abort();
    });
    await context.addInitScript(data => {
      if (location.hostname === 'crm.test' && !localStorage.getItem('filip_crm_main_v1')) localStorage.setItem('filip_crm_main_v1', JSON.stringify(data));
    }, fixture);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push('CRM: ' + error.message));
    page.on('dialog', dialog => dialog.dismiss());
    await page.goto('https://crm.test/FILIP-CRM.html');
    await page.waitForFunction(() => typeof compareFundsByCompanyName === 'function' && typeof clientOutput_xFundPageUrl === 'function');
    const officialPages = await page.evaluate(() => Object.values(window.CRM_FUND_PROFILES).map(profile => ({isin: profile.isin, url: profile.officialUrl, accepted: clientOutput_xFundPageUrl(profile.officialUrl)})));
    assert.ok(officialPages.length >= 38);
    assert.ok(officialPages.every(profile => profile.url && profile.accepted), 'every audited official fund page remains available to clients');
    assert.deepEqual(await page.evaluate(() => [
      {company: 'Codya', product: 'Stejný fond', isin: 'CZ9000000002', key: 'z'},
      {company: 'Kodia', product: 'Stejný fond', isin: 'CZ9000000001', key: 'b'},
      {company: 'Codia', product: 'Stejný fond', isin: 'CZ9000000001', key: 'a'}
    ].sort(compareFundsByCompanyName).map(f => f.key)), ['a', 'b', 'z'], 'equal-name aliases use stable ISIN/key ties');

    await page.evaluate(() => {
      state.deals = []; state.contracts = []; state.investmentRecords = []; state.investmentSnapshots = [];
      state.fundValues = {}; state.lockedFunds = {}; state.trailSettings = {};
      const definitions = [
        ['Cyrrus', 'Omega běžná', 'Investice', 940000], ['Atris OPF', 'Zebra běžná', 'Investice', 910000],
        ['Atris', 'Alfa běžná', 'Investice', 110000], ['Cyrrus', 'Beta běžná', 'Investice', 140000],
        ['Codya', 'Omega Codya', 'FKI', 980000], ['Avant', 'Zebra Avant', 'FKI', 990000],
        ['Cirus', 'Zebra Cyrrus', 'FKI', 970000], ['Kodia', 'Alfa Codya', 'FKI', 180000],
        ['AVANT investiční společnost', 'Beta Avant', 'FKI', 190000], ['Cyrrus', 'Beta Cyrrus', 'FKI', 170000]
      ];
      window.CRM_FUND_PROFILES = {};
      definitions.forEach(([company, product, area, current], index) => {
        const isin = 'CZ9000000' + String(index).padStart(3, '0');
        const invested = current * 0.8;
        const profile = {isin, name: product, checkedAt: '2026-10-27', targetReturn: '8 % p.a.', performance12m: '7 % k 30. 9. 2026', fundSize: '100 mil. Kč k 30. 9. 2026', entryFee: '2 %', exitFee: '1 % do tří let', liquidity: 'Výplata do 30 pracovních dnů', valuationFrequency: 'Měsíčně', investmentHorizon: '5 let', risk: '4 / 7', manager: company, officialUrl: 'https://fund.example.test/funds/' + index, sources: [{label: 'Oficiální stránka', url: 'https://fund.example.test/funds/' + index}, {label: 'KID', url: 'https://fund.example.test/kid.pdf'}, {label: 'Statut', url: 'https://fund.example.test/statut.pdf'}]};
        window.CRM_FUND_PROFILES[isin] = profile;
        let key;
        if (area === 'FKI') {
          const row = {id: 500 + index, clientId: 1, company, Fond: product, ISIN: isin, 'Typ produktu': 'FKI', 'Typ CP': 'Investiční akcie', 'Čistá investice': invested, 'Aktuální hodnota investice': current, 'Datum připsání platby': '2025-01-10', 'Datum emise': '2025-02-01', 'Poslední schválená hodnota do': '2026-10-22', 'Typ transakce': 'Platba'};
          state.investmentRecords.push(row); key = invPositionKey(row);
        } else {
          const snapshot = {id: 400 + index, clientId: 1, company, product, isin, invested, current, date: '2026-10-22', purchaseDate: '2025-01-10', source: 'QA výpis', fundType: 'Podílový list'};
          state.investmentSnapshots.push(snapshot); key = investmentFundKey(investmentSnapshotItem(snapshot));
        }
        state.fundValues[key] = {area: area === 'FKI' ? 'fki' : 'investice', company, fond: product, isin, date: '2026-10-22', comment: 'Podrobný popis ' + product + '. Záměrně skrytý do otevření informací.'};
      });
      // Multiple dated transactions of one fund must retain their original order and values.
      const base = state.investmentRecords.find(row => row.Fond === 'Beta Avant');
      base['Čistá investice'] /= 2; base['Aktuální hodnota investice'] /= 2;
      state.investmentRecords.push({...base, id: 600, 'Datum připsání platby': '2025-06-10', 'Datum emise': '2025-07-01'});
      persist();
    });
    const fingerprint = () => page.evaluate(() => JSON.stringify({fundValues: state.fundValues, deals: state.deals, contracts: state.contracts, records: state.investmentRecords, snapshots: state.investmentSnapshots, locked: state.lockedFunds}));
    const before = await fingerprint();
    const order = await page.evaluate(() => ({
      classic: fundPerformance_classicGroups(classicInvestmentItemsForClient(1)).map(f => f.product),
      catalogClassic: investmentFundItems().filter(f => f.clients.size).map(f => f.product),
      catalogFki: collectFkFunds().filter(f => f.clients.size || f.rawCurrent).map(f => f.product),
      report: clientOutput_xClientInvestments(findClient(1)).map(f => ({company: fundCompanySortName(f.company), name: f.product, area: f.area})),
      aliases: ['Codya', 'Codia', 'Kodia', 'Kodya', 'Codie'].map(fundCompanySortName)
    }));
    assert.deepEqual(order.classic, classicNames, 'CRM ordinary investments use company then fund name, not amount');
    assert.deepEqual(order.catalogClassic, classicNames, 'ordinary fund catalogue uses the same order');
    assert.deepEqual(order.catalogFki, fkiNames, 'FKI catalogue groups provider aliases and alphabetizes funds');
    assert.deepEqual(order.aliases, Array(5).fill('Codya'));
    assert.deepEqual(order.report.filter(f => f.area === 'Investice').map(f => f.name), classicNames);
    assert.deepEqual(order.report.filter(f => f.area === 'FKI').map(f => f.name), fkiNames);

    const crmHtml = await page.evaluate(() => ({
      classic: renderInvestmentDetail(investmentClientRows().find(row => row.client.id === 1)),
      fki: renderFkClientDetail(fkClientRows().find(row => row.client.id === 1)),
      portfolio: clientPortfolio(findClient(1), [], [])
    }));
    const domNames = async (html, selector) => {
      const result = await page.evaluate(({html, selector}) => {
        const container = document.createElement('div'); container.innerHTML = html;
        return [...container.querySelectorAll(selector)].map(el => el.textContent.trim());
      }, {html, selector});
      return result;
    };
    assert.deepEqual(await domNames(crmHtml.portfolio, '[data-portfolio-area="investice"] .product-row b'), classicNames);
    assert.deepEqual(await domNames(crmHtml.portfolio, '[data-portfolio-area="fki"] .product-row b'), fkiNames);
    for (const [kind, names] of [['classic', classicNames], ['fki', fkiNames]]) {
      // Card titles are authoritative; the timeline may repeat fund labels earlier on the page.
      const cards = await domNames(crmHtml[kind], '.fki-work-card > summary .fki-work-name > b');
      assert.deepEqual(cards.map(title => names.find(name => title.includes(name))), names, 'rendered CRM ' + kind + ' cards');
    }

    const html = await page.evaluate(() => clientOutput_xReportHtml(findClient(1), {summary: true, investments: true, fki: true, notice: true}));
    fs.writeFileSync('/private/tmp/crm-report-fund-layout.html', html);
    const report = await context.newPage(); report.on('pageerror', error => errors.push('REPORT: ' + error.message));
    await report.setContent(html);
    const titles = area => report.locator('.report-area-' + area + ' .report-fund-detail h3').allTextContents();
    assert.deepEqual(await titles('classic'), classicNames);
    assert.deepEqual(await titles('fki'), fkiNames);
    assert.deepEqual(await report.locator('.report-provider-head h2').allTextContents(), ['Avant', 'Codya', 'Cyrrus']);
    const anchors = await report.locator('.report-fund-overview tbody a').evaluateAll(links => links.map(link => ({name: link.textContent.trim(), target: document.querySelector(link.getAttribute('href'))?.querySelector('h3')?.textContent.trim()})));
    assert.equal(anchors.length, 10);
    assert.ok(anchors.every(link => link.name === link.target), 'overview anchors still reach the matching fund after alias grouping');
    for (const [area, names] of [['classic', classicNames], ['fki', fkiNames]]) {
      assert.deepEqual(await report.locator('.report-area-' + area + ' .report-fund-overview tbody a b').allTextContents(), names, 'overview matches card order');
      const picked = await report.locator('[data-pick-group=' + area + ']').evaluate(input => [...input.closest('fieldset').querySelectorAll(':scope > label')].map(label => label.textContent.trim().split(' · ')[0]));
      assert.deepEqual(picked, names, 'selection controls use the same order');
    }
    const card = report.locator('.report-fund-detail').filter({has: report.locator('h3', {hasText: 'Beta Avant'})});
    const info = card.locator('details.report-fund-info'), transactions = card.locator('details.report-transactions');
    assert.equal(await report.locator('details.report-fund-info').count(), 10);
    assert.equal(await report.locator('details.report-fund-info[open],details.report-transactions[open]').count(), 0);
    assert.equal(await info.locator('.fund-profile').isVisible(), false);
    assert.equal(await info.locator('.fund-note').isVisible(), false);
    assert.equal(await card.locator(':scope > .fund-note, :scope > .fund-profile, .report-redemption').count(), 0);
    assert.equal(await card.locator('h3').isVisible(), true); assert.equal(await card.locator('.fund-tags').isVisible(), true); assert.equal(await card.locator(':scope > .metrics').isVisible(), true);
    const layout = await card.evaluate(el => [...el.children].map(child => child.className));
    assert.deepEqual(layout, ['report-fund-head', 'report-fund-info', 'metrics', 'report-transactions']);
    await card.screenshot({path: '/private/tmp/crm-report-fund-collapsed-desktop.png'});
    await info.locator('summary').focus(); await report.keyboard.press('Enter');
    assert.equal(await info.getAttribute('open'), ''); assert.equal(await info.locator('.fund-profile').isVisible(), true);
    assert.match(await info.innerText(), /Podrobný popis Beta Avant/);
    assert.equal(await info.locator('a').count(), 1); assert.equal(await info.locator('a').getAttribute('href'), 'https://fund.example.test/funds/8');
    assert.match(await info.locator('a').innerText(), /Oficiální stránka fondu/); assert.equal(await info.locator('a').getAttribute('rel'), 'noopener noreferrer');
    await info.locator('summary').click(); assert.equal(await info.locator('.fund-profile').isVisible(), false);
    await transactions.locator('summary').click();
    const transactionText = await transactions.locator('tbody tr').allTextContents();
    assert.equal(transactionText.length, 2); assert.match(transactionText[0], /10\. 1\. 2025/); assert.match(transactionText[1], /10\. 6\. 2025/);
    await transactions.locator('summary').click();
    await info.locator('summary').click(); await card.screenshot({path: '/private/tmp/crm-report-fund-expanded-desktop.png'});

    // Offline selection remains independent of expansion and preserves the correct total.
    const totalBefore = await report.locator('[data-summary-group=total] [data-value=current]').innerText();
    await report.locator('#reportSelection summary').click();
    const id = await card.getAttribute('data-report-item');
    await report.locator('[data-pick-item="' + id + '"]').uncheck(); assert.equal(await card.isVisible(), false);
    assert.notEqual(await report.locator('[data-summary-group=total] [data-value=current]').innerText(), totalBefore);
    await report.locator('[data-pick-item="' + id + '"]').check(); assert.equal(await card.isVisible(), true);
    assert.equal(await info.getAttribute('open'), ''); assert.equal(await report.locator('[data-summary-group=total] [data-value=current]').innerText(), totalBefore);
    await report.locator('#reportSelection summary').click();

    // Printing includes an explicitly opened profile, never expands other information blocks.
    const closedInfo = report.locator('details.report-fund-info').first();
    await report.emulateMedia({media: 'print'}); await report.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    assert.equal(await closedInfo.isVisible(), false); assert.equal(await info.locator('.fund-profile').isVisible(), true);
    assert.equal(await report.locator('details.report-fund-info[open]').count(), 1);
    assert.equal(await transactions.locator('table').isVisible(), true, 'existing print expansion of transactions retained');
    await report.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await report.emulateMedia({media: 'screen'});
    assert.equal(await transactions.getAttribute('open'), null); assert.equal(await info.getAttribute('open'), '');
    await report.setViewportSize({width: 390, height: 844});
    assert.ok(await report.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.ok(await info.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await card.screenshot({path: '/private/tmp/crm-report-fund-expanded-mobile.png'});
    await info.locator('summary').click(); await card.screenshot({path: '/private/tmp/crm-report-fund-collapsed-mobile.png'});
    await transactions.locator('summary').click(); assert.ok(await report.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'transaction table scrolls inside its card');

    // Advisor catalogue retains documentary sources; client disclosure allows only the fund page.
    const safety = await page.evaluate(() => {
      const f = clientOutput_xClientInvestments(findClient(1)).find(f => f.product === 'Beta Avant');
      const result = {advisor: clientOutput_xFundProfileHtml(f), scenario: clientOutput_xFundDetail(f, 'scenario', true)};
      const second = clientOutput_xClientInvestments(findClient(1)).find(x => x.product === 'Alfa Codya');
      result.comparison = investmentComparisonPortraitHtml(findClient(1), {name: 'QA porovnání', createdAt: '2026-10-27', years: 5, managedRows: [], externalRows: [], baselineProjection: {}, variants: [{name: 'Nové portfolio', rows: [f, second].map(x => ({...x, funding: 'new', monthly: 0, rate: 8})), dispositions: {}, projection: {}}]});
      result.urls = ['javascript:alert(1)', 'data:text/html,test', 'https://user:pass@fund.example.test/', 'https://fund.example.test/kid.pdf', 'https://fund.example.test/statut', 'https://fund.example.test/factsheet.pdf'].map(clientOutput_xFundPageUrl);
      const attack = '<img src=x onerror="window.__qaInjected=1">';
      const dangerous = {...f, isin: 'CZ9000000999', product: attack, company: attack, comment: attack};
      window.CRM_FUND_PROFILES[dangerous.isin] = {isin: dangerous.isin, name: attack, checkedAt: '2026-10-27', exitFee: attack, officialUrl: 'javascript:alert(1)', sources: [{label: 'KID', url: 'https://fund.example.test/kid.pdf'}]};
      result.unsafe = clientOutput_xFundDetail(dangerous, 'unsafe');
      result.unknown = clientOutput_xFundDetail({...f, key: 'unknown', isin: '', product: 'Fond bez ISIN'}, 'unknown');
      delete window.CRM_FUND_PROFILES[dangerous.isin];
      return result;
    });
    assert.equal((await domNames(safety.advisor, 'a')).length, 3, 'advisor audit sources remain accessible');
    assert.ok(safety.urls.every(url => !url), 'document and dangerous links never reach client reports');
    const safetyPage = await context.newPage(); safetyPage.on('pageerror', error => errors.push('SAFETY: ' + error.message));
    await safetyPage.setContent(safety.unsafe + safety.unknown + safety.scenario);
    assert.equal(await safetyPage.locator('img,script,[onerror],[onclick]').count(), 0);
    assert.equal(await safetyPage.locator('#report-fund-unsafe a').count(), 0, 'no documentary fallback when official page is invalid');
    assert.match(await safetyPage.locator('#report-fund-unknown .fund-profile').textContent(), /Chybí platný ISIN/);
    assert.equal(await safetyPage.locator('.scenario-simple-fund details.report-fund-info[open]').count(), 0);
    assert.equal(await safetyPage.locator('.scenario-simple-fund details.report-fund-info').count(), 1);
    assert.equal(await safetyPage.evaluate(() => window.__qaInjected), undefined);
    // The custom comparison export reuses the same cards and disclosure style independently.
    const comparison = await context.newPage(); comparison.on('pageerror', error => errors.push('COMPARISON: ' + error.message));
    await comparison.setContent(safety.comparison);
    const comparisonInfo = comparison.locator('details.report-fund-info');
    assert.equal(await comparisonInfo.count(), 2);
    assert.equal(await comparison.locator('details.report-fund-info[open]').count(), 0);
    assert.equal(await comparisonInfo.first().locator('.fund-profile').isVisible(), false);
    assert.equal(await comparisonInfo.first().locator('summary').evaluate(el => getComputedStyle(el).borderTopStyle), 'solid');
    await comparisonInfo.last().locator('summary').focus(); await comparison.keyboard.press('Enter');
    assert.equal(await comparisonInfo.last().locator('.fund-profile').isVisible(), true);
    assert.equal(await comparisonInfo.last().locator('a').count(), 1);
    await comparison.emulateMedia({media: 'print'});
    assert.equal(await comparisonInfo.first().isVisible(), false);
    assert.equal(await comparisonInfo.last().locator('.fund-profile').isVisible(), true);
    await comparison.emulateMedia({media: 'screen'});
    assert.equal(await comparisonInfo.first().isVisible(), true);
    assert.equal(await comparison.locator('details.report-fund-info[open]').count(), 1);
    assert.equal(await fingerprint(), before, 'report rendering, aliases, CRM cards and disclosure never mutate holdings/valuations');
    assert.deepEqual(errors, []);
    console.log('PASS: client disclosure keyboard/click, only official fund link, advisor sources preserved, concise card order, no redemption duplicate, transaction order, aliases/company/name sorting across CRM/catalog/report/selection, offline toggles, mobile, print, actual comparison export disclosure styling/print, escaping, no holding mutations.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
