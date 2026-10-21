/* Shared file contract; no network, storage or CRM dependencies. */
const FairLifeExchange = (() => {
  const TYPE='family-plan-questionnaire', VERSION=1;
  const questions=['children','otherFamily','will','maritalProperty','gifts','exceptions','international','assets','debts'];
  const budgetKeys=['expenses','income','months','oneOff','reserve','insurance'];
  const manualKeys=['contact','children','documents','payments','insurance','access','firstDays','notary','notes'];
  const crisisKeys=['contacts','policies','services','access','benefits','tasks'];
  const currencies=['CZK','EUR','USD'];
  function blank(name='',date=new Date().toISOString().slice(0,10)) {
    return {type:TYPE,version:VERSION,status:'draft',date,self:{name,birth:'',birthUnknown:true,status:'unknown',marriageDate:'',marriageUnknown:true,email:'',phone:'',address:''},people:[],answers:Object.fromEntries(questions.map(k=>[k,'unknown'])),assets:[],budget:Object.fromEntries(budgetKeys.map(k=>[k,{value:'',unknown:true}])),manual:Object.fromEntries(manualKeys.map(k=>[k,''])),confirm:{family:false,property:false,truth:false,delivery:false},notes:'',crisis:Object.fromEntries(crisisKeys.map(k=>[k,[]]))};
  }
  function object(x){return x!==null&&typeof x==='object'&&!Array.isArray(x);}
  function text(x,max=4000){return typeof x==='string'&&x.length<=max;}
  function date(x){return text(x,10)&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;}
  function amount(x){return typeof x==='string'&&x.trim()!==''&&Number.isFinite(Number(x))&&Number(x)>=0&&Number(x)<=1e12;}
  function scan(x,depth=0){
    if(depth>25)throw Error('Soubor obsahuje příliš vnořená data.');
    if(typeof x==='string'&&x.length>20000)throw Error('Text v souboru je příliš dlouhý.');
    if(x&&typeof x==='object')for(const k of Object.keys(x)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Nepovolený klíč v souboru.');scan(x[k],depth+1);}
  }
  function parse(input){
    const raw=typeof input==='string'?input:JSON.stringify(input);
    if(new TextEncoder().encode(raw).length>5_000_000)throw Error('Soubor může mít nejvýše 5 MB.');
    let d;try{d=JSON.parse(raw);}catch(e){throw Error('Soubor není platný JSON dotazník.');}scan(d);
    if(!object(d)||d.type!==TYPE||d.version!==VERSION)throw Error('Nepodporovaný typ nebo verze dotazníku.');
    if(!['draft','submitted'].includes(d.status)||!date(d.date)||!object(d.self)||!text(d.self.name,120)||!d.self.name.trim())throw Error('Dotazníku chybí jméno klienta, platné datum nebo stav.');
    for(const k of ['email','phone','address'])if(d.self[k]!==undefined&&!text(d.self[k],500))throw Error('Neplatný kontakt klienta.');
    if(typeof d.self.birthUnknown!=='boolean'||(!d.self.birthUnknown&&!date(d.self.birth))||typeof d.self.marriageUnknown!=='boolean')throw Error('Neplatné datum narození nebo označení neznámých údajů.');
    if(!['single','married','partner','divorced','widowed','registered','unknown',''].includes(d.self.status))throw Error('Neplatný rodinný stav.');
    if(!Array.isArray(d.people)||d.people.length>100||!Array.isArray(d.assets)||d.assets.length>500)throw Error('Neplatný nebo příliš velký seznam osob/majetku.');
    const people=new Set();
    for(const p of d.people){
      if(!object(p)||!text(p.id,200)||!p.id||people.has(p.id)||!text(p.name,120)||!p.name.trim()||!['child','spouse','partner','ex','parent','sibling','other'].includes(p.role)||typeof p.birthUnknown!=='boolean'||(!p.birthUnknown&&!date(p.birth))||!['alive','dead','unknown'].includes(p.life))throw Error('Neplatná osoba nebo duplicitní identifikátor.');
      people.add(p.id);
    }
    for(const p of d.people)if(p.role==='child'&&!['only','unknown',...[...people].filter(id=>id!==p.id)].includes(p.otherParent))throw Error('Neplatná vazba na druhého rodiče.');
    const ids=new Set();
    for(const a of d.assets){
      if(!object(a)||!text(a.id,500)||!a.id||ids.has(a.id)||!text(a.name,120)||!a.name.trim()||!['asset','debt'].includes(a.kind)||!text(a.category,120)||!a.category||(a.liquid!==undefined&&typeof a.liquid!=='boolean')||typeof a.valueUnknown!=='boolean'||(!a.valueUnknown&&!amount(a.value))||!currencies.includes(a.currency)||!['me','person','joint','shares','unknown'].includes(a.owner)||!['purchase','before','gift','inheritance','unknown'].includes(a.acquisition)||!text(a.note||''))throw Error('Neplatná majetková položka, částka, měna nebo duplicitní ID.');
      if(['person','shares'].includes(a.owner)&&!people.has(a.person))throw Error('Vlastník majetku chybí v seznamu osob.');
      if(a.owner==='joint'&&!d.people.some(p=>p.role==='spouse'))throw Error('Společné jmění není propojeno s uvedeným manželem/manželkou.');
      if(a.owner==='shares'&&(!amount(a.share)||Number(a.share)<=0||Number(a.share)>=100))throw Error('Neplatný vlastnický podíl.');
      ids.add(a.id);
    }
    if(!object(d.answers)||!object(d.budget)||!object(d.manual)||!object(d.confirm)||!text(d.notes||''))throw Error('Chybí části společného dotazníku.');
    for(const k of questions)if(!['yes','no','unknown',''].includes(d.answers[k]))throw Error('Neplatná odpověď v dotazníku.');
    for(const k of budgetKeys){const b=d.budget[k];if(!object(b)||typeof b.unknown!=='boolean'||(!b.unknown&&!amount(b.value)))throw Error('Neplatná částka rozpočtu.');}
    for(const k of manualKeys)if(!text(d.manual[k]||''))throw Error('Neplatný text příručky.');
    for(const k of ['family','property','truth','delivery'])if(typeof d.confirm[k]!=='boolean')throw Error('Neplatná potvrzení dotazníku.');
    if(d.status==='submitted'&&Object.values(d.confirm).some(v=>v!==true))throw Error('Hotový dotazník nemá všechna klientská potvrzení.');
    if(d.crisis!==undefined){if(!object(d.crisis))throw Error('Neplatná krizová část.');for(const k of crisisKeys){const rows=d.crisis[k]||[];if(!Array.isArray(rows)||rows.length>200||rows.some(r=>!object(r)||Object.values(r).some(v=>!text(v,2000))))throw Error('Neplatné řádky krizové příručky.');}}
    if(d.exchange!==undefined){
      const e=d.exchange;
      if(!object(e)||e.version!==1||!['filip-crm','family-plan'].includes(e.source)||!text(e.exportId,200)||!text(e.exportedAt,100)||!text(e.clientRef,500)||!object(e.assetRefs)||!Array.isArray(e.contracts)||e.contracts.length>500)throw Error('Nepodporovaná nebo poškozená metadata přenosu.');
      const sourceKeys=new Set();for(const [id,r] of Object.entries(e.assetRefs)){if(!ids.has(id)||!object(r)||['sourceKey','kind','company','isin','asOf'].some(k=>!text(r[k]??'',2000)))throw Error('Neplatný odkaz na původ majetku.');if(r.sourceKey){if(sourceKeys.has(r.sourceKey))throw Error('Duplicitní odkaz na původ majetku.');sourceKeys.add(r.sourceKey);}}
      const contractIds=new Set();for(const c of e.contracts){if(!object(c)||!text(c.id,500)||!c.id||contractIds.has(c.id)||['type','company','product','number','currency','payment','startDate','endDate','notes'].some(k=>!text(c[k]??'',4000)))throw Error('Neplatná smlouva nebo duplicitní ID.');if(c.payment&&!amount(c.payment))throw Error('Neplatná platba smlouvy.');if(c.currency&&!currencies.includes(c.currency))throw Error('Neplatná měna smlouvy.');contractIds.add(c.id);}
    }
    return d;
  }
  function stable(x){if(Array.isArray(x))return '['+x.map(stable).join(',')+']';if(object(x))return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}';return JSON.stringify(x);}
  // Deterministic record keys, not an authentication or cryptographic mechanism.
  function key(text){let h=2166136261;for(const c of text){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
  function asset(value={}){return {id:value.id||'',name:value.name||'',kind:value.kind||'asset',category:value.category||'Ostatní majetek',value:'',valueUnknown:true,currency:'CZK',owner:'unknown',person:'',share:'',acquisition:'unknown',liquid:false,note:'',...value};}
  function contractRows(d){
    const rows=(d.exchange?.contracts||[]).map(c=>({...c})),ids=new Set(rows.map(c=>c.id));
    for(const p of d.crisis?.policies||[]){const id=p.id||'policy-'+key(stable(p));if(ids.has(id)){const c=rows.find(x=>x.id===id);if(p.provider)c.company=p.provider;if(p.number)c.number=p.number;if(p.type)c.type=p.type;const details=[p.coverage&&'Krytí: '+p.coverage,p.beneficiary&&'Obmyšlený: '+p.beneficiary,p.location&&'Uložení: '+p.location,p.phone&&'Asistence: '+p.phone].filter(Boolean);for(const line of details)if(!(c.notes||'').includes(line))c.notes=[c.notes,line].filter(Boolean).join('\n').slice(0,4000);continue;}rows.push({id,type:p.type||'Pojištění',company:p.provider||'',product:p.person||p.type||'Pojistná smlouva',number:p.number||'',currency:'CZK',payment:'',startDate:'',endDate:'',notes:[p.coverage&&'Krytí: '+p.coverage,p.beneficiary&&'Obmyšlený: '+p.beneficiary,p.location&&'Uložení: '+p.location,p.phone&&'Asistence: '+p.phone,p.notes].filter(Boolean).join('\n').slice(0,4000)});ids.add(id);}
    return rows;
  }
  function totals(assets){const result={};for(const a of assets){const c=result[a.currency]||={assets:0,debts:0,unknown:0};if(a.valueUnknown)c.unknown++;else c[a.kind==='debt'?'debts':'assets']+=Number(a.value);}return result;}
  return {TYPE,VERSION,blank,parse,asset,stable,key,contractRows,totals,date};
})();
if(typeof module!=='undefined')module.exports=FairLifeExchange;
