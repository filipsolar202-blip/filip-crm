// Synthetic review ledger only; no live CRM, provider files or client data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,launchOptions}=require('./runtime.cjs'),root=path.resolve(__dirname,'../..');

(async()=>{
  const browser=await chromium.launch(launchOptions);
  try {
    const context=await browser.newContext();
    await context.route('**/*',route=>{
      const url=new URL(route.request().url()),file=path.join(root,decodeURIComponent(url.pathname));
      if(url.hostname==='crm.test'&&file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
      return route.abort();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('https://crm.test/FILIP-CRM.html');
    const result=await page.evaluate(()=>{
      const stamp='2026-10-01T12:00:00.000Z',recordKey='qa-client|isin|qa0000000001|provider|order-1';
      const make=(id,status,target,clientId=1)=>({id,status,clientId,targetKey:target,recordKey:target?.kind==='record'?target.key:'',reason:'Původní důvod',canAccept:true,updatedAt:stamp,incoming:{current:123000,valuationDate:'2026-09-30'},changes:[{field:'current',before:120000,after:123000}]});
      const record={kind:'record',key:recordKey},snapshot={kind:'snapshot',key:'77'};
      state=normalizeState({createdAt:stamp,clients:[{id:1,name:'QA Jedna'},{id:2,name:'QA Dva'}],investmentRecords:[{Fond:'QA fond','Aktuální hodnota investice':120000}],investmentSnapshots:[{id:77,clientId:1,current:120000}],providerImports:[
        {id:'changed',updatedAt:stamp,entries:[make('pending','pending',record),make('automatic','auto',record),make('snapshot','pending',snapshot),make('accepted','accepted',record),make('kept','kept',record),make('unchanged','unchanged',record)]},
        {id:'legacy',updatedAt:stamp,entries:[{...make('legacy-record-key','pending',null),recordKey:'legacy-key'},make('different-kind','pending',{kind:'record',key:'77'},2),{...make('authoritative-target','pending',{kind:'snapshot',key:'88'},2),recordKey}]},
        {id:'untouched',updatedAt:stamp,entries:[make('other-order','pending',{kind:'record',key:'other-order'},2)]}
      ]});
      const targets=[record,snapshot,{kind:'record',key:'legacy-key'}],before=JSON.parse(JSON.stringify(state)),beforePending=providerImportPending(1).length;
      let writes=0;const originalPersist=persist;
      let count;
      try {persist=()=>{writes++;return true;};count=crmDeleteCloseProviderTargets(targets);} finally {persist=originalPersist;}
      const after=JSON.parse(JSON.stringify(state)),afterPending=providerImportPending(1).length,otherPending=providerImportPending(2).length;
      const repeated=crmDeleteCloseProviderTargets(targets),repeatUnchanged=JSON.stringify(after)===JSON.stringify(state);
      const invalid=crmDeleteCloseProviderTargets([null,{}, {kind:'record',key:''},{kind:'other',key:recordKey}]);
      const invalidUnchanged=JSON.stringify(after)===JSON.stringify(state);
      return {before,after,count,writes,beforePending,afterPending,otherPending,repeated,repeatUnchanged,invalid,invalidUnchanged};
    });
    assert.equal(result.count,4,'only pending/auto entries for exact selected records and snapshots close');
    assert.equal(result.writes,0,'the caller owns atomic persistence');
    assert.equal(result.beforePending,3);assert.equal(result.afterPending,0,'the cached client warning must refresh after ledger changes');
    assert.equal(result.otherPending,3,'other orders and same numeric keys from another target kind stay pending');
    assert.deepEqual(result.after.investmentRecords,result.before.investmentRecords);
    assert.deepEqual(result.after.investmentSnapshots,result.before.investmentSnapshots,'the helper closes reviews, never modifies holdings');
    for(const id of ['pending','automatic','snapshot','legacy-record-key']){
      const old=result.before.providerImports.flatMap(b=>b.entries).find(e=>e.id===id),entry=result.after.providerImports.flatMap(b=>b.entries).find(e=>e.id===id);
      assert.equal(entry.status,'kept');assert.equal(entry.canAccept,false);assert.equal(entry.reason,'Záznam byl odstraněn uživatelem.');
      assert.match(entry.resolvedAt,/^\d{4}-\d{2}-\d{2}T/);assert.equal(entry.updatedAt,entry.resolvedAt);
      assert.deepEqual(entry.incoming,old.incoming);assert.deepEqual(entry.changes,old.changes);assert.deepEqual(entry.targetKey,old.targetKey,'the historical target remains auditable');
      const batch=result.after.providerImports.find(b=>b.entries.includes(entry));assert.equal(batch.updatedAt,entry.updatedAt);
    }
    for(const id of ['accepted','kept','unchanged','different-kind','authoritative-target','other-order']){
      assert.deepEqual(result.after.providerImports.flatMap(b=>b.entries).find(e=>e.id===id),result.before.providerImports.flatMap(b=>b.entries).find(e=>e.id===id),'unrelated or already-resolved review remains untouched: '+id);
    }
    assert.deepEqual(result.after.providerImports.find(b=>b.id==='untouched'),result.before.providerImports.find(b=>b.id==='untouched'));
    assert.equal(result.repeated,0);assert(result.repeatUnchanged);assert.equal(result.invalid,0);assert(result.invalidUnchanged);
    const ownership=await page.evaluate(()=>{
      const make=(id,clientId,kind)=>({id,clientId,status:'pending',targetKey:{kind,key:'shared-legacy-key'},updatedAt:'2026-10-01T12:00:00.000Z'});
      state.providerImports=[{id:'owner-check',entries:[make('record-owner',1,'record'),make('record-namesake',2,'record'),make('snapshot-owner',1,'snapshot'),make('snapshot-namesake',2,'snapshot')]}];
      const count=crmDeleteCloseProviderTargets([{kind:'record',key:'shared-legacy-key',clientId:'1'},{kind:'snapshot',key:'shared-legacy-key',clientId:1}]);
      const scoped=state.providerImports[0].entries.map(e=>({id:e.id,status:e.status}));
      const legacyCount=crmDeleteCloseProviderTargets([{kind:'record',key:'shared-legacy-key'}]);
      return {count,scoped,legacyCount,snapshotNamesake:state.providerImports[0].entries.find(e=>e.id==='snapshot-namesake').status};
    });
    assert.equal(ownership.count,2,'explicit target ownership narrows even identical legacy record keys');
    assert.deepEqual(ownership.scoped,[{id:'record-owner',status:'kept'},{id:'record-namesake',status:'pending'},{id:'snapshot-owner',status:'kept'},{id:'snapshot-namesake',status:'pending'}]);
    assert.equal(ownership.legacyCount,1,'omitting clientId retains the previous exact-kind/key API');assert.equal(ownership.snapshotNamesake,'pending');
    assert.deepEqual(errors,[]);
    console.log('PASS provider deletion: exact record/snapshot review closure, immutable history and holdings, badge cache invalidation, namespace isolation, no persistence, idempotence.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
