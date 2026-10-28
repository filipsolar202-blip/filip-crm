/* Local report preview and persistent discrepancy review; no external upload. */
(function () {
  'use strict';
  const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el=id=>document.getElementById(id), same=(a,b)=>String(a??'')===String(b??'');
  const ui={draft:null,parsed:null,provider:'',area:'fki',fileName:'',rawRows:[],date1904:false,page:0,clientId:'',isin:'',history:false};
  const PAGE=30;
  const statuses={pending:'K ověření',auto:'Bezpečná aktualizace',accepted:'Přijato z reportu',kept:'Potvrzeno CRM',unchanged:'Beze změny'};
  let indexSource=null,indexVersion='',pendingByClient=new Map();
  function pendingIndex(){
    const batches=state.providerImports||[],version=batches.map(b=>`${b.id}:${b.updatedAt}:${(b.entries||[]).length}`).join('|');
    if(indexSource===batches&&indexVersion===version)return pendingByClient;
    indexSource=batches;indexVersion=version;pendingByClient=new Map();
    batches.forEach(b=>(b.entries||[]).filter(e=>e.status==='pending').forEach(e=>{
      if(e.clientId==null)return;const key=String(e.clientId);if(!pendingByClient.has(key))pendingByClient.set(key,[]);pendingByClient.get(key).push({batch:b,entry:e});
    }));return pendingByClient;
  }
  function providerImportPending(clientId,isin=''){
    const rows=clientId==null||clientId===''?(state.providerImports||[]).flatMap(batch=>(batch.entries||[]).filter(e=>e.status==='pending').map(entry=>({batch,entry}))):pendingIndex().get(String(clientId))||[];
    return isin?rows.filter(x=>same(x.entry.isin,isin)):rows;
  }
  function providerImportNeedsReview(clientId,isin=''){return providerImportPending(clientId,isin).length>0;}
  function providerImportFieldClass(clientId,isin,field,recordKey=''){
    const aliases={current:['current','Aktuální hodnota investice','nav'],invested:['amount','netAmount','invested','Čistá investice','units'],gain:['current','nav','amount','netAmount','invested','redemptionValue','units']};
    return providerImportPending(clientId,isin).some(({entry:e})=>(!recordKey||!e.targetKey||same(e.targetKey.key??e.targetKey,recordKey))&&(!e.changes?.length||e.changes.some(c=>(aliases[field]||[field]).includes(c.field))))?'provider-diff-value':'';
  }
  function providerImportRecordNeedsReview(clientId,r){return providerImportPending(clientId,typeof invIsin==='function'?invIsin(r):'').some(({entry:e})=>!e.targetKey||(e.targetKey.key??e.targetKey)===invRecordKey(r));}
  function providerImportBadge(clientId,isin='',interactive=true){
    const n=providerImportPending(clientId,isin).length;if(!n)return '';
    const label=`Rozdíly proti reportu · ${n}`;
    return interactive?`<button type="button" class="provider-review-badge" data-client="${h(clientId)}" data-isin="${h(isin)}" onclick="event.preventDefault();event.stopPropagation();providerImportOpenReviews(this.dataset.client,this.dataset.isin)">${label}</button>`:`<span class="provider-review-badge">${label}</span>`;
  }
  function providerImportNotice(clientId,isin=''){
    if(!providerImportNeedsReview(clientId,isin))return '';
    return `<div class="provider-review-notice"><b>Portfolio potřebuje ověření proti reportu.</b> ${providerImportBadge(clientId,isin)}<span>Sporné údaje zůstávají v CRM zachované do rozhodnutí.</span></div>`;
  }
  function modal(title){
    let m=el('providerImportModal');if(!m){m=document.createElement('div');m.id='providerImportModal';m.className='modal provider-import-modal';document.body.appendChild(m);}
    m.innerHTML=`<div class="modal-box wide"><div class="toolbar"><h2>${h(title)}</h2><button class="btn" onclick="closeModal('providerImportModal')">Zavřít</button></div><div id="providerImportBody"></div></div>`;return el('providerImportBody');
  }
  function amount(v){if(v===null||v===undefined||v==='')return 'Neuvedeno';if(typeof v==='number')return v.toLocaleString('cs-CZ',{maximumFractionDigits:6});if(typeof v==='object')return JSON.stringify(v);return String(v);}
  function entryName(e){const c=(state.clients||[]).find(c=>same(c.id,e.clientId));return c?clientName(c):e.incoming?.investor||e.incoming?.name||e.incoming?.Investor||e.investor||'Klient není spárovaný';}
  function entryReason(e){return Array.isArray(e.reason)?e.reason.join(' · '):e.reason||'';}
  function rowHtml(batch,e,preview){
    const changes=Array.isArray(e.changes)?e.changes:[],id=h(e.id),bid=h(batch.id);
    return `<article class="provider-review-entry ${e.status==='pending'?'provider-needs-review':''}" data-provider-entry="${id}"><div class="provider-entry-head"><div><b>${h(entryName(e))}</b><div>${h(e.fund||e.incoming?.fund||'Fond neurčen')} ${e.isin?`<small>ISIN ${h(e.isin)}</small>`:''}</div></div><span class="provider-entry-status">${h(statuses[e.status]||e.status)}</span></div><p>${h(entryReason(e))}</p>${changes.length?`<div class="table-wrap"><table class="compact-table provider-diff-table"><thead><tr><th>Údaj</th><th>CRM</th><th>Report</th></tr></thead><tbody>${changes.map(c=>`<tr><th>${h(c.label||c.field)}</th><td class="${e.status==='pending'?'provider-diff-value':''}">${h(amount(c.before))}</td><td class="${e.status==='pending'?'provider-diff-value':''}">${h(amount(c.after))}</td></tr>`).join('')}</tbody></table></div>`:''}<p class="note">${h(batch.provider==='avant'?'Avant':'Codya')} · ${h(batch.fileName||'report')} · datum exportu ${h(batch.reportDate||'neuvedeno')}${e.incoming?.valuationDate?' · ocenění '+h(e.incoming.valuationDate):''}</p>${!preview&&e.status==='pending'?`<div class="actions"><button class="btn" data-batch="${bid}" data-entry="${id}" onclick="providerImportChoose(this.dataset.batch,this.dataset.entry,'keep')">Potvrdit správnost CRM</button>${e.canAccept?`<button class="btn primary" data-batch="${bid}" data-entry="${id}" onclick="providerImportChoose(this.dataset.batch,this.dataset.entry,'accept')">Přijmout údaje reportu</button>`:''}${e.clientId!=null?`<button class="btn" data-client="${h(e.clientId)}" onclick="providerImportGoClient(this.dataset.client)">Otevřít klienta a upravit</button>`:''}</div>`:''}</article>`;
  }
  function pages(total){const count=Math.max(1,Math.ceil(total/PAGE));ui.page=Math.max(0,Math.min(ui.page,count-1));return `<div class="provider-pagination"><button class="btn slim" onclick="providerImportPage(-1)" ${ui.page===0?'disabled':''}>← Předchozí</button><span>${total} záznamů · strana ${ui.page+1} / ${count}</span><button class="btn slim" onclick="providerImportPage(1)" ${ui.page===count-1?'disabled':''}>Další →</button></div>`;}
  function renderPreview(){
    const body=modal(`Import ${ui.provider==='avant'?'Avant':'Codya'} · kontrola reportu`),b=ui.draft,entries=b?.entries||[];
    const pending=entries.filter(e=>e.status==='pending').length,auto=entries.filter(e=>e.status==='auto').length;
    const pager=pages(entries.length);
    body.innerHTML=`<p class="note">${h(ui.fileName)}. Při potvrzení se převezmou pouze bezpečné aktualizace. Sporné řádky se uloží k ověření a označí klienta červeně. Chybějící řádek v reportu neznamená smazání investice.</p><div class="provider-report-options"><label for="providerReportDate">Datum exportu / stav reportu<input id="providerReportDate" type="date" value="${h(b?.reportDate||'')}" onchange="providerImportRebuild()"></label><span class="note">Ocenění Avantu používá datum uvedené u každé transakce. U Codyy doplň skutečné datum stavu reportu.</span></div>${ui.parsed?.errors?.length?`<div class="provider-review-notice">${ui.parsed.errors.map(x=>h(typeof x==='string'?x:JSON.stringify(x))).join('<br>')}</div>`:''}<div class="provider-import-summary"><b>${auto} bezpečných aktualizací</b><b class="${pending?'provider-diff-value':''}">${pending} k ověření</b><span>${entries.length-auto-pending} beze změny</span></div><div class="actions"><button id="providerImportCommitButton" class="btn primary" onclick="providerImportConfirm()" ${!b||!b.reportDate||!entries.length||b.errors?.length?'disabled':''}>Převzít bezpečné změny a uložit kontroly</button></div>${pager}<div class="provider-entries">${entries.slice(ui.page*PAGE,(ui.page+1)*PAGE).map(e=>rowHtml(b,e,true)).join('')||'<p>Report neobsahuje použitelné řádky.</p>'}</div>${entries.length>PAGE?pager:''}`;
    openModal('providerImportModal');
  }
  async function providerImportOpenFile(file,provider,area='fki'){
    if(!file)return;if(typeof XLSX==='undefined')return alert('Čtečka Excelu není načtená. Obnov CRM.');
    try{
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',raw:true,cellDates:false}),rows=XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{defval:'',raw:true});
      Object.assign(ui,{provider,area,fileName:file.name,rawRows:rows,date1904:!!workbook.Workbook?.WBProps?.date1904,page:0,draft:null});
      const reportDate=provider==='avant'?new Date().toLocaleDateString('sv-SE'):'';
      ui.parsed=provider==='avant'?providerImportParseAvant(rows,{fileName:file.name,reportDate,date1904:ui.date1904}):providerImportParseCodya(rows,{fileName:file.name,reportDate,area});
      ui.draft=providerImportBuildPlan(state,ui.parsed);renderPreview();
    }catch(error){alert('Report se nepodařilo načíst: '+(error?.message||error));}
  }
  function providerImportRebuild(){
    const date=el('providerReportDate')?.value||'';
    try{ui.parsed=ui.provider==='avant'?providerImportParseAvant(ui.rawRows,{fileName:ui.fileName,reportDate:date,date1904:ui.date1904}):providerImportParseCodya(ui.rawRows,{fileName:ui.fileName,reportDate:date,area:ui.area});ui.draft=providerImportBuildPlan(state,ui.parsed);renderPreview();}catch(e){alert(e.message||e);}
  }
  function successful(result){if(result===false||result?.ok===false){if(result?.error)alert(result.error);return false;}return true;}
  function providerImportConfirm(){
    if(!ui.draft)return;try{const result=providerImportCommit(ui.draft);if(!successful(result))return;ui.draft=null;renderAll();providerImportOpenReviews();saveToast(result?.duplicate?'Tento report už je zpracovaný. Zobrazuji uložené kontroly.':'Report zpracován. Nesrovnalosti čekají na ověření.');}catch(e){alert(e.message||e);}
  }
  function providerImportOpenReviews(clientId='',isin=''){
    Object.assign(ui,{draft:null,clientId,isin,page:0,history:false});renderReviews();openModal('providerImportModal');
  }
  function renderReviews(){
    const body=modal('Kontrola rozdílů proti reportům');
    const rows=(state.providerImports||[]).slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).flatMap(batch=>(batch.entries||[]).filter(e=>(ui.history||e.status==='pending')&&(!ui.clientId||same(e.clientId,ui.clientId))&&(!ui.isin||same(e.isin,ui.isin))).map(entry=>({batch,entry})));
    const pager=pages(rows.length);
    body.innerHTML=`<div class="toolbar"><p class="note">Potvrzení správnosti CRM zachová uložené hodnoty. Přijetí reportu mění jen uvedený záznam. Po ruční úpravě můžeš porovnání uzavřít potvrzením CRM.</p><label class="provider-history"><input type="checkbox" ${ui.history?'checked':''} onchange="providerImportHistory(this.checked)"> Ukázat také vyřešené</label></div>${ui.clientId?`<button class="btn slim" onclick="providerImportOpenReviews()">Všichni klienti</button>`:''}${pager}<div class="provider-entries">${rows.slice(ui.page*PAGE,(ui.page+1)*PAGE).map(x=>rowHtml(x.batch,x.entry,false)).join('')||'<p class="provider-import-clear">Žádné nevyřešené rozdíly pro tento výběr.</p>'}</div>${rows.length>PAGE?pager:''}`;
  }
  function providerImportChoose(batchId,entryId,action){
    try{const result=providerImportResolve(batchId,entryId,action);if(!successful(result))return;indexSource=null;renderAll();renderReviews();saveToast(action==='keep'?'Hodnoty CRM potvrzeny':'Údaje reportu přijaty');}catch(e){alert(e.message||e);}
  }
  function providerImportGoClient(id){closeModal('providerImportModal');selectedClientId=Number(id);clientSection='portfolio';clientDirectoryMode=false;showView('clients');renderClients();}
  function providerImportPage(delta){ui.page+=delta;if(ui.draft)renderPreview();else renderReviews();}
  function providerImportHistory(value){ui.history=value;ui.page=0;renderReviews();}
  Object.assign(window,{providerImportOpenFile,providerImportOpenReviews,providerImportRebuild,providerImportConfirm,providerImportChoose,providerImportGoClient,providerImportPage,providerImportHistory,providerImportPending,providerImportNeedsReview,providerImportBadge,providerImportNotice,providerImportFieldClass,providerImportRecordNeedsReview});
})();
