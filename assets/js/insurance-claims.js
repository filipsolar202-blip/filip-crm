/* Insurance claims are service records, kept separate from sales and commissions. */
const INSURANCE_CLAIM_STATUSES = {
  reported: 'Nahlášeno', collecting: 'Kompletace', sent: 'Odesláno pojišťovně',
  review: 'Posouzení', resolved: 'Vyřízeno', rejected: 'Zamítnuto', cancelled: 'Zrušeno'
};
const INSURANCE_CLAIM_CATEGORIES = ['Životní', 'Úraz / děti', 'Auto', 'Majetek', 'Odpovědnost', 'Ostatní'];
const INSURANCE_CLAIM_CLOSED = new Set(['resolved', 'rejected', 'cancelled']);
const INSURANCE_CLAIM_FIELDS = ['clientId','contractId','title','category','status','incidentDate','recordedDate','reportedDate','sentDate','resolvedDate','insurer','claimNumber','description','requestedAmount','paidAmount','outcome','nextStep','nextDate'];
const INSURANCE_CLAIM_LABELS = {clientId:'Klient',contractId:'Smlouva',title:'Název',category:'Druh pojištění',status:'Stav',incidentDate:'Datum události',recordedDate:'Datum evidence',reportedDate:'Nahlášeno pojišťovně',sentDate:'Odesláno pojišťovně',resolvedDate:'Datum uzavření',insurer:'Pojišťovna',claimNumber:'Číslo události',description:'Co se stalo',requestedAmount:'Požadované plnění',paidAmount:'Vyplaceno',outcome:'Výsledek',nextStep:'Další krok',nextDate:'Termín dalšího kroku'};
const INSURANCE_CLAIM_INPUTS = {clientId:'icClient',contractId:'icContract',title:'icTitle',category:'icCategory',status:'icStatus',incidentDate:'icIncidentDate',recordedDate:'icRecordedDate',reportedDate:'icReportedDate',sentDate:'icSentDate',resolvedDate:'icResolvedDate',insurer:'icInsurer',claimNumber:'icClaimNumber',description:'icDescription',requestedAmount:'icRequestedAmount',paidAmount:'icPaidAmount',outcome:'icOutcome',nextStep:'icNextStep',nextDate:'icNextDate'};
let insuranceClaimFilters = {query:'',scope:'open',category:'',status:'',sort:'next'};
let insuranceClaimEditor = null;

function insuranceClaimToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function insuranceClaimDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Neuvedeno';
  return new Date(`${value}T12:00:00`).toLocaleDateString('cs-CZ');
}
function insuranceClaimRows(clientId) {
  return (state.insuranceClaims || []).filter(x => x && (clientId == null || String(x.clientId) === String(clientId)));
}
function insuranceClaimFind(id) { return insuranceClaimRows().find(x => String(x.id) === String(id)); }
function insuranceClaimKnownStatus(status) { return Object.prototype.hasOwnProperty.call(INSURANCE_CLAIM_STATUSES,status); }
function insuranceClaimStatus(status) { return insuranceClaimKnownStatus(status) ? INSURANCE_CLAIM_STATUSES[status] : 'Neurčený stav'; }
function insuranceClaimStageKey(record) { return insuranceClaimKnownStatus(record.status) ? record.status : 'unknown'; }
function insuranceClaimRevisionSignature(record) {
  if(!record)return null;
  return JSON.stringify({fields:Object.fromEntries(INSURANCE_CLAIM_FIELDS.map(key=>[key,record[key]??''])),createdAt:record.createdAt,updatedAt:record.updatedAt,history:record.history||[],attachments:(record.attachments||[]).map(a=>({id:a.id,name:a.name,type:a.type,size:a.size,content:a.dataUrl||a.fileRef||'',createdAt:a.createdAt,date:a.date,status:a.status}))});
}
function insuranceClaimClientName(id) { const c = findClient(id); return c ? clientName(c) : 'Klient není přiřazen'; }
function insuranceClaimAmount(value) { return value === null || value === undefined || value === '' ? 'Neuvedeno' : money(value); }
function insuranceClaimBadge(status) { return `<span class="insurance-claim-badge ic-status-${esc(status)}">${esc(insuranceClaimStatus(status))}</span>`; }
function insuranceClaimOpenButton(record, label, className='btn') {
  return `<button type="button" class="${className} insurance-claim-open" data-claim="${esc(record.id)}" data-client="${esc(record.clientId || '')}" onclick="openInsuranceClaim(this.dataset.client,this.dataset.claim)">${esc(label)}</button>`;
}
function insuranceClaimCard(record) {
  const overdue = !INSURANCE_CLAIM_CLOSED.has(record.status) && record.nextDate && record.nextDate < insuranceClaimToday();
  return `<article class="insurance-claim-card">
    ${insuranceClaimOpenButton(record,record.title || 'Pojistná událost','insurance-claim-title')}
    <div class="insurance-claim-client">${esc(insuranceClaimClientName(record.clientId))}</div>
    <div class="chips"><span class="badge">${esc(record.category || 'Ostatní')}</span>${record.insurer ? `<span class="note">${esc(record.insurer)}</span>` : ''}</div>
    <dl><div><dt>Událost</dt><dd>${insuranceClaimDate(record.incidentDate)}</dd></div><div><dt>Zaevidováno</dt><dd>${insuranceClaimDate(record.recordedDate)}</dd></div>${record.sentDate ? `<div><dt>Odesláno</dt><dd>${insuranceClaimDate(record.sentDate)}</dd></div>` : ''}${record.resolvedDate ? `<div><dt>Uzavřeno</dt><dd>${insuranceClaimDate(record.resolvedDate)}</dd></div>` : ''}${record.paidAmount !== null && record.paidAmount !== undefined && record.paidAmount !== '' ? `<div class="insurance-claim-payout"><dt>Vyplaceno</dt><dd>${money(record.paidAmount)}</dd></div>` : ''}</dl>
    ${record.nextStep || record.nextDate ? `<div class="insurance-claim-next ${overdue ? 'overdue' : ''}"><b>${record.nextDate ? `${overdue ? 'Po termínu · ' : ''}${insuranceClaimDate(record.nextDate)}` : 'Další krok'}</b>${record.nextStep ? `<span>${esc(record.nextStep)}</span>` : ''}</div>` : ''}
    <div class="insurance-claim-card-footer"><span class="note">${(record.history || []).length} záznamů · ${(record.attachments || []).length} příloh</span>${insuranceClaimOpenButton(record,'Otevřít','btn slim')}</div>
  </article>`;
}
function renderInsuranceClaims() {
  const el = byId('insuranceClaims');
  if (!el) return;
  el.innerHTML = `<div class="card insurance-claims-shell"><div class="toolbar"><div><div class="eyebrow">Servis klientům</div><h2>Pojistné události</h2></div><button type="button" class="btn primary" onclick="openInsuranceClaim()">+ Pojistná událost</button></div><div id="icSummary" class="insurance-claim-summary"></div>
    <div class="insurance-claim-filters"><label class="field"><span>Hledat</span><input id="icFilterQuery" type="search" placeholder="Klient, událost, pojišťovna…" value="${esc(insuranceClaimFilters.query)}" oninput="insuranceClaimSetFilter('query',this.value)"></label>
    <label class="field"><span>Zobrazení</span><select id="icFilterScope" onchange="insuranceClaimSetFilter('scope',this.value)"><option value="open">V řešení</option><option value="all">Všechny události</option><option value="closed">Uzavřené</option></select></label>
    <label class="field"><span>Druh pojištění</span><select id="icFilterCategory" onchange="insuranceClaimSetFilter('category',this.value)"><option value="">Všechny druhy</option>${INSURANCE_CLAIM_CATEGORIES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
    <label class="field"><span>Stav</span><select id="icFilterStatus" onchange="insuranceClaimSetFilter('status',this.value)"><option value="">Všechny stavy</option>${Object.entries(INSURANCE_CLAIM_STATUSES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <label class="field"><span>Řadit podle</span><select id="icFilterSort" onchange="insuranceClaimSetFilter('sort',this.value)"><option value="next">Nejbližší další krok</option><option value="incident">Data události – nejnovější</option><option value="recorded">Data evidence – nejnovější</option><option value="updated">Poslední změny</option></select></label></div>
    <div id="icBoardResults" aria-live="polite"></div></div>`;
  Object.entries({scope:'icFilterScope',category:'icFilterCategory',status:'icFilterStatus',sort:'icFilterSort'}).forEach(([key,id])=>{byId(id).value=insuranceClaimFilters[key];});
  renderInsuranceClaimBoard();
}
function insuranceClaimSetFilter(key,value) {
  if (!(key in insuranceClaimFilters)) return;
  insuranceClaimFilters[key] = value;
  // Selecting a concrete stage also reveals it when it belongs to the opposite group.
  if (key === 'status' && value) insuranceClaimFilters.scope = 'all';
  if (key === 'scope') {insuranceClaimFilters.status='';if(byId('icFilterStatus'))byId('icFilterStatus').value='';}
  if(byId('icFilterScope'))byId('icFilterScope').value=insuranceClaimFilters.scope;
  renderInsuranceClaimBoard();
}
function renderInsuranceClaimBoard() {
  const target=byId('icBoardResults');if(!target)return;
  const all=insuranceClaimRows(),closed=all.filter(x=>INSURANCE_CLAIM_CLOSED.has(x.status));
  byId('icSummary').innerHTML=`<div><span>V řešení</span><b>${all.length-closed.length}</b></div><div><span>Uzavřené události</span><b>${closed.length}</b></div><div><span>Vyplaceno · všechny události</span><b>${money(all.reduce((sum,x)=>sum+(Number(x.paidAmount)||0),0))}</b></div>`;
  const f=insuranceClaimFilters,q=norm(f.query),rows=all.filter(x=>{
    if(f.scope==='open'&&INSURANCE_CLAIM_CLOSED.has(x.status))return false;
    if(f.scope==='closed'&&!INSURANCE_CLAIM_CLOSED.has(x.status))return false;
    return (!f.category||x.category===f.category)&&(!f.status||x.status===f.status)&&(!q||norm([insuranceClaimClientName(x.clientId),x.title,x.insurer,x.claimNumber,x.description,x.nextStep].join(' ')).includes(q));
  }).sort((a,b)=>{
    if(f.sort==='next')return String(a.nextDate||'9999').localeCompare(String(b.nextDate||'9999'))||String(b.recordedDate||'').localeCompare(String(a.recordedDate||''));
    const key={incident:'incidentDate',recorded:'recordedDate',updated:'updatedAt'}[f.sort]||'recordedDate';return String(b[key]||'').localeCompare(String(a[key]||''));
  });
  const statuses=[...Object.keys(INSURANCE_CLAIM_STATUSES),...(rows.some(x=>insuranceClaimStageKey(x)==='unknown')?['unknown']:[])].filter(s=>(!f.status||s===f.status)&&(f.scope==='all'||(f.scope==='closed')===INSURANCE_CLAIM_CLOSED.has(s)));
  target.innerHTML=`<div class="insurance-claim-result-note note">${rows.length} událostí${rows.length!==all.length?` z ${all.length}`:''}</div>${all.length ? '' : '<p class="insurance-claim-empty">Zatím žádné pojistné události. První založte tlačítkem výše nebo přímo u klienta.</p>'}<div class="insurance-claims-board" style="--claim-columns:${Math.max(statuses.length,1)}">${statuses.map(status=>{const list=rows.filter(x=>insuranceClaimStageKey(x)===status);return `<section class="insurance-claim-column ic-status-${status}"><header><h3>${esc(insuranceClaimStatus(status))}</h3><span>${list.length}</span></header><div class="insurance-claim-cards">${list.map(insuranceClaimCard).join('')||'<p class="insurance-claim-empty">Žádná událost</p>'}</div></section>`;}).join('')}</div>`;
}
function clientInsuranceClaimsHtml(clientId) {
  const rows=insuranceClaimRows(clientId).sort((a,b)=>String(b.recordedDate||'').localeCompare(String(a.recordedDate||''))),open=rows.filter(x=>!INSURANCE_CLAIM_CLOSED.has(x.status));
  return `<section class="mini-card insurance-client-claims"><div class="toolbar"><div><h3>Pojistné události <span class="note">${rows.length}</span></h3><p class="note">V řešení ${open.length} · Vyplaceno ${money(rows.reduce((sum,x)=>sum+(Number(x.paidAmount)||0),0))}</p></div><button type="button" class="btn primary" data-client="${esc(clientId)}" onclick="openInsuranceClaim(this.dataset.client)">+ Pojistná událost</button></div>${rows.length?`<div class="insurance-client-claim-list">${rows.map(x=>`<article><div class="insurance-client-claim-main">${insuranceClaimOpenButton(x,x.title||'Pojistná událost','insurance-claim-title')}<p>${esc(x.category||'Ostatní')}${x.insurer?' · '+esc(x.insurer):''}</p><div class="note">Událost: ${insuranceClaimDate(x.incidentDate)} · Evidence: ${insuranceClaimDate(x.recordedDate)}${x.resolvedDate?' · Uzavřeno: '+insuranceClaimDate(x.resolvedDate):''}</div>${x.outcome?`<p class="insurance-claim-outcome">${esc(x.outcome)}</p>`:''}</div><div class="insurance-client-claim-result">${insuranceClaimBadge(x.status)}<b>Vyplaceno: ${insuranceClaimAmount(x.paidAmount)}</b><span class="note">${(x.history||[]).length} záznamů · ${(x.attachments||[]).length} příloh</span>${insuranceClaimOpenButton(x,'Detail a historie','btn slim')}</div></article>`).join('')}</div>`:'<p class="insurance-claim-empty">U klienta zatím není evidována pojistná událost.</p>'}</section>`;
}
function insuranceClaimField(key,label,type='text',options={}) {
  const id=INSURANCE_CLAIM_INPUTS[key],value=insuranceClaimEditor.record[key]??'',full=options.full?' full':'';
  return `<label class="field${full}" for="${id}"><span>${esc(label)}</span>${type==='textarea'?`<textarea id="${id}" rows="${options.rows||3}" maxlength="20000">${esc(value)}</textarea>`:`<input id="${id}" type="${type}" value="${esc(value)}" ${options.required?'required ':''}${options.money?'inputmode="decimal" placeholder="Neuvedeno" ':''}${type==='text'?'maxlength="300" ':''}>`}</label>`;
}
function openInsuranceClaim(clientId=null,id=null) {
  if(insuranceClaimEditor&&byId('insuranceClaimModal')?.classList.contains('show')&&!closeInsuranceClaim())return;
  const saved=id!=null?insuranceClaimFind(id):null;
  if(id!=null&&!saved)return alert('Pojistná událost už není v evidenci.');
  const now=new Date().toISOString(),day=insuranceClaimToday(),record=saved?JSON.parse(JSON.stringify(saved)):{id:null,syncId:'',clientId:findClient(clientId)?.id??null,contractId:null,title:'',category:'Životní',status:'reported',incidentDate:'',recordedDate:day,reportedDate:'',sentDate:'',resolvedDate:'',insurer:'',claimNumber:'',description:'',requestedAmount:null,paidAmount:null,outcome:'',nextStep:'',nextDate:'',history:[],attachments:[],createdAt:now,updatedAt:now};
  insuranceClaimEditor={record,original:saved?JSON.stringify(saved):null,originalRevision:insuranceClaimRevisionSignature(saved),baseline:'',pending:0,token:Symbol('claim'),lastFocus:document.activeElement};
  let modal=byId('insuranceClaimModal');if(!modal){modal=document.createElement('div');modal.id='insuranceClaimModal';modal.className='modal';document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target===modal)closeInsuranceClaim();});}
  const clientOptions=[...(state.clients||[])].sort((a,b)=>clientName(a).localeCompare(clientName(b),'cs')).map(c=>`<option value="${esc(c.id)}">${esc(clientName(c))}</option>`).join('');
  modal.innerHTML=`<div class="modal-box wide" role="dialog" aria-modal="true" aria-labelledby="icModalTitle"><form id="insuranceClaimForm" onsubmit="event.preventDefault();saveInsuranceClaim()"><div class="toolbar"><div><div class="eyebrow">Pojistné události</div><h2 id="icModalTitle">${saved?'Detail pojistné události':'Nová pojistná událost'}</h2></div><button class="btn" type="button" onclick="closeInsuranceClaim()" aria-label="Zavřít pojistnou událost">Zavřít</button></div>
    <div class="form-grid insurance-claim-form"><label class="field"><span>Klient *</span><select id="icClient" required onchange="insuranceClaimClientChanged()"><option value="">Vyberte klienta</option>${clientOptions}</select></label>${insuranceClaimField('title','Název události *','text',{required:true})}<label class="field"><span>Druh pojištění</span><select id="icCategory">${INSURANCE_CLAIM_CATEGORIES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
    <label class="field"><span>Pojistná smlouva · volitelné</span><select id="icContract" onchange="insuranceClaimContractChanged()"></select></label>${insuranceClaimField('insurer','Pojišťovna')}${insuranceClaimField('claimNumber','Číslo události u pojišťovny')}
    <label class="field"><span>Stav řešení</span><select id="icStatus" onchange="insuranceClaimStatusChanged()">${Object.entries(INSURANCE_CLAIM_STATUSES).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join('')}</select></label>${insuranceClaimField('incidentDate','Kdy se událost stala','date')}${insuranceClaimField('recordedDate','Zaevidováno v CRM','date',{required:true})}
    ${insuranceClaimField('description','Co se stalo','textarea',{full:true,rows:3})}${insuranceClaimField('reportedDate','Nahlášeno pojišťovně','date')}${insuranceClaimField('sentDate','Podklady odeslány pojišťovně','date')}${insuranceClaimField('resolvedDate','Datum uzavření události','date')}
    ${insuranceClaimField('requestedAmount','Požadované plnění (Kč)','text',{money:true})}${insuranceClaimField('paidAmount','Skutečně vyplaceno (Kč)','text',{money:true})}<p class="note insurance-claim-help">Částku vyplňte, pokud je známá. Prázdné pole znamená neuvedeno, nula znamená bez výplaty.</p>${insuranceClaimField('outcome','Výsledek řešení / důvod zamítnutí','textarea',{full:true,rows:2})}${insuranceClaimField('nextStep','Další krok')}${insuranceClaimField('nextDate','Termín dalšího kroku','date')}
    </div><section class="insurance-claim-log-editor"><h3>Nový záznam a podklady</h3><div class="insurance-claim-note-grid"><label class="field"><span>Datum záznamu</span><input id="icEventDate" type="date" value="${day}"></label><label class="field"><span>Poznámka k aktuální fázi</span><textarea id="icEventNote" rows="2" maxlength="20000" placeholder="Např. klient dodal lékařskou zprávu, čekáme na rozhodnutí…"></textarea></label></div><div class="insurance-claim-upload"><label class="btn" for="icAttachmentInput">+ PDF nebo obrázek<input id="icAttachmentInput" type="file" multiple accept="application/pdf,image/png,image/jpeg,image/gif,image/webp" onchange="addInsuranceClaimAttachments(this.files)"></label><span class="note">Nejvýše 8 MB na soubor; celkový objem závisí na volném místě v prohlížeči. Přílohy se uloží spolu s událostí.</span></div><div id="icAttachments" class="insurance-claim-attachments"></div></section>
    <details class="insurance-claim-history" ${saved?'open':''}><summary>Historie řešení <span>${(record.history||[]).length}</span></summary><div id="icHistory"></div></details><p id="icError" class="insurance-claim-error" role="alert" hidden></p><div class="insurance-claim-save-bar"><span id="icSaveHint" class="note">Změny a podklady potvrďte uložením.</span><button type="button" class="btn" onclick="closeInsuranceClaim()">Zavřít</button><button id="icSave" class="btn primary" type="submit">Uložit událost</button></div></form></div>`;
  byId('icClient').value=record.clientId??'';byId('icCategory').value=INSURANCE_CLAIM_CATEGORIES.includes(record.category)?record.category:'Ostatní';byId('icStatus').value=insuranceClaimKnownStatus(record.status)?record.status:'reported';
  insuranceClaimFillContracts(record.contractId);renderInsuranceClaimAttachments();renderInsuranceClaimHistory();
  openModal('insuranceClaimModal');insuranceClaimEditor.baseline=insuranceClaimDraftSignature();
  byId('icTitle').focus();
}
function insuranceClaimFillContracts(selected=null) {
  const client=byId('icClient').value,contracts=(state.contracts||[]).filter(x=>String(x.clientId)===String(client));
  // Include all client contracts so older imports with a nonstandard type can be linked too.
  byId('icContract').innerHTML='<option value="">Bez propojené smlouvy</option>'+contracts.map(x=>`<option value="${esc(x.id)}">${esc([x.company,x.product||x.type,x.number].filter(Boolean).join(' · '))}</option>`).join('');
  byId('icContract').value=selected??'';if(byId('icContract').selectedIndex<0)byId('icContract').value='';
}
function insuranceClaimClientChanged() { insuranceClaimFillContracts(); }
function insuranceClaimContractChanged() {
  const s=(state.contracts||[]).find(x=>String(x.id)===byId('icContract').value&&String(x.clientId)===byId('icClient').value);if(!s)return;
  if(s.company)byId('icInsurer').value=s.company;
  const category={'život':'Životní',auto:'Auto',majetek:'Majetek'}[s.type];if(category)byId('icCategory').value=category;
}
function insuranceClaimStatusChanged() {
  const status=byId('icStatus').value,date=byId('icEventDate').value||insuranceClaimToday();
  if(status==='sent'&&!byId('icSentDate').value)byId('icSentDate').value=date;
  if(INSURANCE_CLAIM_CLOSED.has(status)&&!byId('icResolvedDate').value)byId('icResolvedDate').value=date;
  if(!INSURANCE_CLAIM_CLOSED.has(status))byId('icResolvedDate').value='';
}
function insuranceClaimDraftValues() {
  return Object.fromEntries(Object.entries(INSURANCE_CLAIM_INPUTS).map(([key,id])=>[key,byId(id)?.value??'']));
}
function insuranceClaimDraftSignature() {
  return JSON.stringify({fields:insuranceClaimDraftValues(),note:byId('icEventNote')?.value||'',date:byId('icEventDate')?.value||'',attachments:(insuranceClaimEditor?.record.attachments||[]).map(x=>[x.id,x.name,x.size,x.createdAt])});
}
function insuranceClaimIsDirty() {return !!insuranceClaimEditor&&(insuranceClaimEditor.pending>0||insuranceClaimDraftSignature()!==insuranceClaimEditor.baseline);}
function closeInsuranceClaim(force=false) {
  const editor=insuranceClaimEditor;
  if(!force&&editor?.pending){insuranceClaimError('Přílohy se ještě načítají. Vyčkejte prosím na dokončení.');return false;}
  if(!force&&insuranceClaimIsDirty()&&!confirm('Zavřít bez uložení? Rozepsané změny a nově přidané podklady budou zahozeny.'))return false;
  if(byId('insuranceClaimModal'))closeModal('insuranceClaimModal');insuranceClaimEditor=null;
  if(editor?.lastFocus?.isConnected)editor.lastFocus.focus();return true;
}
function insuranceClaimError(message) {const el=byId('icError');if(el){el.textContent=message;el.hidden=!message;}}
function insuranceClaimNumberInput(value,label) {
  if(!String(value).trim())return null;
  const clean=String(value).trim().replace(/[\s\u00a0\u202f]/g,'').replace(/Kč$/i,'').replace(',','.');
  if(!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(clean)||!Number.isFinite(Number(clean)))throw new Error(`${label}: zadejte nezápornou částku v Kč, nejvýše se dvěma desetinnými místy.`);
  return Number(clean);
}
function insuranceClaimValidDate(value) {
  if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(`${value}T12:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function insuranceClaimChangeValue(key,value) {
  if(value===null||value===undefined||value==='')return 'neuvedeno';
  if(key==='status')return insuranceClaimStatus(value);
  if(key==='clientId')return insuranceClaimClientName(value);
  if(key==='contractId'){const s=(state.contracts||[]).find(x=>String(x.id)===String(value));return s?[s.company,s.product||s.type,s.number].filter(Boolean).join(' · '):'smlouva '+value;}
  if(key.endsWith('Amount'))return money(value);
  if(key.endsWith('Date'))return insuranceClaimDate(value);
  return String(value);
}
function saveInsuranceClaim() {
  const editor=insuranceClaimEditor;if(!editor)return false;
  insuranceClaimError('');if(editor.pending){insuranceClaimError('Přílohy se ještě načítají. Poté událost uložte.');return false;}
  const form=byId('insuranceClaimForm');if(!form.reportValidity())return false;
  const raw=insuranceClaimDraftValues(),client=findClient(raw.clientId);if(!client){insuranceClaimError('Vyberte existujícího klienta.');return false;}
  const contract=raw.contractId?(state.contracts||[]).find(x=>String(x.id)===raw.contractId&&String(x.clientId)===String(client.id)):null;
  if(raw.contractId&&!contract){insuranceClaimError('Vybraná smlouva nepatří klientovi. Vyberte smlouvu znovu.');return false;}
  if(!raw.title.trim()){insuranceClaimError('Doplňte krátký název události.');return false;}
  if(!insuranceClaimKnownStatus(raw.status)||!INSURANCE_CLAIM_CATEGORIES.includes(raw.category)){insuranceClaimError('Vyberte platný stav a druh pojištění.');return false;}
  const eventDate=byId('icEventDate').value||insuranceClaimToday();
  if(!insuranceClaimValidDate(eventDate)||Object.entries(raw).some(([key,value])=>key.endsWith('Date')&&!insuranceClaimValidDate(value))){insuranceClaimError('Zkontrolujte zadaná data.');return false;}
  if(INSURANCE_CLAIM_CLOSED.has(raw.status)&&!raw.resolvedDate){insuranceClaimError('U uzavřené události doplňte datum uzavření.');return false;}
  if(!INSURANCE_CLAIM_CLOSED.has(raw.status)&&raw.resolvedDate){insuranceClaimError('Datum uzavření patří k vyřízené, zamítnuté nebo zrušené události.');return false;}
  let requested,paid;try{requested=insuranceClaimNumberInput(raw.requestedAmount,'Požadované plnění');paid=insuranceClaimNumberInput(raw.paidAmount,'Vyplaceno');}catch(e){insuranceClaimError(e.message);return false;}
  const existing=editor.record.id!=null?insuranceClaimFind(editor.record.id):null;
  if(editor.originalRevision!==null&&(!existing||insuranceClaimRevisionSignature(existing)!==editor.originalRevision)){insuranceClaimError('Tato událost se mezitím změnila. Vaše rozepsané údaje zůstávají v okně; nejprve ověřte aktuální záznam.');return false;}
  const now=new Date().toISOString(),next={...editor.record,...raw,clientId:client.id,contractId:contract?.id??null,title:raw.title.trim(),requestedAmount:requested,paidAmount:paid,updatedAt:now};
  if(existing)next.attachments=(next.attachments||[]).map(a=>{const current=(existing.attachments||[]).find(x=>String(x.id)===String(a.id)&&(x.dataUrl||x.fileRef||'')===(a.dataUrl||a.fileRef||''));return current?{...current,...a,fileRef:current.fileRef||a.fileRef,storage:current.storage||a.storage,savedAt:current.savedAt||a.savedAt}:a;});
  if(!existing){next.id=uid();next.syncId=typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():`claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;next.createdAt=now;}
  const differences=existing?INSURANCE_CLAIM_FIELDS.filter(key=>String(existing[key]??'')!==String(next[key]??'')):[];
  const added=(next.attachments||[]).filter(x=>!(existing?.attachments||[]).some(old=>String(old.id)===String(x.id))),note=byId('icEventNote').value.trim();
  if(existing&&!differences.length&&!added.length&&!note){closeInsuranceClaim(true);return true;}
  const changes=existing?differences.map(key=>`${INSURANCE_CLAIM_LABELS[key]}: ${insuranceClaimChangeValue(key,existing[key])} → ${insuranceClaimChangeValue(key,next[key])}`):['Pojistná událost založena.'];
  if(added.length)changes.push('Přidány podklady: '+added.map(x=>x.name).join(', '));
  if(note)changes.push(note);
  next.history=[...(existing?.history||editor.record.history||[]),{id:uid(),at:now,date:eventDate,status:next.status,text:changes.join('\n')}];
  const previous=state.insuranceClaims||[];
  state.insuranceClaims=existing?previous.map(x=>String(x.id)===String(existing.id)?next:x):[...previous,next];
  let ok=false;try{ok=persist()===true;}catch(e){ok=false;}
  if(!ok){state.insuranceClaims=previous;insuranceClaimError('Uložení se nepodařilo. Rozepsané údaje i podklady zůstaly v tomto okně. '+(added.length?'Odeberte nově přidanou přílohu tlačítkem Odebrat nebo použijte menší PDF či obrázek a zkuste událost uložit znovu.':'Ověřte dostupnost úložiště a zkuste uložit znovu.'));return false;}
  closeInsuranceClaim(true);
  if(byId('insuranceClaims')?.classList.contains('active'))renderInsuranceClaims();
  if(byId('clients')?.classList.contains('active')&&typeof renderClientDetail==='function')renderClientDetail();
  if(typeof toast==='function')toast('Pojistná událost uložena.');return true;
}
function insuranceClaimAttachmentAllowed(file) {
  const type=String(file.type||'').toLowerCase(),name=String(file.name||'');
  return ['application/pdf','image/png','image/jpeg','image/gif','image/webp'].includes(type)||(!type&&/\.(pdf|png|jpe?g|gif|webp)$/i.test(name));
}
async function addInsuranceClaimAttachments(files) {
  const editor=insuranceClaimEditor;if(!editor)return;
  const token=editor.token,list=Array.from(files||[]);if(!list.length)return;
  const status=byId('icStatus').value,eventDate=byId('icEventDate').value||insuranceClaimToday();
  editor.pending++;byId('icSave').disabled=true;byId('icSaveHint').textContent='Načítání podkladů…';insuranceClaimError('');
  const errors=[];
  try {
    for(const file of list){
      if(!insuranceClaimAttachmentAllowed(file)){errors.push(`${file.name}: lze přidat PDF, PNG, JPG, GIF nebo WebP.`);continue;}
      if(file.size>8*1024*1024){errors.push(`${file.name}: soubor překračuje 8 MB.`);continue;}
      try{
        const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Soubor nelze přečíst.'));reader.onabort=()=>reject(new Error('Načítání bylo přerušeno.'));const mime=file.type||({pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'}[String(file.name).split('.').pop().toLowerCase()]);reader.readAsDataURL(file.type?file:file.slice(0,file.size,mime));});
        if(insuranceClaimEditor?.token!==token)return;
        if(!/^data:(application\/pdf|image\/(png|jpeg|gif|webp));base64,/i.test(String(dataUrl))){errors.push(`${file.name}: nepodporovaný obsah souboru.`);continue;}
        editor.record.attachments=[...(editor.record.attachments||[]),{id:uid(),name:file.name,type:String(dataUrl).slice(5,String(dataUrl).indexOf(';')),size:file.size,dataUrl,createdAt:new Date().toISOString(),date:eventDate,status}];
      }catch(e){errors.push(`${file.name}: načtení se nepodařilo.`);}
    }
  } finally {
    if(insuranceClaimEditor?.token===token){editor.pending--;byId('icSave').disabled=editor.pending>0;byId('icSaveHint').textContent=editor.pending?'Načítání podkladů…':'Změny a podklady potvrďte uložením.';byId('icAttachmentInput').value='';renderInsuranceClaimAttachments();if(errors.length)insuranceClaimError(errors.join(' '));}
  }
}
function renderInsuranceClaimAttachments() {
  const el=byId('icAttachments');if(!el||!insuranceClaimEditor)return;
  const original=insuranceClaimEditor.original?JSON.parse(insuranceClaimEditor.original):null;
  el.innerHTML=(insuranceClaimEditor.record.attachments||[]).map((a,index)=>{const isNew=!(original?.attachments||[]).some(x=>String(x.id)===String(a.id));return `<div class="insurance-claim-attachment"><span class="insurance-claim-file-icon">${a.type==='application/pdf'?'PDF':'IMG'}</span><div><b>${esc(a.name||'Příloha')}</b><span class="note">${esc(insuranceClaimStatus(a.status))} · ${insuranceClaimDate(a.date||String(a.createdAt||'').slice(0,10))}${isNew?' · připraveno k uložení':''}</span></div><div class="actions"><button type="button" class="btn slim" onclick="openInsuranceClaimAttachment(${index})">Otevřít</button><button type="button" class="btn slim" onclick="downloadInsuranceClaimAttachment(${index})">Stáhnout</button>${isNew?`<button type="button" class="btn slim" onclick="removeInsuranceClaimDraftAttachment(${index})">Odebrat</button>`:''}</div></div>`;}).join('')||'<p class="note">Zatím bez podkladů.</p>';
}
function removeInsuranceClaimDraftAttachment(index) {
  const editor=insuranceClaimEditor,a=editor?.record.attachments?.[index];if(!a)return;
  const original=editor.original?JSON.parse(editor.original):null;if((original?.attachments||[]).some(x=>String(x.id)===String(a.id)))return;
  editor.record.attachments.splice(index,1);renderInsuranceClaimAttachments();
}
function insuranceClaimAttachmentUrl(index) {
  const a=insuranceClaimEditor?.record.attachments?.[index];if(!a)return null;
  if(!insuranceClaimAttachmentAllowed(a))return null;
  // Imported data URLs must never open HTML/SVG/script content.
  if(a.dataUrl&&!/^data:(application\/pdf|image\/(png|jpeg|gif|webp));base64,/i.test(a.dataUrl))return null;
  const url=attachmentBlobUrl(a.dataUrl ? {...a,fileRef:null} : a);
  if(!url||!/^(blob:|data:(application\/pdf|image\/(png|jpeg|gif|webp));base64,|https?:\/\/)/i.test(url))return null;
  return {a,url};
}
function openInsuranceClaimAttachment(index) {
  const item=insuranceClaimAttachmentUrl(index);if(!item){insuranceClaimError('Přílohu nelze otevřít. Ověřte dostupnost souboru v úložišti.');return;}
  const link=document.createElement('a');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';document.body.appendChild(link);link.click();link.remove();if(item.url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(item.url),300000);
}
function downloadInsuranceClaimAttachment(index) {
  const item=insuranceClaimAttachmentUrl(index);if(!item){insuranceClaimError('Přílohu nelze stáhnout. Ověřte dostupnost souboru v úložišti.');return;}
  const link=document.createElement('a');link.href=item.url;link.download=item.a.name||'priloha';link.rel='noopener';document.body.appendChild(link);link.click();link.remove();if(item.url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(item.url),1000);
}
function renderInsuranceClaimHistory() {
  const el=byId('icHistory');if(!el||!insuranceClaimEditor)return;
  const history=[...(insuranceClaimEditor.record.history||[])].reverse();
  el.innerHTML=history.map(x=>`<article><div><b>${insuranceClaimDate(x.date||String(x.at||'').slice(0,10))}</b>${insuranceClaimBadge(x.status)}${x.at?`<span class="note">Zapsáno ${esc(new Date(x.at).toLocaleString('cs-CZ'))}</span>`:''}</div><p>${esc(x.text||'')}</p></article>`).join('')||'<p class="note">Historie vznikne po prvním uložení.</p>';
}
window.addEventListener('beforeunload',e=>{if(insuranceClaimEditor&&insuranceClaimIsDirty()){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{
  const modal=document.getElementById('insuranceClaimModal');if(!modal?.classList.contains('show'))return;
  if(e.key==='Escape'){e.preventDefault();closeInsuranceClaim();return;}
  if(e.key==='Tab'){
    const items=[...modal.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary')].filter(x=>x.getClientRects().length);
    const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  }
});
