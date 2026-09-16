const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'assets/js/crm.js'),'utf8');
new vm.Script(source,{filename:'crm.js'});
const names=[...source.matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);
assert.equal(names.length,new Set(names).size,'Application functions must have a single definition');
assert(!/window\.\w+\s*=\s*function/.test(source),'No runtime patch layers');
const html=fs.readFileSync(path.join(root,'FILIP-CRM.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="(assets\/[^"?]+)/g))assert(fs.existsSync(path.join(root,m[1])),m[1]);
assert.equal([...html.matchAll(/src="assets\/js\/crm.js/g)].length,1);
let scripts=0;
for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
 for(const m of fs.readFileSync(path.join(root,f),'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  if(!m[2].trim()||/type=["'](?:module|application\/json)/.test(m[1]))continue;
  new vm.Script(m[2],{filename:f});scripts++;
 }
}
new vm.Script(fs.readFileSync(path.join(root,'scenario-enhancement.js'),'utf8'));
new vm.Script(fs.readFileSync(path.join(root,'google-sync/Code.gs'),'utf8'));
console.log(`PASS: ${names.length} unique application functions; ${scripts} legacy/entry scripts; local assets; single runtime; Apps Script and scenario syntax.`);
