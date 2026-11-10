const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('assets/js/crm.js','utf8'),ctx={today:()=> '2026-11-10'};
vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function contractReviewYears'),src.indexOf('function contractDays')),ctx);
const property={type:'majetek',anniv:'2024-12-01'},car={type:'auto',anniv:'2024-12-01'};
assert.equal(ctx.contractReviewDate(property),'2026-12-01');
assert.equal(ctx.contractReviewDate(property,'2025-11-10'),'2026-12-01');
assert.equal(ctx.contractReviewDate(car,'2025-11-10'),'2025-12-01');
for(const [s,next] of [[property,'2028-12-01'],[car,'2027-12-01']]){
 ctx.recordContractReviewSent(s,'2026-11-10');assert.equal(ctx.contractReviewDate(s),next);
 ctx.recordContractReviewSent(s,'2026-11-12');assert.equal(ctx.contractReviewDate(s),next);
 assert.equal(s.anniv,'2024-12-01');
 assert.equal(ctx.contractReviewDate(JSON.parse(JSON.stringify(s))),next);
}
assert.equal(ctx.contractReviewDate({type:'majetek',anniv:'2024-02-29'},'2026-01-01'),'2026-02-28');
assert.equal(ctx.contractReviewDate({type:'majetek',anniv:''}),'');
assert.equal(ctx.contractReviewDate({type:'majetek',anniv:'2026-02-31'}),'');
const future={type:'majetek',anniv:'2027-10-01'};ctx.recordContractReviewSent(future,'2026-11-10');assert.equal(future.lastReviewAnniversary,undefined);
console.log('PASS annual/biennial review, repeat sending, persistence, leap date, unknown date and policy anniversary preserved.');
