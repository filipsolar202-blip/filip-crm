// Pending subscriptions stay visible without being presented as settled assets.
const investmentSettlementTabs = {fki:'active',investice:'active'};
function settlementAction(action,kind,id) {
  return esc(`${action}(${JSON.stringify(kind)},${JSON.stringify(String(id))})`);
}
function investmentPendingPanel(clientId=null,area='',compact=false) {
  const company=clientId!=null&&area?clientProviderSelection(area,clientId):'',
    rows=investmentPendingRows(clientId,area).filter(r=>!company||(r.company||'Bez společnosti')===company),
    total=rows.reduce((sum,r)=>sum+(+r.amount||0),0);
  if(compact&&!rows.length)return '';
  return `<section class="mini-card settlement-panel" data-settlement-area="${esc(area)}"><div class="toolbar"><div><div class="eyebrow">Nakoupeno</div><h3>Čeká na připsání</h3><p class="note">Sjednané prostředky čekají na potvrzení nákupu${area==='investice'?'':' / emise'}. Nejsou součástí AUM ani výnosu; samotný podpis nepotvrzuje odeslání peněz.</p></div><div class="metric"><small>Čekající částka</small><b data-pending-total="${total}">${money(total)}</b></div></div><div class="table-wrap"><table class="compact-table"><thead><tr>${clientId==null?'<th>Klient</th>':''}<th>Fond / společnost</th><th>Sjednáno</th><th>Datum obchodu</th><th>Nákup / emise</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${rows.map(r=>`<tr data-pending-id="${esc(r.id)}">${clientId==null?`<td><button class="case-title" onclick="openClientWorkspace(${Number(r.clientId)},'pendingInvestments')">${esc(clientName(findClient(r.clientId)))}</button></td>`:''}<td><b>${esc(r.product)}</b><br><span class="note">${esc([r.company,r.isin].filter(Boolean).join(' · '))}</span></td><td class="money">${money(r.amount)}</td><td>${esc(r.tradeDate?liquidity_fmtDate(r.tradeDate):'Neuvedeno')}</td><td>Nákup: ${esc(r.purchaseDate?liquidity_fmtDate(r.purchaseDate):'Neznámé')}${r.area==='fki'?`<br>Emise: ${esc(r.emissionDate?liquidity_fmtDate(r.emissionDate):'Neznámé')}`:''}</td><td><span class="badge orange">${esc(r.reason||'Čeká na připsání')}</span></td><td><div class="actions"><button class="btn slim primary" onclick="${settlementAction('openPendingInvestment',r.kind,r.id)}">Doplnit údaje</button><button class="btn slim red" onclick="${settlementAction('deletePendingInvestment',r.kind,r.id)}">Smazat</button></div></td></tr>`).join('')||`<tr><td colspan="${clientId==null?7:6}" class="note">Žádné investice nečekají na doplnění nákupu nebo emise.</td></tr>`}</tbody></table></div></section>`;
}
function investmentSettlementAumHeader(area,active) {
  const waiting=investmentPendingRows(null,area).reduce((sum,r)=>sum+(+r.amount||0),0),tab=investmentSettlementTabs[area]||'active';
  return `<div class="settlement-summary"><div class="metric"><small>Investováno · aktuální AUM</small><b data-settled-aum="${active}">${money(active)}</b></div><div class="metric"><small>Nakoupeno · čeká na připsání</small><b data-pending-aum="${waiting}">${money(waiting)}</b></div></div><div class="subnav" aria-label="Stav investic"><button class="subtab ${tab==='active'?'active':''}" onclick="setInvestmentSettlementTab('${area}','active')">Investováno</button><button class="subtab ${tab==='pending'?'active':''}" onclick="setInvestmentSettlementTab('${area}','pending')">Čeká na připsání</button></div>`;
}
function setInvestmentSettlementTab(area,tab) {
  if(!['fki','investice'].includes(area))return;
  investmentSettlementTabs[area]=tab==='pending'?'pending':'active';
  if(area==='fki')renderFk();else renderInvestments();
}
function pendingInvestmentById(kind,id) {
  return investmentPendingRows().find(r=>r.kind===kind&&String(r.id)===String(id));
}
function openPendingInvestment(kind,id) {
  const row=pendingInvestmentById(kind,id);
  if(!row)return alert('Investice již nečeká na doplnění. Obnov přehled.');
  if(kind==='record')return openFkRecordModal(row.clientId,encodeURIComponent(invPositionKey(row.source)),encodeURIComponent(invRecordKey(row.source)));
  if(kind==='snapshot')return openInvestmentSnapshotById(row.source.id);
  let modal=byId('investmentSettlementModal');
  if(!modal){modal=document.createElement('div');modal.id='investmentSettlementModal';modal.className='modal';document.body.appendChild(modal);}
  modal.dataset.kind=kind;modal.dataset.sourceId=String(id);
  modal.innerHTML=`<div class="modal-box"><div class="toolbar"><h2>Potvrzení nákupu</h2><button class="btn" onclick="closeModal('investmentSettlementModal')">Zavřít</button></div><p><b>${esc(row.product)}</b> · ${money(row.amount)}</p><p class="note">Datum obchodu zůstane ${esc(row.tradeDate?liquidity_fmtDate(row.tradeDate):'neuvedené')}. Doplň pouze skutečné datum podle potvrzení; prázdné datum ponechá investici v čekání.</p><div class="form-grid"><div class="field"><label for="settlementPurchaseDate">Datum nákupu / připsání</label><input id="settlementPurchaseDate" type="date" value="${esc(row.purchaseDate||'')}"></div>${row.area==='fki'?`<div class="field"><label for="settlementEmissionDate">Datum emise</label><input id="settlementEmissionDate" type="date" value="${esc(row.emissionDate||'')}"></div>`:''}</div><div class="actions"><button class="btn primary" onclick="savePendingInvestmentDates()">Uložit údaje</button></div></div>`;
  openModal('investmentSettlementModal');
}
function savePendingInvestmentDates() {
  const modal=byId('investmentSettlementModal');
  if(settleInvestmentPurchase(modal.dataset.kind,modal.dataset.sourceId,val('settlementPurchaseDate'),val('settlementEmissionDate'))) {
    closeModal('investmentSettlementModal');renderAll();saveToast('Údaje o připsání uloženy');
  }
}
function deletePendingInvestment(kind,id) {
  const row=pendingInvestmentById(kind,id);
  if(!row)return;
  if(kind==='record')return deleteFkiRecordByKey(encodeURIComponent(invRecordKey(row.source)),row.clientId);
  if(kind==='snapshot')return deleteInvestmentSnapshot(row.source.id);
  if(kind==='deal')return deleteDeal(row.source.id);
  if(kind==='contract')return deleteContract(row.source.id);
}
function openInvestmentSnapshotById(id) {
  const snapshot=(state.investmentSnapshots||[]).find(s=>String(s.id)===String(id));
  if(!snapshot)return alert('Aktualizace už není v evidenci.');
  fillClientSelect('isClient',snapshot.clientId);setVal('isClient',snapshot.clientId);
  fillInvestmentProductSelect('__snapshot:'+snapshot.id);
  openModal('investmentSnapshotModal');
}
function updateInvestmentSettlementHint() {
  const purchase=val('fkRecPaymentDate'),emission=val('fkRecEmissionDate'),withdrawal=invIsWithdrawal({'Typ transakce':val('fkRecTx')});
  const area=investmentRecordArea({'Typ produktu':val('fkRecType')}),fkiInfo=investmentSettlementInfo({purchaseDate:purchase,emissionDate:emission},area);
  setText('fkRecSettlementHint',withdrawal?'Datum odkupu nemění datum původního nákupu.':fkiInfo.pending?'Nakoupeno – čeká na připsání. '+fkiInfo.reason+' Částka zůstává mimo AUM a výnos.':area==='fki'?'Datum nákupu a emise jsou vyplněné. Investice může být zahrnuta do AUM.':'Datum nákupu je vyplněné. Investice může být zahrnuta do AUM.');
  const scope=val('isSnapshotScope'),info=investmentSettlementInfo({purchaseDate:val('isPurchaseDate')});
  setText('isSettlementHint',scope==='provider-total'?'Souhrnný potvrzený výpis producenta eviduje zůstatek účtu. Není jednotlivou nákupní transakcí.':info.pending?'Nakoupeno – čeká na připsání. '+info.reason+' Částka nevstupuje do AUM ani výnosu.':scope==='purchase'?'Údaje této nákupní pozice se přičítají k dřívějším potvrzeným investicím.':'Celková hodnota fondu k uvedenému datu má zahrnovat i všechny již připsané dokupy.');
}
function investmentPendingClientNotice(clientId) {
  const rows=investmentPendingRows(clientId),total=rows.reduce((sum,r)=>sum+(+r.amount||0),0);
  if(!rows.length||clientSection==='pendingInvestments')return '';
  return `<div class="notice small settlement-client-notice"><b>Nakoupeno – čeká na připsání: ${money(total)}</b><span> ${num(rows.length)} položek mimo AUM.</span> <button class="btn slim" onclick="clientSection='pendingInvestments';renderClientDetail()">Zkontrolovat nákupy</button></div>`;
}
