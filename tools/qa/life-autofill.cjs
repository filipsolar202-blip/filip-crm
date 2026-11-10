const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch(launchOptions);try{const ctx=await browser.newContext();await ctx.route('**/*',r=>{const u=new URL(r.request().url()),p=path.join(root,decodeURIComponent(u.pathname));return u.hostname==='crm.test'&&fs.existsSync(p)&&fs.statSync(p).isFile()?r.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html'}):r.abort();});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://crm.test/assets/life/calculator.html');await page.waitForFunction(()=>typeof d==='object');
await page.evaluate(()=>{d=L.normalize(L.fresh());d.household='married';d.adults.forEach((p,i)=>p.name='Test dospělý '+i);d.children=[L.person()];L.syncCoverage(d);d.expenses.home=50000;d.step=5;render();go(6);});
let result=await page.evaluate(()=>d.adults.map(p=>({actual:d.coverage[p.id].death.offers[0],expected:L.calculate(d,p).effective.death})));assert(result.every(x=>x.actual===x.expected&&x.expected>0));
const id=await page.evaluate(()=>d.adults[0].id),selector=`[data-path="coverage.${id}.death.offers.0"]`;
// Even re-entering the identical amount explicitly makes it manual.
await page.locator(selector).fill(String(result[0].actual));await page.locator(selector).dispatchEvent('change');
await page.evaluate(()=>{d.expenses.home=70000;go(5);go(6);});
assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.offers[0]),result[0].actual);
assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.offers[1]),await page.evaluate(()=>L.calculate(d,d.adults[0]).effective.death));
await page.locator(selector).fill('0');await page.locator(selector).dispatchEvent('change');
const saved=await page.evaluate(()=>JSON.stringify(L.validate(d)));await page.reload();await page.evaluate(s=>{d=L.normalize(L.validate(JSON.parse(s)));d.expenses.home=90000;go(6);},saved);assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.offers[0]),0);
await page.evaluate(()=>{for(const rows of Object.values(d.coverage))for(const r of Object.values(rows))delete r.autoCoverage;d.coverage[d.children[0].id].invalid.offers=[123,456,789];d.coverage[d.adults[0].id].death.current=12345;render();});
assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.offers[0]),0);
await page.locator('[data-action="refresh"]').click();
// Custom confirmation dialog.
const buttons=await page.locator('dialog[open] button').allTextContents();
assert(buttons.length>0);await page.locator('dialog[open] button').last().click();
assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.offers[0]),await page.evaluate(()=>L.calculate(d,d.adults[0]).effective.death));
assert.equal(await page.evaluate(()=>d.coverage[d.adults[0].id].death.current),12345);
assert.deepEqual(await page.evaluate(()=>d.coverage[d.children[0].id].invalid.offers),[123,456,789]);assert.deepEqual(errors,[]);
console.log('PASS family prefill, input changes, manual identical/zero protection, validated reload, legacy preservation and confirmed transfer.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
