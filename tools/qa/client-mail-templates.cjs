const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.runInNewContext(fs.readFileSync('assets/js/client-mail-templates.js','utf8'),context);
const t=context.window.ClientMailTemplates,url='https://example.invalid/personal-link';assert.equal(t.formIds.length,9);
for(const formId of t.formIds)for(const tone of ['formal','informal'])for(const anniversary of [false,true]){
 const d=t.build({formId,tone,url,anniversary,product:'Test smlouva'});
 assert(d.subject&&!d.subject.includes('undefined'));assert.equal(d.body.split(url).length,2);
 assert(d.body.includes('telefonu i počítači'));assert(d.body.includes('soubor mi přilož'));
 assert(d.body.includes('dalším postupem'));assert(!d.body.includes('JSON'));assert(!d.body.includes('@'));
 assert(d.body.startsWith(tone==='informal'?'Ahoj,':'Dobrý den,'));
 if(tone==='formal')assert(!/\b(Ti|Tvé|Tebe|Tebou)\b/u.test(d.body));else assert(!/\b(Vám|Vaší|Vámi|Vaše)\b/u.test(d.body));
}
assert.throws(()=>t.build({formId:'investments'}));
console.log('PASS all 9 questionnaire templates × 2 tones × standard/contract contexts, return instructions and single signature.');
