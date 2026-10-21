/* Client wealth inventory and explicit file exchange. Native AUM/commissions are never inferred from a questionnaire. */
let wealthPendingImport=null;
function wealthProfile(c){return c.wealthProfile || {assets:[],contracts:[],clientRefs:[],imports:[]};}
function wealthEnsureIdentity(c){if(c.wealthExchangeId)return true;const previous=c.wealthExchangeId;c.wealthExchangeId='crm:'+crypto.randomUUID();if(persist())return true;c.wealthExchangeId=previous;return false;}
function wealthClientRef(c){return c.wealthExchangeId || `crm:${state.createdAt || 'local'}:${c.id}`;}
function wealthBirth(c){
  if(FairLifeExchange.date(c.birthDate))return c.birthDate;
  if(clientAgeFromBirthId(c.birthId)===null)return '';
  const digits=String(c.birthId).replace(/\D/g,''),yy=+digits.slice(0,2),m=+digits.slice(2,4),month=m>70?m-70:m>50?m-50:m>20?m-20:m;
  const year=digits.length===9?1900+yy:(yy>new Date().getFullYear()%100?1900:2000)+yy;
  return `${year}-${String(month).padStart(2,'0')}-${digits.slice(4,6)}`;
}
function wealthDate(x){const t=String(x||'').slice(0,10);return FairLifeExchange.date(t)?t:'';}
function wealthMoney(a){return a.valueUnknown?'Částku doplnit':`${Number(a.value).toLocaleString('cs-CZ',{maximumFractionDigits:2})} ${a.currency}`;}
function wealthOwner(a,people=[]){const p=people.find(p=>p.id===a.person);return {unknown:'Vlastnictví doplnit',me:'Klient výlučně',person:p?.name||'Jiná osoba',joint:'Společné jmění',shares:`Podíl klienta ${a.share || '?'} %`}[a.owner]||'Vlastnictví doplnit';}
function wealthSourceKey(d,a){return d.exchange?.assetRefs?.[a.id]?.sourceKey || `intake:${d.exchange?.clientRef || 'questionnaire'}:${a.id}`;}
function wealthLiveRows(c){
  const ref=wealthClientRef(c),rows=[],keys=new Set();
  function add(sourceKey,asset,meta){
    if(keys.has(sourceKey)){
      if(sourceKey.startsWith('investment:')){const previous=rows.find(r=>r.sourceKey===sourceKey);previous.asset.valueUnknown ||= asset.valueUnknown;previous.asset.value=previous.asset.valueUnknown?'':String(Number(previous.asset.value)+Number(asset.value));if(previous.ref.asOf!==meta.asOf)previous.ref.asOf='';}
      return;
    }keys.add(sourceKey);
    const id='crm-'+FairLifeExchange.key(ref+'|'+sourceKey);
    rows.push({id,sourceKey,native:true,asset:FairLifeExchange.asset({id,...asset}),ref:{sourceKey,kind:'wealth',company:'',isin:'',asOf:'',...meta},updatedAt:''});
  }
  clientDisplayInvestmentItems(c.id).forEach(x=>{
    const area=investmentAreaOfItem(x),src=x.source||{},currency=String(x.currency||src.currency||src['Měna']||'CZK').toUpperCase();
    const amount=Number(x.amount),known=Number.isFinite(amount)&&amount>=0;
    const fv=clientOutput_xFundValue(area==='fki'?'fki':'investice',x.key||investmentFundKey(x),x.isin||invIsin(src));
    const asOf=wealthDate(fv.date||x.snapshot?.date||src.valueDate||src['Poslední schválená hodnota do']);
    const supported=['CZK','EUR','USD'].includes(currency);
    add('investment:'+area+':'+currency+':'+investmentFundKey(x),{name:String(x.product||x.kind||'Investice').slice(0,120),category:'Investiční fondy',value:known&&supported?String(amount):'',valueUnknown:!known||!supported,currency:supported?currency:'CZK',note:[area==='fki'?'FKI':'Investice',x.company,asOf?'Ocenění k '+asOf:'Datum ocenění v CRM není uvedeno.',!supported?'Původní měna '+currency+' není podporována; částku je nutné doplnit.':'','Evidovaná hodnota z CRM; právní vlastnictví není ověřeno.'].filter(Boolean).join('\n')},{kind:area==='fki'?'fki':'investment',company:x.company||'',isin:x.isin||invIsin(src)||'',asOf});
  });
  clientPensionSummary(c.id).items.forEach(x=>{
    const src=x.source||{},raw=src.current??src.aum??src.accountValue,balance=raw===undefined||raw===null||raw===''?null:parseMoney(raw);
    add('pension:'+x.kind+':'+x.id,{name:String(x.product||'Penze').slice(0,120),category:'Ostatní majetek',value:balance===null?'':String(balance),valueUnknown:balance===null,note:[x.type,x.company,'Penzijní smlouva. Pravidelná platba není majetkový zůstatek; hodnotu účtu ověřit.'].filter(Boolean).join('\n')},{kind:'pension',company:x.company||'',asOf:wealthDate(src.valueDate)});
  });
  clientExternalInvestments(c.id).forEach(x=>{
    const currency=String(x.currency||'CZK').toUpperCase(),known=x.current!==null&&x.current!==undefined&&x.current!==''&&!x.valueUnknown&&['CZK','EUR','USD'].includes(currency);
    add('external:'+x.id,{name:String(x.product||'Investice mimo správu').slice(0,120),category:'Investiční fondy',value:known?String(x.current):'',valueUnknown:!known,currency:['CZK','EUR','USD'].includes(currency)?currency:'CZK',note:String(x.note||'').slice(0,4000)},{kind:'external',company:x.company||'',isin:x.isin||'',asOf:wealthDate(x.valueDate)});
  });
  clientContracts(c.id).filter(s=>['hypotéka','úvěr'].includes(s.type)&&!s.portfolioReplacedBy).forEach(s=>{
    const raw=s.outstandingBalance??s.remainingPrincipal,known=raw!==undefined&&raw!==null&&raw!=='';
    add('debt:contract:'+s.id,{name:String(s.product||s.type).slice(0,120),kind:'debt',category:s.type==='hypotéka'?'Hypotéky':'Spotřebitelské úvěry',value:known?String(parseMoney(raw)):'',valueUnknown:!known,note:'Zbývající dluh je nutné ověřit. Původní výše úvěru ani splátka nejsou aktuální jistinou.'},{kind:'debt',company:s.company||'',asOf:wealthDate(s.balanceDate)});
  });
  return rows;
}
function wealthRows(c){
  const live=wealthLiveRows(c),saved=wealthProfile(c).assets||[],map=new Map(live.map(x=>[x.sourceKey,x]));
  for(const r of saved){
    const base=map.get(r.sourceKey);
    // Returned native rows overlay planning facts but must not resurrect a sold/removed position.
    if(r.native&&!base)continue;
    map.set(r.sourceKey,{...base,...r,ref:{...base?.ref,...r.ref},asset:{...base?.asset,...r.asset}});
  }
  return [...map.values()];
}
function wealthContracts(c){
  const ref=wealthClientRef(c),map=new Map();
  for(const s of clientContracts(c.id)){
    if(s.portfolioReplacedBy)continue;
    const id=`crm-contract-${FairLifeExchange.key(ref)}-${s.id}`;
    map.set(id,{id,type:s.type||'',company:s.company||'',product:s.product||'',number:s.number||'',currency:s.currency||'CZK',payment:s.payment===undefined||s.payment===null?'':String(s.payment),startDate:wealthDate(s.datumUzavreni||s.startDate),endDate:wealthDate(s.endDate),notes:String(s.note||'').slice(0,4000)});
  }
  for(const s of wealthProfile(c).contracts||[])map.set(s.id,s);
  return [...map.values()];
}
function wealthBuildDocument(c){
  const p=wealthProfile(c),d=FairLifeExchange.blank(clientName(c),dashboardToday()),ctx=p.context;
  if(ctx){for(const k of ['self','people','answers','budget','manual','notes','crisis'])if(ctx[k]!==undefined)d[k]=structuredClone(ctx[k]);}
  d.self={...d.self,name:clientName(c),email:c.email||d.self.email||'',phone:c.phone||d.self.phone||'',address:c.address||d.self.address||''};
  const birth=wealthBirth(c);if(birth){d.self.birth=birth;d.self.birthUnknown=false;}
  if(!ctx){d.people=(c.familyLinks||[]).map(link=>{const person=findClient(link.clientId);if(!person)return null;const birth=wealthBirth(person);return {id:'crm-person-'+person.id,name:clientName(person).slice(0,120),role:['child','parent','partner','sibling'].includes(link.type)?link.type:'other',birth,birthUnknown:!birth,life:'unknown',otherParent:'unknown',year:'unknown',care:'unknown',note:link.note||'Rodinná vazba z CRM; právní vztah ověřit.'};}).filter(Boolean);}
  const rows=wealthRows(c);d.assets=rows.map(r=>structuredClone(r.asset));
  d.status='draft';d.confirm={family:false,property:false,truth:false,delivery:false};
  d.exchange={version:1,source:'filip-crm',exportId:crypto.randomUUID(),exportedAt:new Date().toISOString(),clientRef:wealthClientRef(c),assetRefs:Object.fromEntries(rows.map(r=>[r.asset.id,r.ref])),contracts:wealthContracts(c)};
  d.crisis={...Object.fromEntries(['contacts','policies','services','access','benefits','tasks'].map(k=>[k,[]])),...d.crisis};
  const ids=new Set((d.crisis.policies||[]).map(x=>x.id));
  for(const s of d.exchange.contracts)if(/život|zivot|poji|auto|majetek/i.test(s.type)&&!ids.has(s.id)){
    d.crisis.policies.push({id:s.id,person:d.self.name,type:s.type,provider:s.company,number:s.number,coverage:'',beneficiary:'',phone:'',location:'CRM · smlouvy',notes:[s.product,s.notes].filter(Boolean).join('\n').slice(0,2000)});ids.add(s.id);
  }
  d.answers.assets=d.assets.some(a=>a.kind==='asset')?'yes':d.answers.assets==='yes'?'unknown':d.answers.assets;
  d.answers.debts=d.assets.some(a=>a.kind==='debt')?'yes':d.answers.debts==='yes'?'unknown':d.answers.debts;
  if(d.people.some(p=>p.role==='child'))d.answers.children='yes';
  if(d.people.some(p=>['parent','sibling','other','ex'].includes(p.role)))d.answers.otherFamily='yes';
  return FairLifeExchange.parse(d);
}
function wealthDownload(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportClientWealth(id){try{const c=findClient(id);if(!c||!wealthEnsureIdentity(c))return;wealthDownload(wealthBuildDocument(c),'majetek-'+clientName(c).replace(/[^\p{L}\p{N}-]/gu,'-')+'.json');saveToast('Soubor pro rodinný plán připraven');}catch(e){alert(e.message);}}
function wealthTotalsHtml(assets){return Object.entries(FairLifeExchange.totals(assets)).map(([currency,t])=>`<div class="client-summary-tile"><small>Hodnota položek · ${esc(currency)}</small><b>${num(t.assets)} ${esc(currency)}</b><span>Závazky ${num(t.debts)} ${esc(currency)} · ${t.unknown} částek k doplnění</span></div>`).join('');}
function wealthAssetsTable(rows,people=[],editable=false){return `<div class="table-wrap"><table><thead><tr><th>Položka</th><th>Hodnota celé položky</th><th>Vlastnictví</th><th>Ocenění k datu</th>${editable?'<th>Akce</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.asset.name)}</b><br><span class="note">${esc(r.asset.kind==='debt'?'Závazek':r.asset.category)} · ${esc(r.ref?.company||'')} ${r.ref?.isin?esc(r.ref.isin):''}</span></td><td>${esc(wealthMoney(r.asset))}</td><td>${esc(wealthOwner(r.asset,people))}</td><td>${esc(r.ref?.asOf?dashboardDateText(r.ref.asOf):'Neuvedeno')}</td>${editable?`<td><button class="btn slim" onclick="wealthEditAsset('${esc(encodeURIComponent(r.sourceKey).replace(/'/g,'%27'))}')">Upravit pro plán</button></td>`:''}</tr>`).join('')||'<tr><td colspan="5">Zatím nejsou evidované majetkové položky.</td></tr>'}</tbody></table></div>`;}
function clientWealthHtml(c){
  const rows=wealthRows(c),p=wealthProfile(c),contracts=wealthContracts(c);
  return `<section class="wealth-panel"><div class="toolbar"><div><h3>Majetek a plán</h3><p class="note">Přehled majetku klienta a podklady pro samostatný dědický a krizový plán.</p></div><div class="actions"><button class="btn primary" onclick="wealthExportPreview(${c.id})">Export majetku</button><button class="btn" onclick="wealthChooseImport(${c.id})">Načíst dotazník / plán</button><button class="btn" onclick="wealthEditAsset()">+ Majetek / závazek</button></div></div><p class="notice small">Částky jsou hodnotami celých evidovaných položek, nikoliv vypočteným osobním podílem klienta. Vlastnictví a neznámé údaje doplň v dotazníku. Převzaté údaje pro plán nemění spravované AUM, obchody ani provize.</p><div class="client-summary-strip">${wealthTotalsHtml(rows.map(r=>r.asset))}</div>${wealthAssetsTable(rows,p.context?.people||[],true)}<details class="wealth-details"><summary>Smlouvy a pojistky (${contracts.length})</summary>${contracts.map(s=>`<div class="product-row"><div><b>${esc(s.product||s.type)}</b><div class="note">${esc([s.type,s.company,s.number].filter(Boolean).join(' · '))}</div>${s.notes?`<p class="note" style="white-space:pre-wrap">${esc(s.notes)}</p>`:''}${s.payment?`<span class="note">Evidovaná platba ${esc(s.payment)} ${esc(s.currency)}</span>`:''}</div></div>`).join('')||'<p>Bez smluv.</p>'}</details><details class="wealth-details"><summary>Dotazník a historie převzetí</summary><p class="note">${p.context?'Rodinné údaje a doplňující podklady jsou uložené pro další export.':'Vyplněný dotazník zatím nebyl převzat.'}</p>${p.context?`<button class="btn" onclick="wealthContextPreview()">Zobrazit převzaté odpovědi</button>`:''}${p.previousContext?`<button class="btn" onclick="wealthContextPreview(true)">Předchozí odpovědi</button>`:''}${(p.imports||[]).slice().reverse().map(i=>`<div class="product-row"><span>${esc(dashboardDateText(i.date))} · ${esc(i.name)} · ${i.assets} položek a ${i.contracts} smluv</span></div>`).join('')}</details>${(p.assets||[]).some(r=>r.native&&!rows.some(x=>x.sourceKey===r.sourceKey))||p.mergeArchive?.length?`<details class="wealth-details"><summary>Archiv podkladů bez aktuální vazby / ze sloučení</summary><p class="note">Tyto podklady zůstávají v záloze. Nezapočítávají se do aktuálního majetku.</p><button class="btn" onclick="wealthDownload(wealthProfile(findClient(selectedClientId)),'archiv-majetku.json')">Stáhnout archiv podkladů</button></details>`:''}<div class="actions" style="margin-top:14px"><a class="btn" href="https://filipsolar202-blip.github.io/rodinny-plan/dotaznik.html" target="_blank" rel="noopener">Otevřít společný dotazník</a><a class="btn" href="https://filipsolar202-blip.github.io/rodinny-plan/" target="_blank" rel="noopener">Otevřít dědický a krizový plán</a></div></section>`;
}
function wealthExportPreview(id){try{const c=findClient(id);if(!c||!wealthEnsureIdentity(c))return;const d=wealthBuildDocument(c);crmExtraModal('wealthExportModal','Majetek · '+clientName(c),`<p>Soubor obsahuje údaje pouze tohoto klienta, jeho uvedené rodinné vazby, majetek a smlouvy. V druhé aplikaci zvol import z CRM; v dotazníku lze pokračovat ze souboru.</p><div class="client-summary-strip">${wealthTotalsHtml(d.assets)}</div>${wealthAssetsTable(d.assets.map(a=>({asset:a,ref:d.exchange.assetRefs[a.id]})),d.people)}<p class="note">${d.exchange.contracts.length} smluv. Neznámé částky a vlastnictví zůstávají k doplnění. Soubor obsahuje osobní údaje; stáhne se k tobě, nikam se automaticky neposílá.</p><div class="actions"><button class="btn primary" onclick="exportClientWealth(${id})">Stáhnout soubor pro plán</button><button class="btn" onclick="wealthPrint(${id})">Majetkový přehled k tisku</button></div>`);}catch(e){alert(e.message);}}
function wealthPrint(id){const c=findClient(id),d=wealthBuildDocument(c),rows=d.assets.map(a=>({asset:a,ref:d.exchange.assetRefs[a.id]}));downloadHtmlFile(`<!doctype html><html lang="cs"><meta charset="utf-8"><title>Majetek klienta</title><style>body{font-family:Arial,sans-serif;color:#204566;padding:36px;max-width:1100px;margin:auto}h1{color:#235786}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:10px;border-bottom:1px solid #c8d9e7}.note{color:#577086;font-size:12px}.client-summary-tile{display:inline-grid;gap:6px;padding:16px;border:1px solid #c8d9e7;border-radius:12px;margin:8px}button{display:none}@media print{body{padding:0}}</style><h1>Majetek klienta · ${esc(clientName(c))}</h1><p>${esc(dashboardDateText(d.date))} · Fair Life · Filip Solár</p><p class="note">Evidence pro přípravu rodinného plánu. Hodnoty celých položek nejsou vypořádáním vlastnických podílů. Neznámé údaje zůstávají k doplnění.</p>${wealthTotalsHtml(d.assets)}${wealthAssetsTable(rows,d.people)}<h2>Smlouvy</h2>${d.exchange.contracts.map(s=>`<p><b>${esc(s.product||s.type)}</b> · ${esc(s.company)} · ${esc(s.number)}</p>`).join('')}<p class="note">Podklad z CRM, nikoliv kompletní potvrzený soupis majetku nebo dědický plán.</p></html>`,'majetkovy-prehled.html');}
function wealthChooseImport(id){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
  input.oncancel=()=>input.remove();input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>5_000_000)throw Error('Maximum je 5 MB.');wealthPrepareImport(await file.text(),id);}catch(e){alert(e.message);}finally{input.remove();}};input.click();
}
function wealthImportPlan(d,c){
  const p=wealthProfile(c),live=wealthRows(c),known=new Set([wealthClientRef(c),...(p.clientRefs||[])]),foreign=d.exchange?.clientRef;
  const linked=foreign&&state.clients.find(x=>[wealthClientRef(x),...(wealthProfile(x).clientRefs||[])].includes(foreign));
  if(linked&&String(linked.id)!==String(c.id))throw Error('Tento soubor je propojen s jiným klientem: '+clientName(linked)+'. Otevři jeho kartu.');
  const assetPlans=d.assets.map(a=>{const key=wealthSourceKey(d,a),ref=d.exchange?.assetRefs?.[a.id]||{sourceKey:key,kind:a.kind==='debt'?'debt':'wealth',company:'',isin:'',asOf:''},existing=live.find(r=>r.sourceKey===key||r.asset.id===a.id);return {asset:a,sourceKey:existing?.sourceKey||key,ref:{...ref,sourceKey:existing?.sourceKey||key},native:!!existing?.native,existing,changed:!!existing&&FairLifeExchange.stable(existing.asset)!==FairLifeExchange.stable(a)};});
  const contracts=wealthContracts(c),contractPlans=FairLifeExchange.contractRows(d).map(s=>({contract:s,existing:contracts.find(x=>x.id===s.id||s.number&&x.number===s.number&&norm(x.company)===norm(s.company))}));
  return {d,clientId:c.id,identityNeedsConfirmation:(!foreign||!known.has(foreign))||norm(clientName(c))!==norm(d.self.name),assets:assetPlans,contracts:contractPlans};
}
function wealthPrepareImport(text,id){const d=FairLifeExchange.parse(text),c=findClient(id);if(!c)throw Error('Vyber klienta.');if(!wealthEnsureIdentity(c))return;wealthPendingImport=wealthImportPlan(d,c);wealthRenderImport();}
function wealthRenderImport(){
  const p=wealthPendingImport;if(!p)return;
  crmExtraModal('wealthImportModal','Kontrola importu majetku',`<p><b>Soubor:</b> ${esc(p.d.self.name)} · ${esc(dashboardDateText(p.d.date))} · ${p.d.status==='draft'?'rozpracované podklady':'klientský dotazník'}<br><b>Uložit ke klientovi:</b> ${esc(clientName(findClient(p.clientId)))}</p><p class="notice small">Vyber položky k převzetí do přehledu Majetek a plán. Investice, dluhy a smlouvy z dotazníku se evidují jako podklady klienta; nevytváří obchod ani provizi. U změněných položek zkontroluj původní a novou hodnotu.</p>${p.identityNeedsConfirmation?'<label class="check-row"><input id="wealthIdentityConfirmed" type="checkbox"> Potvrzuji, že tento soubor patří vybranému klientovi.</label>':''}<div class="table-wrap"><table><thead><tr><th>Převzít</th><th>Položka</th><th>V CRM / pro plán</th><th>V souboru</th><th>Stav</th></tr></thead><tbody>${p.assets.map((r,i)=>`<tr><td><input type="checkbox" aria-label="Převzít ${esc(r.asset.name)}" data-wealth-asset="${i}" ${!r.existing?'checked':''}></td><td>${esc(r.asset.name)}<br><span class="note">${esc(wealthOwner(r.asset,p.d.people))}</span></td><td>${r.existing?esc(wealthMoney(r.existing.asset)):'—'}</td><td>${esc(wealthMoney(r.asset))}</td><td>${r.existing?r.changed?'Změna – zkontrolovat':'Již evidováno':'Nová položka'}</td></tr>`).join('')}</tbody></table></div><h3>Smlouvy a pojistky</h3>${p.contracts.map((r,i)=>`<label class="check-row"><input type="checkbox" data-wealth-contract="${i}" ${!r.existing?'checked':''}> ${esc([r.contract.product||r.contract.type,r.contract.company,r.contract.number].filter(Boolean).join(' · '))} · ${r.existing?'již evidováno / aktualizace':'nová'}</label>`).join('')||'<p class="note">Žádné smlouvy.</p>'}<label class="check-row"><input id="wealthContext" type="checkbox" checked> Převzít rodinné údaje, rozpočet a odpovědi pro plán (nahradí dříve převzaté odpovědi; předchozí verzi si lze zobrazit).</label><label class="check-row"><input id="wealthContacts" type="checkbox"> Doplnit prázdné kontaktní údaje klienta (${esc([p.d.self.email,p.d.self.phone,p.d.self.address].filter(Boolean).join(' · ')||'v souboru neuvedené')}). Vyplněné kontakty se nepřepíšou.</label><div class="actions"><button class="btn primary" onclick="wealthApplyImport()">Převzít vybrané údaje</button><button class="btn" onclick="closeModal('wealthImportModal');wealthPendingImport=null">Zrušit</button></div>`);
}
function wealthApplyImport(){
  try {
  const p=wealthPendingImport;if(!p)return;
  if(p.identityNeedsConfirmation&&!byId('wealthIdentityConfirmed')?.checked)return alert('Potvrď, ke kterému klientovi soubor patří.');
  const c=findClient(p.clientId);if(!c)return;
  // Recheck identity against current state; preview is not permission to overwrite another client.
  wealthImportPlan(p.d,c);
  const before=JSON.stringify(state),profile=structuredClone(wealthProfile(c));profile.assets||=[];profile.contracts||=[];profile.imports||=[];profile.clientRefs||=[];
  let assetCount=0,contractCount=0;
  byId('wealthImportModal').querySelectorAll('[data-wealth-asset]:checked').forEach(el=>{
    const r=p.assets[Number(el.dataset.wealthAsset)],index=profile.assets.findIndex(x=>x.sourceKey===r.sourceKey);
    const next={id:r.asset.id,sourceKey:r.sourceKey,asset:structuredClone(r.asset),ref:structuredClone(r.ref),native:r.native,origin:'import',updatedAt:new Date().toISOString()};
    if(index>=0){next.previous=profile.assets[index].asset;profile.assets[index]=next;}else profile.assets.push(next);assetCount++;
  });
  byId('wealthImportModal').querySelectorAll('[data-wealth-contract]:checked').forEach(el=>{const r=p.contracts[Number(el.dataset.wealthContract)],id=r.existing?.id||r.contract.id,next={...r.contract,id};const i=profile.contracts.findIndex(s=>s.id===id);if(i>=0)profile.contracts[i]=next;else profile.contracts.push(next);contractCount++;});
  if(byId('wealthContext').checked){
    const nextContext=Object.fromEntries(['self','people','answers','budget','manual','notes','crisis'].map(k=>[k,structuredClone(p.d[k]|| (k==='notes'?'':{}))]));
    // Keep reviewed policy details only; unchecked incoming policies cannot bypass the preview.
    const selectedPolicies=new Set([...byId('wealthImportModal').querySelectorAll('[data-wealth-contract]:checked')].map(el=>p.contracts[Number(el.dataset.wealthContract)].contract.id));
    nextContext.crisis.policies=[...(profile.context?.crisis?.policies||[]).filter(x=>!selectedPolicies.has(x.id)),...(p.d.crisis?.policies||[]).filter(x=>selectedPolicies.has(x.id))];
    if(profile.context&&FairLifeExchange.stable(profile.context)!==FairLifeExchange.stable(nextContext))profile.previousContext=profile.context;
    profile.context=nextContext;
  }
  if(p.d.exchange?.clientRef&&!profile.clientRefs.includes(p.d.exchange.clientRef))profile.clientRefs.push(p.d.exchange.clientRef);
  const contactUpdates={};if(byId('wealthContacts').checked)for(const k of ['email','phone','address'])if(!c[k]&&p.d.self[k])contactUpdates[k]=p.d.self[k];
  const signature=FairLifeExchange.key(FairLifeExchange.stable({assets:p.d.assets,contracts:FairLifeExchange.contractRows(p.d),self:p.d.self,people:p.d.people,answers:p.d.answers,budget:p.d.budget,manual:p.d.manual,crisis:p.d.crisis}));
  if(!profile.imports.some(i=>i.signature===signature))profile.imports.push({signature,date:dashboardToday(),name:p.d.self.name,assets:assetCount,contracts:contractCount,source:p.d.exchange?.source||'dotazník'});
  // Validate the combined result, including ownership references when context is not selected.
  wealthBuildDocument({...c,wealthProfile:profile});
  Object.assign(c,contactUpdates);c.wealthProfile=profile;c.updatedAt=today();
  if(!persist()){state=normalizeState(JSON.parse(before));return;}
  wealthPendingImport=null;closeModal('wealthImportModal');clientSection='wealth';selectedClientId=c.id;renderClientDetail();saveToast('Majetkové podklady převzaty');
  } catch(e) { alert('Import nebyl dokončen: '+e.message); }
}
function wealthEditAsset(encoded=''){
  const c=findClient(selectedClientId);if(!c||!wealthEnsureIdentity(c))return;const key=decodeURIComponent(encoded),row=wealthRows(c).find(r=>r.sourceKey===key),a=row?.asset||FairLifeExchange.asset({id:crypto.randomUUID()});
  const people=wealthProfile(c).context?.people||[];
  crmExtraModal('wealthAssetModal','Majetek / závazek pro plán',`<input type="hidden" id="waKey" value="${esc(key)}"><input type="hidden" id="waId" value="${esc(a.id)}"><div class="form-grid"><div class="field"><label>Název</label><input id="waName" maxlength="120" value="${esc(a.name)}"></div><div class="field"><label>Typ</label><select id="waKind"><option value="asset">Majetek</option><option value="debt">Závazek</option></select></div><div class="field"><label>Kategorie</label><input id="waCategory" maxlength="120" value="${esc(a.category)}" placeholder="Nemovitosti, investice, hypotéky…"></div><div class="field"><label>Hodnota celé položky / zbývající dluh</label><input id="waValue" type="number" min="0" max="1000000000000" step="any" value="${esc(a.value)}"><label><input id="waUnknown" type="checkbox" ${a.valueUnknown?'checked':''}> Částku neznám</label></div><div class="field"><label>Měna</label><select id="waCurrency"><option>CZK</option><option>EUR</option><option>USD</option></select></div><div class="field"><label>Ocenění k datu</label><input id="waDate" type="date" value="${esc(row?.ref?.asOf||'')}"></div><div class="field"><label>Vlastnictví</label><select id="waOwner"><option value="unknown">Nevím / ověřit</option><option value="me">Výlučně klient</option>${people.length?'<option value="person">Jiná osoba</option><option value="shares">Podílové vlastnictví</option>':''}${people.some(p=>p.role==='spouse')?'<option value="joint">Společné jmění manželů</option>':''}</select></div><div class="field"><label>Další vlastník (pro podíly / jinou osobu)</label><select id="waPerson"><option value="">Nevybráno</option>${people.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div><div class="field"><label>Podíl klienta (%)</label><input id="waShare" type="number" step="any" value="${esc(a.share)}"></div><div class="field"><label>Původ majetku</label><select id="waAcquisition"><option value="unknown">Nevím</option><option value="purchase">Koupě / příjmy</option><option value="before">Před manželstvím</option><option value="gift">Dar</option><option value="inheritance">Dědictví</option></select></div><div class="field full"><label>Poznámka</label><textarea id="waNote" maxlength="4000">${esc(a.note)}</textarea></div></div><p class="note">Upravuje se přehled pro plán. Hodnota spravovaného portfolia, obchodní produkce a provize se nemění.</p><div class="actions"><button class="btn primary" onclick="wealthSaveAsset()">Uložit</button></div>`);
  setVal('waKind',a.kind);setVal('waCurrency',a.currency);setVal('waOwner',a.owner);setVal('waPerson',a.person);setVal('waAcquisition',a.acquisition);
}
function wealthSaveAsset(){
  try{const c=findClient(selectedClientId),old=wealthRows(c).find(r=>r.sourceKey===val('waKey')),key=old?.sourceKey||'wealth:'+val('waId');
    const a=FairLifeExchange.asset({id:val('waId'),name:val('waName').trim(),kind:val('waKind'),category:val('waCategory').trim(),value:byId('waUnknown').checked?'':val('waValue'),valueUnknown:byId('waUnknown').checked,currency:val('waCurrency'),owner:val('waOwner'),person:val('waPerson'),share:val('waShare'),acquisition:val('waAcquisition'),liquid:old?.asset.liquid||false,note:val('waNote')});
    const probe=FairLifeExchange.blank(clientName(c));probe.people=wealthProfile(c).context?.people||[];probe.assets=[a];FairLifeExchange.parse(probe);
    const before=JSON.stringify(state),profile=structuredClone(wealthProfile(c)),index=(profile.assets||[]).findIndex(r=>r.sourceKey===key),r={id:a.id,sourceKey:key,asset:a,native:!!old?.native,ref:{sourceKey:key,kind:a.kind==='debt'?'debt':'wealth',company:'',isin:'',...old?.ref,asOf:val('waDate')},origin:'manual',updatedAt:new Date().toISOString()};
    profile.assets||=[];if(index<0)profile.assets.push(r);else profile.assets[index]={...r,previous:profile.assets[index].asset};c.wealthProfile=profile;
    if(!persist()){state=normalizeState(JSON.parse(before));return;}closeModal('wealthAssetModal');renderClientDetail();
  }catch(e){alert(e.message);}
}
function mergeWealthProfiles(target,source){
  if(!source.wealthProfile)return;
  if(!target.wealthProfile){target.wealthProfile=structuredClone(source.wealthProfile);target.wealthProfile.clientRefs=[...new Set([...(source.wealthProfile.clientRefs||[]),wealthClientRef(source)])];return;}
  const t=target.wealthProfile,s=source.wealthProfile;
  for(const [key,id] of [['assets','sourceKey'],['contracts','id'],['imports','signature']]){t[key]||=[];for(const row of s[key]||[]){const existing=t[key].find(x=>x[id]===row[id]);if(!existing)t[key].push(structuredClone(row));else if(FairLifeExchange.stable(existing)!==FairLifeExchange.stable(row)){t.mergeArchive||=[];const archived={kind:key,record:structuredClone(row)};if(!t.mergeArchive.some(x=>FairLifeExchange.stable(x)===FairLifeExchange.stable(archived)))t.mergeArchive.push(archived);}}}
  t.clientRefs=[...new Set([...(t.clientRefs||[]),...(s.clientRefs||[]),wealthClientRef(source)])];if(!t.context&&s.context)t.context=structuredClone(s.context);else if(s.context&&FairLifeExchange.stable(t.context)!==FairLifeExchange.stable(s.context)){t.previousContext=structuredClone(s.context);}
}
function wealthContextPreview(previous=false){
  const c=findClient(selectedClientId),p=wealthProfile(c),d=previous?p.previousContext:p.context;if(!d)return;
  const labels={children:'Děti',otherFamily:'Další rodina',will:'Závěť / dědická smlouva',maritalProperty:'Úprava společného jmění',gifts:'Dary',exceptions:'Zvláštní rodinné okolnosti',international:'Vztah k zahraničí',assets:'Majetek',debts:'Závazky',expenses:'Měsíční výdaje',income:'Zbývající měsíční příjmy',months:'Počet měsíců zajištění',oneOff:'Jednorázové výdaje',reserve:'Dostupná rezerva',insurance:'Pojistné krytí',contact:'Kontakty',documents:'Dokumenty',payments:'Platby',access:'Přístupy',firstDays:'První dny',notary:'Notář',notes:'Poznámky'};
  crmExtraModal('wealthContextModal',previous?'Předchozí odpovědi':'Převzaté odpovědi pro plán',`<h3>Rodina</h3>${(d.people||[]).map(p=>`<p><b>${esc(p.name)}</b> · ${esc({child:'Dítě',spouse:'Manžel / manželka',partner:'Partner',parent:'Rodič',sibling:'Sourozenec',ex:'Bývalý partner',other:'Další osoba'}[p.role])} · ${esc(p.birthUnknown?'Narození neuvedeno':p.birth)}</p>`).join('')}<h3>Odpovědi</h3>${Object.entries(d.answers||{}).map(([k,v])=>`<p>${esc(labels[k]||k)}: <b>${esc({yes:'Ano',no:'Ne',unknown:'Nevím','':'Neuvedeno'}[v])}</b></p>`).join('')}<h3>Rozpočet domácnosti</h3>${Object.entries(d.budget||{}).map(([k,v])=>`<p>${esc(labels[k]||k)}: <b>${esc(v.unknown?'Neuvedeno':v.value+(k==='months'?' měsíců':' Kč'))}</b></p>`).join('')}<h3>Pokyny a poznámky</h3>${Object.entries(d.manual||{}).filter(([,v])=>v).map(([k,v])=>`<p><b>${esc(labels[k]||k)}</b><br><span style="white-space:pre-wrap">${esc(v)}</span></p>`).join('')}<p style="white-space:pre-wrap">${esc(d.notes||'')}</p>`);
}
