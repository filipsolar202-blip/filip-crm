const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch(launchOptions);
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100},timezoneId:'Europe/Prague'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='crm.test'){const p=path.join(root,decodeURIComponent(u.pathname));if(fs.existsSync(p))return route.fulfill({body:fs.readFileSync(p),contentType:p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.png')?'image/png':'text/html'});}return route.abort();});
  const fixture={clients:[{id:1,name:'Testovací klient',phone:'777000000',email:'qa@example.test'}],activities:[
   {id:1,clientId:1,type:'Poznámka',text:'Upraven klient',date:'2026-09-01',completed:false},
   {id:2,clientId:1,type:'Smlouva',text:'Upravena Auto',date:'2026-09-02',outcome:'agreed'},
   {id:3,clientId:1,type:'Příležitost',text:'Stav: Oportunita · Investice',date:'2026-09-03'},
   {id:4,clientId:1,type:'Příležitost',text:'Obchod přesunut zpět do příležitostí: DPS',date:'2026-09-04'},
   {id:5,clientId:1,type:'Email',text:'Smlouva: Auto · qa@example.test',date:'2026-09-05'},
   {id:6,clientId:1,type:'Obchod',text:'Upraven DPS · 10 BJ',date:'2026-09-06'},
   {id:10,clientId:1,type:'Telefon',text:'Kontrola po e-mailu',date:'2026-10-06',time:'09:00'},
   {id:11,clientId:1,type:'Schůzka',text:'Probrat další postup',date:'2026-10-19',time:'10:00'},
   {id:12,clientId:1,type:'Email',text:'Domluvení schůzky',date:'2026-10-19'},
   {id:13,clientId:1,type:'Úkol',text:'Klient upraven – zavolat a ověřit údaje',date:'2026-10-19'},
   {id:14,clientId:1,type:'Úkol',text:'Připravit nabídku',date:'2026-10-20',time:'09:00'},
   {id:15,clientId:1,type:'Úkol',text:'Budoucí úkol',date:'2026-11-20'},
   {id:16,clientId:1,type:'Poznámka',text:'Upraven klient',source:'quick_activity',date:'2026-10-19'},
   {id:17,clientId:1,type:'Úkol',text:'Bez termínu'},
   {id:18,clientId:1,type:'Schůzka',text:'Přesunutá schůzka',date:'2026-10-19',outcome:'moved'},
   {id:19,clientId:1,type:'Telefon',text:'Hotový hovor',date:'2026-10-19',completedAt:'2026-10-19'},
   {id:20,clientId:1,type:'Email',text:'Smlouva: Auto · qa@example.test',date:'2026-10-19',recordKind:'activity'},
  ],contracts:[{id:100,clientId:1,type:'auto',anniv:'2023-11-01',product:'Testovací smlouva'},{id:101,clientId:1,type:'život',anniv:'2021-11-01',product:'Revize'},{id:102,clientId:1,type:'hypotéka',anniv:'2026-12-01',product:'Fixace'}]};
  await context.addInitScript(f=>{if(location.hostname==='crm.test'&&!localStorage.getItem('filip_crm_main_v1'))localStorage.setItem('filip_crm_main_v1',JSON.stringify(f));},fixture);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.clock.install({time:new Date('2026-10-19T10:00:00+02:00')});
  await page.goto('https://crm.test/FILIP-CRM.html');
  const ids=()=>page.evaluate(()=>dashboardWorkRows().filter(x=>x.kind==='activity').map(x=>x.id));
  assert.deepEqual(await ids(),[10,12,13,16,20,11,17]);
  const migrated=await page.evaluate(()=>JSON.parse(localStorage.getItem(STORE)).activities.filter(a=>a.historyCleanup));
  assert.equal(migrated.length,6);assert(migrated.every(a=>a.completed&&a.outcome==='realized'&&a.recordKind==='history'));
  assert.equal(migrated[0].completedAt,'2026-09-01','Preserve historical date rather than inventing contact today');
  assert.equal(await page.evaluate(()=>state.activities.length),fixture.activities.length,'No history deletion');
  await page.reload();await page.evaluate(()=>openFocusPanel('dashboardTasks'));assert.deepEqual(await ids(),[10,12,13,16,20,11,17]);
  await page.locator('#dashTaskType').selectOption('Telefon');assert.deepEqual(await ids(),[10]);
  await page.locator('#dashTaskType').selectOption('Email');assert.deepEqual(await ids(),[12,20]);
  await page.locator('#dashTaskType').selectOption('');await page.locator('#dashTaskPeriod').selectOption('week');assert((await ids()).includes(14));assert(!(await ids()).includes(15));
  await page.locator('#dashTaskPeriod').selectOption('all');assert((await ids()).includes(15));
  await page.locator('#dashTaskSort').selectOption('desc');assert.equal((await ids())[0],15);
  await page.locator('#dashTaskPeriod').selectOption('range');
  await page.locator('#dashTaskFrom').fill('2026-10-20');await page.locator('#dashTaskTo').fill('2026-10-20');assert.deepEqual(await ids(),[14]);
  assert.match(await page.locator('#dashTasks').innerText(),/20\. 10\. 2026/);
  await page.locator('#dashTaskPeriod').selectOption('today');await page.locator('#dashTaskSort').selectOption('asc');
  assert.match(await page.locator('#dashTasks').innerText(),/Po termínu: 13 dní/);
  assert.match(await page.locator('#dashTasks').innerText(),/Bez termínu/);
  assert.equal(await page.locator('#dashContractTasks').evaluate(e=>e.open),false);
  assert.deepEqual(await page.evaluate(()=>dashboardWorkRows().filter(x=>x.kind==='contract').map(x=>[x.id,x.date,x.dateLabel]).sort((a,b)=>a[0]-b[0])),[[100,'2026-11-01','Nejbližší výročí'],[101,'2026-11-01','Revize po 5 letech'],[102,'2026-12-01','Konec fixace']]);
  // Rows with different optional buttons share exactly the same columns.
  const cols=await page.locator('#dashTasks .dash-work-row').evaluateAll(rows=>rows.map(r=>[...r.children].map(c=>Math.round(c.getBoundingClientRect().x))));
  assert(cols.length>3);cols.forEach(c=>assert.deepEqual(c,cols[0]));
  await page.locator('.dashboard-tasks').screenshot({path:'/private/tmp/crm-daily-desktop.png'});
  await page.setViewportSize({width:834,height:1112});
  assert(await page.locator('.dashboard-tasks').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Tablet card must not overflow');
  await page.locator('.dashboard-tasks').screenshot({path:'/private/tmp/crm-daily-tablet.png'});
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('.dashboard-tasks').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Phone card must not overflow');
  await page.locator('.dashboard-tasks').screenshot({path:'/private/tmp/crm-daily-mobile.png'});
  await page.setViewportSize({width:1440,height:1100});
  await page.locator('#dashTasks [data-dash-action="done"][data-id="10"]').click();assert(!(await ids()).includes(10));
  await page.reload();await page.evaluate(()=>openFocusPanel('dashboardTasks'));assert(!(await ids()).includes(10));
  await page.evaluate(()=>{addActivity(1,'Smlouva','Upravena Test',true);persist();renderDashboardWorkQueue();});
  assert.equal(await page.evaluate(()=>state.activities.at(-1).recordKind),'history');
  // Manual entry resembling an automatic event remains explicitly actionable.
  await page.evaluate(()=>{openActivityModal(1);setVal('aType','Email');setVal('aDate','2026-10-19');setVal('aText','Smlouva: Test · qa@example.test');setVal('aOutcome','agreed');saveActivity();});
  assert.equal(await page.evaluate(()=>state.activities.at(-1).completed),false);
  // Restoring legacy backup applies the same migration without deleting or duplicating events.
  assert.equal(await page.evaluate(f=>normalizeState(JSON.parse(JSON.stringify(f))).activities.filter(a=>a.historyCleanup).length,fixture),6);
  await page.evaluate(()=>{state.activities=Array.from({length:250},(_,i)=>({id:2000+i,type:'Úkol',text:'Úkol '+i,date:'2026-10-19',recordKind:'activity'}));persist();filterDashboardTasks();});
  assert.equal(await page.locator('#dashTasks .dash-work-row').count(),100);
  await page.locator('#dashTasks').getByText('Zobrazit dalších 100 úkolů',{exact:true}).click();assert.equal(await page.locator('#dashTasks .dash-work-row').count(),200);
  assert.deepEqual(errors,[]);
  console.log('PASS: conservative history cleanup and reload/restore, preserved manual tasks, type/period/range/sort filters, exact contract dates, shared columns, responsive layouts, completion, pagination.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
