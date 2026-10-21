const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const E=require('../../assets/js/wealth-exchange.js');
const fixture=require('./fixtures/wealth-exchange-v1.json');
assert.equal(E.parse(fixture).assets[0].value,'200000');
for(const edit of [d=>d.version=9,d=>d.assets.push({...d.assets[0]}),d=>d.assets[0].value='-1',d=>d.assets[0].currency='XXX',d=>d.assets[0].owner='joint',d=>{d.assets[0].owner='person';d.assets[0].person='absent';},d=>d.status='submitted',d=>d.date='2026-02-30']){const d=structuredClone(fixture);edit(d);assert.throws(()=>E.parse(d));}
assert.throws(()=>E.parse('{"__proto__":{}}'));
const d=structuredClone(fixture);d.assets.push(E.asset({id:'eur',name:'EUR účet',currency:'EUR',valueUnknown:false,value:'1000'}),E.asset({id:'unknown',name:'Neznámý dluh',kind:'debt'}),E.asset({id:'zero',name:'Nulový účet',valueUnknown:false,value:'0'}));
assert.deepEqual(E.totals(E.parse(d).assets),{CZK:{assets:200000,debts:0,unknown:1},EUR:{assets:1000,debts:0,unknown:0}});
(async()=>{
 const sibling=path.resolve(__dirname,'../../../rodinny-plan/src/wealth-exchange.js');
 if(fs.existsSync(sibling)){
  const {readExchangeFile,exportExchange}=await import(sibling);
  const {candidate}=readExchangeFile(JSON.stringify(d));const back=E.parse(exportExchange(candidate));
  assert.equal(back.exchange.clientRef,d.exchange.clientRef);assert.equal(back.status,'draft');assert.deepEqual(back.assets.map(a=>a.id),d.assets.map(a=>a.id));
  assert.equal(back.assets.find(a=>a.id==='unknown').valueUnknown,true);assert.equal(back.assets.find(a=>a.id==='zero').value,'0');assert.equal(back.assets[0].owner,'unknown');
  assert.deepEqual(E.totals(back.assets),E.totals(d.assets));
  console.log('PASS: actual family-plan importer/exporter roundtrip, stable identities, currencies, zero vs unknown, draft and unknown ownership.');
 }
 console.log('PASS: shared contract validation, bad versions/values/identities rejected, currency totals separate.');
})().catch(e=>{console.error(e);process.exitCode=1});
