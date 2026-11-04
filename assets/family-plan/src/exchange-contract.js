// Optional file-exchange extension; no network or case-completeness assumptions.
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v,n=4000)=>typeof v==='string'&&v.length<=n;
const safeKey=k=>bounded(k,200)&&k.trim()&&!['__proto__','constructor','prototype'].includes(k);
export function contactErrors(self){return ['email','phone','address'].some(k=>self?.[k]!==undefined&&!bounded(self[k],k==='address'?1000:254))?['Neplatné kontaktní údaje klienta.']:[];}
export function exchangeErrors(x){
 if(x===undefined)return [];
 if(!record(x)||x.version!==1||!['filip-crm','family-plan'].includes(x.source)||!safeKey(x.exportId)||!bounded(x.clientRef,200)||!x.clientRef.trim()||!bounded(x.exportedAt,40)||!/^\d{4}-\d\d-\d\dT/.test(x.exportedAt)||!Number.isFinite(Date.parse(x.exportedAt)))return ['Neplatné údaje o původu přenosu.'];
 if(!record(x.assetRefs)||Object.keys(x.assetRefs).length>500||Object.entries(x.assetRefs).some(([id,r])=>!safeKey(id)||!record(r)||Object.keys(r).some(k=>!['sourceKey','kind','company','isin','asOf'].includes(k))||Object.values(r).some(v=>!bounded(v,500))))return ['Neplatné odkazy na majetek z CRM.'];
 if(!Array.isArray(x.contracts)||x.contracts.length>500||x.contracts.some(r=>!record(r)||!safeKey(r.id)||Object.keys(r).some(k=>!['id','type','company','product','number','currency','payment','startDate','endDate','notes'].includes(k))||Object.values(r).some(v=>!bounded(v))))return ['Neplatný seznam smluv v přenosu.'];
 if(new Set(x.contracts.map(r=>r.id)).size!==x.contracts.length)return ['Duplicitní ID smluv.'];
 return [];
}
export function draftShapeErrors(d){
 if(!record(d)||d.type!=='family-plan-questionnaire'||d.version!==1||!['draft','submitted'].includes(d.status)||!record(d.self)||!record(d.answers)||!record(d.budget)||!record(d.manual)||!record(d.confirm)||!Array.isArray(d.people)||!Array.isArray(d.assets)||d.people.length>100||d.assets.length>500)return ['Neplatná struktura rozpracovaného dotazníku.'];
 const errors=[...contactErrors(d.self),...exchangeErrors(d.exchange)];
 const dates=['birth','marriageDate'];
 if(!bounded(d.self.name,120)||dates.some(k=>d.self[k]!==undefined&&!bounded(d.self[k],10))||['birthUnknown','marriageUnknown'].some(k=>typeof d.self[k]!=='boolean')||!['','single','married','partner','divorced','widowed','registered','unknown'].includes(d.self.status))errors.push('Neplatné údaje klienta.');
 if(!bounded(d.date,10)||!/^\d{4}-\d\d-\d\d$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date)errors.push('Neplatné datum dotazníku.');
 const ids=d.people.map(p=>p?.id),assets=d.assets.map(a=>a?.id);
 if(ids.some(id=>!safeKey(id))||new Set(ids).size!==ids.length||assets.some(id=>!safeKey(id))||new Set(assets).size!==assets.length)errors.push('Neplatné nebo duplicitní ID osob či majetku.');
 if(d.people.some(p=>!record(p)||!bounded(p.name,120)||typeof p.birthUnknown!=='boolean'||!bounded(p.birth||'',10)||!['','child','spouse','partner','ex','parent','sibling','other'].includes(p.role)||!['','alive','dead','unknown'].includes(p.life)||['otherParent','note','year','care','appearance'].some(k=>p[k]!==undefined&&!bounded(p[k]))))errors.push('Neplatné údaje osob.');
 if(d.assets.some(a=>!record(a)||!['asset','debt'].includes(a.kind)||!bounded(a.name,120)||!bounded(a.category||'',120)||typeof a.valueUnknown!=='boolean'||!bounded(a.value,100)||(!a.valueUnknown&&a.value!==''&&(!Number.isFinite(Number(a.value))||Number(a.value)<0||Number(a.value)>1e12))||!['CZK','EUR','USD'].includes(a.currency)||!['','me','person','joint','shares','unknown'].includes(a.owner)||!['','purchase','before','gift','inheritance','unknown'].includes(a.acquisition)||['person','share','note'].some(k=>a[k]!==undefined&&!bounded(a[k]))))errors.push('Neplatné údaje majetku.');
 if(d.people.some(p=>record(p)&&p.role==='child'&&p.otherParent&&!['only','unknown',...ids.filter(id=>id!==p.id)].includes(p.otherParent)))errors.push('Neplatná vazba na druhého rodiče.');
 if(d.assets.some(a=>record(a)&&((a.liquid!==undefined&&typeof a.liquid!=='boolean')||(['person','shares'].includes(a.owner)&&!ids.includes(a.person))||(a.owner==='shares'&&!(Number(a.share)>0&&Number(a.share)<100)))))errors.push('Neplatné podíly nebo odkaz na vlastníka.');
 if(record(d.exchange?.assetRefs)&&Object.keys(d.exchange.assetRefs).some(id=>!assets.includes(id)))errors.push('Odkaz na neexistující majetek v přenosu.');
 if(Object.values(d.answers).some(v=>!['','yes','no','unknown'].includes(v))||Object.values(d.confirm).some(v=>typeof v!=='boolean')||Object.values(d.manual).some(v=>!bounded(v))||!bounded(d.notes||''))errors.push('Neplatné odpovědi nebo poznámky.');
 for(const k of ['expenses','income','months','oneOff','reserve','insurance']){const b=d.budget[k];if(!record(b)||typeof b.unknown!=='boolean'||!bounded(b.value,100)||(!b.unknown&&b.value!==''&&(!Number.isFinite(Number(b.value))||Number(b.value)<0||Number(b.value)>1e12)))errors.push('Neplatný finanční údaj: '+k);}
 return [...new Set(errors)];
}

export function parseExchangeJSON(text){return JSON.parse(text,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw Error('Soubor obsahuje nepovolený klíč.');return value;});}
