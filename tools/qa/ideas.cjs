const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');
(async()=>{const browser=await chromium.launch(launchOptions);try{const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(root,u.pathname);return u.hostname==='crm.test'&&f.startsWith(root+'/')&&fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'text/html'}):r.abort();});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('https://crm.test/FILIP-CRM.html');await page.waitForFunction(()=>typeof CrmAnniversaries!=='undefined'&&typeof state!=='undefined');
const result=await page.evaluate(()=>{
state.notes=[];state.dailyPriorities=[];state.weeklyGoals=[];state.weeklyReviews=[];
CrmIdeas.importRows({format:'filip-crm-ideas',version:1,notes:[{title:'Zlepšit servis',text:'Zavolat a připravit plán',idea:{key:'test-1',priority:'Velká',area:'Pracovní'}},{title:'Osobní nápad',text:'Soukromé',idea:{key:'test-2',priority:'Malá',area:'Osobní'}}]});
CrmIdeas.importRows(CrmIdeas.payload());const count=state.notes.length,id=state.notes[0].id;
CrmIdeas.plan(id);setVal('ideaPlanDate','2026-12-01');CrmIdeas.assign(id,'day');
CrmIdeas.plan(id);setVal('ideaPlanDate','2026-12-01');CrmIdeas.assign(id,'week');
state.dailyPriorities[0].status='Hotovo';state.weeklyGoals[0].status='Splněno';
const done=CrmIdeas.status(state.notes[0]);persist();showView('ideas');return {count,days:state.dailyPriorities.length,weeks:state.weeklyGoals.length,done};});
assert.deepEqual(result,{count:2,days:1,weeks:1,done:'Hotovo'});
const guards=await page.evaluate(()=>{const notices=[];window.alert=m=>notices.push(m);const id=state.notes[0].id;CrmIdeas.plan(id);setVal('ideaPlanDate','2026-12-01');CrmIdeas.assign(id,'day');const duplicate=state.dailyPriorities.length;for(const slot of [1,2,3])state.dailyPriorities.push({id:uid(),date:'2026-12-02',slot,title:'Existující',status:'Čeká'});CrmIdeas.plan(id);setVal('ideaPlanDate','2026-12-02');CrmIdeas.assign(id,'day');const full=state.dailyPriorities.filter(p=>p.date==='2026-12-02').length;closeModal('ideaModal');return {duplicate,full,notices:notices.length};});assert.deepEqual(guards,{duplicate:1,full:3,notices:2});

await page.reload();await page.waitForFunction(()=>typeof CrmIdeas!=='undefined'&&typeof state!=='undefined');
assert.equal(await page.evaluate(()=>state.notes.filter(n=>n.idea).length),2);await page.evaluate(()=>showView('ideas'));
await page.screenshot({path:'/private/tmp/ideas-desktop.png'});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/private/tmp/ideas-mobile.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));assert.deepEqual(errors,[]);console.log('PASS ideas import deduplication, daily/weekly planning, completion, persistence, mobile');}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
