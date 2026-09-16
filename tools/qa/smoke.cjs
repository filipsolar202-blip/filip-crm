const fs=require('fs'),path=require('path');
const {chromium,launchOptions}=require('./runtime.cjs');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const browser=await chromium.launch(launchOptions);
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage();let errors=[];
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('dialog',async d=>d.type()==='confirm'?d.accept():d.dismiss());
 await context.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.hostname==='crm.test'){
  const p=path.join(root,decodeURIComponent(url.pathname));
  if(fs.existsSync(p))return route.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html'});
 }
 if(url.hostname==='127.0.0.1')return route.fulfill({status:503,body:'disabled in isolated test'});
 if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({body:'window.Chart=class {constructor(){this.destroy=()=>{}}};window.XLSX={};',contentType:'text/javascript'});
 return route.abort();
 });
 await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForTimeout(2000);
 console.log('errors',errors);
 console.log('version',await page.locator('#appVersionBadge').textContent());
 for(const view of await page.locator('.tab[data-view]').evaluateAll(xs=>xs.map(x=>x.dataset.view))){await page.locator(`.tab[data-view="${view}"]`).click();console.log('view',view,await page.locator('#'+view).isVisible())}
 console.log('all errors',errors);
 await page.locator('.tab[data-view="dashboard"]').click();
 await page.screenshot({path:'/private/tmp/crm-unified-dashboard.png',fullPage:true});
 await browser.close();if(errors.length)process.exitCode=1;
})();
