const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'assets/js/crm.js'),'utf8');
new vm.Script(source,{filename:'crm.js'});
const claimsSource=fs.readFileSync(path.join(root,'assets/js/insurance-claims.js'),'utf8');
new vm.Script(claimsSource,{filename:'insurance-claims.js'});
const workSource=fs.readFileSync(path.join(root,'assets/js/work-measurement.js'),'utf8');
new vm.Script(workSource,{filename:'work-measurement.js'});
const providerSource=fs.readFileSync(path.join(root,'assets/js/provider-import.js'),'utf8');
const providerUiSource=fs.readFileSync(path.join(root,'assets/js/provider-import-ui.js'),'utf8');
new vm.Script(providerSource,{filename:'provider-import.js'});
new vm.Script(providerUiSource,{filename:'provider-import-ui.js'});
const names=[...(source+'\n'+claimsSource+'\n'+workSource+'\n'+providerSource+'\n'+providerUiSource).matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);
assert.equal(names.length,new Set(names).size,'Application functions must have a single definition');
assert(!/window\.\w+\s*=\s*function/.test(source),'No runtime patch layers');
assert(!/window\.\w+\s*=\s*function/.test(claimsSource),'Claims module must not patch the runtime');
assert(!/window\.\w+\s*=\s*function/.test(workSource),'Work module must not patch the runtime');
const html=fs.readFileSync(path.join(root,'FILIP-CRM.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="(assets\/[^"?]+)/g))assert(fs.existsSync(path.join(root,m[1])),m[1]);
assert.equal([...html.matchAll(/src="assets\/js\/crm.js/g)].length,1);
assert.equal([...html.matchAll(/src="assets\/js\/insurance-claims.js/g)].length,1);
assert.equal([...html.matchAll(/src="assets\/js\/work-measurement.js/g)].length,1);
assert(html.indexOf('src="assets/js/work-measurement.js') < html.indexOf('src="assets/js/crm.js'),'Work renderers must exist before startup');
assert(html.indexOf('src="assets/js/insurance-claims.js') < html.indexOf('src="assets/js/crm.js'),'Claim renderers must exist before startup');
for(const name of ['provider-import.js','provider-import-ui.js']){
 assert.equal([...html.matchAll(new RegExp('src="assets/js/'+name.replaceAll('.','\\.'),'g'))].length,1);
 assert(html.indexOf('src="assets/js/'+name)<html.indexOf('src="assets/js/crm.js'));
}
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
