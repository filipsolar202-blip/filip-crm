function renderAll() {
  fkiSync_syncCrmFkiDealsToRecords();
  renderVersion();
  relinkAllStrongIdentities();
  persist();
  fillYears();
  fillPeopleList();
  [['Dashboard', renderDashboard], ['Klienti', renderClients], ['Poznámky', renderNotes], ['Příležitosti', renderOpportunities], ['Smlouvy', renderContracts], ['Investice', renderInvestments], ['FKI', renderFk], ['Penze', renderPensions], ['Obchody', renderDeals], ['Reporty', renderReports], ['Typaři', renderReferrerHub], ['Roční plán', renderPlanForm], ['Plnění plánu', renderPlanProgress], ['Segmenty plánu', renderPlanSegments], ['Provize plánu', renderPlanCommission], ['Nastavení', renderSettings]].forEach(x => renderPart(x[0], x[1]));
}
// Shared file delivery for all client-facing HTML outputs.
function downloadHtmlFile(html, filename) {
  const url = URL.createObjectURL(new Blob([html], {type:'text/html;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 1000);
}
function def() {
  const y = new Date().getFullYear();
  return {
    nextId: 1,
    settings: {
      bjCoef: 150
    },
    plans: {
      [y]: {
        bjCoef: 150,
        clients: 0,
        investment: 0,
        mortgage: 0,
        categories: {}
      }
    },
    clients: [],
    contracts: [],
    deals: [],
    activities: [],
    referrals: [],
    referrerPayouts: [],
    notes: [],
    opportunities: [],
    commissionImports: [],
    analysisEntries: [],
    analysisPlans: {},
    contractOpportunityStatuses: {},
    verifiedDuplicates: {},
    investmentRecords: [],
    investmentSnapshots: [],
    fundValues: {},
    lockedFunds: {},
    trailSettings: {},
    createdAt: new Date().toISOString()
  };
}
function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORE) || 'null') || def());
  } catch (e) {
    return def();
  }
}
function normalizeState(s) {
  const base = def();
  s = {
    ...base,
    ...s
  };
  delete s.mailHeaders;
  ['clients', 'contracts', 'deals', 'activities', 'referrals', 'referrerPayouts', 'notes', 'opportunities', 'investmentRecords', 'investmentSnapshots', 'commissionImports', 'analysisEntries'].forEach(k => s[k] = Array.isArray(s[k]) ? s[k] : []);
  ['contractOpportunityStatuses', 'verifiedDuplicates', 'fundValues', 'lockedFunds', 'trailSettings', 'analysisPlans', '_syncMeta'].forEach(k => s[k] = s[k] && typeof s[k] === 'object' ? s[k] : {});
  s.settings = {
    ...base.settings,
    ...(s.settings || {})
  };
  s.plans = s.plans && typeof s.plans === 'object' ? s.plans : base.plans;
  Object.values(s.plans).forEach(p => normalizePlan(p, s.settings.bjCoef));
  dedupeInvestmentRecordsInState(s);
  dedupeInvestmentSnapshotsInState(s);
  let maxId = Math.max(0, ...['clients', 'contracts', 'deals', 'activities', 'referrals', 'referrerPayouts', 'notes', 'opportunities', 'commissionImports', 'investmentSnapshots', 'analysisEntries'].flatMap(k => s[k].map(x => +x.id || 0)));
  if (!s.nextId || s.nextId <= maxId) s.nextId = maxId + 1;
  return s;
}
function normalizePlan(p, bjCoef = 150) {
  p.categories = p.categories || {};
  if (!p.bjCoef) p.bjCoef = bjCoef || 150;
  if (!p.investment && p.categories['Investice']) p.investment = p.categories['Investice'];
  if (!p.mortgage && p.categories['Hypotéky']) p.mortgage = p.categories['Hypotéky'];
  if (!p.unifiedInvestmentPlan) {
    const oldInv = +(p.categories['Investice'] || p.investment || 0),
      oldFki = +(p.categories['FKI'] || p.fki || 0);
    if (oldFki) p.categories['Investice'] = oldInv + oldFki;
    p.unifiedInvestmentPlan = true;
  }
  p.investment = +(p.categories['Investice'] || p.investment || 0);
  p.mortgage = +(p.categories['Hypotéky'] || p.mortgage || 0);
  delete p.categories['FKI'];
  p.fki = 0;
  return p;
}
function persist() {
  state = normalizeState(state);
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
    window.__lastPersistOk = true;
    queueDiskSave();
    return true;
  } catch (e) {
    window.__lastPersistOk = false;
    queueDiskSave();
    alert('Pozor: CRM se nepovedlo uložit do prohlížeče. Diskové úložiště se ještě pokusí data uložit. Pokud diskový pomocník neběží, zkontroluj záložku Záloha.');
    return false;
  }
}
function uid() {
  return state.nextId++;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function normId(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}
function normalizeStrongId(v) {
  if (v == null) return '';
  let s = String(v).trim();
  if (/^[-+]?\d+(?:[\.,]\d+)?e[-+]?\d+$/i.test(s) || typeof v === 'number') {
    const n = Number(String(s).replace(',', '.'));
    if (Number.isFinite(n)) s = Math.round(n).toString();
  }
  return normId(s);
}
function num(n) {
  return new Intl.NumberFormat('cs-CZ', {
    maximumFractionDigits: 0
  }).format(+n || 0);
}
function decimal(n, max = 2) {
  const value = typeof n === 'number' ? n : parseMoney(n);
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: max
  }).format(Number.isFinite(value) ? value : 0);
}
function money(n) {
  return num(n) + ' Kč';
}
function parseMoney(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  let m = String(v).replace(/\s/g, '').replace(/Kč|kc|,-/ig, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return m ? +m[0] : 0;
}
function byId(id) {
  return document.getElementById(id);
}
function val(id) {
  return byId(id)?.value || '';
}
function setVal(id, v) {
  const el = byId(id);
  if (el) el.value = v ?? '';
}
function saveToast(msg) {
  if (window.__lastPersistOk !== false) toast(msg);
}
function localStorageWriteState() {
  try {
    localStorage.setItem(STORE, JSON.stringify(state));
    window.__lastPersistOk = true;
  } catch (e) {
    window.__lastPersistOk = false;
  }
}
function setDiskBanner(html = '') {
  const el = byId('diskBanner');
  if (!el) return;
  if (!html) {
    el.classList.remove('show');
    el.innerHTML = '';
    return;
  }
  el.classList.add('show');
  el.innerHTML = html;
}
function setDiskStorageStatus(html) {
  diskStorageStatus.message = html;
  const el = byId('diskStorageStatus');
  if (el) el.innerHTML = html;
  if (diskStorageStatus.ok) setDiskBanner('');
}
function setDiskBackupStatus(html) {
  const el = byId('diskBackupStatus');
  if (el) el.innerHTML = html;
}
function diskBackupSize(bytes) {
  const n = +bytes || 0;
  if (n > 1024 * 1024) return decimal(n / 1024 / 1024, 1) + ' MB';
  if (n > 1024) return decimal(n / 1024, 1) + ' KB';
  return num(n) + ' B';
}
function diskBackupLabel(b) {
  return `${b.updatedAt || ''} · ${diskBackupSize(b.size)} · ${num(b.counts?.clients || 0)} klientů · ${num(b.counts?.contracts || 0)} smluv · ${num(b.counts?.deals || 0)} obchodů`;
}
function diskFileUrl(ref) {
  return DISK_STORAGE_URL + '/file?ref=' + encodeURIComponent(ref || '');
}
function queueDiskSave(reason = 'autosave') {
  if (!diskLoadDone) return;
  clearTimeout(diskSaveTimer);
  diskSaveTimer = setTimeout(() => saveStateToDisk(reason), 450);
}
async function saveStateToDisk(reason = 'autosave', manual = false) {
  if (diskSaveInFlight) {
    diskSavePending = true;
    return;
  }
  diskSaveInFlight = true;
  diskSavePending = false;
  const sentState = JSON.stringify(state);
  try {
    const response = await fetch(DISK_STORAGE_URL + '/state', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state: JSON.parse(sentState),
        reason,
        backup: true
      }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('disk ' + response.status);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Uložení na disk se nepovedlo.');
    if (payload.state && JSON.stringify(state) === sentState) {
      state = normalizeState(payload.state);
      localStorageWriteState();
    } else if (JSON.stringify(state) !== sentState) {
      // A late response must never replace edits made while the request was in flight.
      diskSavePending = true;
    }
    diskStorageStatus = {
      ok: true,
      checked: true,
      message: `<b>Diskové úložiště funguje.</b><br>Data: ${esc(payload.stateFile || 'FILIP-CRM-data')}<br>Uloženo: ${stateCountsText()} · příloh: ${num(payload.counts?.attachments || 0)}${payload.attachmentsExternalized ? ` · nové soubory na disku: ${num(payload.attachmentsExternalized)}` : ''}`
    };
    setDiskStorageStatus(diskStorageStatus.message);
    if (manual) toast('Disková záloha vytvořená');
  } catch (e) {
    diskStorageStatus = {
      ok: false,
      checked: true,
      message: `<b>Diskové úložiště teď neběží.</b><br>CRM dál drží nouzovou kopii v prohlížeči. Spusť <b>install-local-crm-storage-autostart.command</b> a pak klikni na „Zkontrolovat disk“.`
    };
    setDiskStorageStatus(diskStorageStatus.message);
    if (manual) alert('Diskové úložiště zatím neběží. Spusť install-local-crm-storage-autostart.command a zkus to znovu.');
  } finally {
    diskSaveInFlight = false;
    if (diskSavePending) {
      diskSavePending = false;
      queueDiskSave('navazujici-ulozeni');
    }
  }
}
async function loadStateFromDisk(manual = false) {
  try {
    setDiskStorageStatus('Kontroluji diskové úložiště...');
    const response = await fetch(DISK_STORAGE_URL + '/state', {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('disk ' + response.status);
    const payload = await response.json();
    if (payload.ok && payload.hasState && payload.state) {
      state = normalizeState(payload.state);
      localStorageWriteState();
      diskLoadDone = true;
      diskStorageStatus = {
        ok: true,
        checked: true,
        message: `<b>Načteno z disku.</b><br>Data: ${esc(payload.stateFile || 'FILIP-CRM-data')}<br>${stateCountsText()} · příloh: ${num(payload.counts?.attachments || 0)}`
      };
      setDiskStorageStatus(diskStorageStatus.message);
      renderAll();
      if (manual) toast('Načteno z disku');
      return true;
    }
    if (manual) alert('Na disku zatím není uložený stav CRM.');
    return false;
  } catch (e) {
    diskLoadDone = true;
    diskStorageStatus = {
      ok: false,
      checked: true,
      message: `<b>Diskové úložiště zatím neběží.</b><br>Spusť <b>install-local-crm-storage-autostart.command</b>. Do té doby CRM používá nouzové uložení v prohlížeči.`
    };
    setDiskStorageStatus(diskStorageStatus.message);
    setDiskBanner(`CRM teď nejede z diskové zálohy, ale ze starší kopie v prohlížeči. Proto nemusí najít nové klienty. <button class="btn slim" onclick="loadStateFromDisk(true)">Načíst z disku</button> <button class="btn slim" onclick="showView('settings')">Otevřít Zálohu</button>`);
    if (manual) alert('Diskové úložiště zatím neběží. Spusť install-local-crm-storage-autostart.command a zkus „Načíst z disku“ znovu.');
    return false;
  }
}
async function initDiskStorage() {
  const loaded = await loadStateFromDisk(false);
  if (loaded) {
    setTimeout(autoPullGoogleBackup, 700);
    return;
  }
  try {
    const response = await fetch(DISK_STORAGE_URL + '/status', {
      cache: 'no-store'
    });
    if (response.ok) {
      diskLoadDone = true;
      await saveStateToDisk('prvni-presun-z-prohlizece', false);
      setDiskStorageStatus(`<b>Diskové úložiště založené.</b><br>První lokální data z prohlížeče byla zapsaná do složky FILIP-CRM-data.<br>${stateCountsText()}`);
      setTimeout(autoPullGoogleBackup, 700);
    }
  } catch (e) {}
}
async function refreshDiskBackups() {
  try {
    setDiskBackupStatus('Načítám seznam diskových záloh...');
    const response = await fetch(DISK_STORAGE_URL + '/backups', {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('disk ' + response.status);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Seznam záloh se nepovedlo načíst.');
    const backups = payload.backups || [],
      select = byId('diskBackupSelect');
    if (select) select.innerHTML = backups.map((b, i) => `<option value="${esc(b.name)}">${i === 0 ? 'Nejnovější · ' : ''}${esc(diskBackupLabel(b))}</option>`).join('');
    setDiskBackupStatus(backups.length ? `<b>Na disku je ${num(backups.length)} záloh.</b><br>Nejnovější: ${esc(diskBackupLabel(backups[0]))}` : 'Na disku zatím není žádná samostatná záloha.');
    return backups;
  } catch (e) {
    setDiskBackupStatus('Seznam diskových záloh nejde načíst: ' + e.message);
    return [];
  }
}
async function createDiskBackup(reason = 'manualni-zaloha') {
  const response = await fetch(DISK_STORAGE_URL + '/backup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason
    }),
    cache: 'no-store'
  });
  if (!response.ok) throw new Error('disk ' + response.status);
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || 'Vytvoření samostatné zálohy se nepovedlo.');
  return payload;
}
async function manualDiskBackup() {
  await saveStateToDisk('manualni-zaloha', true);
  try {
    await createDiskBackup('manualni-kopie-aktualniho-crm');
    await refreshDiskBackups();
    toast('Samostatná disková záloha uložená');
  } catch (e) {
    setDiskBackupStatus('Aktuální data jsou uložená, ale samostatná kopie se nepovedla vytvořit: ' + e.message);
  }
}
async function restoreDiskBackupByName(name) {
  if (!name) return alert('Vyber zálohu.');
  if (!confirm('Opravdu obnovit vybranou diskovou zálohu? Aktuální stav CRM se před obnovou uloží jako bezpečnostní kopie.')) return;
  try {
    setDiskBackupStatus('Obnovuji diskovou zálohu...');
    const response = await fetch(DISK_STORAGE_URL + '/restore-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name
      }),
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('disk ' + response.status);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Obnova se nepovedla.');
    state = normalizeState(payload.state);
    localStorageWriteState();
    diskLoadDone = true;
    renderAll();
    setDiskStorageStatus(`<b>Obnoveno z diskové zálohy.</b><br>${stateCountsText()} · příloh: ${num(payload.counts?.attachments || 0)}`);
    setDiskBackupStatus(`<b>Obnova hotová.</b><br>Obnoveno: ${esc(diskBackupLabel(payload.restored || {}))}. Aktuální stav před obnovou je uložený jako bezpečnostní kopie.`);
    toast('Disková záloha obnovena');
  } catch (e) {
    setDiskBackupStatus('Obnova diskové zálohy se nepovedla: ' + e.message);
  }
}
async function restoreSelectedDiskBackup() {
  await restoreDiskBackupByName(val('diskBackupSelect'));
}
async function restoreLatestDiskBackup() {
  const backups = await refreshDiskBackups();
  if (!backups.length) return alert('Na disku zatím není žádná záloha.');
  await restoreDiskBackupByName(backups[0].name);
}
async function checkDiskStorage() {
  try {
    const response = await fetch(DISK_STORAGE_URL + '/status', {
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('disk ' + response.status);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || 'Kontrola se nepovedla.');
    diskStorageStatus = {
      ok: true,
      checked: true,
      message: `<b>Diskové úložiště běží.</b><br>Data: ${esc(payload.baseDir)}<br>Soubor: ${esc(payload.stateFile)}<br>Poslední změna: ${esc(payload.updatedAt || 'zatím bez uložených dat')} · příloh: ${num(payload.counts?.attachments || 0)}`
    };
    setDiskStorageStatus(diskStorageStatus.message);
  } catch (e) {
    diskStorageStatus = {
      ok: false,
      checked: true,
      message: `<b>Diskové úložiště neběží.</b><br>Spusť soubor <b>install-local-crm-storage-autostart.command</b> ve složce FILIP-CRM.`
    };
    setDiskStorageStatus(diskStorageStatus.message);
  }
}
function clientName(c) {
  return c?.name || 'Bez jména';
}
function initials(name) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
}
function findClient(id) {
  return state.clients.find(c => String(c.id) === String(id));
}
function clientContracts(id) {
  return sortContracts(state.contracts.filter(s => String(s.clientId) === String(id)));
}
function clientDeals(id) {
  return visibleDeals().filter(d => String(d.clientId) === String(id));
}
function clientOpportunities(id) {
  return state.opportunities.filter(o => String(o.clientId) === String(id));
}
function contractOpportunityStatus(s) {
  const ids = getStatuses(s);
  if (ids.some(x => ['ceka_podklady', 'kontakt', 'nedovolano', 'sms', 'telefon', 'whatsapp', 'domluveno'].includes(x))) return 'Čekám na podklady';
  if (ids.some(x => ['nabidka', 'ceka_nabidka', 'email', 'vypoved'].includes(x))) return 'Ve schvalování';
  return 'Oportunita';
}
function contractOpportunityCategory(s) {
  const t = s?.type || '';
  if (t === 'život') return 'Život';
  if (t === 'auto' || t === 'majetek') return 'Auto';
  if (t === 'hypotéka') return 'Hypotéka';
  if (t === 'úvěr') return 'Úvěry';
  if (t === 'FKI') return 'FKI';
  if (t === 'DPS' || t === 'DIP') return 'Penze';
  if (t === 'investice') return 'Investice';
  return sourceForType(t);
}
function opportunityFromContract(s) {
  const status = state.contractOpportunityStatuses?.[s.id] || contractOpportunityStatus(s),
    last = (s.log || []).slice(-1)[0],
    lead = clientLeadDefault(findClient(s.clientId));
  return {
    id: 'contract_' + s.id,
    contractId: s.id,
    clientId: s.clientId,
    status,
    contractStatus: s.status || '',
    contractStatusLabel: STATUS_LABELS[s.status] || '',
    statusDate: last?.d || s.updatedAt || s.createdAt || today(),
    category: contractOpportunityCategory(s),
    company: s.company || '',
    product: s.product || s.type || '',
    amount: parseMoney(s.amount),
    bj: +s.dealBj || 0,
    expectedCommission: +s.expectedCommission || 0,
    expectedDate: s.anniv || '',
    owner: s.dealOwner || lead.owner || '',
    ownerType: s.dealOwnerType || lead.ownerType || '',
    note: s.note || '',
    isContractOpportunity: true
  };
}
function contractOpportunities() {
  return state.contracts.filter(s => isActiveContract(s)).map(opportunityFromContract);
}
function opportunityProductsOverlap(a, b) {
  const pa = norm(a?.product),
    pb = norm(b?.product);
  if (!pa || !pb) return true;
  if (pa === pb || pa.includes(pb) || pb.includes(pa)) return true;
  return pa.split(' ')[0] && pa.split(' ')[0] === pb.split(' ')[0];
}
function isInvestmentOpportunity(o) {
  return ['investice', 'fki'].includes(opportunityArea(o));
}
function opportunityFundIdentity(o) {
  const isin = normId(o?.isin || o?.fundIsin || '');
  if (isin) return 'isin:' + isin;
  const key = normId(o?.fundKey || o?.scenarioKey || o?.proposalKey || '');
  if (key) return 'key:' + key;
  return ['fund', norm(o?.category), norm(o?.company), norm(o?.product)].join('|');
}
function sameOpenOpportunity(a, b) {
  if (String(a?.clientId) !== String(b?.clientId)) return false;
  if (norm(a?.category) !== norm(b?.category)) return false;
  if (norm(a?.company) !== norm(b?.company)) return false;
  if (isInvestmentOpportunity(a) || isInvestmentOpportunity(b)) return opportunityFundIdentity(a) === opportunityFundIdentity(b);
  const aa = parseMoney(a?.amount),
    bb = parseMoney(b?.amount);
  if (aa || bb) {
    if (Math.abs(aa - bb) > 1) return false;
  } else if (norm(a?.product) !== norm(b?.product)) return false;
  return opportunityProductsOverlap(a, b);
}
function allOpenOpportunities() {
  const manual = [...(state.opportunities || [])].filter(isOpenOpportunity),
    generated = contractOpportunities().filter(o => !manual.some(m => sameOpenOpportunity(m, o)));
  return [...manual, ...generated];
}
function clientOpenOpportunities(id) {
  return allOpenOpportunities().filter(o => String(o.clientId) === String(id));
}
function clientNotes(id) {
  return state.notes.filter(n => String(n.clientId) === String(id)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function clientActivities(id) {
  return state.activities.filter(a => String(a.clientId) === String(id)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
function fillClientSelect(id, selected) {
  const el = byId(id);
  if (!el) return;
  el.innerHTML = state.clients.map(c => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${esc(clientName(c))}</option>`).join('');
}
function fillOptionalClientSelect(id, selected) {
  const el = byId(id);
  if (!el) return;
  el.innerHTML = '<option value="">Bez klienta</option>' + state.clients.map(c => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${esc(clientName(c))}</option>`).join('');
}
function knownPeople() {
  return [...new Set([...state.clients.map(clientName), ...(state.deals || []).map(d => d.owner), ...(state.referrals || []).flatMap(r => [r.from, r.to]), ...(state.referrerPayouts || []).map(p => p.name)].map(x => String(x || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
}
function fillPeopleList() {
  const el = byId('peopleList');
  if (el) el.innerHTML = knownPeople().map(x => `<option value="${esc(x)}"></option>`).join('');
}
function leadTypeLabel(t) {
  return t === 'tipar' ? 'Typař' : t === 'referral' ? 'Doporučení' : 'Volný klient';
}
function leadSourceBadge(c) {
  if (!c?.leadType || c.leadType === 'direct') return '<span class="chip">Volný klient</span>';
  const cls = c.leadType === 'tipar' ? 'purple' : 'green';
  return `<span class="badge ${cls}">${esc(leadTypeLabel(c.leadType))}: ${esc(c.leadSource || 'bez jména')}</span>`;
}
function referrerBadge(c) {
  if (c?.referrerRole === 'tipar') return `<span class="badge purple">Je typař${c.referrerCommissionPct ? ' · ' + num(c.referrerCommissionPct) + ' %' : ''}</span>`;
  if (c?.referrerRole === 'referral') return '<span class="badge green">Dává doporučení</span>';
  return '';
}
function findPersonClient(name) {
  return state.clients.find(c => norm(clientName(c)) === norm(name));
}
function referrerCommissionFor(name) {
  const c = findPersonClient(name);
  return +(c?.referrerCommissionPct || 0);
}
function clientLeadDefault(c) {
  if (!c || !c.leadType || c.leadType === 'direct') return {
    owner: '',
    ownerType: '',
    pct: 0
  };
  const profilePct = c.leadType === 'tipar' ? referrerCommissionFor(c.leadSource) : 0;
  return {
    owner: c.leadSource || '',
    ownerType: c.leadType,
    pct: profilePct || +c.leadCommissionPct || 0
  };
}
function fillYears() {
  const y = new Date().getFullYear();
  const years = [...new Set([y, ...visibleDeals().map(d => yearOf(d.date)), ...Object.keys(state.plans || {}).map(Number)])].filter(Boolean).sort((a, b) => b - a);
  ['dealYear', 'chartYear'].forEach(id => {
    const el = byId(id);
    if (el) {
      const cur = el.value || y;
      el.innerHTML = years.map(v => `<option ${String(v) === String(cur) ? 'selected' : ''}>${v}</option>`).join('');
    }
  });
}
function yearOf(d) {
  return new Date(d || Date.now()).getFullYear();
}
function monthOf(d) {
  return new Date(d || Date.now()).getMonth();
}
function dateDiffDays(date) {
  if (!date) return 99999;
  const a = new Date(date),
    b = new Date();
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  if (isNaN(a)) return 99999;
  return Math.ceil((a - b) / 86400000);
}
function cDaysAnnual(ds) {
  if (!ds) return 99999;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const raw = new Date(ds);
  if (isNaN(raw)) return 99999;
  const d = new Date(raw);
  d.setHours(0, 0, 0, 0);
  if (d.getFullYear() > t.getFullYear()) return Math.round((d - t) / 86400000);
  d.setFullYear(t.getFullYear());
  if (d < t) d.setFullYear(t.getFullYear() + 1);
  return Math.round((d - t) / 86400000);
}
function cDaysAbs(ds) {
  return dateDiffDays(ds);
}
function days5(ds) {
  if (!ds) return 99999;
  const d = new Date(ds);
  if (isNaN(d)) return 99999;
  d.setFullYear(d.getFullYear() + 5);
  return dateDiffDays(d.toISOString().slice(0, 10));
}
function days3(ds) {
  if (!ds) return 99999;
  const d = new Date(ds);
  if (isNaN(d)) return 99999;
  d.setFullYear(d.getFullYear() + 3);
  return dateDiffDays(d.toISOString().slice(0, 10));
}
function contractDays(s) {
  const type = s?.type || '',
    src = s?.source || '';
  if (norm(src).includes('adamek') || norm(src).includes('linhart')) return cDaysAbs(s.anniv);
  if (type === 'hypotéka') return cDaysAbs(s.anniv);
  if (type === 'úvěr') return days3(s.datumUzavreni || s.anniv);
  if (type === 'život') return days5(s.anniv);
  return cDaysAnnual(s.anniv);
}
function nextAnnualDateString(date) {
  if (!date) return '';
  const d = new Date(date),
    t = new Date();
  if (isNaN(d)) return date;
  d.setFullYear(t.getFullYear());
  if (d <= t) d.setFullYear(t.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
function sourceForType(type) {
  if (type === 'život') return 'Životní';
  if (type === 'hypotéka') return 'Hypotéky';
  if (type === 'úvěr') return 'Úvěry';
  if (type === 'auto' || type === 'majetek') return 'Auta + majetek';
  if (type === 'investice') return 'Investice';
  if (type === 'FKI') return 'FKI';
  if (type === 'DPS' || type === 'DIP') return 'Penze';
  return 'Ostatní';
}
function sectionForContract(s) {
  const t = s?.type || '';
  if (t === 'auto' || t === 'majetek') return 'auta';
  if (t === 'život') return 'zivot';
  if (t === 'hypotéka') return 'hypoteky';
  if (t === 'úvěr') return 'uvery-only';
  if (t === 'investice' || t === 'FKI') return 'investice';
  if (t === 'DPS' || t === 'DIP') return 'penze';
  return 'ostatni';
}
function isFkiText(txt) {
  const n = norm(txt);
  return /(^|\s)fki(\s|$)|fond kvalifikovanych|kvalifikovanych investoru|sicav|investicni akcie/.test(n);
}
function areaForContract(s) {
  const t = s?.type || '',
    src = norm([s?.source, s?.product, s?.company].join(' '));
  if (t === 'DPS' || t === 'DIP' || src.includes('dip') || src.includes('dps') || src.includes('penz')) return 'penze';
  if (t === 'FKI' || isFkiText(src)) return 'fki';
  if (t === 'investice' || src.includes('invest')) return 'investice';
  if (t === 'hypotéka' || t === 'úvěr') return 'uvery';
  if (t === 'život' || t === 'auto' || t === 'majetek') return 'pojisteni';
  return 'ostatni';
}
function areaForDeal(d) {
  const txt = [d?.category, d?.product, d?.company].join(' '),
    n = norm(txt);
  if (d?.category === 'Penze' || /\bdps\b|\bdip\b|penz/.test(n)) return 'penze';
  if (d?.category === 'FKI' || isFkiText(txt)) return 'fki';
  if (d?.category === 'Investice') return 'investice';
  if (d?.category === 'Hypotéky' || d?.category === 'Úvěry') return 'uvery';
  if (d?.category === 'Životní pojištění' || d?.category === 'Neživotní pojištění') return 'pojisteni';
  return 'ostatni';
}
function areaLabel(k) {
  return {
    investice: 'Investice',
    fki: 'FKI',
    sporeni: 'Spoření',
    penze: 'Penze',
    pojisteni: 'Pojištění',
    uvery: 'Úvěry',
    ostatni: 'Ostatní'
  }[k] || k;
}
function opportunityArea(o) {
  return areaForDeal({
    category: o?.category,
    product: o?.product,
    company: o?.company
  });
}
function focusClientPortfolio(k) {
  clientSection = 'portfolio';
  clientPortfolioFocus = k;
  renderClientDetail();
  setTimeout(() => document.querySelector('[data-portfolio-area="' + k + '"]')?.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  }), 40);
}
function opportunityFolderDefs(rows = []) {
  const base = [['zivot', 'Život'], ['auto', 'Auto'], ['nemovitost', 'Nemovitost'], ['hypoteka', 'Hypotéka'], ['uvery', 'Úvěry'], ['penze', 'Penze'], ['investice', 'Investice'], ['fki', 'FKI'], ['ostatni', 'Ostatní']];
  const used = new Set(base.map(x => x[0]));
  rows.forEach(o => {
    const k = opportunityFolderKey(o),
      label = o.category || areaLabel(k);
    if (!used.has(k)) {
      base.push([k, label]);
      used.add(k);
    }
  });
  return base;
}
function opportunityFolderKey(o) {
  const n = norm(o?.category || o?.product || '');
  if (/zivot|pojisteni/.test(n)) return 'zivot';
  if (/auto|vozid|moto/.test(n)) return 'auto';
  if (/nemovit|majet/.test(n)) return 'nemovitost';
  if (/hypotek|hypo/.test(n)) return 'hypoteka';
  if (/uver|kredit/.test(n)) return 'uvery';
  if (/penz|dps|dip/.test(n)) return 'penze';
  if (/fki|kvalifik/.test(n) || isFkiText(n)) return 'fki';
  if (/invest|fond|opf/.test(n)) return 'investice';
  return norm(o?.category || 'ostatni') || 'ostatni';
}
function opportunityFolderLabel(key) {
  return dict(opportunityFolderDefs(), key) || areaLabel(key);
}
function dict(pairs, key) {
  const row = pairs.find(x => x[0] === key);
  return row ? row[1] : key;
}
function opportunityCategoryToDeal(category, product = '') {
  if (category === 'Život') return 'Životní pojištění';
  if (category === 'Auto') return 'Neživotní pojištění';
  if (category === 'Hypotéka') return 'Hypotéky';
  if (category === 'Investice' || category === 'FKI' || category === 'Penze') return category;
  if (category === 'Úvěry') return 'Úvěry';
  return category || categoryFrom(product);
}
function opportunityStatusClass(s) {
  return {
    'Oportunita': 'opp-opportunity',
    'Čekám na podklady': 'opp-docs',
    'Ve schvalování': 'opp-approval',
    'Schváleno': 'opp-approved',
    'Podepsáno': 'opp-signed',
    'Zamítnuto': 'opp-rejected'
  }[s] || 'opp-opportunity';
}
function opportunityBadge(s) {
  return `<span class="opp-status ${opportunityStatusClass(s)}">${esc(s || 'Oportunita')}</span>`;
}
function isOpenOpportunity(o) {
  return !['Podepsáno', 'Zamítnuto'].includes(o?.status);
}
function clientAreaStats(clientId) {
  const stats = {
      investice: {
        count: 0,
        volume: 0
      },
      fki: {
        count: 0,
        volume: 0
      },
      sporeni: {
        count: 0,
        volume: 0
      },
      penze: {
        count: 0,
        volume: 0
      },
      pojisteni: {
        count: 0,
        volume: 0
      },
      uvery: {
        count: 0,
        volume: 0
      },
      ostatni: {
        count: 0,
        volume: 0
      }
    },
    contracts = clientContracts(clientId),
    contractIds = new Set(contracts.map(s => String(s.id)));
  contracts.forEach(s => {
    const k = areaForContract(s);
    if (k === 'investice' || k === 'fki') return;
    stats[k].count++;
    stats[k].volume += parseMoney(s.amount);
  });
  clientDeals(clientId).forEach(d => {
    const k = areaForDeal(d);
    if (k === 'investice' || k === 'fki') return;
    const linked = linkedContractForDeal(d);
    if (linked && contractIds.has(String(linked.id))) return;
    stats[k].count++;
    stats[k].volume += dealVolume(d);
  });
  clientDisplayInvestmentItems(clientId).forEach(x => {
    const k = investmentAreaOfItem(x);
    stats[k].count++;
    stats[k].volume += x.amount;
  });
  return stats;
}
function investmentAreaOfItem(x) {
  return x?.area || x?.group || (x?.kind === 'FKI' ? 'fki' : 'investice');
}
function clientInvestmentItems(clientId) {
  const allowed = ['investice', 'fki'],
    records = investmentPortfolioForClient(clientId).map(x => ({
      ...x,
      sourceType: 'record'
    })),
    recordAreas = new Set(records.map(investmentAreaOfItem));
  const deals = clientDeals(clientId).filter(d => allowed.includes(areaForDeal(d)) && !recordAreas.has(areaForDeal(d))).map(d => ({
    kind: areaForDeal(d) === 'fki' ? 'FKI obchod' : 'Obchod',
    area: areaForDeal(d),
    clientId: d.clientId,
    company: d.company,
    product: d.product || d.category,
    amount: dealVolume(d),
    date: d.date,
    source: d,
    sourceType: 'deal',
    sourceId: d.id
  }));
  const usedAreas = new Set([...recordAreas, ...deals.map(investmentAreaOfItem)]);
  const contracts = clientContracts(clientId).filter(s => allowed.includes(areaForContract(s)) && !usedAreas.has(areaForContract(s))).map(s => ({
    kind: areaForContract(s) === 'fki' ? 'FKI' : 'Smlouva',
    area: areaForContract(s),
    clientId: s.clientId,
    company: s.company,
    product: s.product || s.type,
    amount: parseMoney(s.amount),
    date: s.anniv,
    source: s,
    sourceType: 'contract',
    sourceId: s.id
  }));
  const items = [...records, ...deals, ...contracts].map(x => investmentAreaOfItem(x) === 'investice' ? applyInvestmentSnapshot(x) : x),
    keys = new Set(items.filter(x => investmentAreaOfItem(x) === 'investice').map(investmentItemKey));
  const orphans = latestInvestmentSnapshots(clientId).filter(s => !keys.has(investmentSnapshotKeyForSnapshot(s))).map(investmentSnapshotItem);
  return [...items, ...orphans];
}
function invNum(v) {
  return parseMoney(v);
}
function invInvestor(r) {
  return String(r?.Investor || r?.investor || r?.client || r?.klient || '').trim();
}
function invBirthId(r) {
  const direct = r?.['RČ'] || r?.RC || r?.['Rodné číslo'] || r?.['Rodne cislo'] || r?.['Rodné číslo / interní ID'] || r?.birthId || '';
  const rc = normalizeStrongId(direct);
  if (rc) return rc;
  const cid = String(r?.ClientID || r?.clientId || '').trim(),
    m = cid.match(/^RC[_-]?(.+)$/i);
  return m ? normalizeStrongId(m[1]) : '';
}
function invClientId(r) {
  return String(r?.ClientID || r?.clientId || '').trim();
}
function inferFkiCompany(fond) {
  const f = norm(fond);
  if (!f) return 'Nezařazeno';
  if (f.includes('julius') || f.includes('meinl')) return 'Codya';
  if (f.includes('gartal') || f.includes('real luxembourg') || f.includes('ebm')) return 'Codya';
  if (f.includes('csnf') || f.includes('csef') || f.includes('realia') || f.includes('r2p') || f.includes('vihorev') || f.includes('spilberk') || f.includes('ceskomoravsky') || f.includes('domus') || f.includes('aguila')) return 'Avant';
  if (f.includes('wood') || f.includes('opf') || f.includes('opd')) return 'WOOD & Company / OPF';
  if (f.includes('efekta')) return 'Efekta';
  if (f.includes('jt') || f.includes('j t')) return 'J&T';
  return 'Nezařazeno';
}
function normalizeFkiCompanyName(raw, fond = '') {
  const rv = String(raw || '').trim(),
    first = rv.split(/\s[-–]\s/)[0].trim(),
    n = norm(first || rv);
  if (n === 'codya' || n === 'codie' || n === 'kodya') return 'Codya';
  if (n === 'avant' || n === 'avanta' || n.includes('avant invest')) return 'Avant';
  if (n === 'efekta' || n.includes('efekta')) return 'Efekta';
  if (n === 'jt' || n === 'j t' || n.includes('j t')) return 'J&T';
  if (n.includes('wood')) return 'WOOD & Company / OPF';
  if (n === '') return inferFkiCompany(fond);
  return rv;
}
function invCompany(r) {
  const raw = String(r?.['Investiční společnost'] || r?.['Investicni spolecnost'] || r?.Společnost || r?.Spolecnost || r?.Producent || r?.company || '').trim();
  return normalizeFkiCompanyName(raw, invFund(r));
}
function invFund(r) {
  return String(r?.Fond || r?.fund || r?.Produkt || r?.product || '').trim();
}
function cleanInvFundName(fund, company = '') {
  let f = String(fund || '').trim();
  ['codya', 'avant', 'efekta', 'j&t', 'jt', 'wood opf', 'wood opd', 'wood & company'].forEach(p => {
    const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[-–:]\\s*', 'i');
    f = f.replace(re, '').trim();
  });
  return f || String(fund || company || '').trim();
}
function invIsin(r) {
  return String(r?.['rp.ISIN'] || r?.ISIN || r?.isin || '').trim();
}
function invType(r) {
  return String(r?.['Typ CP'] || r?.['Typ produktu'] || r?.type || '').trim();
}
function invProductType(r) {
  const raw = String(r?.['Typ produktu'] || r?.['Produktový typ'] || '').trim();
  if (raw) return raw;
  const f = norm((r?.Fond || '') + ' ' + invCompany(r));
  if (f.includes('vigo') || f.includes('public') || f.includes('wood opf') || f.includes('opf')) return 'Retail / OPF';
  if (f.includes('dip')) return 'DIP';
  if (f.includes('dps')) return 'DPS';
  return 'FKI';
}
function invProductGroup(r) {
  const p = norm(invProductType(r));
  if (p.includes('retail') || p.includes('opf')) return 'Retail / OPF';
  if (p.includes('etf')) return 'ETF / fondy';
  if (p.includes('dip')) return 'DIP';
  if (p.includes('dps')) return 'DPS';
  if (p.includes('jine') || p.includes('jine')) return 'Jiné';
  return 'FKI';
}
function invAreaGuess(r) {
  const txt = [invFund(r), invCompany(r), invType(r), r?.['Typ produktu']].join(' ');
  return isFkiText(txt) ? 'fki' : 'investice';
}
function invDate(r) {
  return String(r?.['Datum připsání platby'] || r?.['Datum emise'] || r?.date || '').trim();
}
function invEmissionDate(r) {
  return String(r?.['Datum emise'] || r?.emissionDate || '').trim();
}
function invPaymentDate(r) {
  return String(r?.['Datum připsání platby'] || r?.paymentDate || r?.date || '').trim();
}
function invDeposit(r) {
  return invNum(r?.['Čistá investice'] || r?.['Cista investice'] || r?.investment || r?.amount);
}
function invCurrent(r) {
  return invNum(r?.['Aktuální hodnota investice'] || r?.['Aktualni hodnota investice'] || r?.current || r?.value);
}
function invQty(r) {
  return invNum(r?.['Počet vydaných CP'] || r?.['Pocet vydanych CP'] || r?.qty);
}
function invSubscribeValue(r) {
  return invNum(r?.['Upisovací hodnota'] || r?.['Upisovaci hodnota'] || r?.subscribeValue);
}
function invTx(r) {
  return norm(r?.['Typ transakce'] || r?.transactionType || 'Platba');
}
function invIsWithdrawal(r) {
  return invTx(r).includes('odkup') || invTx(r).includes('vyber');
}
function invDateObj(v) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}
function invTodayObj() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function invIsFutureWithdrawal(r) {
  const d = invDateObj(r?.['Datum připsání platby'] || r?.paymentDate || r?.date);
  return invIsWithdrawal(r) && d && d > invTodayObj();
}
function invCurrentNav(r) {
  const fv = state.fundValues?.[invPositionKey(r)] || {};
  return invNum(fv.nav) || invNum(r?.['Poslední schválená hodnota CP'] || r?.['Posledni schvalena hodnota CP']);
}
function invEffectiveQty(r) {
  const q = invQty(r);
  if (q) return q;
  const dep = invDeposit(r),
    up = invSubscribeValue(r);
  return dep && up && !invIsWithdrawal(r) ? dep / up : 0;
}
function invWithdrawalValue(r) {
  return invIsWithdrawal(r) ? Math.abs(invCurrent(r) || invDeposit(r)) : 0;
}
function invCurrentValue(r) {
  if (invIsWithdrawal(r)) return invIsFutureWithdrawal(r) ? 0 : -invWithdrawalValue(r);
  const qty = invEffectiveQty(r),
    nav = invCurrentNav(r);
  if (qty && nav) return qty * nav;
  return invCurrent(r);
}
function invClientIdentity(r) {
  return normalizeStrongId(invBirthId(r)) || normalizeStrongId(String(invClientId(r)).replace(/^RC[_-]?/i, '')) || norm(invInvestor(r));
}
function invPositionKey(r) {
  const isin = norm(invIsin(r));
  if (isin) return ['isin', isin].join('|');
  return ['fond', norm(cleanInvFundName(invFund(r), invCompany(r))), norm(invType(r) || invAreaGuess(r))].join('|');
}
function invRecordKey(r) {
  const identity = invClientIdentity(r);
  return [identity, invPositionKey(r), invEmissionDate(r), invPaymentDate(r), invTx(r), Math.round(invDeposit(r) * 100), Math.round(invQty(r) * 1000000), Math.round(invSubscribeValue(r) * 1000000)].join('|');
}
function invRecordScore(r) {
  return Object.values(r || {}).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length + (invCurrent(r) > 0 ? 2 : 0);
}
function mergeInvRecord(a, b) {
  const keep = invRecordScore(b) >= invRecordScore(a) ? {
    ...a,
    ...b
  } : {
    ...b,
    ...a
  };
  Object.keys({
    ...a,
    ...b
  }).forEach(k => {
    if ((keep[k] === null || keep[k] === undefined || keep[k] === '') && a[k]) keep[k] = a[k];
    if ((keep[k] === null || keep[k] === undefined || keep[k] === '') && b[k]) keep[k] = b[k];
  });
  return keep;
}
function dedupeInvestmentRecordsInState(s) {
  const map = new Map(),
    out = [];
  (s.investmentRecords || []).forEach(r => {
    const key = invRecordKey(r);
    if (key && map.has(key)) {
      const i = map.get(key);
      out[i] = mergeInvRecord(out[i], r);
      return;
    }
    if (key) map.set(key, out.length);
    out.push(r);
  });
  s.investmentRecords = out;
  return out.length;
}
function snapshotDedupeKeyRaw(s) {
  const i = norm(s?.isin || ''),
    m = norm(s?.mergeKey || ''),
    company = norm(s?.company || ''),
    product = norm(s?.product || 'Investice'),
    type = norm(s?.fundType || s?.typ || s?.kind || 'Investice');
  const fund = i ? 'isin|' + i : m ? 'merge|' + m : ['fund', company, product, type].join('|');
  return [String(s?.clientId || ''), fund].join('|');
}
function dedupeInvestmentSnapshotsInState(s) {
  const map = new Map(),
    out = [];
  (s.investmentSnapshots || []).forEach(x => {
    const key = [snapshotDedupeKeyRaw(x), x.date || '', Math.round((+x.current || 0) * 100), Math.round((+x.invested || 0) * 100)].join('|');
    if (key && map.has(key)) {
      const i = map.get(key);
      out[i] = {
        ...out[i],
        ...x,
        id: out[i].id || x.id
      };
      return;
    }
    if (key) map.set(key, out.length);
    out.push(x);
  });
  s.investmentSnapshots = out;
  return out.length;
}
function isFkiMirrorRecord(r) {
  return r && (r._source === 'local-fki' || r.Fond || r.fund || r['Čistá investice'] !== undefined || r['Aktuální hodnota investice'] !== undefined || r['Počet vydaných CP'] !== undefined);
}
function currentFkiSnapshot(records) {
  const tmp = {
    investmentRecords: (Array.isArray(records) ? records : []).map(r => ({
      ...r,
      _importedAt: today(),
      _source: 'local-fki'
    }))
  };
  dedupeInvestmentRecordsInState(tmp);
  return tmp.investmentRecords;
}
function setFkiBridgeState(payload) {
  payload = payload || {};
  const records = currentFkiSnapshot(payload.records || payload.recs || []);
  state.investmentRecords = (state.investmentRecords || []).filter(r => !isFkiReportRecord(r));
  records.forEach(r => state.investmentRecords.push(r));
  dedupeInvestmentRecordsInState(state);
  if (payload.fundValues && typeof payload.fundValues === 'object') state.fundValues = payload.fundValues;
  if (payload.lockedFunds && typeof payload.lockedFunds === 'object') state.lockedFunds = payload.lockedFunds;
  if (payload.trailSettings && typeof payload.trailSettings === 'object') state.trailSettings = payload.trailSettings;
  relinkAllStrongIdentities();
  persist();
  return {
    records: records.length,
    funds: Object.keys(state.fundValues || {}).length
  };
}
function personNameKey(name) {
  return norm(name).split(' ').filter(Boolean).sort().join('|');
}
function clientAliasNames(c) {
  return [clientName(c), ...String(c?.aliases || '').split(',').map(x => x.trim())].filter(Boolean);
}
function clientMatchesName(c, name) {
  const exact = norm(name),
    person = personNameKey(name);
  return clientAliasNames(c).some(alias => norm(alias) === exact || person && personNameKey(alias) === person);
}
function findOrCreateClientFromInvestment(r) {
  const name = invInvestor(r);
  if (!name) return null;
  let c = null;
  const rc = normalizeStrongId(invBirthId(r));
  if (rc) c = state.clients.find(x => normalizeStrongId(x.birthId) === rc);
  if (!c) c = state.clients.find(x => clientMatchesName(x, name));
  if (!c) {
    c = {
      id: uid(),
      name,
      phone: '',
      email: '',
      contactPref: 'email',
      birthId: invBirthId(r),
      address: '',
      note: '',
      createdAt: today(),
      importedAt: today()
    };
    state.clients.push(c);
  } else {
    if (!c.birthId && invBirthId(r)) c.birthId = invBirthId(r);
    if (name && !clientMatchesName(c, name)) c.aliases = [...new Set(String(c.aliases || '').split(',').map(x => x.trim()).concat(name).filter(Boolean))].join(', ');
  }
  linkInvestmentRecordsToClient(c);
  return c;
}
function linkInvestmentRecordsToClient(c) {
  const rc = normalizeStrongId(c?.birthId);
  if (!rc) return 0;
  let changed = 0;
  (state.investmentRecords || []).forEach(r => {
    if (normalizeStrongId(invBirthId(r)) !== rc) return;
    if (!r.ClientID || String(r.ClientID).startsWith('CL')) {
      r.ClientID = 'RC_' + rc;
      changed++;
    }
    if (!r['RČ']) {
      r['RČ'] = rc;
      changed++;
    }
    if (c.name && (!r.Investor || norm(r.Investor) !== norm(c.name))) {
      r._crmInvestorOriginal = r._crmInvestorOriginal || r.Investor || '';
      r.Investor = c.name;
      changed++;
    }
  });
  return changed;
}
function relinkAllStrongIdentities() {
  let changed = 0;
  state.clients.forEach(c => {
    if (c.birthId) changed += linkInvestmentRecordsToClient(c);
  });
  return changed;
}
function investmentRecordsForClient(clientId) {
  const c = findClient(clientId);
  if (!c) return [];
  const rc = normalizeStrongId(c.birthId),
    id = String(c.id);
  return (state.investmentRecords || []).filter(r => rc && (normalizeStrongId(invBirthId(r)) === rc || normalizeStrongId(invClientId(r).replace(/^RC[_-]?/i, '')) === rc) || String(invClientId(r)) === id || clientMatchesName(c, invInvestor(r)));
}
function readLocalJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}
function localFkiHash() {
  const raw = localStorage.getItem('crm3') || '';
  return raw.length + '|' + raw.slice(0, 80) + '|' + raw.slice(-80);
}
function syncLocalFkiStorage(silent = false) {
  const hash = localFkiHash();
  localFkiSyncHash = hash;
  const raw = readLocalJson('crm3', []);
  const count = {
    clients: 0,
    records: 0,
    funds: 0,
    skipped: 0,
    linked: 0,
    replaced: 0
  };
  if (!Array.isArray(raw) || !raw.length) {
    if (!silent) setOldGoogleStatus('Lokální FKI v tomto prohlížeči nevidím. Otevři jednou záložku FKI / původní investment-crm ve stejném prohlížeči, aby se data načetla.');
    return count;
  }
  const records = currentFkiSnapshot(raw);
  dedupeInvestmentRecordsInState(state);
  records.forEach(r => {
    const before = state.clients.length;
    findOrCreateClientFromInvestment(r);
    if (state.clients.length > before) count.clients++;
  });
  const beforeLen = (state.investmentRecords || []).length;
  state.investmentRecords = (state.investmentRecords || []).filter(r => !isFkiMirrorRecord(r));
  count.replaced = beforeLen - state.investmentRecords.length;
  records.forEach(r => {
    state.investmentRecords.push(r);
    count.records++;
  });
  dedupeInvestmentRecordsInState(state);
  const fundValues = readLocalJson('crm3_fund_values', {}),
    lockedFunds = readLocalJson('crm3_locked_funds', {}),
    trailSettings = readLocalJson('crm3_fki_trail_settings', {});
  state.fundValues = fundValues && typeof fundValues === 'object' ? fundValues : {};
  state.lockedFunds = lockedFunds && typeof lockedFunds === 'object' ? lockedFunds : {};
  state.trailSettings = trailSettings && typeof trailSettings === 'object' ? trailSettings : {};
  count.funds = Object.keys(state.fundValues || {}).length;
  count.linked += relinkAllStrongIdentities();
  return count;
}
function importLocalFkiStorage() {
  const c = syncLocalFkiStorage(false);
  persist();
  renderAll();
  setOldGoogleStatus(`<b>Lokální FKI načtené a spárované podle RČ/IČO.</b><br>Přidáno: ${num(c.clients)} klientů · načteno aktuálně ${num(c.records)} FKI záznamů · nahrazeno starých ${num(c.replaced || 0)} záznamů · ${num(c.funds)} fondů. Propojeno/opraveno: ${num(c.linked)} vazeb.`);
}
function investmentPortfolioForClient(clientId) {
  const tmp = {
    investmentRecords: investmentRecordsForClient(clientId)
  };
  dedupeInvestmentRecordsInState(tmp);
  const rows = tmp.investmentRecords,
    map = {};
  rows.forEach(r => {
    const k = invPositionKey(r);
    if (!map[k]) map[k] = {
      kind: 'FKI',
      area: 'fki',
      clientId,
      company: invCompany(r),
      product: invFund(r) || 'FKI',
      isin: invIsin(r),
      typ: invType(r),
      amount: 0,
      invested: 0,
      current: 0,
      realized: 0,
      date: invDate(r),
      tx: 0,
      source: r
    };
    map[k].tx++;
    if (invIsWithdrawal(r)) {
      map[k].current += invCurrentValue(r);
      map[k].realized += invWithdrawalValue(r);
      map[k].amount = Math.max(0, map[k].current);
      if (invDate(r)) map[k].date = invDate(r);
      return;
    }
    map[k].invested += invDeposit(r);
    map[k].current += invCurrentValue(r) || invCurrent(r) || invDeposit(r);
    map[k].amount = Math.max(0, map[k].current);
    if (invDate(r)) map[k].date = invDate(r);
  });
  return Object.values(map).filter(x => x.current > 0 || x.invested > 0 || x.realized > 0).map(x => ({
    ...x,
    current: Math.max(0, x.current),
    amount: Math.max(0, x.amount)
  })).sort((a, b) => b.current - a.current);
}
function getStatuses(s) {
  return [...new Set([...(Array.isArray(s.statuses) ? s.statuses : []), s.status].filter(Boolean))];
}
function hasStatus(s, id) {
  return getStatuses(s).includes(id);
}
function isActiveContract(s) {
  return !hasStatus(s, 'vyrizeno') && !hasStatus(s, 'podepsano') && !hasStatus(s, 'nechce') && (getStatuses(s).some(x => ACTIVE_STATUS_IDS.includes(x)) || hasContractWorkNote(s) || isWorseMortgageRate(s));
}
function isClosedContract(s) {
  return hasStatus(s, 'vyrizeno') || hasStatus(s, 'podepsano') || hasStatus(s, 'nechce');
}
function statusBadge(s) {
  if (!s) return '';
  const cls = s === 'prepojistit' || s === 'nedovolano' ? 'red' : s === 'vypoved' ? 'purple' : s === 'nabidka' ? 'orange' : s === 'vyrizeno' || s === 'podepsano' || s === 'domluveno' ? 'green' : 'blue';
  return `<span class="badge ${cls}">${esc(STATUS_LABELS[s] || s)}</span>`;
}
function contractAttachments(s) {
  return Array.isArray(s?.attachments) ? s.attachments : [];
}
function contractPdfCount(s) {
  return contractAttachments(s).filter(a => String(a.type || '').includes('pdf') || /\.pdf$/i.test(a.name || '')).length;
}
function contractAttachmentBadge(s) {
  const total = contractAttachments(s).length,
    pdf = contractPdfCount(s);
  if (!total) return '';
  const label = pdf ? `PDF ${pdf}${total > pdf ? ' / příloh ' + total : ''}` : `Příloh ${total}`;
  return `<span class="badge purple">${esc(label)}</span>`;
}
function opportunityAttachmentBadge(o) {
  if (!o?.contractId) return '';
  const s = state.contracts.find(x => String(x.id) === String(o.contractId));
  return contractAttachmentBadge(s);
}
function daysBadge(d) {
  if (d >= 99999) return '<span class="badge">bez data</span>';
  if (d < 0) return '<span class="badge red">prošlé</span>';
  const cls = d < 30 ? 'red' : d < 70 ? 'orange' : d <= 90 ? 'blue' : 'green';
  return `<span class="badge ${cls}">za ${d} dní</span>`;
}
function hasContractWorkNote(s) {
  const txt = norm([s?.note, s?.product, s?.company, (s?.log || []).map(l => l.t).join(' ')].join(' '));
  return /(resi|reseni|vyresit|rozprac|cekam|ceka|podklad|nabid|vypoved|prepoj|kontakt|volat|telefon|schuz|sms|email|mail|nedovol)/.test(txt);
}
function needsContractAttention(s) {
  return !isClosedContract(s) && (isActiveContract(s) || hasContractWorkNote(s) || hasStatus(s, 'prepojistit') || isWorseMortgageRate(s));
}
function isContractUrgent(s, d = contractDays(s)) {
  return !isClosedContract(s) && (hasStatus(s, 'prepojistit') || isWorseMortgageRate(s) || d < 30);
}
function isContractWork(s) {
  return needsContractAttention(s) && !isContractUrgent(s);
}
function contractVisualClass(s, d = contractDays(s)) {
  if (isClosedContract(s)) return 'ok';
  if (isContractUrgent(s, d)) return 'hot';
  if (isContractWork(s)) return 'active-work';
  if (d <= 90) return 'soon';
  return 'ok';
}
function rowClassContract(s) {
  if (isClosedContract(s)) return 'row-done';
  const cls = contractVisualClass(s);
  return cls === 'hot' ? 'row-hot' : cls === 'active-work' ? 'row-active' : cls === 'soon' ? 'row-soon' : 'row-ok';
}
function dealBJ(d) {
  return +d.bj || 0;
}
function visibleDeals() {
  return state.deals.filter(d => !d.hidden);
}
function getPlan(y) {
  state.plans = state.plans || {};
  state.plans[y] = state.plans[y] || {
    bjCoef: state.settings.bjCoef || 150,
    clients: 0,
    investment: 0,
    mortgage: 0,
    categories: {}
  };
  return normalizePlan(state.plans[y], state.settings.bjCoef);
}
function isVolumeCategory(c) {
  return c === 'Investice' || c === 'Hypotéky';
}
function dealCash(d, y) {
  const base = dealBJ(d) * (+getPlan(y || yearOf(d.date)).bjCoef || +state.settings.bjCoef || 150);
  return d.category === 'Životní pojištění' ? base * .8 : base;
}
function dealVolume(d) {
  return +(d.amount || 0);
}
function dealActualCommissionIsSet(d) {
  return d && d.actualCommission !== undefined && d.actualCommission !== null && String(d.actualCommission).trim() !== '';
}
function dealActualCommission(d) {
  return dealActualCommissionIsSet(d) ? parseMoney(d.actualCommission) : 0;
}
function dealPaid(d) {
  return !!d.commissionPaid;
}
function dealPaidActualCommission(d) {
  return dealPaid(d) ? dealActualCommission(d) : 0;
}
function dealExpectedCommission(d, y) {
  return dealPaid(d) ? 0 : dealCash(d, y || yearOf(d.date));
}
function isOtherDashboardDeal(d) {
  const area = areaForDeal(d);
  return !['investice', 'fki'].includes(area) && d.category !== 'Hypotéky';
}
function opportunityCash(o, y) {
  return dealCash({
    category: opportunityCategoryToDeal(o?.category, o?.product),
    bj: +o?.bj || 0,
    date: o?.statusDate || today()
  }, y || yearOf(o?.statusDate || today()));
}
function leadSourceType(c) {
  return c?.leadType === 'tipar' ? 'tipar' : c?.leadType === 'referral' ? 'referral' : 'direct';
}
function leadSourceName(type) {
  return type === 'tipar' ? 'Typař' : type === 'referral' ? 'Doporučení' : 'Volný klient';
}
function fillDashboardFilters() {
  const typeEl = byId('dashDealTypeFilter'),
    sourceEl = byId('dashLeadSourceFilter');
  if (typeEl) {
    const cur = typeEl.value,
      cats = [...new Set([...visibleDeals().map(d => d.category).filter(Boolean), ...CATEGORIES])];
    typeEl.innerHTML = '<option value="">Všechny typy obchodů</option>' + cats.map(c => `<option value="${esc(c)}" ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join('');
  }
  if (sourceEl) {
    const cur = sourceEl.value,
      types = [...new Set(['direct', 'tipar', 'referral', ...(state.clients || []).map(leadSourceType)])];
    sourceEl.innerHTML = '<option value="">Všechny zdroje klientů</option>' + types.map(t => `<option value="${esc(t)}" ${t === cur ? 'selected' : ''}>${esc(leadSourceName(t))}</option>`).join('');
  }
}
function dashboardFilteredDeals(deals) {
  const type = val('dashDealTypeFilter'),
    source = val('dashLeadSourceFilter');
  return deals.filter(d => (!type || d.category === type) && (!source || leadSourceType(findClient(d.clientId)) === source));
}
function dashboardFilterSummary(year, total, filtered) {
  const type = val('dashDealTypeFilter'),
    source = val('dashLeadSourceFilter'),
    parts = [];
  if (type) parts.push('typ obchodu: ' + type);
  if (source) parts.push('zdroj klienta: ' + leadSourceName(source));
  setText('dashboardFilterSummary', parts.length ? `Filtrováno podle ${parts.join(' · ')}. Zobrazeno ${num(filtered.length)} z ${num(total.length)} obchodů za rok ${year}.` : `Dashboard ukazuje všechna data za rok ${year}.`);
}
function clearDashboardFilters() {
  setVal('dashDealTypeFilter', '');
  setVal('dashLeadSourceFilter', '');
  renderDashboard();
}
function dealOwnerType(d) {
  return d.ownerType || (d.owner ? 'tipar' : '');
}
function dealOwnerLabel(d) {
  if (!d.owner) return '';
  return `${d.owner}${dealOwnerType(d) === 'referral' ? ' (doporučení)' : dealOwnerType(d) === 'tipar' ? ' (typař)' : ''}`;
}
function dealOwnerPct(d) {
  return dealOwnerType(d) === 'tipar' ? +d.ownerCommissionPct || referrerCommissionFor(d.owner) || 0 : 0;
}
function dealOwnerPayout(d, y) {
  return dealOwnerType(d) === 'tipar' ? dealCash(d, y || yearOf(d.date)) * dealOwnerPct(d) / 100 : 0;
}
function dealNetCommission(d, y) {
  const actual = dealActualCommission(d);
  return actual ? actual - dealOwnerPayout(d, y) : 0;
}
function isLateUnpaid(d) {
  if (dealPaid(d)) return false;
  const dt = new Date(d.date);
  if (isNaN(dt)) return false;
  const limit = new Date();
  limit.setMonth(limit.getMonth() - 3);
  return dt < limit;
}
function excelDateText(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v || '').trim();
  if (!s) return '';
  const m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? s : d.toISOString().slice(0, 10);
}
function commissionRows() {
  return (state.commissionImports || []).flatMap(i => (i.rows || []).map(r => ({
    ...r,
    importId: i.id,
    importedAt: i.importedAt,
    fileName: i.fileName,
    payoutDate: i.payoutDate,
    period: i.period
  })));
}
function latestCommissionImport() {
  return [...(state.commissionImports || [])].sort((a, b) => String(b.payoutDate || b.importedAt).localeCompare(String(a.payoutDate || a.importedAt)))[0] || null;
}
function commissionSummaryTotals(y = new Date().getFullYear()) {
  const imports = (state.commissionImports || []).filter(i => yearOf(i.payoutDate || i.importedAt) === y),
    rows = commissionRows().filter(r => yearOf(r.payoutDate || r.importedAt) === y),
    latest = latestCommissionImport();
  return {
    imports,
    rows,
    latest,
    paid: imports.reduce((s, i) => s + (+i.summary?.toPay || 0), 0),
    gross: imports.reduce((s, i) => s + (+i.summary?.gross || 0), 0),
    withheld: imports.reduce((s, i) => s + (+i.summary?.withheld || 0), 0),
    reserve: +latest?.summary?.reserveEnd || 0,
    deferred: +latest?.summary?.deferredEnd || 0,
    recurring: rows.filter(isRecurringCommissionRow).reduce((s, r) => s + (+r.commission || 0), 0),
    negative: rows.filter(r => (+r.commission || 0) < 0).reduce((s, r) => s + (+r.commission || 0), 0),
    matched: rows.filter(r => r.matchType === 'contract' || r.matchType === 'deal').length,
    review: rows.filter(r => r.matchType !== 'contract' && r.matchType !== 'deal').length
  };
}
function isRecurringCommissionRow(r) {
  return /mng fee|management|sprav|násled|nasled|prubez|průběž/i.test(String(r.note || '') + ' ' + String(r.product || '') + ' ' + String(r.commissionType || ''));
}
function commissionRowKey(r) {
  return normId([r.producer, r.product, r.client, r.contractNumber, r.closedAt, r.commission, r.note].join('|'));
}
function findDealByContractNumber(number) {
  const k = normId(number);
  if (!k) return null;
  let d = state.deals.find(x => normId(x.contractNumber) === k);
  if (d) return d;
  const s = state.contracts.find(x => normId(x.number) === k);
  if (!s) return null;
  return state.deals.find(x => String(x.contractId) === String(s.id) || String(x.clientId) === String(s.clientId) && normId(x.contractNumber) === k) || null;
}
function matchCommissionRow(r) {
  const d = findDealByContractNumber(r.contractNumber);
  if (d) return {
    type: 'deal',
    dealId: d.id,
    clientId: d.clientId
  };
  const s = state.contracts.find(x => normId(x.number) === normId(r.contractNumber));
  if (s) return {
    type: 'contract',
    contractId: s.id,
    clientId: s.clientId
  };
  const c = state.clients.find(x => norm(clientName(x)) === norm(r.client));
  return c ? {
    type: 'client',
    clientId: c.id
  } : {
    type: 'none'
  };
}
function parseCommissionWorkbookRows(rows, fileName = 'provizni-vypis.xlsx') {
  const summary = {},
    detail = [],
    period = (rows[4] || []).find(x => String(x || '').includes('od ')) || '',
    payoutDate = excelDateText(rows[4]?.[0] || today());
  const rowByLabel = needle => rows.slice(0, 16).find(r => norm(r.join(' ')).includes(needle)) || [];
  const grossRow = rowByLabel('provizni narok celkem vlastni'),
    withheldRow = rowByLabel('zadrzeno ve prospech rezervniho fondu'),
    payRow = rowByLabel('k vyplaceni'),
    endRow = rowByLabel('konecny stav');
  summary.gross = parseMoney(grossRow[4] ?? grossRow[3] ?? 0);
  summary.withheld = parseMoney(withheldRow[4] ?? withheldRow[3] ?? 0);
  summary.toPay = parseMoney(payRow[3] ?? payRow[4] ?? 0);
  summary.reserveEnd = parseMoney(endRow[8] ?? 0);
  summary.operatingReserveEnd = parseMoney(endRow[10] ?? 0);
  summary.pointsEnd = parseMoney(endRow[12] ?? 0);
  summary.deferredEnd = parseMoney(endRow[13] ?? 0);
  const headerIndex = rows.findIndex(r => norm(r[0]) === 'producent' && norm(r[4]) === 'klient');
  if (headerIndex < 0) throw new Error('Nenašel jsem v Excelu tabulku detailů provizí.');
  rows.slice(headerIndex + 1).forEach(r => {
    if (!r || !r.some(Boolean)) return;
    const row = {
      producer: String(r[0] || '').trim(),
      product: String(r[1] || '').trim(),
      advisor: String(r[2] || '').trim(),
      closedAt: excelDateText(r[3]),
      client: String(r[4] || '').trim(),
      contractNumber: String(r[5] || '').trim(),
      bj: parseMoney(r[6]),
      coef: parseMoney(r[7]),
      commission: parseMoney(r[8]),
      reserve: parseMoney(r[9]),
      commissionType: String(r[10] || '').trim(),
      dealType: String(r[11] || '').trim(),
      note: String(r[12] || '').trim(),
      businessId: String(r[21] || '').trim()
    };
    if (!row.client && !row.product && !row.commission) return;
    const m = matchCommissionRow(row);
    row.matchType = m.type;
    row.clientId = m.clientId || null;
    row.dealId = m.dealId || null;
    row.contractId = m.contractId || null;
    row.recurring = isRecurringCommissionRow(row);
    detail.push(row);
  });
  return {
    fileName,
    period: String(period || ''),
    payoutDate,
    summary,
    rows: detail
  };
}
function applyExactCommissionMatches(imp) {
  let updated = 0;
  const seen = new Set();
  (imp.rows || []).filter(r => !r.recurring && r.dealId && (+r.commission || 0)).forEach(r => {
    const d = state.deals.find(x => String(x.id) === String(r.dealId));
    if (!d) return;
    const key = commissionRowKey(r);
    d.commissionImportKeys = Array.isArray(d.commissionImportKeys) ? d.commissionImportKeys : [];
    if (d.commissionImportKeys.includes(key) || seen.has(key)) return;
    seen.add(key);
    d.actualCommission = (+d.actualCommission || 0) + (+r.commission || 0);
    d.commissionPaid = true;
    d.commissionImportKeys.push(key);
    updated++;
  });
  return updated;
}
function importCommissionPayload(payload, fileName) {
  const imp = parseCommissionWorkbookRows(payload, fileName),
    sourceKey = normId([imp.period, imp.payoutDate, imp.rows.length, imp.summary?.toPay, imp.summary?.gross].join('|')),
    legacySourceKey = normId([imp.fileName, imp.period, imp.payoutDate, imp.rows.length, imp.summary?.toPay].join('|'));
  const existing = state.commissionImports.find(x => x.sourceKey === sourceKey || x.sourceKey === legacySourceKey);
  if (existing && !confirm('Tenhle provizní výpis už v CRM pravděpodobně je. Chceš ho nahradit novou verzí?')) return;
  if (existing) state.commissionImports = state.commissionImports.filter(x => x.id !== existing.id && x.sourceKey !== sourceKey && x.sourceKey !== legacySourceKey);
  imp.id = uid();
  imp.sourceKey = sourceKey;
  imp.importedAt = today();
  state.commissionImports.push(imp);
  const exact = applyExactCommissionMatches(imp);
  persist();
  renderAll();
  const recurring = imp.rows.filter(isRecurringCommissionRow).reduce((s, r) => s + (+r.commission || 0), 0),
    matched = imp.rows.filter(r => r.matchType === 'deal' || r.matchType === 'contract').length,
    review = imp.rows.length - matched;
  setCommissionImportStatus(`<b>Výpis načtený:</b> ${esc(imp.fileName)} · ${esc(imp.period || imp.payoutDate)}<br>Řádků: ${num(imp.rows.length)} · jistě spárováno: ${num(matched)} · ke kontrole: ${num(review)} · propsáno do existujících obchodů: ${num(exact)}.<br>Vyplaceno: ${money(imp.summary.toPay)} · rezervní fond: ${money(imp.summary.reserveEnd)} · odložená provize: ${money(imp.summary.deferredEnd)} · následné provize ve výpisu: ${money(recurring)}.`);
  toast('Provizní výpis načtený');
}
function importCommissionFile(file) {
  if (!file) return;
  if (typeof XLSX === 'undefined') return alert('Čtečka Excelu se nenačetla. Zkontroluj internet a obnov CRM.');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, {
          type: 'array',
          cellDates: true
        }),
        ws = wb.Sheets[wb.SheetNames[0]],
        rows = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: false,
          defval: ''
        });
      importCommissionPayload(rows, file.name);
    } catch (err) {
      alert('Provizní výpis se nepovedlo načíst: ' + err.message);
    } finally {
      const input = byId('commissionImportFile');
      if (input) input.value = '';
    }
  };
  reader.readAsArrayBuffer(file);
}
function setCommissionImportStatus(html) {
  const el = byId('commissionImportStatus');
  if (el) el.innerHTML = html;
}
function commissionSystemClient() {
  let c = state.clients.find(x => x.systemRole === 'commission');
  if (c) {
    c.name = 'Následná provize';
    return c;
  }
  c = {
    id: uid(),
    name: 'Následná provize',
    systemRole: 'commission',
    contactPref: 'email',
    note: 'Technická karta pro souhrn následných provizí z provizních výpisů.',
    createdAt: today()
  };
  state.clients.push(c);
  return c;
}
function postRecurringCommissionsToDeals() {
  const imports = (state.commissionImports || []).filter(i => (i.rows || []).some(isRecurringCommissionRow));
  if (!imports.length) return alert('Zatím není načtený výpis s následnými provizemi.');
  const c = commissionSystemClient();
  let added = 0,
    skipped = 0;
  imports.forEach(i => {
    const total = (i.rows || []).filter(isRecurringCommissionRow).reduce((s, r) => s + (+r.commission || 0), 0);
    if (!total) return;
    const key = 'recurring_' + normId([i.period, i.payoutDate, total].join('|'));
    if (state.deals.some(d => d.recurringCommissionKey === key)) {
      skipped++;
      return;
    }
    state.deals.push({
      id: uid(),
      clientId: c.id,
      category: 'Následná provize',
      company: 'Broker Trust',
      product: 'Následné provize z výpisu',
      date: i.payoutDate || today(),
      amount: 0,
      bj: 0,
      actualCommission: total,
      commissionPaid: true,
      owner: '',
      ownerType: '',
      createdAt: today(),
      recurringCommissionKey: key,
      commissionImportId: i.id
    });
    added++;
  });
  persist();
  renderAll();
  alert(`Hotovo. Přidáno ${num(added)} řádků následných provizí, přeskočeno ${num(skipped)} už existujících.`);
}
function planId(c) {
  return 'plan_' + norm(c).replace(/\s+/g, '_');
}
function categoryActual(y, c) {
  const deals = visibleDeals().filter(d => yearOf(d.date) === y);
  if (c === 'Investice') return deals.filter(d => ['investice', 'fki'].includes(areaForDeal(d))).reduce((s, d) => s + dealVolume(d), 0);
  if (c === 'Hypotéky') return deals.filter(d => d.category === 'Hypotéky').reduce((s, d) => s + dealVolume(d), 0);
  return deals.filter(d => d.category === c).reduce((s, d) => s + dealBJ(d), 0);
}
function metricLabel(c, n) {
  return isVolumeCategory(c) ? money(n) : num(n) + ' BJ';
}
function yearProgress(y) {
  const now = new Date(),
    start = new Date(y, 0, 1),
    end = new Date(+y + 1, 0, 1);
  if (now < start) return 0;
  if (now >= end) return 1;
  return Math.max(.01, Math.min(1, (now - start) / (end - start)));
}
function planPaceNote(y, target, actual, c) {
  if (!target) return '<span class="pace-neutral">Cíl není nastavený.</span>';
  const left = target - actual;
  if (left <= 0) return `<span class="pace-good">Plán překonán o ${metricLabel(c, Math.abs(left))}.</span>`;
  const elapsed = yearProgress(y),
    shouldHave = target * elapsed,
    paceDiff = actual - shouldHave,
    projected = elapsed ? actual / elapsed : 0,
    monthNow = new Date().getFullYear() === +y ? new Date().getMonth() : 11,
    monthsLeft = Math.max(1, 12 - monthNow),
    needMonthly = left / monthsLeft;
  if (paceDiff >= 0) return `<span class="pace-good">Tempo je v plusu o ${metricLabel(c, paceDiff)}.</span> Projekce roku ${metricLabel(c, projected)} · do cíle zbývá ${metricLabel(c, left)} · potřeba cca ${metricLabel(c, needMonthly)} měsíčně.`;
  return `<span class="pace-bad">Za plánem o ${metricLabel(c, Math.abs(paceDiff))}.</span> Projekce roku ${metricLabel(c, projected)} · do cíle zbývá ${metricLabel(c, left)} · potřeba cca ${metricLabel(c, needMonthly)} měsíčně.`;
}
function renderPlanProgress() {
  const y = +val('chartYear') || +val('planYear') || new Date().getFullYear(),
    p = getPlan(y),
    cats = [...PLAN_CATEGORIES];
  const html = cats.map(c => {
    const target = +(p.categories?.[c] || 0),
      actual = categoryActual(y, c),
      left = Math.max(target - actual, 0),
      pct = target ? Math.min(100, Math.round(actual / target * 100)) : 0;
    return `<div class="progress-card"><div class="progress-row"><b>${esc(c)}</b><span>${pct}% splněno</span></div><div class="note">Splněno ${metricLabel(c, actual)} / cíl ${metricLabel(c, target)} · zbývá ${metricLabel(c, left)}</div><div class="note">${planPaceNote(y, target, actual, c)}</div><div class="progress"><span style="width:${pct}%"></span></div></div>`;
  }).join('');
  document.querySelectorAll('.planProgress').forEach(el => el.innerHTML = html);
}
function contractPlanCategory(s) {
  const c = categoryFrom([s.type, s.product, s.company].join(' '));
  if (c === 'FKI') return 'Investice';
  if (c === 'Ostatní') return 'Ostatní';
  return c;
}
function dealPlanCategory(d) {
  if (d.category === 'Následná provize') return 'Následná provize';
  if (['investice', 'fki'].includes(areaForDeal(d))) return 'Investice';
  return d.category || 'Ostatní';
}
function renderPlanSegments() {
  const table = byId('planSegmentTable'),
    metrics = byId('planSegmentMetrics');
  if (!table) return;
  const y = +val('planYear') || +val('chartYear') || new Date().getFullYear(),
    segments = [...PLAN_CATEGORIES, 'Následná provize', 'Ostatní'],
    deals = visibleDeals().filter(d => yearOf(d.date) === y),
    contracts = state.contracts || [],
    rows = segments.map(seg => {
      const ds = deals.filter(d => dealPlanCategory(d) === seg),
        cs = contracts.filter(s => contractPlanCategory(s) === seg),
        volume = ds.reduce((s, d) => s + dealVolume(d), 0),
        bj = ds.reduce((s, d) => s + dealBJ(d), 0),
        expected = ds.reduce((s, d) => s + dealExpectedCommission(d, y), 0),
        paid = ds.reduce((s, d) => s + dealPaidActualCommission(d), 0),
        avgBj = ds.length ? bj / ds.length : 0,
        avgVolume = ds.length ? volume / ds.length : 0;
      return {
        seg,
        contracts: cs.length,
        deals: ds.length,
        volume,
        bj,
        expected,
        paid,
        avgBj,
        avgVolume
      };
    }).filter(r => r.contracts || r.deals || PLAN_CATEGORIES.includes(r.seg));
  const totalContracts = rows.reduce((s, r) => s + r.contracts, 0),
    totalDeals = rows.reduce((s, r) => s + r.deals, 0),
    totalBj = rows.reduce((s, r) => s + r.bj, 0),
    totalPaid = rows.reduce((s, r) => s + r.paid, 0);
  if (metrics) metrics.innerHTML = `<div class="metric"><span class="note">Smluv v evidenci</span><b>${num(totalContracts)}</b></div><div class="metric"><span class="note">Obchodů letos</span><b>${num(totalDeals)}</b></div><div class="metric"><span class="note">BJ letos</span><b>${num(totalBj)}</b></div><div class="metric"><span class="note">Vyplaceno letos</span><b>${money(totalPaid)}</b></div>`;
  table.innerHTML = `<thead><tr><th>Segment</th><th>Smluv v evidenci</th><th>Obchodů letos</th><th>BJ</th><th>Objem</th><th>Průměr</th><th>Oček. provize</th><th>Vyplaceno</th></tr></thead><tbody>${rows.map(r => {
    const avg = isVolumeCategory(r.seg) ? money(r.avgVolume) : num(r.avgBj.toFixed(1)) + ' BJ';
    return `<tr><td><b>${esc(r.seg)}</b></td><td class="num">${num(r.contracts)}</td><td class="num">${num(r.deals)}</td><td class="num">${num(r.bj)}</td><td class="money">${money(r.volume)}</td><td class="money">${avg}</td><td class="money">${money(r.expected)}</td><td class="money">${money(r.paid)}</td></tr>`;
  }).join('')}</tbody>`;
}
function renderPlanCommission() {
  const table = byId('planCommissionTable');
  if (!table) return;
  const y = +val('planYear') || +val('chartYear') || new Date().getFullYear(),
    t = commissionSummaryTotals(y),
    deals = visibleDeals().filter(d => yearOf(d.date) === y),
    paidDeals = deals.reduce((s, d) => s + dealPaidActualCommission(d), 0),
    expected = deals.reduce((s, d) => s + dealExpectedCommission(d, y), 0),
    recDeals = deals.filter(d => d.category === 'Následná provize').reduce((s, d) => s + dealActualCommission(d), 0),
    trail = typeof investmentTrailSplit === 'function' ? investmentTrailSplit() : {
      annualGross: 0,
      monthlyPayout: 0,
      yearEndBonus: 0
    };
  table.innerHTML = `<thead><tr><th>Položka</th><th>Hodnota</th><th>Co to znamená</th></tr></thead><tbody><tr><td><b>Vyplaceno z výpisů ${y}</b></td><td class="money">${money(t.paid)}</td><td>částka „k vyplacení“ z nahraných Broker Trust výpisů</td></tr><tr><td><b>Zaplacené obchody v CRM</b></td><td class="money">${money(paidDeals)}</td><td>jen obchody označené jako zaplacené a jejich skutečná provize</td></tr><tr><td><b>Očekávaná provize</b></td><td class="money">${money(expected)}</td><td>obchody, které ještě nejsou označené jako zaplacené</td></tr><tr><td><b>Následné provize z výpisů</b></td><td class="money">${money(t.recurring || recDeals)}</td><td>správa / management fee z nahraných výpisů nebo ručně zadaná následná provize</td></tr><tr><td><b>Investiční následné ročně</b></td><td class="money">${money(trail.annualGross)}</td><td>orientační plná roční následná provize ze všech reportovaných investic, FKI a Edwarda podle nastavených % u fondů</td></tr><tr><td><b>Měsíční výplata 90 %</b></td><td class="money">${money(trail.monthlyPayout)}</td><td>částka k průběžné měsíční výplatě při plné kvalitě</td></tr><tr><td><b>Roční doplatek 10 %</b></td><td class="money">${money(trail.yearEndBonus)}</td><td>část odložená na roční doplatek</td></tr><tr><td><b>Rezervní fond</b></td><td class="money">${money(t.reserve)}</td><td>aktuální konečný stav z posledního načteného výpisu</td></tr><tr><td><b>Odložená provize</b></td><td class="money">${money(t.deferred)}</td><td>aktuální konečný stav z posledního načteného výpisu</td></tr><tr><td><b>Storna / korekce</b></td><td class="money">${money(t.negative)}</td><td>záporné položky z detailu provizí</td></tr></tbody>`;
}
function renderPlanForm() {
  const y = +val('planYear') || +val('chartYear') || new Date().getFullYear(),
    p = getPlan(y);
  setVal('planYear', y);
  setVal('planBjCoef', p.bjCoef ?? state.settings.bjCoef ?? 150);
  setVal('planClients', p.clients || '');
  setVal('planInvestment', p.categories?.['Investice'] || p.investment || '');
  setVal('planMortgage', p.categories?.['Hypotéky'] || p.mortgage || '');
  setVal('planLife', p.categories?.['Životní pojištění'] || '');
  setVal('planNonLife', p.categories?.['Neživotní pojištění'] || '');
  setVal('planLoans', p.categories?.['Úvěry'] || '');
  setVal('planPension', p.categories?.['Penze'] || '');
}
function savePlan() {
  const y = +val('planYear') || new Date().getFullYear(),
    p = getPlan(y);
  p.bjCoef = +val('planBjCoef') || +state.settings.bjCoef || 150;
  p.clients = +val('planClients') || 0;
  p.investment = +val('planInvestment') || 0;
  p.mortgage = +val('planMortgage') || 0;
  p.fki = 0;
  p.categories = p.categories || {};
  p.categories['Investice'] = p.investment;
  p.categories['Hypotéky'] = p.mortgage;
  p.categories['Životní pojištění'] = +val('planLife') || 0;
  p.categories['Neživotní pojištění'] = +val('planNonLife') || 0;
  p.categories['Úvěry'] = +val('planLoans') || 0;
  p.categories['Penze'] = +val('planPension') || 0;
  delete p.categories['FKI'];
  state.settings.bjCoef = p.bjCoef;
  setVal('chartYear', y);
  setVal('dealYear', y);
  persist();
  renderAll();
  saveToast('Roční plán uložen');
}
function categoryFrom(txt) {
  let n = norm(txt);
  if (/nasled|sprav|management|mng fee/.test(n)) return 'Následná provize';
  if (/hypotek|hypo/.test(n)) return 'Hypotéky';
  if (/uver|konsolid/.test(n)) return 'Úvěry';
  if (/zivot|nn|gcp|cpp|koop|generali|uniqa/.test(n)) return 'Životní pojištění';
  if (/auto|majet|nezivot|pov|havar/.test(n)) return 'Neživotní pojištění';
  if (/\bdps\b|\bdip\b|penz/.test(n)) return 'Penze';
  if (isFkiText(n)) return 'FKI';
  if (/invest|fond|opf|nav|portu|edward|atris|wood|jrd/.test(n)) return 'Investice';
  return 'Ostatní';
}
function contractTypeFromDeal(category, product = '') {
  const n = norm(product);
  if (category === 'Životní pojištění') return 'život';
  if (category === 'Hypotéky') return 'hypotéka';
  if (category === 'Úvěry') return 'úvěr';
  if (category === 'FKI' || isFkiText(n)) return 'FKI';
  if (category === 'Investice') return 'investice';
  if (category === 'Penze') return 'DPS';
  if (category === 'Neživotní pojištění') return /auto|vozid|pov|havar/.test(n) ? 'auto' : 'majetek';
  return 'ostatní';
}
function dealContractAmountText(d) {
  if (d.category === 'Investice' || d.category === 'FKI' || d.category === 'Hypotéky' || d.category === 'Úvěry') return dealVolume(d) ? money(dealVolume(d)) : '';
  return d.amount ? String(d.amount) : '';
}
function clientMatchKey(c) {
  const id = normalizeStrongId(c.birthId);
  if (id) return 'id:' + id;
  const email = normId(c.email),
    phone = normId(c.phone),
    name = norm(c.name);
  if (name && email) return 'name-email:' + name + '|' + email;
  if (name && phone) return 'name-phone:' + name + '|' + phone;
  if (name) return 'name:' + name;
  return '';
}
function clientDuplicateReason(g) {
  if (g.some(c => normalizeStrongId(c.birthId)) && new Set(g.map(c => normalizeStrongId(c.birthId)).filter(Boolean)).size === 1) return 'Rodné číslo / IČO';
  if (g.some(c => normId(c.email)) && new Set(g.map(c => normId(c.email)).filter(Boolean)).size === 1) return 'E-mail';
  if (g.some(c => normId(c.phone)) && new Set(g.map(c => normId(c.phone)).filter(Boolean)).size === 1) return 'Telefon';
  return 'Jméno';
}
function contractMatchKey(s) {
  const number = normId(s.number);
  if (number) return 'number:' + number;
  const client = String(s.clientId || ''),
    type = norm(s.type),
    company = norm(s.company),
    product = norm(s.product),
    anniv = String(s.anniv || '');
  if (client && (type || company || product || anniv)) return ['client', client, type, company, product, anniv].join('|');
  return '';
}
function dealDuplicateKey(d) {
  return [d.clientId, d.date, norm(d.category), norm(d.company), norm(d.product), dealVolume(d), dealBJ(d)].join('|');
}
function duplicateGroupKey(kind, g) {
  return kind + ':' + g.map(x => String(x.id)).sort().join('|');
}
function duplicateIsVerified(kind, g, data = state) {
  return !!data.verifiedDuplicates?.[duplicateGroupKey(kind, g)];
}
function duplicateGroups(data = state) {
  const clients = {},
    contracts = {},
    deals = {};
  (data.clients || []).forEach(c => {
    const k = clientMatchKey(c);
    if (k) (clients[k] = clients[k] || []).push(c);
  });
  (data.contracts || []).forEach(s => {
    const k = contractMatchKey(s);
    if (k) (contracts[k] = contracts[k] || []).push(s);
  });
  (data.deals || []).forEach(d => {
    const k = dealDuplicateKey(d);
    if (k) (deals[k] = deals[k] || []).push(d);
  });
  return {
    clients: Object.values(clients).filter(g => g.length > 1 && !duplicateIsVerified('client', g, data)),
    contracts: Object.values(contracts).filter(g => g.length > 1 && !duplicateIsVerified('contract', g, data)),
    deals: Object.values(deals).filter(g => g.length > 1 && !duplicateIsVerified('deal', g, data))
  };
}
function contractDuplicatesFor(number, ignoreId = null) {
  const k = normId(number);
  if (!k) return [];
  return state.contracts.filter(s => s.id !== ignoreId && normId(s.number) === k);
}
function clientDuplicatesFor(c) {
  const k = clientMatchKey(c);
  if (!k) return [];
  return state.clients.filter(x => x.id !== c.id && clientMatchKey(x) === k);
}
function mergeLinkCounts(id) {
  return {
    contracts: clientContracts(id).length,
    deals: clientDeals(id).length,
    opps: clientOpportunities(id).length,
    notes: clientNotes(id).length,
    acts: clientActivities(id).length,
    snapshots: (state.investmentSnapshots || []).filter(x => String(x.clientId) === String(id)).length,
    fki: investmentRecordsForClient(id).length
  };
}
function clientCompleteness(c) {
  return ['name', 'birthId', 'phone', 'email', 'altEmails', 'address', 'note', 'contactPref'].reduce((s, k) => s + (c[k] ? 1 : 0), 0) + Object.values(mergeLinkCounts(c.id)).reduce((s, n) => s + n, 0);
}
function mergeClientOptionLabel(c) {
  const n = mergeLinkCounts(c.id);
  return `${clientName(c)} · smlouvy ${n.contracts} · obchody ${n.deals} · pozn. ${n.notes}`;
}
function contractMergeKey(s) {
  const number = normId(s.number);
  if (number) return ['number', number, norm(s.type), norm(s.company), norm(s.product)].join('|');
  return [norm(s.type), norm(s.company), norm(s.product), String(s.anniv || ''), normId(s.amount)].join('|');
}
function contractDuplicateLines(rows) {
  return rows.map(s => `${clientName(findClient(s.clientId))} · ${[s.type, s.company, s.product].filter(Boolean).join(' · ') || 'bez detailu'}`).join('\n');
}
function confirmedContractDuplicates(number, ignoreId = null) {
  const dups = contractDuplicatesFor(number, ignoreId);
  if (!dups.length) return [];
  return confirm(`Pozor, stejné číslo smlouvy už v CRM existuje:\n\n${contractDuplicateLines(dups)}\n\nPokud je to správně, potvrď uložení jako samostatné smlouvy. CRM původní smlouvy nesloučí ani nepřepíše.`) ? dups : null;
}
function confirmContractDuplicateNumber(number, ignoreId = null) {
  return confirmedContractDuplicates(number, ignoreId) !== null;
}
function markDuplicateVerified(kind, g) {
  if (!g || g.length < 2) return;
  state.verifiedDuplicates = state.verifiedDuplicates || {};
  state.verifiedDuplicates[duplicateGroupKey(kind, g)] = {
    kind,
    ids: g.map(x => x.id),
    verifiedAt: new Date().toISOString()
  };
}
function verifyDuplicateGroup(kind, ids) {
  const arr = kind === 'deal' ? state.deals : kind === 'contract' ? state.contracts : state.clients,
    g = (ids || []).map(id => arr.find(x => String(x.id) === String(id))).filter(Boolean);
  if (g.length < 2) return alert('Tuhle skupinu už nevidím jako duplicitu.');
  if (!confirm('Označit tuto duplicitu jako správnou a ověřenou? Dashboard ji už nebude hlásit.')) return;
  markDuplicateVerified(kind, g);
  persist();
  renderDuplicateWarnings();
  saveToast('Duplicita označena jako ověřená');
}
function clientMergeContractConflicts(ids) {
  const map = {};
  state.contracts.filter(s => ids.map(String).includes(String(s.clientId))).forEach(s => {
    const k = contractMergeKey(s);
    if (k) (map[k] = map[k] || []).push(s);
  });
  return Object.values(map).filter(g => g.length > 1);
}
function mergeFieldSelect(field, label, clients) {
  const values = [...new Set(clients.map(c => String(c[field] || '').trim()).filter(Boolean))];
  if (!values.length) return `<div class="merge-field-row"><b>${label}</b><span class="note">bez hodnoty</span></div>`;
  return `<div class="merge-field-row"><b>${label}</b><select id="merge_${field}">${clients.filter(c => String(c[field] || '').trim()).map(c => `<option value="${c.id}">${esc(c[field])} — ${esc(clientName(c))}</option>`).join('')}</select></div>`;
}
function openClientMergeModal(ids) {
  mergingClientIds = ids.map(Number).filter(Boolean);
  const clients = mergingClientIds.map(findClient).filter(Boolean);
  if (clients.length < 2) return alert('Ke sloučení potřebuji alespoň dva klienty.');
  const master = [...clients].sort((a, b) => clientCompleteness(b) - clientCompleteness(a))[0],
    conflicts = clientMergeContractConflicts(mergingClientIds),
    reason = clientDuplicateReason(clients),
    body = byId('mergeClientBody');
  body.innerHTML = `<div class="merge-warning"><b>Důvod duplicity: ${esc(reason)}.</b><br><span class="note">${reason === 'Rodné číslo / IČO' ? 'Tuhle skupinu je vhodné sloučit. Rodné číslo/IČO bereme jako nejsilnější identifikátor klienta.' : 'Tady raději zkontroluj, jestli jde opravdu o stejného člověka. Stejný telefon nebo e-mail může být i u rodiny.'}</span></div><div class="merge-grid"><div class="merge-client-box"><h3>1. Vyber hlavního klienta</h3><div class="field"><label>Do této karty se vše sloučí</label><select id="mergeMaster">${clients.map(c => `<option value="${c.id}" ${c.id === master.id ? 'selected' : ''}>${esc(mergeClientOptionLabel(c))}</option>`).join('')}</select></div><div class="divider"></div>${clients.map(c => {
    const n = mergeLinkCounts(c.id);
    return `<div class="event"><small>${esc(c.birthId || 'bez RČ')}</small><div><b>${esc(clientName(c))}</b><br><span class="note">${esc([c.phone, c.email, c.altEmails, c.address].filter(Boolean).join(' · ') || 'bez kontaktů')}</span><div class="chips"><span class="chip">${num(n.contracts)} smluv</span><span class="chip">${num(n.deals)} obchodů</span><span class="chip">${num(n.opps)} příležitostí</span><span class="chip">${num(n.fki)} FKI záznamů</span><span class="chip">${num(n.snapshots)} aktualizací investic</span>${leadSourceBadge(c)}</div></div></div>`;
  }).join('')}</div><div class="merge-client-box"><h3>2. Vyber správné údaje</h3>${mergeFieldSelect('name', 'Jméno / firma', clients)}${mergeFieldSelect('birthId', 'RČ / IČO', clients)}${mergeFieldSelect('phone', 'Telefon', clients)}${mergeFieldSelect('email', 'E-mail', clients)}${mergeFieldSelect('altEmails', 'Další e-maily', clients)}${mergeFieldSelect('contactPref', 'Preferovaný kontakt', clients)}${mergeFieldSelect('address', 'Adresa', clients)}${mergeFieldSelect('leadType', 'Zdroj klienta', clients)}${mergeFieldSelect('leadSource', 'Typař / doporučil', clients)}${mergeFieldSelect('leadDate', 'Datum doporučení', clients)}${mergeFieldSelect('leadCommissionPct', 'Provize typaři %', clients)}${mergeFieldSelect('referrerRole', 'Role typaře/doporučitele', clients)}${mergeFieldSelect('referrerCommissionPct', 'Domluvená provize typaři %', clients)}${mergeFieldSelect('note', 'Poznámka', clients)}</div></div><div class="divider"></div><h3>Možné stejné smlouvy při sloučení</h3><div class="table-wrap"><table class="compact-table"><thead><tr><th>Smlouva</th><th>Klienti</th><th>Co se stane</th></tr></thead><tbody>${conflicts.map(g => `<tr class="row-soon"><td><b>${esc(g[0].number || 'bez čísla')}</b><br><span class="note">${esc([g[0].type, g[0].company, g[0].product].filter(Boolean).join(' · '))}</span></td><td>${g.map(s => esc(clientName(findClient(s.clientId)))).join('<br>')}</td><td>Obě smlouvy zůstanou zachované pod hlavní kartou. CRM nic automaticky nesmaže.</td></tr>`).join('') || '<tr><td colspan="3" class="note">Nevidím stejné číslo smlouvy ani stejnou smlouvu mezi těmito klienty.</td></tr>'}</tbody></table></div><div class="actions" style="justify-content:flex-end;margin-top:12px"><button class="btn" onclick="closeModal('mergeClientModal')">Zrušit</button><button class="btn primary" onclick="mergeClientsFromModal()">Sloučit klienty</button></div>`;
  openModal('mergeClientModal');
}
function selectedMergeClientFor(field) {
  const el = byId('merge_' + field);
  return el ? findClient(el.value) : null;
}
function absorbRecordFields(target, source) {
  ['type', 'source', 'company', 'product', 'number', 'anniv', 'amount', 'rate', 'status', 'note'].forEach(k => {
    if (!target[k] && source[k]) target[k] = source[k];
  });
  const logs = [...(Array.isArray(target.log) ? target.log : []), ...(Array.isArray(source.log) ? source.log : [])];
  target.log = logs.length ? logs : target.log;
  const attachments = [...(Array.isArray(target.attachments) ? target.attachments : []), ...(Array.isArray(source.attachments) ? source.attachments : [])];
  if (attachments.length) {
    const seen = new Set();
    target.attachments = attachments.filter(a => {
      const k = [a.name, a.size, a.dataUrl].join('|');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }
}
function dedupeMasterContracts(masterId) {
  const seen = {};
  state.contracts = [...state.contracts].filter(s => {
    if (String(s.clientId) !== String(masterId)) return true;
    const k = contractMergeKey(s);
    if (!k) return true;
    if (!seen[k]) {
      seen[k] = s;
      return true;
    }
    absorbRecordFields(seen[k], s);
    seen[k].log = seen[k].log || [];
    seen[k].log.push({
      d: today(),
      t: 'Sloučena duplicitní smlouva při sloučení klienta'
    });
    return false;
  });
}
function mergeClientsFromModal() {
  const clients = mergingClientIds.map(findClient).filter(Boolean),
    masterId = +val('mergeMaster'),
    master = findClient(masterId);
  if (!master || clients.length < 2) return alert('Vyber hlavního klienta.');
  if (!confirm('Opravdu sloučit tyto klienty do jedné karty? Navázané záznamy se přesunou pod hlavního klienta a žádná smlouva ani investice se automaticky nesmaže.')) return;
  const originalNames = [...new Set(clients.flatMap(clientAliasNames))],
    originalBirthIds = [...new Set(clients.map(c => normalizeStrongId(c.birthId)).filter(Boolean))],
    originalClientIds = new Set(clients.map(c => String(c.id)));
  ['name', 'birthId', 'phone', 'email', 'altEmails', 'contactPref', 'address', 'leadType', 'leadSource', 'leadDate', 'leadCommissionPct', 'referrerRole', 'referrerCommissionPct', 'note'].forEach(k => {
    const src = selectedMergeClientFor(k);
    if (src && src[k]) master[k] = src[k];
  });
  master.aliases = [...new Set([...String(master.aliases || '').split(',').map(x => x.trim()), ...originalNames].filter(x => x && norm(x) !== norm(master.name)))].join(', ');
  const loserIds = clients.map(c => c.id).filter(id => id !== masterId),
    loserSet = new Set(loserIds.map(String));
  ['contracts', 'deals', 'opportunities', 'activities', 'notes', 'investmentSnapshots', 'analysisEntries'].forEach(arr => (state[arr] || []).forEach(x => {
    if (loserSet.has(String(x.clientId))) x.clientId = masterId;
  }));
  (state.investmentRecords || []).forEach(r => {
    const recordId = String(invClientId(r) || ''),
      recordBirth = normalizeStrongId(invBirthId(r)),
      matchesName = originalNames.some(name => personNameKey(name) && personNameKey(name) === personNameKey(invInvestor(r)));
    if (!originalClientIds.has(recordId) && !originalBirthIds.includes(recordBirth) && !matchesName) return;
    r._crmInvestorOriginal = r._crmInvestorOriginal || r.Investor || '';
    r._crmInvestorAliases = [...new Set(String(r._crmInvestorAliases || '').split(',').map(x => x.trim()).concat(originalNames).filter(Boolean))].join(', ');
    r.Investor = master.name;
    if (master.birthId) {
      const rc = normalizeStrongId(master.birthId);
      r.ClientID = 'RC_' + rc;
      r['RČ'] = master.birthId;
    }
  });
  state.clients = state.clients.filter(c => !loserSet.has(String(c.id)));
  syncClientReferral(master);
  addActivity(masterId, 'Poznámka', 'Sloučeni duplicitní klienti: ' + originalNames.join(', ') + '. Všechny podkladové záznamy zachovány.', true);
  selectedClientId = masterId;
  closeModal('mergeClientModal');
  persist();
  renderAll();
  alert('Hotovo. Karty jsou sloučené, všechny smlouvy, investice, FKI a historie zůstaly zachované.');
}
function renderDuplicateWarnings() {
  const el = byId('duplicateTable');
  if (!el) return;
  const dup = duplicateGroups(),
    rows = [];
  dup.clients.forEach(g => {
    const ids = '[' + g.map(c => c.id).join(',') + ']',
      reason = clientDuplicateReason(g),
      hard = reason === 'Rodné číslo / IČO';
    rows.push(`<tr class="${hard ? 'row-hot' : 'row-soon'}"><td><b>Klient</b><br><span class="badge ${hard ? 'red' : 'orange'}">${esc(reason)}</span></td><td>${g.map(c => esc(clientName(c))).join('<br>')}</td><td>${g.map(c => esc([c.birthId, c.phone, c.email].filter(Boolean).join(' · '))).join('<br>')}</td><td><button class="btn slim primary" onclick="openClientMergeModal(${ids})">Sloučit skupinu</button> ${g.map(c => `<button class="btn slim" onclick="selectedClientId=${c.id};showView('clients');openClientModal(${c.id})">Upravit ${esc(clientName(c))}</button>`).join(' ')}</td></tr>`);
  });
  dup.contracts.forEach(g => {
    const clients = g.map(s => findClient(s.clientId)),
      ids = '[' + g.map(s => s.id).join(',') + ']';
    rows.push(`<tr class="row-hot"><td><b>Smlouva</b><br><span class="note">${esc(g[0].number || 'bez čísla - shoda podle klienta/detailu')}</span></td><td>${g.map((s, i) => esc(clientName(clients[i]))).join('<br>')}</td><td>${g.map(s => esc([s.type, s.company, s.product, s.anniv].filter(Boolean).join(' · '))).join('<br>')}</td><td>${g.map(s => `<button class="btn slim" onclick="selectedClientId=${s.clientId};showView('clients');openContractModal(${s.clientId},${s.id})">Upravit smlouvu</button>`).join(' ')} <button class="btn slim green" onclick="verifyDuplicateGroup('contract',${ids})">Ověřit jako správné</button></td></tr>`);
  });
  dup.deals.forEach(g => {
    const ids = '[' + g.map(d => d.id).join(',') + ']';
    rows.push(`<tr class="row-soon"><td><b>Obchod</b></td><td>${g.map(d => esc(clientName(findClient(d.clientId)))).join('<br>')}</td><td>${g.map(d => esc([d.date, d.category, d.product, num(dealBJ(d)) + ' BJ'].filter(Boolean).join(' · '))).join('<br>')}</td><td>${g.map(d => `<button class="btn slim" onclick="selectedClientId=${d.clientId};showView('deals');openDealModal(${d.clientId},${d.id})">Upravit obchod</button>`).join(' ')} <button class="btn slim green" onclick="verifyDuplicateGroup('deal',${ids})">Ověřit jako správné</button></td></tr>`);
  });
  el.innerHTML = `<thead><tr><th>Typ duplicity</th><th>Klient</th><th>Detail</th><th>Oprava</th></tr></thead><tbody>${rows.join('') || '<tr><td colspan="4" class="note">Vypadá to čistě. Nenašel jsem stejné klienty, smlouvy ani obchody.</td></tr>'}</tbody>`;
}
function showView(id) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  renderAll();
}
function noteTags(n) {
  return String(n.tags || '').split(',').map(x => x.trim()).filter(Boolean);
}
function noteSearchText(n) {
  const c = findClient(n.clientId);
  return [n.title, n.date, n.tags, clientName(c)].join(' ');
}
function noteType(n) {
  const t = noteTags(n).map(norm);
  if (t.includes('skoleni') || norm(n.title).includes('skoleni')) return 'školení';
  if (n.clientId) return 'klient';
  return 'agenda';
}
function renderNotes() {
  const el = byId('notesList');
  if (!el) return;
  const q = norm(val('noteSearch'));
  let rows = (state.notes || []).filter(n => !q || norm(noteSearchText(n)).includes(q)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const topics = new Set(rows.flatMap(noteTags).map(norm).filter(Boolean)),
    clientRows = rows.filter(n => n.clientId).length;
  const m = byId('noteMetrics');
  if (m) m.innerHTML = `<div class="metric"><span class="note">Poznámek</span><b>${num(rows.length)}</b></div><div class="metric"><span class="note">Štítků ve výběru</span><b>${num(topics.size)}</b></div><div class="metric"><span class="note">Vazba na klienta</span><b>${num(clientRows)}</b></div><div class="metric"><span class="note">Hledání</span><b>${q ? esc(val('noteSearch')) : 'vše'}</b></div>`;
  el.innerHTML = `<thead><tr><th>Název</th><th>Datum</th><th>Klient / téma</th><th>Štítky</th><th>Typ</th><th></th></tr></thead><tbody>${rows.map(n => {
    const c = findClient(n.clientId),
      tags = noteTags(n);
    return `<tr><td><button class="note-title-btn" onclick="openNoteViewModal(${n.id})">▧ ${esc(n.title || 'Poznámka')}</button></td><td>${esc(n.date || '')}</td><td>${c ? `<span class="badge blue">${esc(clientName(c))}</span>` : '<span class="note">bez klienta</span>'}</td><td>${tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</td><td><span class="badge blue">${esc(noteType(n))}</span></td><td><button class="icon-btn" title="Upravit poznámku" onclick="openNoteModal(${n.clientId || 'null'},${n.id})">✎</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="note">Zatím žádné poznámky. Přidej třeba školení a do štítků napiš R2P, ČSN nebo název fondu.</td></tr>'}</tbody>`;
}
function fkiGlobalLockKey(k) {
  return '__GLOBAL_FUND__||' + String(k || '');
}
function isFkiFundGloballyLocked(k) {
  return !!state.lockedFunds?.[fkiGlobalLockKey(k)];
}
function isFkiReportRecord(r) {
  return isFkiMirrorRecord(r) && invProductGroup(r) === 'FKI' && String(r?.['Stav scénáře'] || r?.['Stav scenare'] || '').trim() !== 'čeká';
}
function fkiReportItems() {
  const funds = {};
  (state.investmentRecords || []).filter(isFkiReportRecord).forEach(r => {
    const key = invPositionKey(r),
      company = invCompany(r) || 'Nezařazeno',
      fond = cleanInvFundName(invFund(r) || 'FKI', company);
    if (!funds[key]) funds[key] = {
      kind: 'FKI',
      area: 'fki',
      key,
      company,
      product: fond,
      isin: invIsin(r),
      typ: invType(r),
      amount: 0,
      rawCurrent: 0,
      invested: 0,
      clients: new Set(),
      products: 1,
      tx: 0,
      source: r
    };
    const f = funds[key];
    f.tx++;
    if (invInvestor(r)) f.clients.add(invInvestor(r));
    if (!invIsWithdrawal(r)) f.invested += invDeposit(r);
    f.rawCurrent += invCurrentValue(r);
    if (!f.isin && invIsin(r)) f.isin = invIsin(r);
    if (!f.typ && invType(r)) f.typ = invType(r);
  });
  return Object.values(funds).map(f => {
    f.rawCurrent = Math.max(0, f.rawCurrent);
    f.amount = isFkiFundGloballyLocked(f.key) ? 0 : f.rawCurrent;
    return f;
  }).filter(f => f.rawCurrent > 0.01 && f.amount > 0).sort((a, b) => b.rawCurrent - a.rawCurrent);
}
function reportProviderCleanName(name) {
  const raw = String(name || '').trim(),
    n = norm(raw);
  if (!raw) return 'Nezařazeno';
  if (n === 'edward invest' || n === 'edward investments' || n === 'edward') return 'Edward';
  if (n === 'avanta' || n.includes('avant invest')) return 'Avant';
  if (n === 'codie' || n === 'kodya') return 'Codya';
  if (n.includes('wood')) return 'WOOD & Company / OPF';
  return raw;
}
function isPensionReportItem(x) {
  const txt = norm([x?.category, x?.product, x?.company, x?.kind, x?.source?.category, x?.source?.product, x?.source?.type, x?.source?.company].join(' '));
  return /\bdps\b|\bdip\b|penz|duchod|duchodov/.test(txt);
}
function reportClassicInvestmentItems() {
  return classicInvestmentItems().filter(x => (+x.amount || 0) > 0 && !isPensionReportItem(x) && !isInvestmentFundLocked(investmentFundKey(x)));
}
function reportInvestmentItems() {
  return [...reportClassicInvestmentItems(), ...fkiReportItems()];
}
function reportProviderName(x) {
  return reportProviderCleanName(x.company || x.provider || x.source?.company || invCompany(x.source) || 'Nezařazeno');
}
function reportAumByProvider() {
  const rows = {};
  reportInvestmentItems().forEach(x => {
    const provider = reportProviderName(x),
      area = investmentAreaOfItem(x) === 'fki' ? 'fki' : 'investice',
      amount = +x.amount || 0;
    rows[provider] = rows[provider] || {
      provider,
      total: 0,
      investice: 0,
      fki: 0,
      clients: new Set(),
      products: 0
    };
    rows[provider].total += amount;
    rows[provider][area] += amount;
    rows[provider].products += x.products || 1;
    if (x.clients instanceof Set) x.clients.forEach(c => rows[provider].clients.add(c));else if (x.client?.id || x.clientId) rows[provider].clients.add(String(x.client?.id || x.clientId));
  });
  return Object.values(rows).sort((a, b) => b.total - a.total || a.provider.localeCompare(b.provider, 'cs'));
}
function clientForInvestmentRecord(r) {
  const rc = normalizeStrongId(invBirthId(r));
  return (rc ? state.clients.find(c => normalizeStrongId(c.birthId) === rc) : null) || state.clients.find(c => clientMatchesName(c, invInvestor(r))) || null;
}
function fkiReportDetailItems() {
  const map = {};
  (state.investmentRecords || []).filter(isFkiReportRecord).forEach(r => {
    const key = invPositionKey(r);
    if (isFkiFundGloballyLocked(key)) return;
    const c = clientForInvestmentRecord(r),
      client = c ? clientName(c) : invInvestor(r) || 'Bez klienta',
      k = [key, normalizeStrongId(invBirthId(r)) || norm(client)].join('|');
    if (!map[k]) map[k] = {
      provider: reportProviderCleanName(invCompany(r)),
      client,
      clientId: c?.id || null,
      product: cleanInvFundName(invFund(r) || 'FKI', invCompany(r)),
      source: 'FKI kalkulačka',
      kind: 'FKI',
      amount: 0,
      date: invDate(r),
      key
    };
    map[k].amount += invCurrentValue(r);
    if (invDate(r)) map[k].date = invDate(r);
  });
  return Object.values(map).filter(x => x.amount > 0.01);
}
function reportDetailItems() {
  const classic = reportClassicInvestmentItems().map(x => ({
    provider: reportProviderName(x),
    client: clientName(x.client || findClient(x.clientId)),
    clientId: x.client?.id || x.clientId || null,
    product: x.product || x.kind || 'Investice',
    source: x.snapshot ? 'Ruční aktualizace' : x.sourceType === 'deal' ? 'Obchod' : x.sourceType === 'contract' ? 'Smlouva' : 'Investice',
    kind: x.snapshot ? 'Investice · ověřeno' : 'Investice',
    amount: +x.amount || 0,
    date: x.snapshot?.date || x.date || ''
  }));
  return [...classic, ...fkiReportDetailItems()].sort((a, b) => a.provider.localeCompare(b.provider, 'cs') || a.client.localeCompare(b.client, 'cs') || b.amount - a.amount);
}
function openReportClient(id) {
  if (!id) return;
  selectedClientId = id;
  clientSection = 'portfolio';
  showView('clients');
}
function renderFundSettingsTable() {
  const table = byId('reportFundSettingsTable');
  if (!table) return;
  const inv = investmentFundItems().map(f => ({
    area: 'Investice',
    key: f.key,
    company: f.company || 'Nezařazeno',
    product: f.product || f.label || 'Investice',
    label: f.label || investmentFundLabel(f),
    isin: f.isin || '',
    typ: f.typ || '',
    mergeKey: f.mergeKey || '',
    aum: +f.rawCurrent || 0,
    invested: +f.invested || 0,
    trail: state.trailSettings?.[f.key]?.trailPct ?? investmentFundStoredValue(f).trailPct ?? '',
    locked: isInvestmentFundLocked(f.key),
    edit: 'investment'
  }));
  const fki = fkFundItems().map(f => ({
    area: 'FKI',
    key: f.key,
    company: f.company || 'Nezařazeno',
    product: f.product || 'FKI',
    label: [f.company, f.product].filter(Boolean).join(' - ') || 'FKI',
    isin: f.isin || '',
    typ: f.typ || '',
    mergeKey: '',
    aum: +f.rawCurrent || 0,
    invested: +f.invested || 0,
    trail: state.trailSettings?.[f.key]?.trailPct ?? state.fundValues?.[f.key]?.trailPct ?? '',
    locked: isFkiFundGloballyLocked(f.key),
    edit: 'fki'
  }));
  const rows = [...inv, ...fki].sort((a, b) => a.area.localeCompare(b.area, 'cs') || String(a.company).localeCompare(String(b.company), 'cs') || String(a.product).localeCompare(String(b.product), 'cs'));
  table.innerHTML = `<thead><tr><th>Typ</th><th>Společnost - fond</th><th>ISIN / klíč</th><th>Vloženo</th><th>AUM</th><th>Následná %</th><th>Zámek</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td><span class="badge ${r.area === 'FKI' ? 'purple' : 'green'}">${r.area}</span></td><td><b>${esc([r.company, r.product].filter(Boolean).join(' - '))}</b><br><span class="note">${esc(r.typ || 'typ neuveden')}</span></td><td>${esc(r.isin || 'ISIN chybí')}<br><span class="note">${esc(r.mergeKey ? 'sloučeno: ' + r.mergeKey : 'klíč: ' + r.key)}</span></td><td class="money">${money(r.invested)}</td><td class="money">${money(r.aum)}</td><td class="num">${r.trail !== '' ? decimal(r.trail) + ' %' : '-'}</td><td>${r.locked ? '<span class="badge orange">zamčeno</span>' : '<span class="note">otevřeno</span>'}</td><td><button class="btn slim" onclick="${r.edit === 'fki' ? `openFkFundModal('${encodeURIComponent(r.key)}')` : `openInvestmentFundModal('${encodeURIComponent(r.key)}')`}">Upravit</button></td></tr>`).join('') || '<tr><td colspan="8" class="note">Zatím tu nejsou žádné fondy k nastavení.</td></tr>'}</tbody>`;
}
function renderReportDetails() {
  const el = byId('reportDetailGroups');
  if (!el) return;
  const q = norm(val('reportDetailSearch'));
  const rows = reportDetailItems().filter(x => !q || norm([x.provider, x.client, x.product, x.source, x.kind].join(' ')).includes(q)),
    groups = {};
  rows.forEach(x => {
    groups[x.provider] = groups[x.provider] || [];
    groups[x.provider].push(x);
  });
  el.innerHTML = Object.entries(groups).sort((a, b) => b[1].reduce((s, x) => s + x.amount, 0) - a[1].reduce((s, x) => s + x.amount, 0)).map(([provider, items]) => {
    const total = items.reduce((s, x) => s + x.amount, 0),
      clients = new Set(items.map(x => x.client));
    return `<details class="report-provider-detail" ${provider === 'Nezařazeno' || q ? 'open' : ''}><summary><span>${esc(provider)} <span class="note">· ${num(clients.size)} klientů · ${num(items.length)} položek</span></span><span class="money">${money(total)}</span></summary><div class="table-wrap"><table class="compact-table"><thead><tr><th>Klient</th><th>Produkt / fond</th><th>Typ</th><th>Zdroj</th><th>Datum</th><th>AUM</th><th></th></tr></thead><tbody>${items.sort((a, b) => b.amount - a.amount || a.client.localeCompare(b.client, 'cs')).map(x => `<tr class="${provider === 'Nezařazeno' ? 'row-soon' : ''}"><td><b>${esc(x.client)}</b></td><td>${esc(x.product)}</td><td>${esc(x.kind)}</td><td>${esc(x.source)}</td><td>${esc(x.date || '')}</td><td class="money">${money(x.amount)}</td><td>${x.clientId ? `<button class="btn slim" onclick="openReportClient(${x.clientId})">Klient</button>` : '<span class="note">bez karty</span>'}</td></tr>`).join('')}</tbody></table></div></details>`;
  }).join('') || '<div class="note">V detailu zatím nejsou žádná AUM data podle zadaného hledání.</div>';
}
function commissionMatchLabel(r) {
  if (r.matchType === 'deal') return '<span class="badge green">obchod</span>';
  if (r.matchType === 'contract') return '<span class="badge blue">smlouva</span>';
  if (r.matchType === 'client') return '<span class="badge orange">jen klient</span>';
  return '<span class="badge red">ke kontrole</span>';
}
function renderCommissionReport() {
  const metrics = byId('commissionReportMetrics'),
    table = byId('commissionLogicTable');
  if (!metrics || !table) return;
  const y = +val('chartYear') || +val('planYear') || new Date().getFullYear(),
    t = commissionSummaryTotals(y),
    rows = [...t.rows].sort((a, b) => String(b.payoutDate || b.closedAt || '').localeCompare(String(a.payoutDate || a.closedAt || '')));
  metrics.innerHTML = `<div class="metric"><span class="note">Výpisů ${y}</span><b>${num(t.imports.length)}</b></div><div class="metric"><span class="note">K vyplacení</span><b>${money(t.paid)}</b></div><div class="metric"><span class="note">Rezervní fond</span><b>${money(t.reserve)}</b></div><div class="metric"><span class="note">Odložená provize</span><b>${money(t.deferred)}</b></div><div class="metric"><span class="note">Následné provize</span><b>${money(t.recurring)}</b></div><div class="metric"><span class="note">Ke kontrole</span><b>${num(t.review)}</b></div>`;
  table.className = 'compact-table';
  table.innerHTML = `<thead><tr><th>Výpis</th><th>Klient</th><th>Producent</th><th>Produkt</th><th>Číslo smlouvy</th><th>Typ</th><th>BJ/body</th><th>Provize</th><th>Párování</th></tr></thead><tbody>${rows.slice(0, 120).map(r => `<tr class="${(+r.commission || 0) < 0 ? 'row-hot' : r.recurring ? 'row-soon' : ''}"><td>${esc(r.payoutDate || r.importedAt || '')}<br><span class="note">${esc(r.period || r.fileName || '')}</span></td><td><b>${esc(r.client || '')}</b></td><td>${esc(r.producer || '')}</td><td><b>${esc(r.product || '')}</b><br><span class="note">${esc(r.note || '')}</span></td><td>${esc(r.contractNumber || '')}</td><td>${esc(r.commissionType || '')}${r.recurring ? '<br><span class="badge green">následná</span>' : ''}</td><td class="num">${num(r.bj)}</td><td class="money">${money(r.commission)}</td><td>${commissionMatchLabel(r)}${r.clientId ? `<br><button class="btn slim" onclick="openReportClient(${r.clientId})">Klient</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="note">Zatím tu není načtený žádný provizní výpis. Nahraj ho v Obchodech tlačítkem Nahrát provize.</td></tr>'}</tbody>`;
}
function renderReports() {
  const table = byId('reportProviderTable');
  if (!table) return;
  const items = reportInvestmentItems(),
    inv = items.filter(x => investmentAreaOfItem(x) === 'investice'),
    fki = items.filter(x => investmentAreaOfItem(x) === 'fki'),
    total = items.reduce((s, x) => s + (+x.amount || 0), 0),
    invTotal = inv.reduce((s, x) => s + (+x.amount || 0), 0),
    fkiTotal = fki.reduce((s, x) => s + (+x.amount || 0), 0),
    providers = reportAumByProvider(),
    monthlyTrail = typeof investmentTrailMonthlyPayout === 'function' ? investmentTrailMonthlyPayout() : fkiTrailEstimate();
  setText('reportTotalAum', money(total));
  setText('reportInvestmentAum', money(invTotal));
  setText('reportFkiAum', money(fkiTotal));
  setText('reportTrailEstimate', money(monthlyTrail));
  table.innerHTML = `<thead><tr><th>Společnost</th><th>AUM celkem</th><th>Investice</th><th>FKI</th><th>Klientů</th><th>Produktů / fondů</th><th>Podíl</th></tr></thead><tbody>${providers.map(r => `<tr><td><b>${esc(r.provider)}</b></td><td class="money">${money(r.total)}</td><td class="money">${money(r.investice)}</td><td class="money">${money(r.fki)}</td><td class="num">${num(r.clients.size)}</td><td class="num">${num(r.products)}</td><td class="num">${total ? (r.total / total * 100).toFixed(1) : '0.0'} %</td></tr>`).join('') || '<tr><td colspan="7" class="note">Zatím tu nejsou investiční ani FKI data k reportu.</td></tr>'}</tbody>`;
  renderReportDetails();
  renderReportFundSettings();
  if (typeof Chart === 'undefined') return;
  const canvas = byId('aumProviderChart');
  if (!canvas) return;
  if (aumProviderChart) aumProviderChart.destroy();
  const palette = ['rgba(37,99,235,.78)', 'rgba(8,145,178,.72)', 'rgba(21,128,61,.72)', 'rgba(124,58,237,.68)', 'rgba(180,83,9,.7)', 'rgba(185,28,28,.62)', 'rgba(71,85,105,.62)'];
  aumProviderChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: providers.map(r => r.provider),
      datasets: [{
        data: providers.map(r => r.total),
        backgroundColor: providers.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,.86)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}
function fillOpportunityStatusSelect(id, selected = '') {
  const el = byId(id);
  if (el) el.innerHTML = OPPORTUNITY_STATUSES.map(s => `<option ${s === selected ? 'selected' : ''}>${s}</option>`).join('');
}
function opportunityCategoryOptions() {
  return ['Život', 'Auto', 'Nemovitost', 'Hypotéka', 'Úvěry', 'Penze', 'Investice', 'FKI', 'Ostatní'];
}
function fillOpportunityCategorySelect(id, selected = '') {
  const cats = opportunityCategoryOptions(),
    el = byId(id);
  if (el) el.innerHTML = cats.map(s => `<option ${s === selected ? 'selected' : ''}>${s}</option>`).join('') + `<option value="__custom" ${selected && !cats.includes(selected) ? 'selected' : ''}>Vlastní...</option>`;
}
function toggleOpportunityCustomCategory() {
  const el = byId('oCategoryCustom');
  if (!el) return;
  const custom = val('oCategory') === '__custom';
  el.disabled = !custom;
  el.parentElement.style.opacity = custom ? '1' : '.45';
  if (!custom) el.value = '';
}
function opportunityInlineStatuses() {
  return OPPORTUNITY_STATUSES;
}
function opportunityStatusSelect(o) {
  return `<select class="opp-inline-status ${opportunityStatusClass(o.status)}" onchange="updateOpportunityStatus('${esc(o.id)}',this.value)">${opportunityInlineStatuses().map(s => `<option value="${esc(s)}" ${s === o.status ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
}
function updateOpportunityStatus(id, status) {
  if (String(id).startsWith('contract_')) {
    const contractId = String(id).replace('contract_', '');
    state.contractOpportunityStatuses = state.contractOpportunityStatuses || {};
    state.contractOpportunityStatuses[contractId] = status;
    const s = state.contracts.find(x => String(x.id) === String(contractId));
    if (s) {
      s.updatedAt = today();
      s.log = s.log || [];
      s.log.push({
        d: today(),
        t: 'CRM stav příležitosti: ' + status
      });
      if (status === 'Podepsáno') {
        s.status = 'podepsano';
        s.dealDate = s.dealDate || today();
        s.createDeal = 'yes';
        persist();
        openDealFromContract(s);
        return;
      }
    }
  } else {
    const o = state.opportunities.find(x => String(x.id) === String(id));
    if (o) {
      const old = o.status;
      o.status = status;
      o.statusDate = today();
      o.updatedAt = today();
      o.history = o.history || [];
      if (old !== status) o.history.push({
        d: today(),
        t: status
      });
      if (status === 'Podepsáno') {
        persist();
        openDealFromOpportunity(o);
        return;
      }
    }
  }
  persist();
  renderAll();
}
function opportunitySortValue(x, key) {
  if (key === 'client') return norm(clientName(x.c));
  if (key === 'area') return norm(x.o.category);
  if (key === 'volume') return +x.o.bj || 0;
  if (key === 'date') return String(x.o.statusDate || x.o.date || x.o.expectedDate || '');
  return OPPORTUNITY_STATUSES.indexOf(x.o.status);
}
function compareOpportunities(a, b) {
  const sort = val('oppSort') || 'status';
  if (sort === 'client' || sort === 'area') {
    const r = String(opportunitySortValue(a, sort)).localeCompare(String(opportunitySortValue(b, sort)), 'cs');
    return r || String(a.o.statusDate || '').localeCompare(String(b.o.statusDate || ''));
  }
  if (sort === 'volume') return opportunitySortValue(a, 'volume') - opportunitySortValue(b, 'volume') || clientName(a.c).localeCompare(clientName(b.c), 'cs');
  if (sort === 'date') return String(a.o.statusDate || a.o.date || '').localeCompare(String(b.o.statusDate || b.o.date || '')) || clientName(a.c).localeCompare(clientName(b.c), 'cs');
  return opportunitySortValue(a, 'status') - opportunitySortValue(b, 'status') || String(a.o.expectedDate || a.o.statusDate).localeCompare(String(b.o.expectedDate || b.o.statusDate)) || clientName(a.c).localeCompare(clientName(b.c), 'cs');
}
function renderOpportunities() {
  const table = byId('opportunityTable');
  if (!table) return;
  const filter = byId('oppStatusFilter');
  if (filter) {
    const cur = filter.value;
    filter.innerHTML = '<option value="">Všechny otevřené</option>' + OPPORTUNITY_STATUSES.filter(s => s !== 'Podepsáno').map(s => `<option ${s === cur ? 'selected' : ''}>${s}</option>`).join('');
  }
  const q = norm(val('oppSearch')),
    sf = val('oppStatusFilter'),
    year = new Date().getFullYear();
  let rows = allOpenOpportunities().map(o => ({
    o,
    c: findClient(o.clientId)
  })).filter(x => sf ? x.o.status === sf : isOpenOpportunity(x.o)).filter(x => !q || norm([clientName(x.c), x.o.status, x.o.contractStatusLabel, x.o.category, x.o.company, x.o.product, x.o.note, x.o.owner, x.o.isContractOpportunity ? 'smlouva' : ''].join(' ')).includes(q));
  rows.sort(compareOpportunities);
  const open = rows.filter(x => isOpenOpportunity(x.o)),
    bj = open.reduce((s, x) => s + (+x.o.bj || 0), 0),
    cash = open.reduce((s, x) => s + (+x.o.actualCommission || +x.o.expectedCommission || opportunityCash(x.o, year)), 0);
  const m = byId('oppMetrics');
  if (m) m.innerHTML = `<div class="metric"><span class="note">Otevřené</span><b>${num(open.length)}</b></div><div class="metric"><span class="note">Očekávané BJ</span><b>${num(bj)}</b></div><div class="metric"><span class="note">Očekávaná provize</span><b>${money(cash)}</b></div><div class="metric"><span class="note">Po podpisu</span><b>do obchodů</b></div>`;
  table.className = 'compact-table';
  table.innerHTML = `<thead><tr><th>Klient</th><th>Datum</th><th>Stav</th><th>Oblast</th><th>Produkt</th><th>Objem klienta</th><th>BJ</th><th>Oček. provize</th><th>Další termín</th><th>Akce</th></tr></thead><tbody>${rows.map(x => {
    const edit = x.o.isContractOpportunity ? `openContractModal(${x.o.clientId},${x.o.contractId})` : `openOpportunityModal(${x.o.clientId},${x.o.id})`,
      contractBadge = x.o.contractStatusLabel ? `<br><span class="chip">Smlouva: ${esc(x.o.contractStatusLabel)}</span>` : '';
    return `<tr class="${isOpenOpportunity(x.o) ? 'opp-hot' : ''}"><td><b>${esc(clientName(x.c))}</b>${x.o.isContractOpportunity ? '<br><span class="chip">ze smlouvy</span>' : ''}</td><td>${esc(x.o.statusDate || x.o.date || '')}</td><td>${opportunityStatusSelect(x.o)}${contractBadge}</td><td>${esc(x.o.category || '')}</td><td><b>${esc(x.o.product || '')}</b><br><span class="note">${esc(x.o.company || '')}</span></td><td class="money">${money(x.o.amount)}</td><td class="num">${num(x.o.bj)}</td><td class="money">${money(+x.o.actualCommission || +x.o.expectedCommission || opportunityCash(x.o, year))}</td><td>${esc(x.o.expectedDate || '')}</td><td><button class="btn slim" onclick="selectedClientId=${x.o.clientId};showView('clients')">Klient</button> <button class="icon-btn" onclick="${edit}">✎</button></td></tr>`;
  }).join('') || '<tr><td colspan="10" class="note">Zatím žádné otevřené příležitosti.</td></tr>'}</tbody>`;
}
function renderVersion() {
  const label = `v${VERSION}`;
  const badge = byId('appVersionBadge');
  if (badge) badge.textContent = label;
  const title = byId('settingsVersionTitle');
  if (title) title.textContent = `FILIP CRM ${label}`;
  const status = byId('settingsVersionStatus');
  if (status) status.innerHTML = `<b>Aktuální verze aplikace: ${esc(label)}</b><br>${esc(VERSION_NOTE)}<br>Pokud Mac, GitHub nebo iPad ukazuje jiné číslo, díváš se na jinou verzi aplikace.`;
}
function renderPart(name, fn) {
  try {
    fn();
  } catch (e) {
    console.error('Render ' + name, e);
  }
}
function renderDashboardMetrics() {
  fillDashboardFilters();
  const year = +val('chartYear') || new Date().getFullYear(),
    month = new Date().getMonth(),
    yearDeals = visibleDeals().filter(d => yearOf(d.date) === year),
    deals = dashboardFilteredDeals(yearDeals),
    monthDeals = deals.filter(d => monthOf(d.date) === month),
    unpaid = deals.filter(d => !dealPaid(d)),
    late = unpaid.filter(isLateUnpaid),
    paidActual = deals.reduce((s, d) => s + dealPaidActualCommission(d), 0),
    unpaidValue = unpaid.reduce((s, d) => s + dealExpectedCommission(d, year), 0),
    lateValue = late.reduce((s, d) => s + dealExpectedCommission(d, year), 0),
    source = val('dashLeadSourceFilter');
  dashboardFilterSummary(year, yearDeals, deals);
  setText('kpiYearBj', num(deals.reduce((s, d) => s + dealBJ(d), 0)));
  setText('kpiYearCash', money(paidActual));
  setText('kpiMonthBj', num(monthDeals.reduce((s, d) => s + dealBJ(d), 0)));
  setText('kpiMonthName', MONTHS[month]);
  setText('kpiMonthCash', money(monthDeals.reduce((s, d) => s + dealCash(d, year), 0)));
  setText('kpiUnpaidCommission', money(unpaidValue));
  setText('kpiLateUnpaid', `3+ měsíce: ${money(lateValue)} · ${num(late.length)} obchodů`);
  setText('kpiInv', money(deals.filter(d => ['investice', 'fki'].includes(areaForDeal(d))).reduce((s, d) => s + dealVolume(d), 0)));
  setText('kpiMortgageYear', money(deals.filter(d => d.category === 'Hypotéky').reduce((s, d) => s + dealVolume(d), 0)));
  setText('kpiDealsYear', num(deals.filter(isOtherDashboardDeal).length));
  const tasks = state.contracts.filter(s => !hasStatus(s, 'vyrizeno') && !hasStatus(s, 'nechce')).map(s => ({
    s,
    c: findClient(s.clientId),
    d: contractDays(s)
  })).filter(x => (!source || leadSourceType(x.c) === source) && (x.d <= 100 || isActiveContract(x.s))).sort(compareContractRows).slice(0, 12);
  byId('dashTasks').innerHTML = `<thead><tr><th>Klient</th><th>Smlouva</th><th>Termín</th><th>Stav</th></tr></thead><tbody>${tasks.map(x => `<tr class="${rowClassContract(x.s)}"><td><b>${esc(clientName(x.c))}</b></td><td>${esc(x.s.type)} · ${esc(x.s.product || '')}</td><td>${x.s.anniv || ''}<br>${daysBadge(x.d)}</td><td>${getStatuses(x.s).map(statusBadge).join(' ')}</td></tr>`).join('') || '<tr><td colspan="4" class="note">Nic akutního.</td></tr>'}</tbody>`;
  renderCharts(year, deals);
  renderDuplicateWarnings();
}
function dashboardActivityTypes() {
  return new Set(['Telefon', 'Hovor', 'Volání', 'WhatsApp', 'Email', 'Schůzka', 'Úkol']);
}
function dashboardIsCallType(type) {
  const t = norm(type);
  return t.includes('telefon') || t.includes('hovor') || t.includes('vol');
}
function dashboardTaskDateKey(x) {
  return String(x.date || '9999-12-31') + '|' + String(x.time || '99:99');
}
function dashboardContactAction(row) {
  const c = findClient(row.clientId),
    clientArg = JSON.stringify(String(row.clientId || ''));
  if (!c) return '';
  if (row.type === 'Email') return `<button class="btn slim" onclick="composeEmailForClient(${clientArg})">Email</button>`;
  if (dashboardIsCallType(row.type)) return `<a class="btn slim" href="${c.phone ? 'tel:' + encodeURIComponent(c.phone) : '#'}">Volat</a>`;
  if (row.type === 'WhatsApp') return `<a class="btn slim" target="_blank" href="${c.phone ? 'https://wa.me/' + normId(c.phone) : '#'}">WA</a>`;
  return '';
}
function renderClients() {
  const q = norm(val('clientSearch'));
  const list = state.clients.filter(c => !q || norm([c.name, c.phone, c.email, c.altEmails, c.birthId, c.address].join(' ')).includes(q)).sort((a, b) => clientName(a).localeCompare(clientName(b), 'cs'));
  setText('clientCountLabel', `(${num(list.length)}/${num(state.clients.length)})`);
  if (!selectedClientId && list[0]) selectedClientId = list[0].id;
  byId('clientList').innerHTML = list.map(c => `<div class="client-row ${String(c.id) === String(selectedClientId) ? 'active' : ''}" onclick="selectClient(${c.id})"><div class="avatar">${esc(initials(c.name))}</div><div><b>${esc(clientName(c))}</b><small>${esc(c.phone || 'bez telefonu')} · ${esc(contactLabel(c))}</small></div></div>`).join('') || '<p class="note">Zatím žádný klient.</p>';
  renderClientDetail();
}
function selectClient(id) {
  selectedClientId = id;
  clientSection = 'overview';
  renderClients();
}
function contactLabel(c) {
  return c.contactPref === 'whatsapp' ? 'WhatsApp' : c.contactPref === 'telefon' ? 'Telefon / SMS' : 'Email';
}
function copyText(text, label = 'Hodnota') {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => toast(`${label} zkopírováno`)).catch(() => prompt('Zkopíruj hodnotu:', text));
}
function toast(msg) {
  let t = byId('miniToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'miniToast';
    t.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:100;background:rgba(23,32,51,.92);color:#fff;border-radius:14px;padding:10px 13px;font-weight:850;font-size:12px;box-shadow:0 18px 50px rgba(23,32,51,.22)';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.display = 'none', 1800);
}
function contactGrid(c) {
  const phone = c.phone || '',
    email = c.email || '',
    addr = c.address || '';
  return `<div class="contact-grid">
  <a class="contact-link" href="${phone ? 'tel:' + encodeURIComponent(phone) : '#'}" onclick="${phone ? `copyText('${esc(phone)}','Telefon')` : 'return false'}"><span>☎</span><b>Tel</b><span>${esc(phone || 'bez telefonu')}</span>${phone ? '<em class="copy-btn">kopie</em>' : ''}</a>
  <a class="contact-link" href="${email ? 'mailto:' + encodeURIComponent(email) : '#'}" onclick="${email ? `copyText('${esc(email)}','E-mail')` : 'return false'}"><span>@</span><b>E-mail</b><span>${esc(email || 'bez e-mailu')}</span>${email ? '<em class="copy-btn">napsat</em>' : ''}</a>
  <a class="contact-link" href="${addr ? 'https://maps.google.com/?q=' + encodeURIComponent(addr) : '#'}" target="_blank" onclick="${addr ? `copyText('${esc(addr)}','Adresa')` : 'return false'}"><span>⌂</span><b>Adresa</b><span>${esc(addr || 'bez adresy')}</span>${addr ? '<em class="copy-btn">mapa</em>' : ''}</a>
</div>`;
}
function splitEmails(v) {
  return String(v || '').split(/[,\s;]+/).map(x => x.trim()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
}
function clientEmails(c) {
  return [...new Set([...splitEmails(c?.email), ...splitEmails(c?.altEmails)])];
}
function clientGivenRecommendations(c) {
  const name = norm(clientName(c));
  return (state.referrals || []).filter(r => norm(r.from) === name).length + state.clients.filter(x => String(x.id) !== String(c.id) && x.leadType === 'referral' && norm(x.leadSource) === name).length;
}
function clientTiparLeads(c) {
  const name = norm(clientName(c));
  return state.clients.filter(x => String(x.id) !== String(c.id) && x.leadType === 'tipar' && norm(x.leadSource) === name).length;
}
function clientSourceSummary(c) {
  const rec = clientGivenRecommendations(c),
    tip = clientTiparLeads(c);
  return `${leadSourceBadge(c)}${referrerBadge(c)}${tip ? `<span class="badge purple">Natipoval: ${num(tip)}</span>` : ''}${rec ? `<span class="badge green">Doporučil: ${num(rec)}</span>` : ''}`;
}
function findClientByName(name) {
  return state.clients.find(c => norm(clientName(c)) === norm(name));
}
function referralPairKey(from, to) {
  return norm(from) + '|' + norm(to);
}
function mergeReferralRow(map, row) {
  const k = referralPairKey(row.from, row.to);
  if (!map[k]) {
    map[k] = row;
    return;
  }
  const old = map[k];
  if (row.type === 'tipar') old.type = 'tipar';
  old.topic = [old.topic, row.topic].filter(Boolean).join(' · ');
  old.date = old.date && row.date ? String(old.date).localeCompare(String(row.date)) <= 0 ? old.date : row.date : old.date || row.date;
  old.clientId = old.clientId || row.clientId || null;
  old.commissionPct = Math.max(+old.commissionPct || 0, +row.commissionPct || 0);
}
function sourceReferralRecords(sourceClient) {
  const source = clientName(sourceClient),
    sourceNorm = norm(source),
    map = {};
  state.clients.filter(c => String(c.id) !== String(sourceClient.id) && ['tipar', 'referral'].includes(c.leadType) && norm(c.leadSource) === sourceNorm).forEach(c => mergeReferralRow(map, {
    id: 'client_' + c.id,
    type: c.leadType,
    from: source,
    to: clientName(c),
    topic: c.leadType === 'tipar' ? 'Tip od klienta' : 'Doporučení klienta',
    date: c.leadDate || c.createdAt || '',
    clientId: c.id,
    commissionPct: +c.leadCommissionPct || 0,
    source: 'client'
  }));
  (state.referrals || []).filter(r => norm(r.from) === sourceNorm).forEach(r => {
    const target = r.clientId ? findClient(r.clientId) : findClientByName(r.to);
    mergeReferralRow(map, {
      id: 'ref_' + r.id,
      type: 'referral',
      from: r.from,
      to: r.to,
      topic: r.topic || '',
      date: r.date || '',
      clientId: target?.id || null,
      commissionPct: 0,
      source: 'referral'
    });
  });
  return Object.values(map).sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.to.localeCompare(b.to, 'cs'));
}
function referralRecordStats(row, year = new Date().getFullYear()) {
  const target = row.clientId ? findClient(row.clientId) : findClientByName(row.to),
    deals = target ? clientDeals(target.id).filter(d => yearOf(d.date) === year) : [];
  return {
    target,
    deals,
    count: deals.length,
    bj: deals.reduce((s, d) => s + dealBJ(d), 0),
    cash: deals.reduce((s, d) => s + dealCash(d, year), 0),
    inv: deals.filter(d => ['investice', 'fki'].includes(areaForDeal(d))).reduce((s, d) => s + dealVolume(d), 0),
    mort: deals.filter(d => d.category === 'Hypotéky').reduce((s, d) => s + dealVolume(d), 0)
  };
}
function recommendationsMini(c) {
  const rows = sourceReferralRecords(c),
    year = new Date().getFullYear();
  return `<div class="toolbar"><div><div class="eyebrow">Doporučení</div><h2>Koho klient doporučil nebo natipoval</h2></div><button class="btn primary" onclick="openClientReferralModal(${c.id})">+ Doporučení</button></div><div class="table-wrap"><table class="compact-table"><thead><tr><th>Typ</th><th>Koho</th><th>Datum</th><th>Obchodů</th><th>BJ</th><th>Oček. provize</th><th>Investice</th><th>Hypotéky</th><th>Akce</th></tr></thead><tbody>${rows.map(r => {
    const s = referralRecordStats(r, year);
    return `<tr><td>${r.type === 'tipar' ? '<span class="badge purple">Tipař</span>' : '<span class="badge green">Doporučení</span>'}</td><td><b>${esc(r.to)}</b>${s.target ? '<br><span class="note">spárováno s klientem</span>' : '<br><span class="note">zatím bez karty klienta</span>'}</td><td>${esc(r.date || '')}</td><td class="num">${num(s.count)}</td><td class="num">${num(s.bj)}</td><td class="money">${money(s.cash)}</td><td class="money">${money(s.inv)}</td><td class="money">${money(s.mort)}</td><td>${s.target ? `<button class="btn slim" onclick="selectedClientId=${s.target.id};showView('clients')">Otevřít</button>` : `<button class="btn slim" onclick="openClientReferralModal(${c.id},'${encodeURIComponent(r.to)}',true)">Založit</button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="note">Zatím tu není žádné doporučení ani tip od tohoto klienta.</td></tr>'}</tbody></table></div>`;
}
function fillReferralTargetSelect(selected = '') {
  const el = byId('crExistingClient');
  if (!el) return;
  el.innerHTML = '<option value="">Vybrat existujícího klienta</option>' + state.clients.filter(c => String(c.id) !== String(referralSourceClientId)).sort((a, b) => clientName(a).localeCompare(clientName(b), 'cs')).map(c => `<option value="${c.id}" ${String(c.id) === String(selected) ? 'selected' : ''}>${esc(clientName(c))}</option>`).join('');
}
function toggleClientReferralFields() {
  const pct = byId('crCommissionPct');
  if (pct) pct.disabled = val('crType') !== 'tipar';
}
function openClientReferralModal(sourceId, name = '', encoded = false) {
  const c = findClient(sourceId);
  if (!c) return;
  referralSourceClientId = sourceId;
  fillReferralTargetSelect();
  setVal('crType', 'referral');
  setVal('crExistingClient', '');
  setVal('crNewClient', encoded ? decodeURIComponent(name) : name || '');
  setVal('crPhone', '');
  setVal('crEmail', '');
  setVal('crDate', today());
  setVal('crTopic', '');
  setVal('crCommissionPct', '');
  setVal('crNote', '');
  setText('clientReferralTitle', 'Doporučení od: ' + clientName(c));
  toggleClientReferralFields();
  openModal('clientReferralModal');
}
function saveClientReferral() {
  const source = findClient(referralSourceClientId);
  if (!source) return alert('Nejdřív otevři zdrojového klienta.');
  const type = val('crType') || 'referral',
    existingId = val('crExistingClient'),
    newName = val('crNewClient').trim();
  let target = existingId ? findClient(existingId) : null;
  if (!target && newName) {
    target = {
      id: uid(),
      name: newName,
      phone: val('crPhone').trim(),
      email: val('crEmail').trim(),
      contactPref: 'email',
      birthId: '',
      address: '',
      note: val('crNote').trim(),
      createdAt: today()
    };
    state.clients.push(target);
  }
  if (!target) return alert('Vyber existujícího klienta nebo napiš jméno nového.');
  target.leadType = type;
  target.leadSource = clientName(source);
  target.leadDate = val('crDate') || today();
  target.leadCommissionPct = type === 'tipar' ? parseMoney(val('crCommissionPct')) : 0;
  if (!target.phone && val('crPhone')) target.phone = val('crPhone').trim();
  if (!target.email && val('crEmail')) target.email = val('crEmail').trim();
  if (val('crNote')) target.note = [target.note, val('crNote').trim()].filter(Boolean).join('\n');
  if (type === 'referral') {
    const exists = (state.referrals || []).some(r => norm(r.from) === norm(clientName(source)) && norm(r.to) === norm(clientName(target)));
    if (!exists) state.referrals.push({
      id: uid(),
      from: clientName(source),
      to: clientName(target),
      topic: val('crTopic').trim() || 'Nový klient',
      date: val('crDate') || today(),
      createdAt: today(),
      clientId: target.id,
      source: 'client-referral'
    });
  }
  addActivity(source.id, type === 'tipar' ? 'Tipař' : 'Doporučení', `${type === 'tipar' ? 'Natipoval' : 'Doporučil'}: ${clientName(target)}`, true);
  addActivity(target.id, 'Zdroj klienta', `${leadTypeLabel(type)} od: ${clientName(source)}`, true);
  selectedClientId = source.id;
  closeModal('clientReferralModal');
  persist();
  renderAll();
  saveToast('Doporučení u klienta uloženo');
}
function clientReportSections(c) {
  const id = c.id,
    contracts = clientContracts(id),
    opps = clientOpenOpportunities(id),
    deals = clientDeals(id),
    inv = clientDisplayInvestmentItems(id),
    notes = clientNotes(id);
  return [{
    id: 'summary',
    label: 'Souhrn spolupráce',
    count: 1,
    html: () => reportSummary(c, contracts, deals, opps, inv)
  }, {
    id: 'contracts',
    label: 'Smlouvy a pojistky',
    count: contracts.length,
    html: () => reportTable('Smlouvy a pojistky', ['Typ', 'Produkt', 'Společnost', 'Termín', 'Stav'], contracts.map(s => [s.type, s.product || '', s.company || '', s.anniv || '', getStatuses(s).map(x => STATUS_LABELS[x] || x).join(', ') || 'Bez stavu']))
  }, {
    id: 'opportunities',
    label: 'Co máme v řešení',
    count: opps.length,
    html: () => reportTable('Co máme v řešení', ['Oblast', 'Produkt', 'Stav', 'Termín', 'Poznámka'], opps.map(o => [o.category || '', o.product || '', o.status || '', o.expectedDate || o.statusDate || '', o.note || '']))
  }, {
    id: 'deals',
    label: 'Uzavřené obchody',
    count: deals.length,
    html: () => reportTable('Uzavřené obchody', ['Datum', 'Kategorie', 'Produkt', 'Objem', 'BJ'], deals.map(d => [d.date || '', d.category || '', d.product || '', money(dealVolume(d)), num(dealBJ(d))]))
  }, {
    id: 'investments',
    label: 'Investice',
    count: inv.filter(x => investmentAreaOfItem(x) === 'investice').length,
    html: () => reportTable('Investice', ['Produkt', 'Společnost', 'Vloženo', 'Aktuální hodnota', 'Výnos', 'Aktualizace', 'Zdroj'], inv.filter(x => investmentAreaOfItem(x) === 'investice').map(x => [x.product || '', x.company || '', money(investmentInvestedAmount(x)), money(x.amount), x.snapshot ? [money(x.snapshot.gainAmount), x.snapshot.gainPct ? num(x.snapshot.gainPct) + ' %' : ''].filter(Boolean).join(' / ') : '', x.snapshot?.date || x.date || '', x.snapshot?.source || '']))
  }, {
    id: 'fki',
    label: 'FKI',
    count: inv.filter(x => investmentAreaOfItem(x) === 'fki').length,
    html: () => reportTable('FKI', ['Produkt', 'Společnost', 'Objem / hodnota', 'Datum'], inv.filter(x => investmentAreaOfItem(x) === 'fki').map(x => [x.product || '', x.company || '', money(x.amount), x.date || '']))
  }, {
    id: 'notes',
    label: 'Poznámky',
    count: notes.length,
    html: () => reportTable('Poznámky', ['Datum', 'Název', 'Témata'], notes.slice(0, 8).map(n => [n.date || '', n.title || 'Poznámka', n.tags || '']))
  }].filter(x => x.count);
}
function reportSummary(c, contracts, deals, opps, inv) {
  const year = new Date().getFullYear(),
    yd = deals.filter(d => yearOf(d.date) === year);
  return `<section><h2>Souhrn spolupráce</h2><div class="kpis"><div><span>Produktů</span><b>${num(contracts.length)}</b></div><div><span>Obchodů letos</span><b>${num(yd.length)}</b></div><div><span>V řešení</span><b>${num(opps.length)}</b></div><div><span>Investice + FKI</span><b>${money(inv.reduce((s, x) => s + x.amount, 0))}</b></div></div>${c.note ? `<p>${esc(c.note)}</p>` : ''}</section>`;
}
function reportTable(title, heads, rows) {
  return `<section><h2>${esc(title)}</h2><table><thead><tr>${heads.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`;
}
function clientReportHtml(c, sections, note) {
  const css = 'body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f6f8fc;color:#152034}.wrap{max-width:1040px;margin:0 auto;padding:34px}header,section{background:rgba(255,255,255,.82);border:1px solid #d8e4f2;border-radius:24px;padding:22px;margin-bottom:16px;box-shadow:0 20px 70px rgba(70,90,120,.12)}h1{font-size:34px;margin:0 0 6px}h2{font-size:20px;margin:0 0 14px}.muted{color:#61708a}.chips{display:flex;gap:8px;flex-wrap:wrap}.chip{background:#eaf2ff;color:#1d63d8;border-radius:999px;padding:5px 9px;font-weight:800;font-size:12px}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.kpis div{background:#f8fbff;border:1px solid #dde8f5;border-radius:16px;padding:12px}.kpis span{display:block;color:#61708a;font-size:12px;font-weight:800;text-transform:uppercase}.kpis b{font-size:22px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;color:#61708a;text-transform:uppercase;font-size:11px;background:#f1f6fd}td,th{border-bottom:1px solid #dce6f2;padding:9px 8px}p{line-height:1.55}@media(max-width:760px){.wrap{padding:18px}.kpis{grid-template-columns:1fr 1fr}table{font-size:12px}}';
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report - ${esc(clientName(c))}</title><style>${css}</style></head><body><div class="wrap"><header><div class="muted">Klientský report</div><h1>${esc(clientName(c))}</h1><div class="chips"><span class="chip">Kontakt: ${esc(contactLabel(c))}</span>${c.phone ? `<span class="chip">Tel: ${esc(c.phone)}</span>` : ''}${c.email ? `<span class="chip">E-mail: ${esc(c.email)}</span>` : ''}<span class="chip">${new Date().toLocaleDateString('cs-CZ')}</span></div></header>${note ? `<section><h2>Poznámka poradce</h2><p>${esc(note).replace(/\n/g, '<br>')}</p></section>` : ''}${sections.map(s => s.html()).join('')}</div></body></html>`;
}
function renderClientDetail() {
  const c = findClient(selectedClientId),
    el = byId('clientDetail');
  if (!c) {
    el.innerHTML = '<div class="note">Vyber nebo přidej klienta.</div>';
    return;
  }
  if (clientSection === 'emails') clientSection = 'overview';
  const contracts = clientContracts(c.id),
    deals = clientDeals(c.id),
    acts = clientActivities(c.id),
    opps = clientOpenOpportunities(c.id),
    notes = clientNotes(c.id),
    year = new Date().getFullYear();
  el.innerHTML = `<div class="client-hero"><div class="avatar">${esc(initials(c.name))}</div><div class="detail-title"><div class="eyebrow">Karta klienta</div><h2>${esc(clientName(c))}</h2><div class="chips"><span class="badge blue">Kontakt: ${esc(contactLabel(c))}</span>${c.birthId ? `<span class="chip">RČ/IČO: ${esc(c.birthId)}</span>` : ''}<span class="chip">${contracts.length} produktů</span><span class="chip">${deals.length} obchodů</span><span class="chip">${opps.filter(isOpenOpportunity).length} příležitostí</span>${clientSourceSummary(c)}</div></div>${contactGrid(c)}</div><div class="actions client-actions"><button class="btn primary" onclick="openClientReportModal(${c.id})">Report pro klienta</button><button class="btn" onclick="openClientReferralModal(${c.id})">+ Doporučení</button><button class="btn" onclick="openActivityModal(${c.id})">+ Aktivita</button><button class="btn" onclick="openOpportunityModal(${c.id})">+ Příležitost</button><button class="btn" onclick="openDealModal(${c.id})">+ Obchod</button><button class="btn" onclick="openContractModal(${c.id})">+ Smlouva</button><button class="btn" onclick="openNoteModal(${c.id})">+ Poznámka</button><button class="btn" onclick="openClientModal(${c.id})">Upravit klienta</button></div><div class="subnav"></div>`;
  const labels = {
    overview: 'Přehled',
    portfolio: 'Portfolio',
    opportunities: 'Příležitosti',
    contracts: 'Smlouvy',
    deals: 'Obchody',
    recommendations: 'Doporučení',
    notes: 'Poznámky',
    history: 'Historie'
  };
  el.querySelector('.subnav').innerHTML = Object.entries(labels).map(([k, l]) => `<button class="subtab ${clientSection === k ? 'active' : ''}" onclick="clientSection='${k}';renderClientDetail()">${l}</button>`).join('');
  el.insertAdjacentHTML('beforeend', clientSection === 'overview' ? clientOverview(c, contracts, deals, acts, year) : clientSection === 'portfolio' ? clientPortfolio(c, contracts, deals) : clientSection === 'opportunities' ? opportunitiesMini(opps) : clientSection === 'contracts' ? contractsMini(contracts) : clientSection === 'deals' ? dealsMini(deals, year) : clientSection === 'recommendations' ? recommendationsMini(c) : clientSection === 'notes' ? notesMini(notes) : historyMini(c, acts, contracts, deals));
}
function clientInvestmentSummary(clientId) {
  const items = clientDisplayInvestmentItems(clientId),
    classic = items.filter(x => investmentAreaOfItem(x) === 'investice').reduce((s, x) => s + (+x.amount || 0), 0),
    fki = items.filter(x => investmentAreaOfItem(x) === 'fki').reduce((s, x) => s + (+x.amount || 0), 0),
    invested = items.reduce((s, x) => s + investmentInvestedAmount(x), 0);
  return {
    items,
    classic,
    fki,
    total: classic + fki,
    invested,
    gain: classic + fki - invested
  };
}
function clientOverview(c, contracts, deals, acts, year) {
  const stats = clientAreaStats(c.id),
    inv = clientDisplayInvestmentItems(c.id),
    sum = clientInvestmentSummary(c.id),
    opps = clientOpenOpportunities(c.id).filter(isOpenOpportunity);
  return `${clientTools(stats)}<div class="mini-card"><h3>Souhrn</h3><p class="note">${esc(c.note || 'Bez poznámky.')}</p><div class="chips"><span class="badge blue">${contracts.length} produktů</span><span class="badge green">${deals.length} obchodů</span><span class="badge orange">${acts.length} aktivit</span>${opps.length ? `<span class="badge purple">${opps.length} v řešení</span>` : ''}</div>${sum.items.length ? `<div class="investment-summary" style="margin-top:14px"><div class="metric"><span class="note">Investice celkem</span><b>${money(sum.total)}</b></div><div class="metric"><span class="note">Běžné investice</span><b>${money(sum.classic)}</b></div><div class="metric"><span class="note">FKI</span><b>${money(sum.fki)}</b></div><div class="metric"><span class="note">Vloženo celkem</span><b>${money(sum.invested)}</b></div></div>` : ''}</div><div class="split" style="margin-top:12px"><div class="mini-card"><h3>X-sell panel</h3>${xsellPanel(stats)}${opportunityMiniList(opps)}</div><div class="mini-card"><h3>Investice a FKI klienta</h3>${investmentMini(inv, c.id)}</div></div>`;
}
function clientTools(stats) {
  const tools = ['investice', 'fki', 'pojisteni', 'uvery', 'ostatni'];
  return `<div class="tools-row">${tools.map(k => `<button class="tool-tile ${stats[k]?.count ? 'active' : ''}" onclick="focusClientPortfolio('${k}')"><span>${esc(areaLabel(k))}</span><span class="count">${num(stats[k]?.count || 0)}</span></button>`).join('')}</div>`;
}
function xsellPanel(stats) {
  const max = Math.max(1, ...Object.values(stats).map(x => x.count));
  return `<div class="xsell-list">${['investice', 'fki', 'sporeni', 'penze', 'pojisteni', 'uvery', 'ostatni'].map(k => {
    const x = stats[k] || {
      count: 0
    };
    const pct = Math.min(100, Math.round(x.count / max * 100));
    return `<button class="xsell-row ${x.count ? '' : 'missing'}" onclick="focusClientPortfolio('${k}')"><b>${esc(areaLabel(k))}</b><div class="xsell-bar"><span style="width:${pct}%"></span></div><span class="num">${num(x.count)}</span></button>`;
  }).join('')}</div>`;
}
function investmentMini(items, clientId) {
  if (!items.length) return `<p class="note">U klienta zatím nevidím investiční produkt ani FKI. Nový návrh založ v záložce Investice nebo FKI.</p><button class="btn slim" onclick="selectedInvestmentClientId=${clientId};selectedClientId=${clientId};showView('investments')">Otevřít Investice</button> <button class="btn slim primary" onclick="selectedFkClientId=${clientId};selectedClientId=${clientId};showView('fki')">Otevřít FKI</button>`;
  return `<div>${items.slice(0, 5).map(x => `<div class="product-row"><div><b>${esc(x.product || areaLabel(investmentAreaOfItem(x)))}</b><span class="note">${esc(x.company || 'bez producenta')} · ${esc(areaLabel(investmentAreaOfItem(x)))} · ${esc(x.kind)}</span></div><div class="money">${money(x.amount)}</div></div>`).join('')}</div>`;
}
function clientPortfolio(c, contracts, deals) {
  const groups = {
      investice: [],
      fki: [],
      penze: [],
      uvery: [],
      pojisteni: [],
      ostatni: []
    },
    contractIds = new Set(contracts.map(s => String(s.id)));
  clientDisplayInvestmentItems(c.id).forEach(x => groups[investmentAreaOfItem(x)].push({
    title: x.product || x.kind || 'Investice',
    sub: [x.company, x.isin, money(x.amount)].filter(Boolean).join(' · '),
    action: x.sourceType === 'deal' ? `openDealModal(${x.clientId},${x.sourceId})` : x.sourceType === 'contract' ? `openContractModal(${x.clientId},${x.sourceId})` : investmentAreaOfItem(x) === 'investice' ? "showView('investments')" : "showView('fki')"
  }));
  contracts.forEach(s => {
    const area = areaForContract(s);
    if (area === 'investice' || area === 'fki') return;
    groups[area].push({
      title: s.product || s.type,
      sub: [s.company, s.number, s.amount].filter(Boolean).join(' · '),
      action: `openContractModal(${s.clientId},${s.id})`
    });
  });
  deals.forEach(d => {
    const area = areaForDeal(d);
    if (area === 'investice' || area === 'fki') return;
    const linked = linkedContractForDeal(d);
    if (linked && contractIds.has(String(linked.id))) return;
    groups[area].push({
      title: d.product || d.category,
      sub: [d.company, d.date, money(dealVolume(d))].filter(Boolean).join(' · '),
      action: `openDealModal(${d.clientId},${d.id})`
    });
  });
  return `<div class="portfolio-grid">${Object.entries(groups).map(([k, rows]) => `<div class="portfolio-card ${clientPortfolioFocus === k ? 'focus' : ''}" data-portfolio-area="${k}"><h3>${esc(areaLabel(k))}</h3>${rows.map(r => `<div class="product-row"><div><b>${esc(r.title)}</b><span class="note">${esc(r.sub)}</span></div><button class="btn slim" onclick="${r.action}">Detail</button></div>`).join('') || `<div class="product-row"><span class="note">Zatím nic sjednáno.</span><button class="btn slim" onclick="openDealModal(${c.id})">+ Přidat</button></div>`}</div>`).join('')}</div>`;
}
function opportunityMiniList(rows) {
  if (!rows.length) return '';
  return `<div style="margin-top:12px"><h3>V řešení</h3>${rows.slice(0, 4).map(o => `<div class="product-row"><div><b>${esc(o.product || o.category)}</b><span class="note">${esc(o.company || '')} · ${opportunityBadge(o.status)}</span></div><div class="money">${num(o.bj)} BJ</div></div>`).join('')}</div>`;
}
function opportunitiesMini(rows) {
  const defs = opportunityFolderDefs(rows),
    groups = {};
  defs.forEach(([k]) => groups[k] = []);
  rows.forEach(o => {
    const k = opportunityFolderKey(o);
    groups[k] = groups[k] || [];
    groups[k].push(o);
  });
  return `<div class="opportunity-board">${defs.map(([k, label]) => {
    const items = groups[k] || [],
      hot = items.some(isOpenOpportunity);
    return `<div class="opportunity-folder ${hot ? 'hot' : ''}"><h3><span>${esc(label)}</span><span class="badge ${hot ? 'blue' : ''}">${num(items.length)}</span></h3>${items.map(o => opportunityFolderRow(o)).join('') || `<div class="opp-folder-row"><div class="opp-folder-main"><span class="note">Zatím nic v řešení.</span><button class="btn slim" onclick="openOpportunityModal(${selectedClientId || 'null'})">+ Přidat</button></div></div>`}</div>`;
  }).join('')}</div>`;
}
function opportunityFolderRow(o) {
  const edit = o.isContractOpportunity ? `openContractModal(${o.clientId},${o.contractId})` : `openOpportunityModal(${o.clientId},${o.id})`,
    contractBadge = o.contractStatusLabel ? `<span class="chip">Smlouva: ${esc(o.contractStatusLabel)}</span>` : '',
    amount = +o.amount || 0 ? money(o.amount) : '',
    bj = +o.bj || 0 ? num(o.bj) + ' BJ' : '';
  return `<div class="opp-folder-row ${isOpenOpportunity(o) ? 'open' : ''}"><div class="opp-folder-main"><div><b>${esc(o.product || o.category || 'Příležitost')}</b><br><span class="note">${esc([o.company, o.statusDate || o.date, o.expectedDate ? 'termín ' + o.expectedDate : ''].filter(Boolean).join(' · '))}</span><div class="chips">${opportunityBadge(o.status)}${o.isContractOpportunity ? '<span class="chip">ze smlouvy</span>' : ''}${contractBadge}${opportunityAttachmentBadge(o)}</div></div><div class="actions"><div class="money">${esc([amount, bj].filter(Boolean).join(' · '))}</div><button class="btn slim" onclick="${edit}">Upravit</button></div></div>${o.note ? `<div class="opp-folder-note note">${esc(o.note)}</div>` : ''}</div>`;
}
function notesMini(rows) {
  return `<div class="table-wrap"><table><thead><tr><th>Název</th><th>Datum</th><th>Štítky</th><th>Typ</th><th></th></tr></thead><tbody>${rows.map(n => `<tr><td><button class="note-title-btn" onclick="openNoteViewModal(${n.id})">▧ ${esc(n.title || 'Poznámka')}</button></td><td>${esc(n.date || '')}</td><td>${noteTags(n).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</td><td><span class="badge blue">${esc(noteType(n))}</span></td><td><button class="icon-btn" onclick="openNoteModal(${n.clientId || 'null'},${n.id})">✎</button></td></tr>`).join('') || '<tr><td colspan="5" class="note">Bez poznámek.</td></tr>'}</tbody></table></div>`;
}
function contractsMini(rows, compact = false) {
  return `<div class="table-wrap"><table><thead><tr><th>Typ</th><th>Produkt</th><th>Společnost</th><th>Výročí/fixace</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${rows.map(s => `<tr class="${rowClassContract(s)}"><td>${esc(s.type)}</td><td><b>${esc(s.product || '')}</b><br><span class="note">${esc(s.number || '')}</span></td><td>${esc(s.company || '')}</td><td>${esc(s.anniv || '')}<br>${daysBadge(contractDays(s))}</td><td>${getStatuses(s).map(statusBadge).join(' ')}${contractAttachmentBadge(s)}</td><td><button class="btn slim" onclick="openContractModal(${s.clientId},${s.id})">Správa</button></td></tr>`).join('') || `<tr><td colspan="6" class="note">Bez smluv.</td></tr>`}</tbody></table></div>`;
}
function clientPerformanceMini(rows, year) {
  const inv = clientDisplayInvestmentItems(selectedClientId),
    yearRows = rows.filter(d => yearOf(d.date) === year);
  return `<div class="mini-card" style="margin-bottom:12px"><h3>Výkon klienta letos</h3><div class="grid" style="gap:8px"><div class="kpi span-4"><div class="label">BJ</div><div class="value">${num(yearRows.reduce((s, d) => s + dealBJ(d), 0))}</div></div><div class="kpi span-4"><div class="label">Oček. provize</div><div class="value">${money(yearRows.reduce((s, d) => s + dealCash(d, year), 0))}</div></div><div class="kpi span-4"><div class="label">Investice + FKI</div><div class="value">${money(inv.reduce((s, x) => s + x.amount, 0))}</div></div></div></div>`;
}
function dealsMini(rows, year) {
  return `${clientPerformanceMini(rows, year)}<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Kategorie</th><th>Produkt</th><th>Objem</th><th>BJ</th><th>Oček. provize</th><th>Akce</th></tr></thead><tbody>${rows.map(d => `<tr><td>${esc(d.date || '')}</td><td>${esc(d.category || '')}</td><td><b>${esc(d.product || '')}</b><br><span class="note">${esc(d.company || '')}</span></td><td class="money">${money(dealVolume(d))}</td><td class="num">${num(dealBJ(d))}</td><td class="money">${money(dealCash(d, yearOf(d.date)))}</td><td><button class="btn slim" onclick="openDealModal(${d.clientId},${d.id})">Upravit</button></td></tr>`).join('') || '<tr><td colspan="7" class="note">Bez obchodů.</td></tr>'}</tbody></table></div>`;
}
function historyMini(c, acts, contracts, deals) {
  const items = [...acts.map(a => ({
    d: a.date,
    time: a.time || '',
    text: [a.type, a.text].filter(Boolean).join(' : ')
  })), ...contracts.flatMap(s => (s.log || []).map(l => ({
    d: l.d,
    time: l.time || '',
    text: ['Smlouva', s.product || s.type, l.t].filter(Boolean).join(' : ')
  }))), ...deals.map(d => ({
    d: d.date,
    time: '',
    text: ['Obchod', d.category, d.product || '', num(dealBJ(d)) + ' BJ'].filter(Boolean).join(' : ')
  }))].sort((a, b) => String((b.d || '') + ' ' + (b.time || '')).localeCompare(String((a.d || '') + ' ' + (a.time || ''))));
  if (!items.length) return '<p class="note">Historie je zatím prázdná.</p>';
  return `<div class="timeline history-compact">${items.map(i => `<div class="history-line"><b>${esc([i.d, i.time].filter(Boolean).join(' '))}</b><span>: ${esc(i.text || '')}</span></div>`).join('')}</div>`;
}
function contractLineClass(s) {
  return contractVisualClass(s);
}
function contactActionButton(c) {
  if (!c) return '';
  if (c.contactPref === 'whatsapp') return `<a class="btn slim" href="${c.phone ? 'https://wa.me/' + normId(c.phone) : '#'}" target="_blank">WhatsApp</a>`;
  if (c.contactPref === 'telefon') return `<a class="btn slim" href="${c.phone ? 'tel:' + encodeURIComponent(c.phone) : '#'}">Telefon</a>`;
  return `<a class="btn slim" href="${c.email ? 'mailto:' + encodeURIComponent(c.email) : '#'}">Email</a>`;
}
function contractEmailButton(c, s = null) {
  return `<button class="btn slim" onclick="event.preventDefault();composeEmailForContract(${c?.id || 'null'},${s?.id || 'null'})">Email</button>`;
}
function contractTabDefs() {
  return [{
    id: 'auta',
    label: 'Auta + majetek',
    icon: '♢'
  }, {
    id: 'zivot',
    label: 'Životní',
    icon: '♡'
  }, {
    id: 'hypoteky',
    label: 'Hypotéky',
    icon: '⌂'
  }, {
    id: 'uvery-only',
    label: 'Úvěry',
    icon: '▣'
  }];
}
function setContractSection(sec) {
  setVal('contractSection', sec);
  renderContracts();
}
function marketMortgageRate() {
  return +(state.settings.marketMortgageRate || 5.09);
}
function saveMortgageMarketRate() {
  state.settings.marketMortgageRate = parseMoney(val('marketMortgageRate')) || marketMortgageRate();
  persist();
  renderContracts();
  saveToast('Tržní sazba aktualizována');
}
function isWorseMortgageRate(s) {
  if (s.type !== 'hypotéka') return false;
  const r = parseMoney(s.rate);
  return r && r > marketMortgageRate() + .5;
}
function contractSectionMatch(s, sec) {
  return !sec || sectionForContract(s) === sec;
}
function contractSectionTitle(sec) {
  return {
    auta: 'Auta + majetek',
    zivot: 'Životní pojištění',
    hypoteky: 'Hypotéky',
    'uvery-only': 'Úvěry'
  }[sec] || 'Všechny smlouvy';
}
function renderContractTabs() {
  const current = val('contractSection') || 'auta',
    tabs = contractTabDefs(),
    counts = {};
  tabs.forEach(t => counts[t.id] = state.contracts.filter(s => contractSectionMatch(s, t.id)).length);
  const el = byId('contractTabs');
  if (!el) return;
  el.innerHTML = tabs.map(t => '<button class="contract-tab ' + (current === t.id ? 'active' : '') + '" onclick="setContractSection(\'' + t.id + '\')">' + t.icon + ' ' + esc(t.label) + ' <span class="badge ' + (current === t.id ? 'blue' : '') + '">' + num(counts[t.id] || 0) + '</span></button>').join('');
}
function renderMortgageRatePanel(sec) {
  const el = byId('mortgageRatePanel');
  if (!el) return;
  if (sec !== 'hypoteky') {
    el.innerHTML = '';
    return;
  }
  const worse = state.contracts.filter(isWorseMortgageRate).length;
  el.innerHTML = '<div class="mortgage-rate-banner"><b>Aktuální tržní sazba hypoték: <input id="marketMortgageRate" type="number" step="0.01" value="' + marketMortgageRate() + '"> %</b><span class="note">Horší sazba o 0,5 %+: ' + num(worse) + ' smluv</span><button class="btn slim" onclick="saveMortgageMarketRate()">Aktualizovat</button></div>';
}
function contractDueSortDays(d) {
  return d >= 99999 ? 99999 : Math.max(0, d);
}
function contractAttentionRank(s, d = contractDays(s)) {
  if (isClosedContract(s)) return 9;
  if (s.type === 'hypotéka' && isWorseMortgageRate(s)) return 0;
  if (needsContractAttention(s)) return 1;
  if (d <= 90) return 2;
  return 3;
}
function contractSortPriority(x) {
  const s = x.s,
    d = x.d ?? contractDays(s),
    closed = isClosedContract(s) ? 1 : 0,
    rank = contractAttentionRank(s, d),
    days = contractDueSortDays(d),
    worse = isWorseMortgageRate(s) ? 0 : 1,
    active = needsContractAttention(s) ? 0 : 1;
  return [closed, rank, worse, active, days];
}
function compareContractRows(a, b) {
  const pa = contractSortPriority(a),
    pb = contractSortPriority(b);
  for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return clientName(a.c).localeCompare(clientName(b.c), 'cs') || String(a.s.product || '').localeCompare(String(b.s.product || ''), 'cs');
}
function sortContracts(rows) {
  return (rows || []).map(s => ({
    s,
    d: contractDays(s),
    c: findClient(s.clientId)
  })).sort(compareContractRows).map(x => x.s);
}
function renderContracts() {
  const sectionEl = byId('contractSection');
  if (sectionEl && !sectionEl.value) sectionEl.value = 'auta';
  const q = norm(val('contractSearch')),
    sec = val('contractSection') || 'auta',
    st = val('contractStatusFilter');
  renderContractTabs();
  renderMortgageRatePanel(sec);
  let rows = state.contracts.map(s => ({
    s,
    c: findClient(s.clientId),
    d: contractDays(s)
  })).filter(x => contractSectionMatch(x.s, sec)).filter(x => !q || norm([clientName(x.c), x.c?.phone, x.c?.email, x.s.type, x.s.product, x.s.company, x.s.number, x.s.note].join(' ')).includes(q)).filter(x => !st || (st === '__active' ? isActiveContract(x.s) || x.d <= 90 : hasStatus(x.s, st) || x.s.status === st));
  rows.sort(compareContractRows);
  const base = state.contracts.map(s => ({
      s,
      d: contractDays(s)
    })).filter(x => contractSectionMatch(x.s, sec)),
    total = rows.length,
    clientsCount = new Set(rows.map(x => x.s.clientId)).size,
    under30 = base.filter(x => x.d < 30 && !hasStatus(x.s, 'vyrizeno') && !hasStatus(x.s, 'nechce')).length,
    under90 = base.filter(x => x.d >= 0 && x.d <= 90 && !hasStatus(x.s, 'vyrizeno') && !hasStatus(x.s, 'nechce')).length,
    active = base.filter(x => isActiveContract(x.s)).length,
    worse = base.filter(x => isWorseMortgageRate(x.s)).length;
  const metrics = byId('contractMetrics');
  if (metrics) metrics.innerHTML = '<div class="metric"><span class="note">Klientů</span><b>' + num(clientsCount) + '</b></div><div class="metric"><span class="note">Smluv</span><b>' + num(total) + '</b></div><div class="metric"><span class="note">Do 30 dní</span><b class="red">' + num(under30) + '</b></div><div class="metric"><span class="note">Do 90 dní</span><b class="orange">' + num(under90) + '</b></div><div class="metric"><span class="note">V řešení / urgentní</span><b class="blue">' + num(active) + '</b></div>' + (sec === 'hypoteky' ? '<div class="metric"><span class="note">Horší sazba</span><b class="red">' + num(worse) + '</b></div>' : '');
  const grouped = {},
    groupOrder = [];
  rows.forEach(x => {
    const id = String(x.s.clientId);
    if (!grouped[id]) {
      grouped[id] = {
        c: x.c,
        rows: []
      };
      groupOrder.push(id);
    }
    grouped[id].rows.push(x);
  });
  const html = groupOrder.map(id => grouped[id]).map(g => {
    const min = Math.min(...g.rows.map(x => x.d)),
      top = g.rows.slice().sort(compareContractRows)[0],
      cls = contractVisualClass(top.s, top.d),
      tags = [...new Set(g.rows.map(x => sourceForType(x.s.type)))],
      single = g.rows.length === 1 ? g.rows[0].s : null;
    return '<details class="contract-client-card ' + cls + '"><summary class="contract-client-head"><div class="days-bubble">' + (min >= 99999 ? '--' : num(Math.max(min, 0))) + '<small>DNÍ</small></div><div class="contract-client-name"><b>' + esc(clientName(g.c)) + '</b><span class="note">' + esc(g.c?.phone || 'bez telefonu') + ' · Kontakt: ' + esc(contactLabel(g.c || {})) + ' · ' + num(g.rows.length) + ' smluv</span><div class="chips">' + tags.map(x => '<span class="chip">' + esc(x) + '</span>').join('') + (g.rows.some(x => isWorseMortgageRate(x.s)) ? '<span class="badge red">Horší sazba</span>' : '') + (g.rows.some(x => isContractWork(x.s)) ? '<span class="badge blue">V řešení</span>' : '') + '</div></div><div class="actions"><button class="btn slim" onclick="event.preventDefault();selectedClientId=' + (g.c?.id || 'null') + ';showView(\'clients\')">Klient</button>' + contractEmailButton(g.c, single) + '<button class="btn slim primary" onclick="event.preventDefault();openContractModal(' + (g.c?.id || 'null') + ')">+ Smlouva</button></div></summary><div class="contract-card-body">' + g.rows.map(x => '<div class="contract-line ' + contractLineClass(x.s) + '"><div><div class="contract-line-title">' + esc(x.s.type) + ' · ' + esc(x.s.product || 'bez produktu') + '</div><div class="contract-line-sub">' + esc(x.s.company || 'bez společnosti') + ' · č. ' + esc(x.s.number || '—') + (x.s.amount ? ' · ' + esc(x.s.amount) : '') + (x.s.rate ? ' · sazba ' + esc(x.s.rate) : '') + '</div><div class="chips">' + daysBadge(x.d) + getStatuses(x.s).map(statusBadge).join('') + '<span class="chip">' + esc(contractLogicLabel(x.s)) + '</span>' + (isWorseMortgageRate(x.s) ? '<span class="badge red">sazba nad trhem</span>' : '') + '</div></div><div class="contract-line-actions"><button class="btn slim" onclick="selectedClientId=' + x.s.clientId + ';showView(\'clients\');clientSection=\'contracts\';renderClients()">Klient</button>' + contractEmailButton(g.c, x.s) + '<button class="btn slim" onclick="openContractModal(' + x.s.clientId + ',' + x.s.id + ')">Správa</button></div></div>').join('') + '</div></details>';
  }).join('') || '<div class="note">V sekci ' + esc(contractSectionTitle(sec)) + ' zatím nic není.</div>';
  const wrap = byId('contractsTable')?.closest('.table-wrap');
  if (wrap) wrap.outerHTML = '<div class="contracts-list" id="contractsList">' + html + '</div>';else {
    const list = byId('contractsList');
    if (list) list.innerHTML = html;
  }
}
function contractLogicLabel(s) {
  if (s.type === 'hypotéka') return 'Fixace hypotéky - skutečný termín';
  if (s.type === 'úvěr') return 'Kontrola úvěru po 3 letech';
  if (s.type === 'život') return 'Kontrola životka po 5 letech';
  if (s.type === 'auto' || s.type === 'majetek') return 'Roční výročí';
  return sourceForType(s.type);
}
function renderMonthTabs() {
  const el = byId('monthTabs');
  if (!el) return;
  el.innerHTML = MONTHS.map((m, i) => `<button class="monthbtn ${i === selectedMonth ? 'active' : ''}" onclick="selectedMonth=${i};renderDeals()">${m}</button>`).join('');
}
function newClientsInMonth(y, m) {
  const first = {};
  visibleDeals().filter(d => yearOf(d.date) === y).forEach(d => {
    const c = findClient(d.clientId),
      k = clientMatchKey(c || {}) || norm(clientName(c));
    if (!k) return;
    if (!first[k] || new Date(d.date) < new Date(first[k].date)) first[k] = d;
  });
  return Object.values(first).filter(d => monthOf(d.date) === m).length;
}
function dealRowClass(d) {
  if (d.hidden) return 'row-done';
  if (isLateUnpaid(d)) return 'row-hot';
  if (dealPaid(d)) return 'row-paid';
  return '';
}
function toggleDealPaid(id, checked) {
  const d = state.deals.find(x => String(x.id) === String(id));
  if (!d) return;
  d.commissionPaid = !!checked;
  persist();
  renderAll();
}
function toggleDealHidden(id, checked) {
  const d = state.deals.find(x => String(x.id) === String(id));
  if (!d) return;
  d.hidden = !!checked;
  persist();
  renderAll();
}
function renderDeals() {
  renderMonthTabs();
  const q = norm(val('dealSearch')),
    y = +val('dealYear') || new Date().getFullYear(),
    showHidden = !!byId('showHiddenDeals')?.checked;
  let rows = state.deals.map(d => ({
    d,
    c: findClient(d.clientId)
  })).filter(x => showHidden || !x.d.hidden).filter(x => yearOf(x.d.date) === y && monthOf(x.d.date) === selectedMonth).filter(x => !q || norm([clientName(x.c), x.d.category, x.d.product, x.d.company, x.d.owner, dealOwnerLabel(x.d), x.d.hidden ? 'skryte' : ''].join(' ')).includes(q));
  rows.sort((a, b) => String(b.d.date).localeCompare(String(a.d.date)));
  const totalHidden = state.deals.filter(d => d.hidden && yearOf(d.date) === y && monthOf(d.date) === selectedMonth).length,
    totals = rows.filter(x => !x.d.hidden).reduce((s, x) => {
      const area = areaForDeal(x.d);
      s.bj += dealBJ(x.d);
      s.cash += dealCash(x.d, y);
      if (area === 'investice' || area === 'fki') s.inv += dealVolume(x.d);
      s.mort += x.d.category === 'Hypotéky' ? dealVolume(x.d) : 0;
      s.actual += dealActualCommission(x.d);
      s.payout += dealOwnerPayout(x.d, y);
      s.net += dealNetCommission(x.d, y);
      s.count++;
      return s;
    }, {
      bj: 0,
      cash: 0,
      inv: 0,
      mort: 0,
      actual: 0,
      payout: 0,
      net: 0,
      count: 0
    });
  const newClients = newClientsInMonth(y, selectedMonth),
    table = byId('dealsTable');
  table.className = 'compact-table';
  table.innerHTML = `<thead><tr><th>Klient</th><th>Kategorie</th><th>Společnost</th><th>Produkt</th><th>Datum</th><th>Objem Kč</th><th>BJ</th><th>Oček. provize</th><th class="paid-col">Zapl.</th><th>Skutečná provize</th><th>Typař / doporučení</th><th>Skrýt</th><th></th></tr></thead><tbody>${rows.map(x => `<tr class="${dealRowClass(x.d)}"><td><b>${esc(clientName(x.c))}</b>${x.d.hidden ? '<br><span class="badge">skryto</span>' : isLateUnpaid(x.d) ? '<br><span class="badge red">3+ měsíce bez provize</span>' : ''}</td><td>${esc(x.d.category || areaLabel(areaForDeal(x.d)))}</td><td>${esc(x.d.company || '')}</td><td><b>${esc(x.d.product || '')}</b></td><td>${esc(x.d.date || '')}</td><td class="money">${money(dealVolume(x.d))}</td><td class="num">${num(dealBJ(x.d))}</td><td class="money">${money(dealCash(x.d, y))}</td><td class="paid-col"><input class="paid-check" type="checkbox" ${dealPaid(x.d) ? 'checked' : ''} onchange="toggleDealPaid(${x.d.id},this.checked)"></td><td class="money">${money(dealNetCommission(x.d, y))}</td><td><b>${esc(dealOwnerLabel(x.d) || '')}</b>${dealOwnerType(x.d) === 'tipar' ? `<br><span class="note">${num(dealOwnerPct(x.d))} % · ${money(dealOwnerPayout(x.d, y))} · ${x.d.ownerPaid ? 'vyplaceno' : 'nevyplaceno'}</span>` : ''}</td><td class="paid-col"><input class="paid-check" type="checkbox" ${x.d.hidden ? 'checked' : ''} onchange="toggleDealHidden(${x.d.id},this.checked)"></td><td><button class="icon-btn" title="Upravit obchod" onclick="selectedClientId=${x.c?.id || 'null'};openDealModal(${x.d.clientId},${x.d.id})">✎</button></td></tr>`).join('') || '<tr><td colspan="13" class="note">V tomto měsíci zatím nejsou žádné viditelné obchody.</td></tr>'}<tr><th colspan="5">Celkem za ${MONTHS[selectedMonth]}<br><span class="note">Noví klienti: ${num(newClients)} · skryto: ${num(totalHidden)}</span></th><th class="money">Investice ${money(totals.inv)}<br>Hypotéky ${money(totals.mort)}</th><th class="num">${num(totals.bj)}</th><th class="money">${money(totals.cash)}</th><th></th><th class="money">${money(totals.net)}</th><th colspan="3">Typaři ${money(totals.payout)} · ${num(totals.count)} viditelných obchodů</th></tr></tbody>`;
  renderOwners(y);
  renderReferrals(y);
}
function allInvestmentItems() {
  return state.clients.flatMap(c => clientInvestmentItems(c.id).map(x => ({
    ...x,
    client: c
  })));
}
function investmentInvestedAmount(x) {
  return +(x.invested || x.investedAmount || x.volume || x.amount || 0);
}
function investmentRealizedAmount(x) {
  return +(x.realized || x.redemptionAmount || x.snapshot?.redemptionAmount || 0);
}
function investmentPerformanceGain(current, invested, realized = 0) {
  return (+current || 0) + (+realized || 0) - (+invested || 0);
}
function investmentPerformancePct(current, invested, realized = 0) {
  return +invested || 0 ? investmentPerformanceGain(current, invested, realized) / (+invested || 0) * 100 : 0;
}
function investmentSnapshotKey(clientId, company, product, isin = '', mergeKey = '', type = '') {
  const i = norm(isin),
    m = norm(mergeKey),
    fund = i ? ['investment-isin', i].join('|') : m ? ['investment-merge', m].join('|') : investmentFundKeyFromParts(company, product, '', type || 'Investice');
  return [String(clientId || ''), fund].join('|');
}
function investmentSnapshotKeyForSnapshot(s) {
  return investmentSnapshotKey(s?.clientId, s?.company, s?.product, s?.isin, s?.mergeKey, s?.fundType || s?.typ || s?.kind);
}
function investmentSnapshotMergeKey(s) {
  return [investmentSnapshotKeyForSnapshot(s), s.date, Math.round((+s.current || 0) * 100), Math.round((+s.invested || 0) * 100)].join('|');
}
function investmentItemKey(x) {
  return [String(x.clientId || x.client?.id || ''), investmentFundKey(x)].join('|');
}
function latestInvestmentSnapshots(clientId = null) {
  const map = {};
  (state.investmentSnapshots || []).filter(s => !clientId || String(s.clientId) === String(clientId)).forEach(s => {
    const key = investmentSnapshotKeyForSnapshot(s);
    if (!map[key] || String(s.date || '').localeCompare(String(map[key].date || '')) >= 0) map[key] = s;
  });
  return Object.values(map).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}
function latestSnapshotForItem(x) {
  const key = investmentItemKey(x);
  return latestInvestmentSnapshots(x.clientId || x.client?.id).find(s => investmentSnapshotKeyForSnapshot(s) === key) || null;
}
function investmentSnapshotItem(s) {
  return {
    kind: 'Aktualizace',
    area: 'investice',
    clientId: s.clientId,
    company: s.company,
    product: s.product || 'Investice',
    isin: s.isin || '',
    mergeKey: s.mergeKey || '',
    typ: s.fundType || s.typ || '',
    amount: +s.current || 0,
    invested: +(s.investedBeforeRedemption ?? s.invested) || 0,
    realized: +s.redemptionAmount || 0,
    date: s.date,
    source: s,
    sourceType: 'snapshot',
    sourceId: s.id,
    snapshot: s
  };
}
function mergeClassicInvestmentItems(items) {
  const map = {};
  (items || []).forEach(x => {
    const key = investmentItemKey(x);
    if (!map[key]) {
      map[key] = {
        ...x,
        mergedCount: 1
      };
      return;
    }
    const old = map[key],
      xDate = x.snapshot?.date || x.date || '',
      oDate = old.snapshot?.date || old.date || '',
      contract = [old, x].find(i => i.sourceType === 'contract');
    if (x.snapshot || old.snapshot) {
      const newer = String(xDate).localeCompare(String(oDate)) >= 0,
        chosen = newer ? x : old;
      map[key] = {
        ...old,
        ...chosen,
        mergedCount: (old.mergedCount || 1) + 1
      };
      if (contract) Object.assign(map[key], {
        sourceType: 'contract',
        sourceId: contract.sourceId,
        source: contract.source,
        clientId: contract.clientId
      });
      return;
    }
    const mirroredSources = old.sourceType && x.sourceType && old.sourceType !== x.sourceType;
    if (mirroredSources) {
      const newer = String(xDate).localeCompare(String(oDate)) >= 0,
        chosen = newer ? x : old;
      map[key] = {
        ...old,
        ...chosen,
        amount: Math.max(+old.amount || 0, +x.amount || 0),
        invested: Math.max(investmentInvestedAmount(old), investmentInvestedAmount(x)),
        mergedCount: (old.mergedCount || 1) + 1
      };
      if (contract) Object.assign(map[key], {
        sourceType: 'contract',
        sourceId: contract.sourceId,
        source: contract.source,
        clientId: contract.clientId
      });
      return;
    }
    old.amount = (+old.amount || 0) + (+x.amount || 0);
    old.invested = investmentInvestedAmount(old) + investmentInvestedAmount(x);
    old.mergedCount = (old.mergedCount || 1) + 1;
    if (String(xDate).localeCompare(String(oDate)) > 0) old.date = x.date;
  });
  return Object.values(map);
}
function investmentRedemptionText(s) {
  const a = +s?.redemptionAmount || 0;
  if (!a) return '';
  return 'Odkup ' + money(a) + (s.redemptionDate ? ' · ' + s.redemptionDate : '');
}
function applyInvestmentSnapshot(x) {
  const s = latestSnapshotForItem(x);
  if (!s) return x;
  const originalInvested = s.investedBeforeRedemption === '' || s.investedBeforeRedemption == null ? s.invested : +s.investedBeforeRedemption;
  return {
    ...x,
    amount: s.current === '' || s.current == null ? +x.amount || 0 : +s.current,
    invested: originalInvested === '' || originalInvested == null ? investmentInvestedAmount(x) : +originalInvested,
    realized: +s.redemptionAmount || 0,
    date: s.date || x.date,
    sourceType: x.sourceType,
    snapshot: s
  };
}
function baseClassicInvestmentItems() {
  return allInvestmentItems().filter(x => investmentAreaOfItem(x) === 'investice' && !isPensionReportItem(x));
}
function classicInvestmentItems() {
  const base = baseClassicInvestmentItems().map(applyInvestmentSnapshot),
    keys = new Set(base.map(investmentItemKey)),
    orphans = latestInvestmentSnapshots().filter(s => !keys.has(investmentSnapshotKeyForSnapshot(s)) && !isPensionReportItem(s)).map(investmentSnapshotItem);
  return mergeClassicInvestmentItems([...base, ...orphans]).filter(x => !isPensionReportItem(x));
}
function clientDisplayInvestmentItems(clientId) {
  const id = String(clientId),
    classic = classicInvestmentItems().filter(x => String(x.clientId || x.client?.id) === id),
    fki = clientInvestmentItems(clientId).filter(x => investmentAreaOfItem(x) === 'fki');
  return [...classic, ...fki];
}
function investmentFundProductType(x = {}) {
  const n = norm([x.product, x.kind, x.typ, x.type, x.category].filter(Boolean).join(' '));
  if (/\bdip\b/.test(n)) return 'DIP';
  if (/\bdps\b/.test(n)) return 'DPS';
  if (/penz/.test(n)) return 'Penze';
  return 'Investice';
}
function canonicalInvestmentCompany(v) {
  const raw = String(v || 'Nezařazeno').trim() || 'Nezařazeno',
    n = norm(raw);
  if (n === 'edward' || n === 'edward invest' || n === 'edward investments') return 'Edward';
  if (n === 'atris opf') return 'Atris';
  return raw;
}
function investmentFundKeyFromParts(company, product, isin = '', type = '') {
  const i = norm(isin);
  if (i) return ['investment-isin', i].join('|');
  const productType = investmentFundProductType({
    product,
    typ: type
  });
  return ['investment-fund', norm(canonicalInvestmentCompany(company)), norm(product || 'Investice'), norm(productType)].join('|');
}
function investmentFundRawKey(x) {
  return investmentFundKeyFromParts(x?.company || x?.provider || '', x?.product || x?.kind || 'Investice', x?.isin || x?.source?.isin || '', investmentFundProductType(x));
}
function investmentFundKey(x) {
  const raw = investmentFundRawKey(x),
    fv = state.fundValues?.[raw] || {},
    i = norm(x?.isin || x?.source?.isin || fv.isin || ''),
    merge = norm(fv.mergeKey || x?.mergeKey || '');
  if (i) return ['investment-isin', i].join('|');
  if (merge) return ['investment-merge', merge].join('|');
  return raw;
}
function investmentFundLabel(f) {
  const company = String(f?.company || 'Nezařazeno').trim() || 'Nezařazeno',
    product = String(f?.product || f?.fond || 'Investice').trim() || 'Investice';
  return norm(company) === norm(product) ? product : `${company} - ${product}`;
}
function investmentFundLockKey(k) {
  return '__INVESTMENT_FUND__||' + String(k || '');
}
function isInvestmentFundLocked(k) {
  return !!state.lockedFunds?.[investmentFundLockKey(k)];
}
function investmentFundItems() {
  const funds = {};
  classicInvestmentItems().forEach(x => {
    const rawKey = investmentFundRawKey(x),
      key = investmentFundKey(x),
      fv = state.fundValues?.[key] || state.fundValues?.[rawKey] || {},
      company = fv.company || x.company || 'Nezařazeno',
      product = fv.fond || x.product || x.kind || 'Investice';
    if (!funds[key]) funds[key] = {
      kind: 'Investice',
      area: 'investice',
      key,
      rawKeys: new Set(),
      company,
      product,
      isin: fv.isin || x.isin || '',
      typ: fv.typ || x.typ || x.kind || investmentFundProductType(x),
      mergeKey: fv.mergeKey || '',
      amount: 0,
      rawCurrent: 0,
      invested: 0,
      clients: new Set(),
      products: 0,
      tx: 0,
      date: '',
      source: x
    };
    const f = funds[key];
    f.rawKeys.add(rawKey);
    f.tx++;
    f.products++;
    if (x.clientId) f.clients.add(String(x.clientId));else if (x.client?.id) f.clients.add(String(x.client.id));
    f.invested += investmentInvestedAmount(x);
    f.rawCurrent += Math.max(0, +x.amount || 0);
    if (!f.date || String(x.snapshot?.date || x.date || '').localeCompare(String(f.date || '')) > 0) f.date = x.snapshot?.date || x.date || f.date;
    if (!f.company && x.company) f.company = x.company;
    if (!f.isin && (x.isin || fv.isin)) f.isin = x.isin || fv.isin;
    if (!f.typ && (x.typ || x.kind || fv.typ)) f.typ = x.typ || x.kind || fv.typ;
    if (!f.mergeKey && fv.mergeKey) f.mergeKey = fv.mergeKey;
  });
  Object.entries(state.fundValues || {}).forEach(([storedKey, fv]) => {
    if (fv?.area !== 'investice') return;
    const key = fv.isin ? ['investment-isin', norm(fv.isin)].join('|') : fv.mergeKey ? ['investment-merge', norm(fv.mergeKey)].join('|') : storedKey;
    if (!funds[key]) funds[key] = {
      kind: 'Investice',
      area: 'investice',
      key,
      rawKeys: new Set([storedKey]),
      company: fv.company || 'Nezařazeno',
      product: fv.fond || 'Investice',
      isin: fv.isin || '',
      typ: fv.typ || fv.product || '',
      mergeKey: fv.mergeKey || '',
      amount: 0,
      rawCurrent: 0,
      invested: 0,
      clients: new Set(),
      products: 1,
      tx: 0,
      date: fv.date || '',
      manual: true
    };
  });
  return Object.values(funds).map(f => {
    const fv = investmentFundStoredValue(f);
    f.company = fv.company || f.company;
    f.product = fv.fond || f.product;
    f.isin = fv.isin || f.isin;
    f.typ = fv.typ || f.typ;
    f.mergeKey = fv.mergeKey || f.mergeKey;
    f.label = investmentFundLabel(f);
    f.amount = isInvestmentFundLocked(f.key) ? 0 : f.rawCurrent;
    return f;
  }).sort((a, b) => b.rawCurrent - a.rawCurrent || String(a.label).localeCompare(String(b.label), 'cs'));
}
function investmentClientRows() {
  const map = {};
  classicInvestmentItems().forEach(x => {
    const id = x.clientId;
    if (!id) return;
    map[id] = map[id] || {
      client: x.client || findClient(id),
      items: [],
      current: 0,
      invested: 0,
      realized: 0
    };
    map[id].items.push(x);
    map[id].current += +x.amount || 0;
    map[id].invested += investmentInvestedAmount(x);
    map[id].realized += investmentRealizedAmount(x);
  });
  return Object.values(map).map(r => ({
    ...r,
    products: r.items.length,
    providers: [...new Set(r.items.map(x => x.company).filter(Boolean))]
  })).sort((a, b) => b.current - a.current || clientName(a.client).localeCompare(clientName(b.client), 'cs'));
}
function selectInvestmentClient(id) {
  selectedInvestmentClientId = id;
  selectedClientId = id;
  investmentMode = 'client';
  renderInvestments();
}
function setInvestmentMode(mode) {
  investmentMode = mode || 'client';
  renderInvestments();
}
function setFkMode(mode) {
  fkMode = mode || 'client';
  renderFk();
}
function selectInvestmentFund(encodedKey) {
  selectedInvestmentFundKey = decodeURIComponent(encodedKey);
  investmentMode = 'funds';
  renderInvestments();
}
function investmentEditButton(x) {
  if (x.sourceType === 'deal') return `<button class="icon-btn" title="Upravit obchod" onclick="openDealModal(${x.clientId},${x.sourceId})">✎</button>`;
  if (x.sourceType === 'contract') return `<button class="icon-btn" title="Správa smlouvy" onclick="openContractModal(${x.clientId},${x.sourceId})">✎</button>`;
  return `<button class="btn slim" onclick="selectedClientId=${x.clientId};showView('clients');clientSection='portfolio';renderClients()">Klient</button>`;
}
function investmentClientFundBreakdown(items) {
  const map = {},
    palette = ['#16415f', '#42b6c8', '#9fc6bd', '#f4c99b', '#6c83a8', '#b7c7ff', '#aee0f6', '#f8d49d', '#d8f7e6', '#ffc6c6', '#d9ccff', '#cbd5e1'];
  (items || []).forEach(x => {
    const rawKey = investmentFundRawKey(x),
      key = investmentFundKey(x),
      fv = state.fundValues?.[key] || state.fundValues?.[rawKey] || {},
      company = fv.company || x.company || 'Nezařazeno',
      product = fv.fond || x.product || x.kind || 'Investice',
      label = investmentFundLabel({
        company,
        product
      });
    map[key] = map[key] || {
      key,
      label,
      company,
      amount: 0,
      invested: 0,
      count: 0
    };
    map[key].amount += +x.amount || 0;
    map[key].invested += investmentInvestedAmount(x);
    map[key].count++;
  });
  return Object.values(map).filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount).map((x, i) => ({
    ...x,
    color: palette[i % palette.length]
  }));
}
function renderInvestmentAllocation(items, total) {
  const rows = investmentClientFundBreakdown(items);
  if (!rows.length) return '';
  let start = 0,
    segments = rows.map(r => {
      const pct = total ? Math.max(0, (+r.amount || 0) / total * 100) : 0,
        seg = `${r.color} ${start.toFixed(2)}% ${(start + pct).toFixed(2)}%`;
      start += pct;
      return seg;
    }).join(',');
  return `<div class="investment-allocation"><div><div class="allocation-donut" style="background:conic-gradient(${segments || '#cbd5e1 0 100%'})"><div class="allocation-center"><span>Portfolio</span>${money(total)}</div></div></div><div><div class="eyebrow">Rozdělení portfolia podle fondů</div><div class="allocation-list">${rows.map(r => `<div class="allocation-row"><span class="allocation-dot" style="background:${r.color}"></span><div><b>${esc(r.label)}</b><br><span class="note">${esc(r.company)} · ${num(r.count)} záznamů</span></div><span class="money">${money(r.amount)}</span><span class="note">${total ? (r.amount / total * 100).toFixed(1) : '0.0'} %</span></div>`).join('')}</div></div></div>`;
}
function investmentFundClientRows(key) {
  const map = {};
  classicInvestmentItems().filter(x => investmentFundKey(x) === key).forEach(x => {
    const id = x.clientId || x.client?.id;
    if (!id) return;
    map[id] = map[id] || {
      client: x.client || findClient(id),
      items: [],
      current: 0,
      invested: 0,
      realized: 0,
      last: ''
    };
    const r = map[id];
    r.items.push(x);
    r.current += +x.amount || 0;
    r.invested += investmentInvestedAmount(x);
    r.realized += investmentRealizedAmount(x);
    const d = x.snapshot?.date || x.date || '';
    if (!r.last || String(d).localeCompare(String(r.last)) > 0) r.last = d;
  });
  return Object.values(map).sort((a, b) => b.current - a.current || clientName(a.client).localeCompare(clientName(b.client), 'cs'));
}
function renderInvestmentFundClients(fund) {
  if (!fund) return '<div class="mini-card" style="margin-top:12px"><span class="note">Klikni na fond a zobrazí se klienti v daném fondu.</span></div>';
  const rows = investmentFundClientRows(fund.key);
  return `<div class="mini-card" style="margin-top:12px"><div class="toolbar"><div><div class="eyebrow">Klienti ve fondu</div><h3>${esc(fund.label || investmentFundLabel(fund))} <span class="badge blue">${num(rows.length)} klientů</span></h3><div class="note">${esc([fund.isin, fund.mergeKey ? 'sloučeno: ' + fund.mergeKey : '', fund.typ].filter(Boolean).join(' · '))}</div></div><button class="icon-btn ${isInvestmentFundLocked(fund.key) ? 'primary' : ''}" title="${isInvestmentFundLocked(fund.key) ? 'Odemknout fond v reportech' : 'Zamknout fond mimo reporty'}" onclick="toggleInvestmentFundLock('${esc(encodeURIComponent(fund.key))}')">${isInvestmentFundLocked(fund.key) ? '🔒' : '🔓'}</button></div><div class="table-wrap"><table class="compact-table"><thead><tr><th>Klient</th><th>AUM</th><th>Vloženo</th><th>Výsledek</th><th>Záznamů</th><th>Poslední hodnota</th><th></th></tr></thead><tbody>${rows.map(r => {
    const gain = investmentPerformanceGain(r.current, r.invested, r.realized);
    return `<tr><td><b>${esc(clientName(r.client))}</b></td><td class="money">${money(r.current)}</td><td class="money">${money(r.invested)}</td><td class="money ${gain >= 0 ? 'green' : 'red'}">${money(gain)}</td><td class="num">${num(r.items.length)}</td><td>${esc(r.last || '')}</td><td><button class="btn slim" onclick="selectInvestmentClient(${r.client?.id || 'null'})">Klient</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" class="note">U tohoto fondu zatím není přiřazený žádný klient.</td></tr>'}</tbody></table></div></div>`;
}
function renderInvestmentAum(funds) {
  const groups = {};
  funds.forEach(f => {
    const k = reportProviderCleanName(f.company);
    groups[k] = groups[k] || {
      provider: k,
      total: 0,
      raw: 0,
      clients: new Set(),
      funds: 0
    };
    groups[k].total += +f.amount || 0;
    groups[k].raw += +f.rawCurrent || 0;
    f.clients.forEach(c => groups[k].clients.add(c));
    groups[k].funds++;
  });
  const total = Object.values(groups).reduce((s, x) => s + x.total, 0);
  return `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Společnost</th><th>AUM v reportu</th><th>Skutečná hodnota</th><th>Fondů</th><th>Klientů</th><th>Podíl</th></tr></thead><tbody>${Object.values(groups).sort((a, b) => b.raw - a.raw).map(g => `<tr><td><b>${esc(g.provider)}</b></td><td class="money">${money(g.total)}</td><td class="money">${money(g.raw)}</td><td class="num">${num(g.funds)}</td><td class="num">${num(g.clients.size)}</td><td class="num">${total ? (g.total / total * 100).toFixed(1) : '0.0'} %</td></tr>`).join('') || '<tr><td colspan="6" class="note">Zatím nejsou investiční data k AUM.</td></tr>'}</tbody></table></div>`;
}
function fkItemKey(x) {
  return x.key || invPositionKey(x.source || {}) || investmentSnapshotKey(x.clientId, x.company, x.product);
}
function fkItemsForClient(clientId) {
  return investmentPortfolioForClient(clientId).map(x => {
    const key = invPositionKey(x.source || {}),
      rawAmount = +x.amount || 0,
      rawInvested = +x.invested || 0,
      rawRealized = +x.realized || 0,
      locked = isFkiFundGloballyLocked(key);
    return {
      ...x,
      key,
      rawAmount,
      rawInvested,
      rawRealized,
      amount: locked ? 0 : rawAmount,
      invested: locked ? 0 : rawInvested,
      realized: locked ? 0 : rawRealized,
      locked
    };
  });
}
function collectFkFunds() {
  const funds = {};
  (state.investmentRecords || []).filter(isFkiReportRecord).forEach(r => {
    const key = invPositionKey(r),
      company = invCompany(r) || 'Nezařazeno',
      fond = cleanInvFundName(invFund(r) || 'FK', company);
    if (!funds[key]) funds[key] = {
      kind: 'FK',
      area: 'fki',
      key,
      company,
      product: fond,
      isin: invIsin(r),
      typ: invType(r),
      amount: 0,
      rawCurrent: 0,
      invested: 0,
      rawInvested: 0,
      clients: new Set(),
      products: 1,
      tx: 0,
      source: r
    };
    const f = funds[key];
    f.tx++;
    if (invInvestor(r)) f.clients.add(invInvestor(r));
    if (!invIsWithdrawal(r)) f.rawInvested += invDeposit(r);
    f.rawCurrent += invCurrentValue(r);
    if (!f.isin && invIsin(r)) f.isin = invIsin(r);
    if (!f.typ && invType(r)) f.typ = invType(r);
  });
  Object.entries(state.fundValues || {}).forEach(([key, fv]) => {
    if (fv?.area === 'investice') return;
    if (!funds[key]) funds[key] = {
      kind: 'FK',
      area: 'fki',
      key,
      company: fv.company || 'Nezařazeno',
      product: cleanInvFundName(fv.fond || 'FK', fv.company),
      isin: fv.isin || '',
      typ: fv.typ || '',
      amount: 0,
      rawCurrent: 0,
      invested: 0,
      rawInvested: 0,
      clients: new Set(),
      products: 1,
      tx: 0,
      manual: true
    };
  });
  return Object.values(funds).map(f => {
    const locked = isFkiFundGloballyLocked(f.key);
    f.rawCurrent = Math.max(0, f.rawCurrent);
    f.amount = locked ? 0 : f.rawCurrent;
    f.invested = locked ? 0 : f.rawInvested;
    return f;
  }).sort((a, b) => b.rawCurrent - a.rawCurrent || String(a.product).localeCompare(String(b.product), 'cs'));
}
function selectFkClient(id) {
  selectedFkClientId = id;
  selectedClientId = id;
  fkMode = 'client';
  renderFk();
}
function renderFkAum(funds) {
  const groups = {};
  funds.forEach(f => {
    const k = reportProviderCleanName(f.company);
    groups[k] = groups[k] || {
      provider: k,
      total: 0,
      raw: 0,
      clients: new Set(),
      funds: 0
    };
    groups[k].total += +f.amount || 0;
    groups[k].raw += +f.rawCurrent || 0;
    f.clients.forEach(c => groups[k].clients.add(c));
    groups[k].funds++;
  });
  const total = Object.values(groups).reduce((s, x) => s + x.total, 0);
  return `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Společnost</th><th>AUM FK</th><th>Skutečná hodnota</th><th>Fondů</th><th>Klientů</th><th>Podíl</th></tr></thead><tbody>${Object.values(groups).sort((a, b) => b.total - a.total).map(g => `<tr><td><b>${esc(g.provider)}</b></td><td class="money">${money(g.total)}</td><td class="money">${money(g.raw)}</td><td class="num">${num(g.funds)}</td><td class="num">${num(g.clients.size)}</td><td class="num">${total ? (g.total / total * 100).toFixed(1) : '0.0'} %</td></tr>`).join('') || '<tr><td colspan="6" class="note">Zatím nejsou FK data k AUM.</td></tr>'}</tbody></table></div>`;
}
function fillFkFundSelect(selected = '') {
  const el = byId('fkFundSelect');
  if (!el) return;
  const funds = fkFundItems();
  el.innerHTML = '<option value="">Nový fond</option>' + funds.map(f => `<option value="${esc(f.key)}" ${f.key === selected ? 'selected' : ''}>${esc([f.company, f.product, f.isin].filter(Boolean).join(' · '))}</option>`).join('');
}
function liquidity_oldLoadFk() {
  const key = val('fkFundSelect'),
    f = fkFundItems().find(x => x.key === key),
    fv = state.fundValues?.[key] || {};
  setVal('fkFundCompany', fv.company || f?.company || '');
  setVal('fkFundName', fv.fond || f?.product || '');
  setVal('fkFundProduct', fv.product || f?.kind || 'FK');
  setVal('fkFundIsin', fv.isin || f?.isin || '');
  setVal('fkFundType', fv.typ || f?.typ || '');
  setVal('fkFundNav', fv.nav || '');
  setVal('fkFundDate', fv.date || f?.date || today());
  setVal('fkFundTrail', fv.trailPct ?? state.trailSettings?.[key]?.trailPct ?? '');
  setVal('fkFundLocked', isFkiFundGloballyLocked(key) ? 'yes' : 'no');
}
function openFkFundModal(encodedKey = '') {
  const key = encodedKey ? decodeURIComponent(encodedKey) : '';
  fillFkFundSelect(key);
  setVal('fkFundSelect', key);
  loadFkFundToForm();
  openModal('fkFundModal');
}
function fkFundKeyFromForm() {
  const isin = norm(val('fkFundIsin'));
  if (isin) return ['isin', isin].join('|');
  return ['fond', norm(cleanInvFundName(val('fkFundName'), val('fkFundCompany'))), norm(val('fkFundType'))].join('|');
}
function toggleFkFundLock(encodedKey) {
  const key = decodeURIComponent(encodedKey),
    lockKey = fkiGlobalLockKey(key);
  state.lockedFunds = state.lockedFunds || {};
  if (state.lockedFunds[lockKey]) delete state.lockedFunds[lockKey];else state.lockedFunds[lockKey] = true;
  persist();
  renderAll();
  saveToast(state.lockedFunds[lockKey] ? 'Fond zamčený' : 'Fond odemčený');
}
function fillInvestmentFundSelect(selected = '') {
  const el = byId('invFundSelect');
  if (!el) return;
  const funds = investmentFundItems();
  el.innerHTML = '<option value="">Nový fond</option>' + funds.map(f => `<option value="${esc(f.key)}" ${f.key === selected ? 'selected' : ''}>${esc([f.label || investmentFundLabel(f), f.isin || '', f.mergeKey ? 'sloučeno: ' + f.mergeKey : ''].filter(Boolean).join(' · '))}</option>`).join('');
}
function investmentFundStoredValue(f) {
  if (!f) return {};
  if (state.fundValues?.[f.key]) return state.fundValues[f.key];
  for (const k of [...(f.rawKeys || [])]) if (state.fundValues?.[k]) return state.fundValues[k];
  return {};
}
function liquidity_oldLoadInv() {
  const key = val('invFundSelect'),
    f = investmentFundItems().find(x => x.key === key),
    fv = investmentFundStoredValue(f);
  setVal('invFundCompany', fv.company || f?.company || '');
  setVal('invFundName', fv.fond || f?.product || '');
  setVal('invFundProduct', fv.product || f?.kind || 'Investice');
  setVal('invFundIsin', fv.isin || f?.isin || '');
  setVal('invFundMergeKey', fv.mergeKey || f?.mergeKey || '');
  setVal('invFundType', fv.typ || f?.typ || '');
  setVal('invFundNav', fv.nav || '');
  setVal('invFundDate', fv.date || f?.date || today());
  setVal('invFundTrail', fv.trailPct ?? state.trailSettings?.[key]?.trailPct ?? '');
  setVal('invFundLocked', isInvestmentFundLocked(key) ? 'yes' : 'no');
}
function openInvestmentFundModal(encodedKey = '') {
  const key = encodedKey ? decodeURIComponent(encodedKey) : '';
  fillInvestmentFundSelect(key);
  setVal('invFundSelect', key);
  loadInvestmentFundToForm();
  openModal('investmentFundModal');
}
function investmentFundKeyFromForm() {
  const isin = norm(val('invFundIsin'));
  if (isin) return ['investment-isin', isin].join('|');
  const merge = norm(val('invFundMergeKey'));
  if (merge) return ['investment-merge', merge].join('|');
  return investmentFundKeyFromParts(val('invFundCompany'), val('invFundName') || val('invFundProduct') || 'Investice', '', val('invFundProduct') || val('invFundType') || 'Investice');
}
function investmentFundMergeCandidates(oldKey, isin, mergeKey) {
  const i = norm(isin),
    m = norm(mergeKey);
  if (!i && !m) return [];
  return investmentFundItems().filter(f => f.key !== oldKey && (i && norm(f.isin) === i || !i && m && norm(f.mergeKey) === m)).sort((a, b) => String(a.label).localeCompare(String(b.label), 'cs'));
}
function chooseInvestmentFundMaster(current, candidates) {
  if (!candidates.length) return current;
  const options = [current, ...candidates.map(f => ({
    company: f.company,
    fond: f.product,
    product: f.kind || 'Investice',
    typ: f.typ || '',
    label: f.label || investmentFundLabel(f)
  }))];
  const text = options.map((o, i) => `${i + 1}. ${o.label || investmentFundLabel({
    company: o.company,
    product: o.fond
  })}`).join('\n');
  const choice = prompt(`Našel jsem stejný ${current.isin ? 'ISIN' : 'slučovací klíč'} u více fondů.\n\nChceš je sloučit. Vyber hlavní název fondu číslem:\n\n${text}`, '1');
  if (choice === null) return null;
  const idx = Math.max(0, Math.min(options.length - 1, (parseInt(choice, 10) || 1) - 1));
  return options[idx];
}
function toggleInvestmentFundLock(encodedKey) {
  const key = decodeURIComponent(encodedKey),
    lockKey = investmentFundLockKey(key);
  state.lockedFunds = state.lockedFunds || {};
  if (state.lockedFunds[lockKey]) delete state.lockedFunds[lockKey];else state.lockedFunds[lockKey] = true;
  persist();
  renderAll();
  saveToast(state.lockedFunds[lockKey] ? 'Fond zamčený mimo reporty' : 'Fond odemčený do reportů');
}
function clientClassicInvestmentReportItems(clientId) {
  const id = String(clientId);
  return classicInvestmentItems().filter(x => String(x.clientId || x.client?.id) === id).map(x => ({
    product: x.product || x.kind || 'Investice',
    company: x.company || '',
    isin: x.isin || x.snapshot?.isin || '',
    typ: x.typ || x.kind || investmentFundProductType(x),
    invested: investmentInvestedAmount(x),
    amount: +x.amount || 0,
    realized: investmentRealizedAmount(x),
    date: x.snapshot?.date || x.date || '',
    note: x.snapshot?.note || '',
    source: 'CRM investice',
    managed: true
  }));
}
function parseFkExtraInvestments() {
  return String(val('fkReportExtraInvestments') || '').split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const p = line.split(';').map(x => x.trim());
    return {
      product: p[0] || 'Další investice',
      company: p[1] || '',
      invested: parseMoney(p[2] || 0),
      amount: parseMoney(p[3] || p[2] || 0),
      note: p.slice(4).join('; '),
      source: 'Ručně v reportu',
      managed: false
    };
  });
}
function fkClientReportOptions() {
  return {
    includeClassic: !!byId('fkReportIncludeClassic')?.checked,
    extraInvestments: [...parseFkExtraInvestments(), ...fkReportManualItems]
  };
}
function addFkReportManualItem() {
  const product = val('fkManualProduct').trim();
  if (!product) return alert('Vyplň název investice.');
  const invested = parseMoney(val('fkManualInvested')),
    current = parseMoney(val('fkManualCurrent'));
  fkReportManualItems.push({
    id: uid(),
    product,
    company: val('fkManualCompany').trim(),
    invested,
    amount: current || invested,
    note: val('fkManualNote').trim(),
    source: 'Jednorázově v reportu',
    managed: !!byId('fkManualManaged')?.checked
  });
  ['fkManualProduct', 'fkManualCompany', 'fkManualInvested', 'fkManualCurrent', 'fkManualNote'].forEach(id => setVal(id, ''));
  if (byId('fkManualManaged')) byId('fkManualManaged').checked = false;
  refreshFkClientReportPreview();
  saveToast('Investice přidána do reportu');
}
function removeFkReportManualItem(index) {
  fkReportManualItems.splice(index, 1);
  refreshFkClientReportPreview();
  saveToast('Ruční položka odebrána');
}
function clearFkReportManualItems() {
  const had = fkReportManualItems.length || String(val('fkReportExtraInvestments') || '').trim();
  fkReportManualItems = [];
  setVal('fkReportExtraInvestments', '');
  refreshFkClientReportPreview();
  saveToast(had ? 'Ruční položky vyčištěny' : 'V reportu nejsou žádné ruční položky');
}
function renderFkReportManualItems() {
  const box = byId('fkReportManualList');
  if (!box) return;
  box.innerHTML = fkReportManualItems.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Investice</th><th>Vloženo</th><th>Hodnota</th><th>Správa</th><th></th></tr></thead><tbody>${fkReportManualItems.map((x, i) => `<tr><td><b>${esc(x.product)}</b><br><span class="note">${esc(x.company || 'Bez společnosti')}</span></td><td class="money">${money(x.invested)}</td><td class="money">${money(x.amount)}</td><td><span class="badge ${x.managed ? 'green' : 'orange'}">${x.managed ? 'V mé správě' : 'Mimo mou správu'}</span></td><td><button class="icon-btn" title="Odebrat" onclick="removeFkReportManualItem(${i})">×</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="note">Zatím nebyla přidána žádná jednorázová investice.</div>';
}
function refreshFkClientReportPreview() {
  const c = findClient(fkReportClientId),
    box = byId('fkReportDetectedInvestments');
  if (!c || !box) return;
  const items = clientClassicInvestmentReportItems(c.id),
    included = !!byId('fkReportIncludeClassic')?.checked,
    total = (included ? items : []).concat(fkReportManualItems).reduce((s, x) => s + (+x.amount || 0), 0);
  box.innerHTML = `<div class="toolbar" style="margin-bottom:8px"><div><h3>Další investice k reportu</h3><div class="note">${included ? 'Načteno z klientské karty' : 'Běžné investice z karty jsou vypnuté'} · ručně ${num(fkReportManualItems.length)} položek · celkem ${money(total)}</div></div></div>${included && items.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Produkt</th><th>Společnost</th><th>Vloženo</th><th>AUM</th><th>Správa</th></tr></thead><tbody>${items.map(x => `<tr><td><b>${esc(x.product)}</b><br><span class="note">${esc([x.isin, x.typ].filter(Boolean).join(' · '))}</span></td><td>${esc(x.company)}</td><td class="money">${money(x.invested)}</td><td class="money">${money(x.amount)}</td><td><span class="badge green">V mé správě</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">U klienta nejsou načtené běžné investice, nebo jsou v reportu vypnuté.</p>'}`;
  renderFkReportManualItems();
}
function openReportWindow(html) {
  const w = window.open('', '_blank');
  if (!w) return alert('Prohlížeč zablokoval náhled. Povol prosím vyskakovací okna pro CRM.');
  w.document.open();
  w.document.write(html);
  w.document.close();
  return w;
}
function previewFkClientReportFromModal() {
  const c = findClient(fkReportClientId),
    row = fkClientRows().find(r => String(r.client?.id) === String(fkReportClientId));
  if (!c || !row) return alert('Report pro klienta není dostupný.');
  openReportWindow(fkClientReportHtml(c, row, fkClientReportOptions()));
}
function downloadFkClientReportFromModal() {
  downloadFkClientReport(fkReportClientId, fkClientReportOptions());
}
function scenarioFundRates(area, key, isin, fv = {}) {
  const defs = typeof window.defaultFundExpectedRate === 'function' ? window.defaultFundExpectedRate(area, key, isin, fv) : {},
    approved = parseMoney(defs.expectedRate || 0),
    stored = parseMoney(fv.expectedRate || fv.rate || fv.expectedYield || fv.modelRate || 0),
    rate = approved || stored || 5;
  return {
    rate,
    minRate: parseMoney(defs.minRate || fv.minRate || Math.max(0, rate - 2)),
    maxRate: parseMoney(defs.maxRate || fv.maxRate || rate + 2)
  };
}
function investmentScenarioCatalog() {
  const all = [...investmentFundItems().map(f => {
      const fv = investmentFundStoredValue(f) || {},
        rates = scenarioFundRates('investice', f.key, f.isin, fv);
      return {
        key: 'Investice|' + f.key,
        area: 'Investice',
        company: f.company || '',
        product: f.product || f.label || 'Investice',
        isin: f.isin || '',
        typ: f.typ || '',
        ...rates
      };
    }), ...fkFundItems().map(f => {
      const fv = state.fundValues?.[f.key] || {},
        rates = scenarioFundRates('fki', f.key, f.isin, fv);
      return {
        key: 'FKI|' + f.key,
        area: 'FKI',
        company: f.company || '',
        product: f.product || 'FKI',
        isin: f.isin || '',
        typ: f.typ || '',
        ...rates
      };
    })],
    seen = new Set();
  return all.filter(x => {
    const k = x.area + '|' + norm(x.isin || x.key);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => String(a.company + ' ' + a.product).localeCompare(String(b.company + ' ' + b.product), 'cs'));
}
function scenario_originalOpen(clientId = null, area = 'Investice') {
  investmentScenario = {
    rows: []
  };
  const id = clientId || selectedClientId || state.clients[0]?.id;
  fillClientSelect('scenarioClient', id);
  const el = byId('scenarioClient');
  if (el) el.insertAdjacentHTML('afterbegin', '<option value="__new">+ Nový klient</option>');
  setVal('scenarioClient', id || '__new');
  setVal('scenarioArea', area === 'FKI' ? 'FKI' : 'Investice');
  setVal('scenarioYears', '10');
  setVal('scenarioAmount', '');
  setVal('scenarioRate', '5');
  ['scenarioNewClientName', 'scenarioNewClientBirthId', 'scenarioNewClientPhone', 'scenarioNewClientEmail'].forEach(x => setVal(x, ''));
  toggleInvestmentScenarioClient();
  fillInvestmentScenarioFunds();
  renderInvestmentScenario();
  openModal('investmentScenarioModal');
}
function toggleInvestmentScenarioClient() {
  const box = byId('scenarioNewClientFields');
  if (box) box.style.display = val('scenarioClient') === '__new' ? 'block' : 'none';
}
function scenario_originalFill() {
  const area = val('scenarioArea') || 'Investice',
    el = byId('scenarioFund');
  if (!el) return;
  const rows = investmentScenarioCatalog().filter(x => x.area === area);
  el.innerHTML = rows.map(x => `<option value="${esc(x.key)}">${esc(x.company + ' – ' + x.product + (x.isin ? ' · ' + x.isin : ''))}</option>`).join('') || '<option value="">Nejdřív založ fond v Reportu</option>';
  applyInvestmentScenarioFundDefaults();
}
function applyInvestmentScenarioFundDefaults() {
  const item = investmentScenarioCatalog().find(x => x.key === val('scenarioFund'));
  if (!item) return;
  setVal('scenarioRate', decimal(item.rate));
  setVal('scenarioMinRate', decimal(item.minRate));
  setVal('scenarioMaxRate', decimal(item.maxRate));
}
function scenarioSelectedClient() {
  return val('scenarioClient') === '__new' ? null : findClient(val('scenarioClient'));
}
function scenario_originalRender() {
  const c = scenarioSelectedClient(),
    portfolio = c ? clientDisplayInvestmentItems(c.id) : [],
    sum = portfolio.reduce((s, x) => s + (+x.amount || 0), 0),
    openOpps = c ? clientOpenOpportunities(c.id).filter(o => ['investice', 'fki'].includes(opportunityArea(o))) : [],
    current = byId('scenarioCurrentPortfolio');
  if (current) current.innerHTML = `<h3>Stávající portfolio${c ? ' · ' + esc(clientName(c)) : ''}</h3>${c ? `<div class="toolbar"><span class="note">${num(portfolio.length)} investic v evidenci · ${num(openOpps.length)} rozpracovaných návrhů</span><b>${money(sum)}</b></div>${portfolio.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Fond / produkt</th><th>Oblast</th><th>Hodnota</th></tr></thead><tbody>${portfolio.map(x => `<tr><td><b>${esc(x.product || 'Investice')}</b><br><span class="note">${esc(x.company || 'bez společnosti')}</span></td><td>${esc(x.area === 'fki' ? 'FKI' : 'Investice')}</td><td class="money">${money(x.amount)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Klient zatím nemá evidované investice.</p>'}${openOpps.length ? `<div class="mini-card" style="margin-top:10px"><h3>Rozpracované investiční příležitosti</h3><div class="table-wrap"><table class="compact-table"><thead><tr><th>Stav</th><th>Produkt</th><th>Objem</th><th>Datum</th></tr></thead><tbody>${openOpps.map(o => `<tr><td>${opportunityBadge(o.status)}</td><td><b>${esc(o.product || o.category)}</b><br><span class="note">${esc([o.category, o.company].filter(Boolean).join(' · '))}</span></td><td class="money">${money(o.amount)}</td><td>${esc(o.statusDate || o.expectedDate || '')}</td></tr>`).join('')}</tbody></table></div></div>` : ''}` : '<p class="note">Po uložení se založí nový klient a návrh se k němu připojí.</p>'}`;
  const years = Math.max(1, parseMoney(val('scenarioYears')) || 10),
    box = byId('scenarioSelectedFunds'),
    total = investmentScenario.rows.reduce((s, x) => s + x.amount, 0),
    future = investmentScenario.rows.reduce((s, x) => s + x.amount * Math.pow(1 + x.rate / 100, years), 0);
  if (box) box.innerHTML = `<div class="toolbar"><div><h3>Navržené investice</h3><div class="note">Horizont ${num(years)} let · jednorázově ${money(total)} · modelová hodnota ${money(future)}</div></div></div>${investmentScenario.rows.length ? `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Fond</th><th>Oblast</th><th>Částka</th><th>Výnos p.a.</th><th>Dokup</th><th>Propad</th><th>Modelová hodnota</th><th></th></tr></thead><tbody>${investmentScenario.rows.map((x, i) => `<tr><td><b>${esc(x.product)}</b><br><span class="note">${esc(x.company)}</span></td><td>${esc(x.area)}</td><td class="money">${money(x.amount)}</td><td class="money">${decimal(x.rate)} %</td><td>${x.topupYear ? esc(x.topupYear + '. rok · ' + money(x.topupAmount)) : '-'}</td><td>${x.dropYear ? esc(x.dropYear + '. rok · ' + decimal(x.dropPct) + ' %') : '-'}</td><td class="money">${money(x.amount * Math.pow(1 + x.rate / 100, years))}</td><td><button class="icon-btn" title="Odebrat" onclick="removeInvestmentScenarioFund(${i})">×</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="note">Vyber fond a přidej jej do návrhu.</p>'}`;
}
function scenarioClientDraft() {
  return {
    name: val('scenarioNewClientName').trim(),
    birthId: val('scenarioNewClientBirthId').trim(),
    phone: val('scenarioNewClientPhone').trim(),
    email: val('scenarioNewClientEmail').trim()
  };
}
function ensureInvestmentScenarioClient() {
  let c = scenarioSelectedClient();
  if (c) return c;
  const d = scenarioClientDraft();
  if (!d.name) {
    alert('Vyplň jméno nového klienta.');
    return null;
  }
  const match = findMatchingClient(d);
  if (match) {
    if (!confirm(`Klient ${clientName(match)} už pravděpodobně existuje. Použít jeho kartu?`)) return null;
    c = match;
  } else {
    c = {
      id: uid(),
      ...d,
      contactPref: 'email',
      createdAt: today()
    };
    state.clients.push(c);
  }
  return c;
}
function setText(id, text) {
  const el = byId(id);
  if (el) el.textContent = text;
}
function renderCharts(y, sourceDeals = null) {
  if (typeof Chart === 'undefined') return;
  const bj = Array(12).fill(0),
    inv = Array(12).fill(0),
    mort = Array(12).fill(0);
  (sourceDeals || visibleDeals()).forEach(d => {
    if (yearOf(d.date) === y) {
      const m = monthOf(d.date),
        area = areaForDeal(d);
      bj[m] += dealBJ(d);
      if (area === 'investice' || area === 'fki') inv[m] += dealVolume(d);
      if (d.category === 'Hypotéky') mort[m] += dealVolume(d);
    }
  });
  const labels = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
  const bjCanvas = byId('bjChart'),
    invCanvas = byId('investmentChart');
  if (bjCanvas) {
    if (bjChart) bjChart.destroy();
    bjChart = new Chart(bjCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'BJ',
          data: bj,
          backgroundColor: 'rgba(37,99,235,.78)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
  if (invCanvas) {
    if (investmentChart) investmentChart.destroy();
    investmentChart = new Chart(invCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Investice Kč',
          data: inv,
          backgroundColor: 'rgba(21,128,61,.72)',
          borderRadius: 8
        }, {
          label: 'Hypotéky Kč',
          data: mort,
          backgroundColor: 'rgba(8,145,178,.62)',
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }
}
function ownerRows(y) {
  const map = {};
  state.clients.filter(c => c.referrerRole === 'tipar').forEach(c => {
    const k = clientName(c);
    map[k] = map[k] || {
      bj: 0,
      cash: 0,
      inv: 0,
      mort: 0,
      count: 0,
      paid: 0,
      unpaid: 0,
      payout: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      extraPaid: 0,
      net: 0,
      pcts: []
    };
    if (+c.referrerCommissionPct) map[k].pcts.push(+c.referrerCommissionPct);
  });
  visibleDeals().filter(d => yearOf(d.date) === y && String(d.owner || '').trim() && dealOwnerType(d) === 'tipar').forEach(d => {
    const k = String(d.owner).trim(),
      area = areaForDeal(d),
      payout = dealOwnerPayout(d, y);
    map[k] = map[k] || {
      bj: 0,
      cash: 0,
      inv: 0,
      mort: 0,
      count: 0,
      paid: 0,
      unpaid: 0,
      payout: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      extraPaid: 0,
      net: 0,
      pcts: []
    };
    map[k].bj += dealBJ(d);
    map[k].cash += dealCash(d, y);
    if (area === 'investice' || area === 'fki') map[k].inv += dealVolume(d);
    if (d.category === 'Hypotéky') map[k].mort += dealVolume(d);
    map[k].count++;
    map[k].payout += payout;
    map[k].net += dealNetCommission(d, y);
    const pct = dealOwnerPct(d);
    if (pct) map[k].pcts.push(pct);
    if (d.ownerPaid) {
      map[k].paid++;
      map[k].paidAmount += payout;
    } else {
      map[k].unpaid++;
      map[k].unpaidAmount += payout;
    }
  });
  (state.referrerPayouts || []).filter(p => yearOf(p.date) === y).forEach(p => {
    const k = String(p.name || '').trim();
    if (!k) return;
    const amount = +p.amount || 0;
    map[k] = map[k] || {
      bj: 0,
      cash: 0,
      inv: 0,
      mort: 0,
      count: 0,
      paid: 0,
      unpaid: 0,
      payout: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      extraPaid: 0,
      net: 0,
      pcts: []
    };
    map[k].payout += amount;
    map[k].paidAmount += amount;
    map[k].extraPaid += amount;
    map[k].net -= amount;
  });
  return Object.entries(map).sort((a, b) => b[1].payout - a[1].payout || b[1].bj - a[1].bj || a[0].localeCompare(b[0], 'cs'));
}
function avgPct(x) {
  return x.pcts?.length ? x.pcts.reduce((s, n) => s + n, 0) / x.pcts.length : 0;
}
function renderOwners(y) {
  const rows = ownerRows(y),
    html = `<thead><tr><th>Typař</th><th>BJ celkem</th><th>Oček. provize z BJ</th><th>Domluveno</th><th>Typaři celkem</th><th>Čistá provize</th><th>Obchodů</th><th>Vyplaceno</th><th>Nevyplaceno</th></tr></thead><tbody>${rows.map(([name, x]) => `<tr><td><b>${esc(name)}</b></td><td class="num">${num(x.bj)}</td><td class="money">${money(x.cash)}</td><td class="num">${avgPct(x).toFixed(0)} %</td><td class="money">${money(x.payout)}</td><td class="money">${money(x.net)}</td><td class="num">${num(x.count)}</td><td class="money">${num(x.paid)} · ${money(x.paidAmount)}</td><td class="money">${num(x.unpaid)} · ${money(x.unpaidAmount)}</td></tr>`).join('') || `<tr><td colspan="9" class="note">Zatím nemáš žádného typaře s obchodem.</td></tr>`}</tbody>`;
  ['ownerTable', 'dealsOwnerTable'].forEach(id => {
    const el = byId(id);
    if (el) el.innerHTML = html;
  });
}
function referrerPayoutRows(y) {
  return (state.referrerPayouts || []).filter(p => yearOf(p.date) === y).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.name).localeCompare(String(b.name), 'cs'));
}
function openReferrerPayoutModal(name = '') {
  setVal('rpName', name);
  setVal('rpDate', today());
  setVal('rpAmount', '');
  setVal('rpNote', '');
  fillPeopleList();
  openModal('referrerPayoutModal');
}
function saveReferrerPayout() {
  const name = val('rpName').trim(),
    amount = parseMoney(val('rpAmount')),
    date = val('rpDate') || today(),
    note = val('rpNote').trim();
  if (!name) return alert('Vyplň typaře.');
  if (!amount) return alert('Vyplň částku provize.');
  state.referrerPayouts = state.referrerPayouts || [];
  state.referrerPayouts.push({
    id: uid(),
    name,
    date,
    amount,
    note,
    createdAt: today()
  });
  const c = findPersonClient(name);
  if (c) addActivity(c.id, 'Typař', 'Vyplacena provize mimo obchod: ' + money(amount) + (note ? ' · ' + note : ''), true);
  closeModal('referrerPayoutModal');
  persist();
  renderAll();
  saveToast('Provize typaři uložena');
}
function deleteReferrerPayout(id) {
  if (!confirm('Smazat ruční provizi typaři?')) return;
  state.referrerPayouts = (state.referrerPayouts || []).filter(p => String(p.id) !== String(id));
  persist();
  renderAll();
  saveToast('Ruční provize smazána');
}
function renderReferrerPayoutTable(y) {
  const t = byId('referrerPayoutTable');
  if (!t) return;
  const rows = referrerPayoutRows(y);
  t.innerHTML = `<thead><tr><th>Ruční výplaty mimo obchod</th><th>Datum</th><th>Částka</th><th>Poznámka</th><th></th></tr></thead><tbody>${rows.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.date || '')}</td><td class="money">${money(p.amount)}</td><td>${esc(p.note || '')}</td><td><button class="btn slim red" onclick="deleteReferrerPayout(${p.id})">Smazat</button></td></tr>`).join('') || '<tr><td colspan="5" class="note">Zatím tu není žádná ruční provize mimo obchod.</td></tr>'}</tbody>`;
}
function referralDeals(r, y) {
  const target = r.clientId ? findClient(r.clientId) : findClientByName(r.to),
    key = norm(r.to);
  return visibleDeals().filter(d => yearOf(d.date) === y && (target ? String(d.clientId) === String(target.id) : norm(clientName(findClient(d.clientId))) === key));
}
function allReferralRows() {
  const map = {};
  (state.referrals || []).forEach(r => {
    const target = r.clientId ? findClient(r.clientId) : findClientByName(r.to),
      k = 'referral|' + norm(r.from) + '|' + norm(r.to);
    map[k] = {
      id: 'ref_' + r.id,
      type: 'referral',
      from: r.from,
      to: r.to,
      topic: r.topic || '',
      date: r.date || '',
      clientId: target?.id || r.clientId || null,
      commissionPct: 0
    };
  });
  state.clients.filter(c => ['tipar', 'referral'].includes(c.leadType) && c.leadSource).forEach(c => {
    const k = c.leadType + '|' + norm(c.leadSource) + '|' + norm(clientName(c));
    if (!map[k]) map[k] = {
      id: 'client_' + c.id,
      type: c.leadType,
      from: c.leadSource,
      to: clientName(c),
      topic: c.leadType === 'tipar' ? 'Tip od klienta' : 'Doporučení klienta',
      date: c.leadDate || c.createdAt || '',
      clientId: c.id,
      commissionPct: +c.leadCommissionPct || 0
    };
  });
  return Object.values(map);
}
function saveReferral() {
  const from = val('refFrom').trim(),
    to = val('refTo').trim();
  if (!from || !to) return alert('Vyplň klienta i doporučení.');
  const exists = (state.referrals || []).some(r => norm(r.from) === norm(from) && norm(r.to) === norm(to));
  if (exists && !confirm('Toto doporučení už vypadá zadané. Přidat znovu?')) return;
  const target = findClientByName(to);
  if (target) {
    target.leadType = 'referral';
    target.leadSource = from;
    target.leadDate = val('refDate') || today();
  }
  state.referrals.push({
    id: uid(),
    from,
    to,
    topic: val('refTopic').trim(),
    date: val('refDate') || today(),
    createdAt: today(),
    clientId: target?.id || null
  });
  setVal('refFrom', '');
  setVal('refTo', '');
  setVal('refTopic', '');
  setVal('refDate', today());
  persist();
  renderAll();
  saveToast('Doporučení uloženo');
}
function deleteReferral(id) {
  if (confirm('Smazat doporučení?')) {
    state.referrals = state.referrals.filter(r => r.id !== id);
    persist();
    renderAll();
  }
}
function renderReferrals(y) {
  const el = byId('referralTable');
  if (!el) return;
  const rows = allReferralRows().map(r => {
    const s = referralRecordStats(r, y);
    return {
      r,
      ...s
    };
  }).sort((a, b) => b.bj - a.bj || b.count - a.count);
  el.innerHTML = `<thead><tr><th>Klient</th><th>Doporučení / tip</th><th>Co to bylo</th><th>BJ celkem</th><th>Oček. provize z BJ</th><th>Investice objem</th><th>Hypotéky</th><th>Obchodů</th><th>Datum</th><th>Akce</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.r.from)}</b><br>${x.r.type === 'tipar' ? '<span class="badge purple">Tipař</span>' : '<span class="badge green">Doporučení</span>'}</td><td>${esc(x.r.to)}</td><td>${esc(x.r.topic || '')}</td><td class="num">${num(x.bj)}</td><td class="money">${money(x.cash)}</td><td class="money">${money(x.inv)}</td><td class="money">${money(x.mort)}</td><td class="num">${num(x.count)}</td><td>${esc(x.r.date || '')}</td><td>${String(x.r.id).startsWith('ref_') ? `<button class="btn slim red" onclick="deleteReferral(${String(x.r.id).replace('ref_', '')})">Smazat</button>` : x.target ? `<button class="btn slim" onclick="selectedClientId=${x.target.id};showView('clients')">Klient</button>` : ''}</td></tr>`).join('') || `<tr><td colspan="10" class="note">Zatím nemáš zadané žádné doporučení.</td></tr>`}</tbody>`;
}
function localIsoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dateObj(s) {
  if (!s) return new Date();
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y || new Date().getFullYear(), (m || 1) - 1, d || 1);
}
function weekKey(d = today()) {
  const date = dateObj(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const week = 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function weekRange(key) {
  const [yPart, wPart] = String(key || weekKey()).split('-W'),
    y = +yPart || new Date().getFullYear(),
    w = +wPart || 1,
    jan4 = new Date(y, 0, 4),
    monday = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4.getDay() + 6) % 7 + (w - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: localIsoDate(monday),
    end: localIsoDate(sunday)
  };
}
function dateInRange(d, start, end) {
  const x = String(d || '').slice(0, 10);
  return x && x >= start && x <= end;
}
function selectedAnalysisWeek() {
  return val('analysisWeek') || weekKey();
}
function selectedAnalysisMonth() {
  return val('analysisMonth') || today().slice(0, 7);
}
function analysisSignedDeals(start, end) {
  return visibleDeals().filter(d => dateInRange(d.date, start, end));
}
function analysisWeekDays() {
  return [['Mon', 'mon'], ['Tue', 'tue'], ['Wed', 'wed'], ['Thu', 'thu'], ['Fri', 'fri'], ['Sat', 'sat'], ['Sun', 'sun']];
}
function analysisPlanFor(key = selectedAnalysisWeek()) {
  state.analysisPlans = state.analysisPlans || {};
  state.analysisPlans[key] = state.analysisPlans[key] || {};
  return state.analysisPlans[key];
}
function analysisPlannedDayMinutes(p) {
  return Object.values(p.callDays || {}).reduce((s, n) => s + (+n || 0), 0);
}
function loadAnalysisPlanInputs() {
  const key = selectedAnalysisWeek(),
    p = analysisPlanFor(key);
  setVal('analysisPlanCalls', p.calls || '');
  setVal('analysisPlanMinutes', p.minutes || '');
  setVal('analysisPlanMeetingsNew', p.meetingsNew || '');
  setVal('analysisPlanMeetingsExisting', p.meetingsExisting || '');
  setVal('analysisPlanReferrals', p.referrals || '');
  setVal('analysisPlanAnalyses', p.analyses || '');
  setVal('analysisPlanPresentations', p.presentations || '');
  setVal('analysisPlanSignatures', p.signatures || '');
  setVal('analysisPlanCoop', p.coop || '');
  setVal('analysisPlanText', p.text || '');
  analysisWeekDays().forEach(([cap, low]) => setVal('analysisCall' + cap, p.callDays?.[low] || ''));
}
function saveAnalysisPlan() {
  const key = selectedAnalysisWeek(),
    callDays = {};
  analysisWeekDays().forEach(([cap, low]) => callDays[low] = parseMoney(val('analysisCall' + cap)));
  state.analysisPlans[key] = {
    calls: parseMoney(val('analysisPlanCalls')),
    minutes: parseMoney(val('analysisPlanMinutes')),
    meetingsNew: parseMoney(val('analysisPlanMeetingsNew')),
    meetingsExisting: parseMoney(val('analysisPlanMeetingsExisting')),
    referrals: parseMoney(val('analysisPlanReferrals')),
    analyses: parseMoney(val('analysisPlanAnalyses')),
    presentations: parseMoney(val('analysisPlanPresentations')),
    signatures: parseMoney(val('analysisPlanSignatures')),
    coop: parseMoney(val('analysisPlanCoop')),
    callDays,
    text: val('analysisPlanText').trim(),
    updatedAt: new Date().toISOString()
  };
  persist();
  renderReferrerHub();
  saveToast('Týdenní plán uložen');
}
function setAnalysisWeek(key) {
  setVal('analysisWeek', key);
  renderReferrerHub();
}
function renderReferrerHubCore() {
  renderAnalysis();
  const y = +val('dealYear') || new Date().getFullYear(),
    q = norm(val('referrerSearch')),
    owners = ownerRows(y).filter(([name, x]) => !q || norm([name, x.count, x.bj].join(' ')).includes(q));
  const recRows = allReferralRows().filter(x => !q || norm([x.from, x.to, x.topic, x.type].join(' ')).includes(q)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const metrics = byId('referrerMetrics');
  if (metrics) {
    const total = owners.reduce((s, [, x]) => s + x.payout, 0),
      unpaid = owners.reduce((s, [, x]) => s + x.unpaidAmount, 0),
      leadClients = state.clients.filter(c => c.leadType === 'tipar' || c.leadType === 'referral' || c.referrerRole).length;
    metrics.innerHTML = `<div class="metric"><span class="note">Zdrojových klientů</span><b>${num(leadClients)}</b></div><div class="metric"><span class="note">Typaři k výplatě</span><b>${money(total)}</b></div><div class="metric"><span class="note">Nevyplaceno</span><b class="orange">${money(unpaid)}</b></div><div class="metric"><span class="note">Doporučení / tipů</span><b>${num(recRows.length)}</b></div>`;
  }
  const t = byId('referrerHubTable');
  if (t) t.innerHTML = `<thead><tr><th>Typař</th><th>Přivedl klientů</th><th>Obchodů</th><th>BJ celkem</th><th>Oček. provize z BJ</th><th>Investice objem</th><th>Hypotéky objem</th><th>Domluveno</th><th>K výplatě</th><th>Vyplaceno</th><th>Mimo obchod</th><th>Nevyplaceno</th><th>Čistá provize</th><th>Akce</th></tr></thead><tbody>${owners.map(([name, x]) => {
    const clients = state.clients.filter(c => c.leadType === 'tipar' && norm(c.leadSource) === norm(name)).length;
    return `<tr><td><b>${esc(name)}</b></td><td class="num">${num(clients)}</td><td class="num">${num(x.count)}</td><td class="num">${num(x.bj)}</td><td class="money">${money(x.cash)}</td><td class="money">${money(x.inv)}</td><td class="money">${money(x.mort)}</td><td class="num">${avgPct(x).toFixed(0)} %</td><td class="money">${money(x.payout)}</td><td class="money">${num(x.paid)} · ${money(x.paidAmount)}</td><td class="money">${money(x.extraPaid || 0)}</td><td class="money">${num(x.unpaid)} · ${money(x.unpaidAmount)}</td><td class="money">${money(x.net)}</td><td><button class="btn slim" onclick="openReferrerPayoutModal(decodeURIComponent('${esc(encodeURIComponent(name))}'))">+ Mimo obchod</button></td></tr>`;
  }).join('') || '<tr><td colspan="14" class="note">Zatím tu není žádný typař. Označ klienta jako „Je typař“ v kartě klienta a tady se objeví i s domluvenou provizí.</td></tr>'}</tbody>`;
  const r = byId('recommendationHubTable');
  if (r) r.innerHTML = `<thead><tr><th>Typ</th><th>Doporučil / typař</th><th>Koho</th><th>Co</th><th>Datum</th><th>Obchodů</th><th>BJ</th><th>Oček. provize</th><th>Investice</th><th>Hypotéky</th><th>Klient</th></tr></thead><tbody>${recRows.map(x => {
    const s = referralRecordStats(x, y);
    return `<tr><td>${x.type === 'tipar' ? '<span class="badge purple">Tipař</span>' : '<span class="badge green">Doporučení</span>'}</td><td><b>${esc(x.from)}</b></td><td>${esc(x.to)}</td><td>${esc(x.topic || '')}</td><td>${esc(x.date || '')}</td><td class="num">${num(s.count)}</td><td class="num">${num(s.bj)}</td><td class="money">${money(s.cash)}</td><td class="money">${money(s.inv)}</td><td class="money">${money(s.mort)}</td><td>${s.target ? `<button class="btn slim" onclick="selectedClientId=${s.target.id};showView('clients')">Otevřít</button>` : '<span class="note">bez karty</span>'}</td></tr>`;
  }).join('') || '<tr><td colspan="11" class="note">Zatím tu není doporučení ani tip.</td></tr>'}</tbody>`;
}
function openModal(id) {
  byId(id).classList.add('show');
}
function closeModal(id) {
  byId(id).classList.remove('show');
}
function toggleLeadFields() {
  const t = val('cLeadType'),
    src = byId('cLeadSource'),
    dt = byId('cLeadDate'),
    pct = byId('cLeadCommissionPct');
  if (src) src.disabled = t === 'direct';
  if (dt) dt.disabled = t === 'direct';
  if (pct) pct.disabled = t !== 'tipar';
}
function toggleReferrerFields() {
  const role = val('cReferrerRole'),
    pct = byId('cReferrerCommissionPct');
  if (pct) pct.disabled = role !== 'tipar';
}
function openClientModal(id = null) {
  editingClientId = id;
  const c = id ? findClient(id) : {};
  setVal('cName', c.name || '');
  setVal('cPhone', c.phone || '');
  setVal('cEmail', c.email || '');
  setVal('cAltEmails', c.altEmails || '');
  setVal('cContactPref', c.contactPref || 'email');
  setVal('cBirthId', c.birthId || '');
  setVal('cAddress', c.address || '');
  setVal('cLeadType', c.leadType || 'direct');
  setVal('cLeadSource', c.leadSource || '');
  setVal('cLeadDate', c.leadDate || c.createdAt || today());
  setVal('cLeadCommissionPct', c.leadCommissionPct || '');
  setVal('cReferrerRole', c.referrerRole || '');
  setVal('cReferrerCommissionPct', c.referrerCommissionPct || '');
  setVal('cNote', c.note || '');
  toggleLeadFields();
  toggleReferrerFields();
  byId('deleteClientBtn').style.display = id ? 'inline-flex' : 'none';
  byId('clientModalTitle').textContent = id ? 'Upravit klienta' : 'Nový klient';
  openModal('clientModal');
}
function syncClientReferral(c) {
  if (c.leadType !== 'referral' || !c.leadSource) return;
  state.referrals = state.referrals || [];
  const exists = state.referrals.some(r => norm(r.from) === norm(c.leadSource) && norm(r.to) === norm(clientName(c)));
  if (!exists) state.referrals.push({
    id: uid(),
    from: c.leadSource,
    to: clientName(c),
    topic: 'Nový klient',
    date: c.leadDate || c.createdAt || today(),
    createdAt: today(),
    clientId: c.id,
    source: 'client-card'
  });
}
function saveClient() {
  const name = val('cName').trim();
  if (!name) return alert('Vyplň jméno klienta.');
  let c = editingClientId ? findClient(editingClientId) : null;
  if (!c) {
    c = {
      id: uid(),
      createdAt: today()
    };
    state.clients.push(c);
  }
  Object.assign(c, {
    name,
    phone: val('cPhone').trim(),
    email: val('cEmail').trim(),
    altEmails: val('cAltEmails').trim(),
    contactPref: val('cContactPref'),
    birthId: val('cBirthId').trim(),
    address: val('cAddress').trim(),
    leadType: val('cLeadType') || 'direct',
    leadSource: val('cLeadType') === 'direct' ? '' : val('cLeadSource').trim(),
    leadDate: val('cLeadType') === 'direct' ? '' : val('cLeadDate') || today(),
    leadCommissionPct: val('cLeadType') === 'tipar' ? parseMoney(val('cLeadCommissionPct')) : 0,
    referrerRole: val('cReferrerRole'),
    referrerCommissionPct: val('cReferrerRole') === 'tipar' ? parseMoney(val('cReferrerCommissionPct')) : 0,
    note: val('cNote').trim()
  });
  const linked = linkInvestmentRecordsToClient(c);
  syncClientReferral(c);
  const dups = clientDuplicatesFor(c);
  selectedClientId = c.id;
  addActivity(c.id, 'Poznámka', (editingClientId ? 'Upraven klient' : 'Založen klient') + (linked ? ' · spárováno FKI podle RČ/IČO' : ''), true);
  closeModal('clientModal');
  renderAll();
  saveToast(editingClientId ? 'Klient uložen' : 'Klient založen');
  if (dups.length) {
    const group = [c, ...dups],
      reason = clientDuplicateReason(group);
    if (confirm('Pozor, tento klient vypadá jako duplicita podle: ' + reason + '. Chceš otevřít sloučení klientů?')) openClientMergeModal(group.map(x => x.id));
  }
}
function deleteClient() {
  const c = findClient(editingClientId);
  if (!c) return;
  if (!confirm('Smazat klienta včetně smluv, obchodů, příležitostí, poznámek a aktivit?')) return;
  state.clients = state.clients.filter(x => x.id !== c.id);
  state.contracts = state.contracts.filter(x => x.clientId !== c.id);
  state.deals = state.deals.filter(x => x.clientId !== c.id);
  state.opportunities = state.opportunities.filter(x => x.clientId !== c.id);
  state.notes = state.notes.map(n => String(n.clientId) === String(c.id) ? {
    ...n,
    clientId: null
  } : n);
  state.activities = state.activities.filter(x => x.clientId !== c.id);
  state.analysisEntries = (state.analysisEntries || []).map(a => String(a.clientId) === String(c.id) ? {
    ...a,
    clientId: null
  } : a);
  selectedClientId = state.clients[0]?.id || null;
  closeModal('clientModal');
  renderAll();
}
function fillStatusSelect() {
  byId('sStatus').innerHTML = Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}
function dateStamp() {
  return new Date().toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
function datedTextareaEnter(e, el) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  e.preventDefault();
  const stamp = '\n\n[' + dateStamp() + ']\n',
    start = el.selectionStart,
    end = el.selectionEnd,
    text = el.value;
  el.value = text.slice(0, start) + stamp + text.slice(end);
  el.selectionStart = el.selectionEnd = start + stamp.length;
}
function attachmentBlobUrl(a) {
  if (a?.fileRef) return diskFileUrl(a.fileRef);
  if (!a?.dataUrl) return '';
  const parts = String(a.dataUrl).split(','),
    meta = parts[0] || '',
    raw = parts.slice(1).join(','),
    mime = (meta.match(/data:([^;]+)/) || [])[1] || a.type || 'application/octet-stream';
  try {
    const bin = atob(raw),
      bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], {
      type: mime
    }));
  } catch (e) {
    return a.dataUrl;
  }
}
function attachmentIsImage(a) {
  return String(a?.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a?.name || '');
}
function attachmentThumb(a) {
  if (attachmentIsImage(a)) {
    const src = a.dataUrl || attachmentBlobUrl(a);
    return src ? `<img src="${esc(src)}" alt="${esc(a.name)}">` : 'IMG';
  }
  return /\.pdf$/i.test(a?.name || '') || String(a?.type || '').includes('pdf') ? 'PDF' : 'Soubor';
}
function openContractAttachment(i) {
  const a = contractAttachmentDraft[i];
  if (!a) return;
  const url = attachmentBlobUrl(a);
  if (!url) return alert('Přílohu se nepovedlo otevřít. Pokud je uložená na disku, zkontroluj v záložce Záloha, že běží diskové úložiště.');
  const w = window.open(url, '_blank');
  if (!w) {
    downloadContractAttachment(i);
    alert('Prohlížeč zablokoval nové okno, přílohu jsem připravil ke stažení.');
  }
  if (url.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(url), 300000);
}
function downloadContractAttachment(i) {
  const a = contractAttachmentDraft[i];
  if (!a) return;
  const url = attachmentBlobUrl(a);
  if (!url) return alert('Přílohu se nepovedlo stáhnout. Pokud je uložená na disku, zkontroluj v záložce Záloha, že běží diskové úložiště.');
  const link = document.createElement('a');
  link.href = url;
  link.download = a.name || 'priloha';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    link.remove();
  }, 1000);
}
function renderContractAttachments() {
  const el = byId('sAttachments');
  if (!el) return;
  const draft = contractAttachmentDraft || [],
    pdf = draft.filter(a => String(a.type || '').includes('pdf') || /\.pdf$/i.test(a.name || '')).length,
    disk = draft.filter(a => a.fileRef).length,
    summary = draft.length ? `<div class="sync-status" style="grid-column:1/-1"><b>Připraveno ${num(draft.length)} příloh</b> · PDF: ${num(pdf)} · na disku: ${num(disk)}. Po přidání nebo smazání klikni na <b>Uložit smlouvu</b>.</div>` : '';
  el.innerHTML = summary + (draft.map((a, i) => `<div class="attachment-card"><button class="attachment-thumb" onclick="openContractAttachment(${i})" title="Otevřít přílohu">${attachmentThumb(a)}</button><b title="${esc(a.name)}">${esc(a.name || 'Příloha')}</b><span class="note">${esc(a.createdAt || a.savedAt || '')}${a.fileRef ? ' · disk' : ''}</span><div class="actions"><button class="btn slim" onclick="openContractAttachment(${i})">Otevřít</button><button class="btn slim" onclick="downloadContractAttachment(${i})">Stáhnout</button><button class="btn slim red" onclick="removeContractAttachment(${i})">Smazat</button></div></div>`).join('') || '<span class="note">Zatím bez příloh. Můžeš přidat PDF nebo obrázek.</span>');
}
function addContractAttachments(files) {
  const list = [...(files || [])];
  if (!list.length) return;
  let pending = list.length,
    added = 0;
  list.forEach(file => {
    if (file.size > 8 * 1024 * 1024) {
      alert('Soubor ' + file.name + ' je moc velký pro lokální uložení. Zkus zatím menší PDF nebo screenshot.');
      if (! --pending) renderContractAttachments();
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      contractAttachmentDraft.push({
        id: uid(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: r.result,
        createdAt: dateStamp()
      });
      added++;
      if (! --pending) {
        renderContractAttachments();
        if (added) toast('Přílohy připravené. Pro trvalé uložení klikni na Uložit smlouvu.');
      }
    };
    r.onerror = () => {
      alert('Přílohu ' + file.name + ' se nepovedlo načíst.');
      if (! --pending) renderContractAttachments();
    };
    r.readAsDataURL(file);
  });
  const input = byId('sAttachmentInput');
  if (input) input.value = '';
}
function removeContractAttachment(i) {
  contractAttachmentDraft.splice(i, 1);
  renderContractAttachments();
}
function toggleContractDealFields() {
  const on = val('sCreateDeal') === 'yes';
  ['sDealDate', 'sDealBj', 'sDealCommission', 'sDealOwner', 'sDealOwnerType'].forEach(id => {
    const el = byId(id);
    if (el) el.disabled = !on;
  });
}
function syncContractDealDefaults(forceType = false) {
  const client = findClient(+val('sClient')),
    lead = clientLeadDefault(client);
  if (val('sStatus') === 'podepsano') setVal('sCreateDeal', 'yes');
  if (!val('sDealDate')) setVal('sDealDate', today());
  if (lead.owner && !val('sDealOwner')) setVal('sDealOwner', lead.owner);
  if (lead.ownerType && !val('sDealOwnerType')) setVal('sDealOwnerType', lead.ownerType);
  toggleContractDealFields();
}
function contractDealPrefill(s) {
  const client = findClient(s.clientId),
    lead = clientLeadDefault(client);
  return {
    date: s.dealDate || today(),
    bj: +s.dealBj || 0,
    commission: '',
    owner: s.dealOwner || lead.owner || '',
    ownerType: s.dealOwnerType || lead.ownerType || '',
    ownerPct: (s.dealOwnerType || lead.ownerType) === 'tipar' ? referrerCommissionFor(s.dealOwner || lead.owner) || lead.pct || 0 : 0
  };
}
function openContractModal(clientId = null, id = null) {
  fillClientSelect('sClient', clientId || selectedClientId);
  fillStatusSelect();
  editingContractId = id;
  const s = id ? state.contracts.find(x => x.id === id) : {
    clientId: clientId || selectedClientId,
    type: 'auto',
    status: 'reseni',
    anniv: today(),
    note: '[' + dateStamp() + ']\n',
    createDeal: 'no'
  };
  setVal('sClient', s.clientId || '');
  setVal('sType', s.type || 'auto');
  setVal('sStatus', s.status || '');
  setVal('sCompany', s.company || '');
  setVal('sProduct', s.product || '');
  setVal('sNumber', s.number || '');
  setVal('sAnniv', s.anniv || '');
  setVal('sAmount', s.amount || '');
  setVal('sRate', s.rate || '');
  setVal('sCreateDeal', s.createDeal === 'yes' || s.fromDealId ? 'yes' : 'no');
  setVal('sDealDate', s.dealDate || today());
  setVal('sDealBj', s.dealBj || '');
  setVal('sDealCommission', s.expectedCommission || '');
  setVal('sDealOwner', s.dealOwner || '');
  setVal('sDealOwnerType', s.dealOwnerType || '');
  setVal('sNote', s.note || '');
  contractAttachmentDraft = (Array.isArray(s.attachments) ? s.attachments : []).map(a => ({
    ...a
  }));
  syncContractDealDefaults();
  renderContractAttachments();
  byId('deleteContractBtn').style.display = id ? 'inline-flex' : 'none';
  byId('contractModalTitle').textContent = id ? 'Správa smlouvy' : 'Nová smlouva';
  openModal('contractModal');
}
function fkiSync_before_saveContract() {
  const clientId = +val('sClient');
  if (!clientId) return alert('Vyber klienta.');
  const number = val('sNumber').trim(),
    confirmedDuplicates = confirmedContractDuplicates(number, editingContractId);
  if (confirmedDuplicates === null) return;
  let s = editingContractId ? state.contracts.find(x => x.id === editingContractId) : null;
  if (!s) {
    s = {
      id: uid(),
      createdAt: today(),
      log: []
    };
    state.contracts.push(s);
  }
  const oldStatus = s.status,
    newStatus = val('sStatus'),
    shouldCreateDeal = newStatus === 'podepsano' && val('sCreateDeal') === 'yes';
  Object.assign(s, {
    clientId,
    type: val('sType'),
    status: newStatus,
    statuses: [],
    source: sourceForType(val('sType')),
    company: val('sCompany').trim(),
    product: val('sProduct').trim(),
    number,
    anniv: val('sAnniv'),
    amount: val('sAmount').trim(),
    rate: val('sRate').trim(),
    createDeal: val('sCreateDeal'),
    dealDate: val('sDealDate') || today(),
    dealBj: parseMoney(val('sDealBj')),
    expectedCommission: parseMoney(val('sDealCommission')),
    dealOwner: val('sDealOwner').trim(),
    dealOwnerType: val('sDealOwner').trim() ? val('sDealOwnerType') : '',
    note: val('sNote').trim(),
    attachments: (contractAttachmentDraft || []).map(a => ({
      ...a
    })),
    updatedAt: today()
  });
  if (confirmedDuplicates.length) markDuplicateVerified('contract', [s, ...confirmedDuplicates]);
  if (!s.log) s.log = [];
  if (oldStatus !== s.status) s.log.push({
    d: today(),
    t: 'Stav: ' + (STATUS_LABELS[s.status] || 'Bez stavu')
  });
  if (shouldCreateDeal) s.log.push({
    d: today(),
    t: 'Podepsáno · připraveno k propsání do obchodů'
  });
  if (!editingContractId) s.log.push({
    d: today(),
    t: 'Smlouva založena v CRM'
  });
  selectedClientId = clientId;
  addActivity(clientId, 'Smlouva', (editingContractId ? 'Upravena ' : 'Přidána ') + (s.product || s.type), true);
  persist();
  if (shouldCreateDeal) {
    openDealFromContract(s);
    return;
  }
  closeModal('contractModal');
  renderAll();
  saveToast('Smlouva uložena · příloh ' + num(contractAttachments(s).length));
}
function markContractDone() {
  setVal('sStatus', 'vyrizeno');
  const type = val('sType'),
    anniv = val('sAnniv');
  if ((type === 'auto' || type === 'majetek') && anniv) setVal('sAnniv', nextAnnualDateString(anniv));
  saveContract();
}
function fkiSync_before_deleteContract() {
  if (!editingContractId) return;
  const s = state.contracts.find(x => x.id === editingContractId);
  if (!s || !confirm('Smazat smlouvu?')) return;
  state.contracts = state.contracts.filter(x => x.id !== editingContractId);
  addActivity(s.clientId, 'Smlouva', 'Smazána smlouva ' + (s.product || s.type), true);
  closeModal('contractModal');
  renderAll();
}
function fillDealStatusSelect() {
  byId('dContractStatus').innerHTML = Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
}
function syncDealOwnerDefaults() {
  if (val('dOwnerType') === 'tipar') {
    const pct = referrerCommissionFor(val('dOwner'));
    if (pct && !parseMoney(val('dOwnerCommissionPct'))) setVal('dOwnerCommissionPct', pct);
  }
  if (val('dOwnerType') === 'referral') setVal('dOwnerCommissionPct', '');
}
function dealCategoryCreatesContract(category) {
  return !['FKI', 'Investice', 'Následná provize'].includes(category);
}
function updateDealExpectedCommission() {
  const expected = dealCash({
    category: val('dCategory'),
    bj: parseMoney(val('dBj')),
    date: val('dDate') || today()
  }, yearOf(val('dDate') || today()));
  setVal('dExpectedCommission', money(expected));
}
function syncDealContractDefaults(forceType = false) {
  const type = contractTypeFromDeal(val('dCategory'), val('dProduct'));
  if (forceType || !editingDealId) setVal('dContractType', type);
  if (forceType && !editingDealId) setVal('dCreateContract', dealCategoryCreatesContract(val('dCategory')) ? 'yes' : 'no');
  if (!val('dContractAnniv')) setVal('dContractAnniv', nextAnnualDateString(val('dDate') || today()));
  if (!val('dContractAmount') && val('dAmount')) setVal('dContractAmount', money(parseMoney(val('dAmount'))));
  updateDealExpectedCommission();
  toggleDealContractFields();
}
function syncSignedDealContractRule() {
  if (val('dContractStatus') === 'podepsano') setVal('dCreateContract', 'yes');
  toggleDealContractFields();
}
function toggleDealContractFields() {
  if (val('dContractStatus') === 'podepsano') setVal('dCreateContract', 'yes');
  const on = val('dCreateContract') !== 'no',
    noOpt = byId('dCreateContract')?.querySelector('option[value="no"]');
  if (noOpt) noOpt.disabled = val('dContractStatus') === 'podepsano';
  ['dContractType', 'dContractNumber', 'dContractAnniv', 'dContractAmount', 'dContractRate', 'dContractStatus', 'dContractNote'].forEach(id => {
    const el = byId(id);
    if (el) el.disabled = !on;
  });
}
function linkedContractForDeal(d) {
  if (d?.contractId) {
    const s = state.contracts.find(x => String(x.id) === String(d.contractId));
    if (s) return s;
  }
  if (!d?.contractNumber) return null;
  const rows = state.contracts.filter(s => String(s.clientId) === String(d.clientId) && normId(s.number) === normId(d.contractNumber));
  if (rows.length === 1) return rows[0];
  return rows.find(s => norm(s.company) === norm(d.company) && norm(s.product) === norm(d.product) && areaForContract(s) === areaForDeal(d)) || null;
}
function linkedDealForContract(s) {
  if (!s) return null;
  let d = state.deals.find(x => String(x.contractId) === String(s.id) || String(x.fromContractId) === String(s.id));
  if (d) return d;
  if (!s.number) return null;
  const rows = state.deals.filter(x => String(x.clientId) === String(s.clientId) && normId(x.contractNumber) === normId(s.number));
  if (rows.length === 1) return rows[0];
  return rows.find(x => norm(x.company) === norm(s.company) && norm(x.product) === norm(s.product) && areaForDeal(x) === areaForContract(s)) || null;
}
function openDealModal(clientId = null, id = null) {
  pendingOpportunityToDealId = null;
  pendingContractToDealId = null;
  fillClientSelect('dClient', clientId || selectedClientId);
  const clientEl = byId('dClient');
  if (clientEl) clientEl.disabled = false;
  byId('dCategory').innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join('');
  fillDealStatusSelect();
  editingDealId = id;
  const baseClient = findClient(clientId || selectedClientId),
    lead = clientLeadDefault(baseClient),
    d = id ? state.deals.find(x => x.id === id) : {
      clientId: clientId || selectedClientId,
      category: 'Životní pojištění',
      date: today(),
      owner: lead.owner,
      ownerType: lead.ownerType,
      ownerCommissionPct: lead.pct,
      ownerPaid: false,
      commissionPaid: false
    };
  const s = linkedContractForDeal(d) || {},
    ownerPct = d.ownerType === 'tipar' ? +d.ownerCommissionPct || referrerCommissionFor(d.owner) : 0;
  setVal('dClient', d.clientId || '');
  setVal('dCategory', d.category || 'Životní pojištění');
  setVal('dDate', d.date || today());
  setVal('dCompany', d.company || '');
  setVal('dProduct', d.product || '');
  setVal('dAmount', d.amount || '');
  setVal('dBj', d.bj || '');
  setVal('dOwner', d.owner || '');
  setVal('dOwnerType', d.ownerType || '');
  setVal('dOwnerCommissionPct', ownerPct || '');
  setVal('dOwnerPaid', d.ownerPaid ? 'yes' : 'no');
  setVal('dActualCommission', dealActualCommissionIsSet(d) ? d.actualCommission : '');
  setVal('dCommissionPaid', d.commissionPaid ? 'yes' : 'no');
  setVal('dCreateContract', d.createContract === false || !id && !dealCategoryCreatesContract(d.category) ? 'no' : 'yes');
  setVal('dContractType', s.type || contractTypeFromDeal(d.category || 'Životní pojištění', d.product || ''));
  setVal('dContractNumber', s.number || d.contractNumber || '');
  setVal('dContractAnniv', s.anniv || nextAnnualDateString(d.date || today()));
  setVal('dContractAmount', s.amount || dealContractAmountText(d));
  setVal('dContractRate', s.rate || '');
  setVal('dContractStatus', s.status || '');
  setVal('dContractNote', s.note || '');
  syncDealOwnerDefaults();
  updateDealExpectedCommission();
  toggleDealContractFields();
  byId('deleteDealBtn').style.display = id ? 'inline-flex' : 'none';
  byId('moveDealToOppBtn').style.display = id ? 'inline-flex' : 'none';
  byId('dealModalTitle').textContent = id ? 'Upravit obchod' : 'Nový obchod';
  openModal('dealModal');
}
function openRecurringCommissionModal() {
  const c = commissionSystemClient();
  openDealModal(c.id);
  setVal('dClient', c.id);
  const clientEl = byId('dClient');
  if (clientEl) clientEl.disabled = true;
  setVal('dCategory', 'Následná provize');
  setVal('dCompany', '');
  setVal('dProduct', '');
  setVal('dAmount', '');
  setVal('dBj', '');
  setVal('dOwner', '');
  setVal('dOwnerType', '');
  setVal('dOwnerCommissionPct', '');
  setVal('dOwnerPaid', 'no');
  setVal('dActualCommission', '');
  setVal('dCreateContract', 'no');
  setVal('dCommissionPaid', 'yes');
  setVal('dContractStatus', '');
  updateDealExpectedCommission();
  toggleDealContractFields();
  byId('dealModalTitle').textContent = 'Následná provize';
}
function openDealFromOpportunity(o) {
  pendingOpportunityToDealId = o.id;
  fillClientSelect('dClient', o.clientId || selectedClientId);
  byId('dCategory').innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join('');
  fillDealStatusSelect();
  editingDealId = o.dealId && state.deals.some(d => String(d.id) === String(o.dealId)) ? o.dealId : null;
  const category = opportunityCategoryToDeal(o.category, o.product),
    d = editingDealId ? state.deals.find(x => String(x.id) === String(editingDealId)) : {
      clientId: o.clientId,
      category,
      date: o.statusDate || today(),
      company: o.company,
      product: o.product,
      amount: o.amount,
      bj: o.bj,
      owner: o.owner,
      actualCommission: o.actualCommission,
      commissionPaid: false,
      ownerPaid: false,
      createContract: o.createContract !== false,
      contractNumber: o.contractNumber
    };
  const s = linkedContractForDeal(d) || {};
  setVal('dClient', d.clientId || o.clientId || '');
  setVal('dCategory', d.category || category);
  setVal('dDate', d.date || o.statusDate || today());
  setVal('dCompany', d.company || o.company || '');
  setVal('dProduct', d.product || o.product || '');
  setVal('dAmount', d.amount || o.amount || '');
  setVal('dBj', d.bj || o.bj || '');
  setVal('dOwner', d.owner || o.owner || '');
  setVal('dOwnerType', d.ownerType || '');
  setVal('dOwnerCommissionPct', d.ownerCommissionPct || '');
  setVal('dOwnerPaid', d.ownerPaid ? 'yes' : 'no');
  setVal('dActualCommission', dealActualCommissionIsSet(d) ? d.actualCommission : dealActualCommissionIsSet(o) ? o.actualCommission : '');
  setVal('dCommissionPaid', d.commissionPaid ? 'yes' : 'no');
  setVal('dCreateContract', o.status === 'Podepsáno' ? 'yes' : o.createContract === false ? 'no' : 'yes');
  setVal('dContractType', s.type || contractTypeFromDeal(category, o.product || ''));
  setVal('dContractNumber', s.number || o.contractNumber || '');
  setVal('dContractAnniv', s.anniv || o.contractAnniv || nextAnnualDateString(o.statusDate || today()));
  setVal('dContractAmount', s.amount || dealContractAmountText(d));
  setVal('dContractRate', s.rate || o.contractRate || '');
  setVal('dContractStatus', s.status || (o.status === 'Podepsáno' ? 'podepsano' : 'vyrizeno'));
  setVal('dContractNote', s.note || o.note || '');
  syncDealOwnerDefaults();
  updateDealExpectedCommission();
  toggleDealContractFields();
  byId('deleteDealBtn').style.display = editingDealId ? 'inline-flex' : 'none';
  byId('moveDealToOppBtn').style.display = 'none';
  byId('dealModalTitle').textContent = 'Propsat příležitost do obchodu';
  closeModal('opportunityModal');
  openModal('dealModal');
  toast('Doplň BJ/provizi a ulož obchod.');
}
function openDealFromContract(s) {
  if (!s) return;
  pendingContractToDealId = s.id;
  pendingOpportunityToDealId = null;
  fillClientSelect('dClient', s.clientId || selectedClientId);
  byId('dCategory').innerHTML = CATEGORIES.map(c => `<option>${c}</option>`).join('');
  fillDealStatusSelect();
  const pref = contractDealPrefill(s),
    existing = linkedDealForContract(s);
  editingDealId = existing?.id || null;
  const category = opportunityCategoryToDeal(contractOpportunityCategory(s), s.product),
    d = existing || {
      clientId: s.clientId,
      category,
      date: pref.date,
      company: s.company,
      product: s.product || s.type,
      amount: parseMoney(s.amount),
      bj: pref.bj,
      owner: pref.owner,
      ownerType: pref.ownerType,
      ownerCommissionPct: pref.ownerPct,
      actualCommission: pref.commission,
      commissionPaid: false,
      ownerPaid: false,
      createContract: true,
      contractId: s.id,
      contractNumber: s.number
    };
  setVal('dClient', d.clientId || s.clientId || '');
  setVal('dCategory', d.category || category);
  setVal('dDate', d.date || pref.date || today());
  setVal('dCompany', d.company || s.company || '');
  setVal('dProduct', d.product || s.product || s.type || '');
  setVal('dAmount', d.amount || parseMoney(s.amount) || '');
  setVal('dBj', d.bj || pref.bj || '');
  setVal('dOwner', d.owner || pref.owner || '');
  setVal('dOwnerType', d.ownerType || pref.ownerType || '');
  setVal('dOwnerCommissionPct', d.ownerCommissionPct || pref.ownerPct || '');
  setVal('dOwnerPaid', d.ownerPaid ? 'yes' : 'no');
  setVal('dActualCommission', dealActualCommissionIsSet(d) ? d.actualCommission : '');
  setVal('dCommissionPaid', d.commissionPaid ? 'yes' : 'no');
  setVal('dCreateContract', 'yes');
  setVal('dContractType', s.type || contractTypeFromDeal(category, s.product || ''));
  setVal('dContractNumber', s.number || '');
  setVal('dContractAnniv', s.anniv || nextAnnualDateString(pref.date || today()));
  setVal('dContractAmount', s.amount || dealContractAmountText(d));
  setVal('dContractRate', s.rate || '');
  setVal('dContractStatus', 'podepsano');
  setVal('dContractNote', s.note || '');
  syncDealOwnerDefaults();
  updateDealExpectedCommission();
  toggleDealContractFields();
  byId('deleteDealBtn').style.display = editingDealId ? 'inline-flex' : 'none';
  byId('moveDealToOppBtn').style.display = 'none';
  byId('dealModalTitle').textContent = 'Podepsanou smlouvu propsat do obchodu';
  closeModal('contractModal');
  openModal('dealModal');
  toast('Doplň BJ/provizi a ulož obchod.');
}
function openInvestmentDealModal(clientId = null, kind = 'Investice') {
  const category = kind === 'FKI' ? 'FKI' : 'Investice';
  openDealModal(clientId || selectedClientId || null);
  setVal('dCategory', category);
  setVal('dCreateContract', 'no');
  setVal('dContractType', category === 'FKI' ? 'FKI' : 'investice');
  syncDealContractDefaults(true);
}
function fillInvestmentProductSelect(selectedKey = '') {
  const clientId = +val('isClient') || selectedInvestmentClientId || selectedClientId,
    el = byId('isProduct');
  if (!el) return;
  const items = baseClassicInvestmentItems().filter(x => String(x.clientId) === String(clientId)),
    seen = new Set();
  const opts = items.map(x => {
    const key = investmentItemKey(x);
    if (seen.has(key)) return '';
    seen.add(key);
    return `<option value="${esc(key)}" ${key === selectedKey ? 'selected' : ''}>${esc([x.company, x.product || x.kind || 'Investice'].filter(Boolean).join(' · '))}</option>`;
  }).join('');
  el.innerHTML = opts + '<option value="__custom">Jiný / ručně</option>';
  if (selectedKey && !seen.has(selectedKey)) el.value = '__custom';
  syncInvestmentSnapshotProduct();
}
function syncInvestmentSnapshotProduct() {
  const key = val('isProduct'),
    clientId = +val('isClient') || selectedInvestmentClientId || selectedClientId;
  if (key && key !== '__custom') {
    const item = baseClassicInvestmentItems().find(x => investmentItemKey(x) === key);
    if (item) {
      const rawKey = investmentFundRawKey(item),
        fundKey = investmentFundKey(item),
        fv = state.fundValues?.[fundKey] || state.fundValues?.[rawKey] || {},
        snap = latestSnapshotForItem(item);
      setVal('isCompany', fv.company || item.company || '');
      setVal('isProductName', fv.fond || item.product || item.kind || 'Investice');
      setVal('isIsin', snap?.isin || fv.isin || item.isin || item.source?.isin || '');
      setVal('isMergeKey', snap?.mergeKey || fv.mergeKey || item.mergeKey || '');
      setVal('isFundType', snap?.fundType || fv.typ || item.typ || item.kind || investmentFundProductType(item));
      setVal('isCurrent', snap?.currentBeforeRedemption ?? snap?.current ?? item.amount ?? '');
      setVal('isInvested', snap?.investedBeforeRedemption ?? snap?.invested ?? investmentInvestedAmount(item) ?? '');
      setVal('isGainAmount', snap?.gainAmount || '');
      setVal('isGainPct', snap?.gainPct || '');
      setVal('isRedemptionAmount', snap?.redemptionAmount || '');
      setVal('isRedemptionDate', snap?.redemptionDate || '');
      setVal('isRegularAmount', snap?.regularAmount || '');
      setVal('isRegularFrequency', snap?.regularFrequency || '');
      setVal('isSource', snap?.source || '');
      setVal('isNote', snap?.note || '');
      return;
    }
  }
  const latest = latestInvestmentSnapshots(clientId)[0] || {};
  setVal('isCompany', '');
  setVal('isProductName', '');
  setVal('isIsin', '');
  setVal('isMergeKey', '');
  setVal('isFundType', '');
  setVal('isCurrent', '');
  setVal('isInvested', '');
  setVal('isGainAmount', '');
  setVal('isGainPct', '');
  setVal('isRedemptionAmount', '');
  setVal('isRedemptionDate', '');
  setVal('isRegularAmount', '');
  setVal('isRegularFrequency', '');
  setVal('isSource', latest.source || '');
  setVal('isNote', '');
}
function openInvestmentSnapshotModal(clientId = null, encodedKey = '') {
  const id = clientId || selectedInvestmentClientId || selectedClientId;
  if (!id) return alert('Vyber klienta.');
  fillClientSelect('isClient', id);
  setVal('isClient', id);
  setVal('isDate', today());
  const key = encodedKey ? decodeURIComponent(encodedKey) : '';
  fillInvestmentProductSelect(key);
  openModal('investmentSnapshotModal');
}
function saveInvestmentSnapshot() {
  const clientId = +val('isClient');
  if (!clientId) return alert('Vyber klienta.');
  const company = val('isCompany').trim(),
    product = val('isProductName').trim() || 'Investice',
    isin = val('isIsin').trim(),
    mergeKey = val('isMergeKey').trim(),
    fundType = val('isFundType').trim() || 'Investice',
    currentRaw = val('isCurrent');
  if (String(currentRaw).trim() === '') return alert('Vyplň hodnotu před odkupem / AUM.');
  const currentBefore = parseMoney(currentRaw),
    investedBefore = parseMoney(val('isInvested')),
    redemptionAmount = parseMoney(val('isRedemptionAmount')),
    redemptionDate = val('isRedemptionDate') || '',
    current = Math.max(0, currentBefore - redemptionAmount),
    invested = investedBefore,
    gainAmount = val('isGainAmount') === '' && invested ? investmentPerformanceGain(current, invested, redemptionAmount) : parseMoney(val('isGainAmount')),
    gainPct = val('isGainPct') === '' && invested ? investmentPerformancePct(current, invested, redemptionAmount) : parseMoney(val('isGainPct')),
    snapshot = {
      id: uid(),
      clientId,
      company,
      product,
      isin,
      mergeKey,
      fundType,
      date: val('isDate') || redemptionDate || today(),
      current,
      invested,
      currentBeforeRedemption: currentBefore,
      investedBeforeRedemption: investedBefore,
      redemptionAmount,
      redemptionDate,
      gainAmount,
      gainPct,
      regularAmount: parseMoney(val('isRegularAmount')),
      regularFrequency: val('isRegularFrequency'),
      source: val('isSource').trim(),
      note: [val('isNote').trim(), redemptionAmount ? investmentRedemptionText({
        redemptionAmount,
        redemptionDate
      }) : ''].filter(Boolean).join('\n'),
      createdAt: today()
    };
  const key = investmentSnapshotKeyForSnapshot(snapshot),
    oldIndex = (state.investmentSnapshots || []).findIndex(s => investmentSnapshotKeyForSnapshot(s) === key);
  if (oldIndex >= 0) snapshot.id = state.investmentSnapshots[oldIndex].id, state.investmentSnapshots[oldIndex] = {
    ...state.investmentSnapshots[oldIndex],
    ...snapshot,
    updatedAt: today()
  };else state.investmentSnapshots.push(snapshot);
  const fundKey = investmentFundKeyFromParts(company, product, isin, fundType),
    rawKey = investmentFundKeyFromParts(company, product, '', fundType),
    fundValue = {
      area: 'investice',
      company: company || 'Nezařazeno',
      fond: product,
      isin,
      mergeKey,
      typ: fundType,
      product: fundType,
      date: snapshot.date
    };
  state.fundValues[fundKey] = {
    ...(state.fundValues[fundKey] || {}),
    ...fundValue
  };
  state.fundValues[rawKey] = {
    ...(state.fundValues[rawKey] || {}),
    ...fundValue
  };
  if (mergeKey) state.fundValues[['investment-merge', norm(mergeKey)].join('|')] = {
    ...(state.fundValues[['investment-merge', norm(mergeKey)].join('|')] || {}),
    ...fundValue
  };
  selectedInvestmentClientId = clientId;
  selectedClientId = clientId;
  dedupeInvestmentSnapshotsInState(state);
  addActivity(clientId, 'Investice', 'Aktualizována hodnota portfolia: ' + product + ' · ' + money(current) + (redemptionAmount ? ' · odkup ' + money(redemptionAmount) : ''), true);
  closeModal('investmentSnapshotModal');
  persist();
  renderAll();
  saveToast(redemptionAmount ? 'Odkup a hodnota investice uloženy ✓' : oldIndex >= 0 ? 'Hodnota investice přepsána ✓' : 'Hodnota investice aktualizována ✓');
}
function upsertContractFromDeal(d) {
  let s = linkedContractForDeal(d);
  if (val('dCreateContract') === 'no') {
    if (s && (s.fromDealId === d.id || (s.log || []).some(l => String(l.t || '').includes('Smlouva vytvořena z obchodu')))) {
      state.contracts = state.contracts.filter(x => String(x.id) !== String(s.id));
    }
    d.createContract = false;
    d.contractId = null;
    d.contractNumber = '';
    return null;
  }
  const number = val('dContractNumber').trim();
  if (!s) {
    s = {
      id: uid(),
      clientId: d.clientId,
      createdAt: today(),
      log: []
    };
    state.contracts.push(s);
  }
  const oldStatus = s.status;
  Object.assign(s, {
    clientId: d.clientId,
    type: val('dContractType') || contractTypeFromDeal(d.category, d.product),
    status: val('dContractStatus'),
    statuses: [],
    source: sourceForType(val('dContractType') || contractTypeFromDeal(d.category, d.product)),
    company: d.company,
    product: d.product,
    number,
    anniv: val('dContractAnniv'),
    amount: val('dContractAmount').trim() || dealContractAmountText(d),
    rate: val('dContractRate').trim(),
    note: val('dContractNote').trim(),
    fromDealId: d.id
  });
  if (!s.log) s.log = [];
  if (!d.contractId) s.log.push({
    d: today(),
    t: 'Smlouva vytvořena z obchodu'
  });
  if (oldStatus !== s.status) s.log.push({
    d: today(),
    t: 'Stav: ' + (STATUS_LABELS[s.status] || 'Bez stavu')
  });
  d.contractId = s.id;
  d.contractNumber = s.number;
  d.createContract = true;
  return s;
}
function opportunityCategoryFromDeal(category, product = '') {
  const type = contractTypeFromDeal(category, product);
  if (type === 'život') return 'Život';
  if (type === 'auto') return 'Auto';
  if (type === 'majetek') return 'Nemovitost';
  if (type === 'hypotéka') return 'Hypotéka';
  if (type === 'úvěr') return 'Úvěry';
  if (type === 'DPS') return 'Penze';
  if (type === 'FKI') return 'FKI';
  if (type === 'investice') return 'Investice';
  return category || 'Ostatní';
}
function fkiSync_before_moveDealToOpportunity() {
  if (!editingDealId) return;
  const d = state.deals.find(x => String(x.id) === String(editingDealId));
  if (!d) return;
  if (!confirm('Přesunout tento řádek z uzavřených obchodů do příležitostí? Obchod zmizí z měsíční evidence, ale u klienta zůstane jako rozpracovaná věc.')) return;
  const clientId = +val('dClient') || d.clientId,
    category = opportunityCategoryFromDeal(val('dCategory') || d.category, val('dProduct') || d.product),
    o = {
      id: uid(),
      clientId,
      status: 'Oportunita',
      statusDate: val('dDate') || d.date || today(),
      category,
      company: val('dCompany').trim() || d.company || '',
      product: val('dProduct').trim() || d.product || '',
      amount: parseMoney(val('dAmount')) || dealVolume(d),
      bj: parseMoney(val('dBj')) || dealBJ(d),
      expectedDate: val('dContractAnniv') || '',
      owner: val('dOwner').trim() || d.owner || '',
      ownerType: val('dOwner').trim() ? val('dOwnerType') : d.ownerType || '',
      createContract: val('dCreateContract') !== 'no',
      contractNumber: val('dContractNumber').trim() || d.contractNumber || '',
      contractAnniv: val('dContractAnniv') || '',
      contractRate: val('dContractRate').trim() || '',
      actualCommission: val('dActualCommission').trim() === '' ? '' : parseMoney(val('dActualCommission')),
      note: val('dContractNote').trim() || d.note || 'Přesunuto z omylem založeného obchodu ' + dateStamp(),
      createdAt: today(),
      history: [{
        d: today(),
        t: 'Přesunuto z obchodů'
      }]
    };
  const exists = (state.opportunities || []).some(x => sameOpenOpportunity(x, o));
  if (!exists) state.opportunities.push(o);
  state.deals = state.deals.filter(x => String(x.id) !== String(d.id));
  const s = linkedContractForDeal(d);
  if (s && String(s.fromDealId) === String(d.id)) {
    s.fromDealId = null;
    s.createDeal = 'no';
    if (s.status === 'podepsano') s.status = 'reseni';
    s.updatedAt = today();
    s.log = s.log || [];
    s.log.push({
      d: today(),
      t: 'Obchod přesunut zpět do příležitostí'
    });
  }
  selectedClientId = clientId;
  addActivity(clientId, 'Příležitost', 'Obchod přesunut zpět do příležitostí: ' + (o.product || o.category), true);
  closeModal('dealModal');
  persist();
  renderAll();
  saveToast('Přesunuto do příležitostí');
}
function fkiSync_before_saveDeal() {
  const clientId = +val('dClient');
  if (!clientId) return alert('Vyber klienta.');
  if (val('dContractStatus') === 'podepsano' && val('dCreateContract') === 'no') setVal('dCreateContract', 'yes');
  toggleDealContractFields();
  const looksEmpty = !parseMoney(val('dAmount')) && !parseMoney(val('dBj')) && !parseMoney(val('dActualCommission'));
  if (!editingDealId && !pendingOpportunityToDealId && !pendingContractToDealId && looksEmpty && val('dCreateContract') === 'no' && !confirm('Tento obchod nemá objem, BJ ani provizi a nemá se propsat do smluv. Nevypadá jako uzavřený obchod. Opravdu ho chceš uložit do obchodů?')) return;
  const existingDeal = editingDealId ? state.deals.find(x => x.id === editingDealId) : null,
    ignoreContractId = existingDeal?.contractId || pendingContractToDealId || null;
  let confirmedContractDup = [];
  if (val('dCreateContract') !== 'no') {
    confirmedContractDup = confirmedContractDuplicates(val('dContractNumber').trim(), ignoreContractId);
    if (confirmedContractDup === null) return;
  }
  let d = existingDeal;
  if (!d) {
    d = {
      id: uid(),
      createdAt: today(),
      commissionPaid: false,
      ownerPaid: false
    };
    state.deals.push(d);
  }
  const wasNew = !editingDealId,
    owner = val('dOwner').trim(),
    ownerType = owner ? val('dOwnerType') : '';
  Object.assign(d, {
    clientId,
    category: val('dCategory'),
    date: val('dDate') || today(),
    company: val('dCompany').trim(),
    product: val('dProduct').trim(),
    amount: parseMoney(val('dAmount')),
    bj: parseMoney(val('dBj')),
    owner,
    ownerType,
    ownerCommissionPct: ownerType === 'tipar' ? parseMoney(val('dOwnerCommissionPct')) || referrerCommissionFor(owner) : 0,
    ownerPaid: val('dOwnerPaid') === 'yes',
    actualCommission: val('dActualCommission').trim() === '' ? '' : parseMoney(val('dActualCommission')),
    commissionPaid: val('dCommissionPaid') === 'yes'
  });
  if (pendingOpportunityToDealId) {
    d.fromOpportunityId = pendingOpportunityToDealId;
    const o = state.opportunities.find(x => String(x.id) === String(pendingOpportunityToDealId));
    if (o) {
      o.status = 'Podepsáno';
      o.statusDate = d.date;
      o.dealId = d.id;
      o.updatedAt = today();
      o.convertedAt = today();
      o.history = o.history || [];
      o.history.push({
        d: d.date,
        t: 'Podepsáno · propsáno do obchodu'
      });
      state.opportunities = state.opportunities.filter(x => String(x.id) !== String(o.id));
      addActivity(clientId, 'Obchod', 'Příležitost propsána do obchodu: ' + (d.product || d.category) + ' · ' + num(dealBJ(d)) + ' BJ', true);
    }
  }
  if (pendingContractToDealId) {
    d.fromContractId = pendingContractToDealId;
    d.contractId = pendingContractToDealId;
    const s = state.contracts.find(x => String(x.id) === String(pendingContractToDealId));
    if (s) {
      s.status = 'podepsano';
      s.createDeal = 'yes';
      s.dealDate = d.date;
      s.dealBj = dealBJ(d);
      s.expectedCommission = dealExpectedCommission(d, yearOf(d.date));
      s.dealOwner = d.owner;
      s.dealOwnerType = d.ownerType;
      s.fromDealId = d.id;
      s.updatedAt = today();
      s.log = s.log || [];
      s.log.push({
        d: d.date,
        t: 'Podepsáno · propsáno do obchodu'
      });
      if (state.contractOpportunityStatuses) delete state.contractOpportunityStatuses[s.id];
      addActivity(clientId, 'Obchod', 'Smlouva propsána do obchodu: ' + (d.product || d.category) + ' · ' + num(dealBJ(d)) + ' BJ', true);
    }
  }
  const linked = upsertContractFromDeal(d);
  if (linked && confirmedContractDup.length) markDuplicateVerified('contract', [linked, ...confirmedContractDup]);
  dedupeInvestmentRecordsInState(state);
  selectedClientId = clientId;
  addActivity(clientId, 'Obchod', (wasNew ? 'Přidán ' : 'Upraven ') + d.category + ' · ' + num(dealBJ(d)) + ' BJ' + (linked ? ' · propsáno do smluv' : ''), true);
  pendingOpportunityToDealId = null;
  pendingContractToDealId = null;
  closeModal('dealModal');
  renderAll();
  saveToast('Obchod uložen');
}
function fkiSync_before_deleteDeal() {
  if (!editingDealId) return;
  const d = state.deals.find(x => x.id === editingDealId);
  if (!d || !confirm('Smazat obchod?')) return;
  state.deals = state.deals.filter(x => x.id !== editingDealId);
  addActivity(d.clientId, 'Obchod', 'Smazán obchod ' + (d.product || d.category), true);
  closeModal('dealModal');
  renderAll();
}
function openNoteModal(clientId = null, id = null) {
  editingNoteId = id;
  fillClientSelect('nClient', clientId || selectedClientId);
  const sel = byId('nClient');
  if (sel) sel.innerHTML = '<option value="">Bez klienta</option>' + sel.innerHTML;
  const n = id ? state.notes.find(x => x.id === id) : {
    date: today(),
    clientId: clientId || selectedClientId || ''
  };
  setVal('nDate', n.date || today());
  setVal('nTitle', n.title || '');
  setVal('nClient', n.clientId || '');
  setVal('nTags', n.tags || '');
  setVal('nText', n.text || '');
  byId('deleteNoteBtn').style.display = id ? 'inline-flex' : 'none';
  byId('noteModalTitle').textContent = id ? 'Upravit poznámku' : 'Nová poznámka';
  openModal('noteModal');
}
function openNoteViewModal(id) {
  const n = state.notes.find(x => String(x.id) === String(id));
  if (!n) return;
  viewingNoteId = n.id;
  const c = findClient(n.clientId);
  setText('noteViewMeta', [n.date, c ? clientName(c) : 'bez klienta'].filter(Boolean).join(' · '));
  setText('noteViewTitle', n.title || 'Poznámka');
  byId('noteViewTags').innerHTML = noteTags(n).map(t => `<span class="chip">${esc(t)}</span>`).join('') + ` <span class="badge blue">${esc(noteType(n))}</span>`;
  setVal('noteInsideSearch', '');
  renderNoteViewText();
  openModal('noteViewModal');
}
function renderNoteViewText() {
  const n = state.notes.find(x => String(x.id) === String(viewingNoteId));
  if (!n) return;
  const q = val('noteInsideSearch').trim(),
    text = esc(n.text || 'Bez textu poznámky.');
  if (!q) {
    byId('noteViewText').innerHTML = text;
    return;
  }
  const safe = esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  byId('noteViewText').innerHTML = text.replace(new RegExp(safe, 'gi'), m => `<mark>${m}</mark>`);
}
function editViewedNote() {
  const n = state.notes.find(x => String(x.id) === String(viewingNoteId));
  if (!n) return;
  closeModal('noteViewModal');
  openNoteModal(n.clientId || null, n.id);
}
function saveNote() {
  const title = val('nTitle').trim(),
    text = val('nText').trim();
  if (!title && !text) return alert('Napiš název nebo text poznámky.');
  let n = editingNoteId ? state.notes.find(x => x.id === editingNoteId) : null;
  if (!n) {
    n = {
      id: uid(),
      createdAt: today()
    };
    state.notes.push(n);
  }
  Object.assign(n, {
    date: val('nDate') || today(),
    title,
    clientId: val('nClient') ? +val('nClient') : null,
    tags: val('nTags').trim(),
    text,
    updatedAt: today()
  });
  if (n.clientId) addActivity(n.clientId, 'Poznámka', 'Poznámka: ' + (title || text.slice(0, 40)), true);
  closeModal('noteModal');
  renderAll();
  saveToast('Poznámka uložena');
}
function deleteNote() {
  if (!editingNoteId) return;
  const n = state.notes.find(x => x.id === editingNoteId);
  if (!n || !confirm('Smazat poznámku?')) return;
  state.notes = state.notes.filter(x => x.id !== editingNoteId);
  closeModal('noteModal');
  renderAll();
}
function populateOpportunityForm(clientId = null, id = null) {
  editingOpportunityId = id;
  fillClientSelect('oClient', clientId || selectedClientId);
  fillOpportunityStatusSelect('oStatus');
  const o = id ? state.opportunities.find(x => x.id === id) : {
    clientId: clientId || selectedClientId,
    status: 'Oportunita',
    statusDate: today(),
    expectedDate: '',
    category: 'Život'
  };
  fillOpportunityCategorySelect('oCategory', o.category || 'Život');
  setVal('oClient', o.clientId || '');
  setVal('oStatus', o.status || 'Oportunita');
  setVal('oStatusDate', o.statusDate || today());
  setVal('oCategory', opportunityCategoryOptions().includes(o.category) ? o.category : '__custom');
  setVal('oCategoryCustom', opportunityCategoryOptions().includes(o.category) ? '' : o.category || '');
  toggleOpportunityCustomCategory();
  setVal('oCompany', o.company || '');
  setVal('oProduct', o.product || '');
  setVal('oAmount', o.amount || '');
  setVal('oBj', o.bj || '');
  setVal('oExpectedDate', o.expectedDate || '');
  setVal('oOwner', o.owner || '');
  setVal('oCreateContract', o.createContract === false ? 'no' : 'yes');
  setVal('oContractNumber', o.contractNumber || '');
  setVal('oContractAnniv', o.contractAnniv || nextAnnualDateString(o.expectedDate || today()));
  setVal('oContractRate', o.contractRate || '');
  setVal('oActualCommission', o.actualCommission || '');
  setVal('oNote', o.note || '');
  byId('deleteOppBtn').style.display = id ? 'inline-flex' : 'none';
  byId('oppModalTitle').textContent = id ? 'Upravit příležitost' : 'Nová příležitost';
  openModal('opportunityModal');
}
function opportunityFromForm() {
  const category = val('oCategory') === '__custom' ? val('oCategoryCustom').trim() || 'Ostatní' : val('oCategory');
  return {
    clientId: +val('oClient'),
    status: val('oStatus') || 'Oportunita',
    statusDate: val('oStatusDate') || today(),
    category,
    company: val('oCompany').trim(),
    product: val('oProduct').trim(),
    amount: parseMoney(val('oAmount')),
    bj: parseMoney(val('oBj')),
    expectedDate: val('oExpectedDate'),
    owner: val('oOwner').trim(),
    createContract: val('oCreateContract') !== 'no',
    contractNumber: val('oContractNumber').trim(),
    contractAnniv: val('oContractAnniv'),
    contractRate: val('oContractRate').trim(),
    actualCommission: parseMoney(val('oActualCommission')),
    note: val('oNote').trim()
  };
}
function saveOpportunity() {
  const data = opportunityFromForm();
  if (!data.clientId) return alert('Vyber klienta.');
  let o = editingOpportunityId ? state.opportunities.find(x => x.id === editingOpportunityId) : null;
  const oldStatus = o?.status;
  if (!o) {
    o = {
      id: uid(),
      createdAt: today(),
      history: []
    };
    state.opportunities.push(o);
  }
  Object.assign(o, data, {
    updatedAt: today()
  });
  if (oldStatus !== o.status) {
    o.history = o.history || [];
    o.history.push({
      d: o.statusDate || today(),
      t: o.status
    });
    addActivity(o.clientId, 'Příležitost', 'Stav: ' + o.status + ' · ' + (o.product || o.category), true);
  }
  selectedClientId = o.clientId;
  if (o.status === 'Podepsáno') {
    persist();
    openDealFromOpportunity(o);
    return;
  }
  closeModal('opportunityModal');
  renderAll();
  saveToast('Příležitost uložena');
}
function quickSignOpportunity() {
  setVal('oStatus', 'Podepsáno');
  setVal('oStatusDate', today());
  if (!val('oContractAnniv')) setVal('oContractAnniv', nextAnnualDateString(today()));
  saveOpportunity();
}
function convertOpportunityToDeal(o) {
  if (o.dealId && state.deals.some(d => d.id === o.dealId)) {
    state.opportunities = state.opportunities.filter(x => x.id !== o.id);
    return;
  }
  const category = opportunityCategoryToDeal(o.category, o.product);
  const d = {
    id: uid(),
    clientId: o.clientId,
    category,
    date: o.statusDate || today(),
    company: o.company,
    product: o.product,
    amount: o.amount,
    bj: o.bj,
    owner: o.owner,
    actualCommission: o.actualCommission,
    commissionPaid: false,
    ownerPaid: false,
    createdAt: today(),
    fromOpportunityId: o.id,
    createContract: o.createContract !== false,
    contractNumber: o.contractNumber
  };
  state.deals.push(d);
  if (o.createContract !== false) {
    const type = contractTypeFromDeal(category, o.product),
      s = {
        id: uid(),
        clientId: o.clientId,
        type,
        status: 'vyrizeno',
        statuses: [],
        source: sourceForType(type),
        company: o.company,
        product: o.product,
        number: o.contractNumber || '',
        anniv: o.contractAnniv || nextAnnualDateString(d.date),
        amount: dealContractAmountText(d),
        rate: o.contractRate || '',
        note: o.note || '',
        createdAt: today(),
        log: [{
          d: today(),
          t: 'Smlouva vytvořena z podepsané příležitosti'
        }]
      };
    state.contracts.push(s);
    d.contractId = s.id;
    d.contractNumber = s.number;
    o.contractId = s.id;
  }
  o.dealId = d.id;
  o.convertedAt = today();
  addActivity(o.clientId, 'Obchod', 'Příležitost podepsána a propsána: ' + (o.product || o.category) + ' · ' + num(o.bj) + ' BJ', true);
  state.opportunities = state.opportunities.filter(x => x.id !== o.id);
}
function deleteOpportunity() {
  if (!editingOpportunityId) return;
  const o = state.opportunities.find(x => x.id === editingOpportunityId);
  if (!o || !confirm('Smazat příležitost? Uzavřený obchod ani smlouva se tím nemažou.')) return;
  state.opportunities = state.opportunities.filter(x => x.id !== editingOpportunityId);
  closeModal('opportunityModal');
  renderAll();
}
function calendarStamp(date, time) {
  return String(date || today()).replaceAll('-', '') + 'T' + String(time || '09:00').replace(':', '') + '00';
}
function localDateString(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addMinutesToTime(date, time, minutes) {
  const d = new Date((date || today()) + 'T' + (time || '09:00') + ':00');
  d.setMinutes(d.getMinutes() + (+minutes || 60));
  return {
    date: localDateString(d),
    time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  };
}
function googleCalendarUrl(a) {
  const c = findClient(a.clientId),
    end = addMinutesToTime(a.date, a.time, a.duration);
  const text = 'Schůzka - ' + clientName(c);
  const details = [a.text, c?.phone ? 'Telefon: ' + c.phone : '', c?.email ? 'Email: ' + c.email : ''].filter(Boolean).join('\n');
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: calendarStamp(a.date, a.time) + '/' + calendarStamp(end.date, end.time),
    details,
    location: a.location || '',
    ctz: 'Europe/Prague'
  });
  return 'https://calendar.google.com/calendar/render?' + q.toString();
}
function renderSettings() {
  setVal('settingsCoef', state.settings.bjCoef || 150);
  setVal('gsyncUrl', localStorage.getItem(GOOGLE_SYNC_URL_KEY) || '');
  setVal('gsyncKey', localStorage.getItem(GOOGLE_SYNC_KEY_KEY) || '');
  setVal('oldGsyncUrl', localStorage.getItem(OLD_GOOGLE_SYNC_URL_KEY) || '');
  setVal('oldGsyncKey', localStorage.getItem(OLD_GOOGLE_SYNC_KEY_KEY) || '');
  const autoPull = byId('googleAutoPull');
  if (autoPull) autoPull.checked = googleAutoPullEnabled();
  setVal('gsyncLocalInfo', stateCountsText());
  setDiskStorageStatus(diskStorageStatus.message);
}
function saveSettings() {
  state.settings.bjCoef = parseMoney(val('settingsCoef')) || 150;
  persist();
  renderAll();
  saveToast('Nastavení uloženo');
}
function saveGoogleAutoPullSetting() {
  localStorage.setItem(GOOGLE_AUTO_PULL_KEY, byId('googleAutoPull')?.checked ? '1' : '0');
  saveToast('Režim Google zálohy uložen');
}
function googleAutoPullEnabled() {
  return localStorage.getItem(GOOGLE_AUTO_PULL_KEY) === '1';
}
function deviceModeLabel() {
  return diskStorageStatus.ok ? 'mac-disk' : 'web-ipad';
}
function googleSyncPayload() {
  const exportDate = new Date().toISOString();
  const payloadState = normalizeState({
    ...state,
    _syncMeta: {
      ...(state._syncMeta || {}),
      lastGoogleExportDate: exportDate,
      lastGoogleExportDevice: deviceModeLabel()
    }
  });
  return {
    version: VERSION,
    source: 'FILIP-CRM.html',
    exportDate,
    state: payloadState
  };
}
function setGoogleSyncStatus(html) {
  byId('gsyncStatus').innerHTML = html;
}
function googleSyncSettings() {
  const url = (val('gsyncUrl') || localStorage.getItem(GOOGLE_SYNC_URL_KEY) || '').trim(),
    key = (val('gsyncKey') || localStorage.getItem(GOOGLE_SYNC_KEY_KEY) || '').trim();
  if (!url || !key) {
    alert('Doplň Apps Script URL a soukromý klíč.');
    return null;
  }
  localStorage.setItem(GOOGLE_SYNC_URL_KEY, url);
  localStorage.setItem(GOOGLE_SYNC_KEY_KEY, key);
  return {
    url,
    key
  };
}
function hasGoogleSyncSettings() {
  return !!(localStorage.getItem(GOOGLE_SYNC_URL_KEY) && localStorage.getItem(GOOGLE_SYNC_KEY_KEY));
}
function googleSyncJsonp(action, params, done) {
  const s = googleSyncSettings();
  if (!s) return;
  const cb = 'filip_crm_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  window[cb] = data => {
    delete window[cb];
    script.remove();
    done(data);
  };
  const q = new URLSearchParams({
    action,
    app: GOOGLE_SYNC_APP,
    key: s.key,
    callback: cb,
    ...(params || {})
  });
  const script = document.createElement('script');
  script.onerror = () => {
    delete window[cb];
    script.remove();
    setGoogleSyncStatus('Nepovedlo se spojit s Googlem. Zkontroluj URL, klíč a nasazení Apps Scriptu.');
  };
  script.src = s.url + (s.url.includes('?') ? '&' : '?') + q.toString();
  document.body.appendChild(script);
}
function refreshGoogleSyncStatus() {
  setGoogleSyncStatus('Kontroluji Google zálohu...');
  googleSyncJsonp('status', {}, data => {
    if (!data || !data.ok) {
      setGoogleSyncStatus('Google záloha zatím nejde načíst. ' + (data?.error || ''));
      return;
    }
    const meta = data.latest || data.meta || null;
    if (!meta) {
      setGoogleSyncStatus(`<b>Na Googlu zatím není záloha pro FILIP CRM.</b><br>Lokálně: ${val('gsyncLocalInfo')}.`);
      return;
    }
    setGoogleSyncStatus(`<b>Na Googlu je záloha pro FILIP CRM.</b><br>Uloženo: ${meta.createdAt || meta.updatedAt || '-'} · velikost: ${num(meta.payloadLength || meta.size || 0)} znaků<br>Lokálně: ${val('gsyncLocalInfo')}.`);
  });
}
function setBackupPreview(html) {
  const el = byId('backupPreview');
  if (el) el.innerHTML = html;
}
function sameDeal(a, b) {
  return String(a.clientId) === String(b.clientId) && a.date === b.date && norm(a.category) === norm(b.category) && norm(a.company) === norm(b.company) && norm(a.product) === norm(b.product) && dealVolume(a) === dealVolume(b) && dealBJ(a) === dealBJ(b);
}
function findMatchingClient(c) {
  const key = clientMatchKey(c);
  if (key) {
    const found = state.clients.find(x => clientMatchKey(x) === key);
    if (found) return found;
  }
  return state.clients.find(x => norm(x.name) === norm(c.name) && (c.phone && normId(x.phone) === normId(c.phone) || c.email && normId(x.email) === normId(c.email)));
}
function mergeIncomingStateCore(incoming) {
  incoming = normalizeState(incoming);
  dedupeInvestmentRecordsInState(state);
  const map = new Map(),
    count = {
      clients: 0,
      contracts: 0,
      deals: 0,
      opportunities: 0,
      notes: 0,
      investments: 0,
      activities: 0,
      analysisEntries: 0,
      referrals: 0,
      skipped: 0
    };
  incoming.clients.forEach(ic => {
    let c = findMatchingClient(ic);
    if (c) {
      ['phone', 'email', 'altEmails', 'birthId', 'address', 'note', 'contactPref'].forEach(k => {
        if (!c[k] && ic[k]) c[k] = ic[k];
      });
      count.skipped++;
    } else {
      c = {
        ...ic,
        id: uid(),
        createdAt: ic.createdAt || today(),
        importedAt: today()
      };
      state.clients.push(c);
      count.clients++;
    }
    map.set(String(ic.id), c.id);
  });
  function mappedClient(id) {
    return map.get(String(id)) || null;
  }
  incoming.contracts.forEach(is => {
    const clientId = mappedClient(is.clientId);
    if (!clientId) return;
    const next = {
      ...is,
      clientId
    };
    const key = contractMatchKey(next);
    if (key && state.contracts.some(s => contractMatchKey(s) === key)) {
      count.skipped++;
      return;
    }
    state.contracts.push({
      ...next,
      id: uid(),
      log: Array.isArray(is.log) ? is.log : [],
      createdAt: is.createdAt || today(),
      importedAt: today()
    });
    count.contracts++;
  });
  incoming.deals.forEach(idl => {
    const clientId = mappedClient(idl.clientId);
    if (!clientId) return;
    const next = {
      ...idl,
      clientId
    };
    if (state.deals.some(d => sameDeal(d, next))) {
      count.skipped++;
      return;
    }
    state.deals.push({
      ...next,
      id: uid(),
      createdAt: idl.createdAt || today(),
      importedAt: today()
    });
    count.deals++;
  });
  incoming.opportunities.forEach(io => {
    const clientId = mappedClient(io.clientId);
    if (!clientId) return;
    const exists = state.opportunities.some(o => String(o.clientId) === String(clientId) && o.status === io.status && o.statusDate === io.statusDate && norm(o.product) === norm(io.product) && (+o.bj || 0) === (+io.bj || 0));
    if (exists) {
      count.skipped++;
      return;
    }
    state.opportunities.push({
      ...io,
      id: uid(),
      clientId,
      createdAt: io.createdAt || today(),
      importedAt: today()
    });
    count.opportunities++;
  });
  incoming.notes.forEach(n => {
    const clientId = n.clientId ? mappedClient(n.clientId) : null;
    const exists = state.notes.some(x => x.date === n.date && norm(x.title) === norm(n.title) && norm(x.text) === norm(n.text));
    if (exists) {
      count.skipped++;
      return;
    }
    state.notes.push({
      ...n,
      id: uid(),
      clientId,
      createdAt: n.createdAt || today(),
      importedAt: today()
    });
    count.notes++;
  });
  (incoming.investmentRecords || []).forEach(ir => {
    const key = invRecordKey(ir);
    if (key && state.investmentRecords.some(r => invRecordKey(r) === key)) {
      count.skipped++;
      return;
    }
    state.investmentRecords.push({
      ...ir,
      _importedAt: today()
    });
    count.investments++;
  });
  dedupeInvestmentRecordsInState(state);
  state.fundValues = {
    ...state.fundValues,
    ...(incoming.fundValues || {})
  };
  state.lockedFunds = {
    ...state.lockedFunds,
    ...(incoming.lockedFunds || {})
  };
  state.trailSettings = {
    ...state.trailSettings,
    ...(incoming.trailSettings || {})
  };
  incoming.activities.forEach(ia => {
    const clientId = mappedClient(ia.clientId);
    if (!clientId) return;
    const exists = state.activities.some(a => String(a.clientId) === String(clientId) && a.date === ia.date && a.type === ia.type && norm(a.text) === norm(ia.text));
    if (exists) {
      count.skipped++;
      return;
    }
    state.activities.push({
      ...ia,
      id: uid(),
      clientId,
      createdAt: ia.createdAt || today(),
      importedAt: today()
    });
    count.activities++;
  });
  (incoming.analysisEntries || []).forEach(ia => {
    const clientId = ia.clientId ? mappedClient(ia.clientId) : null;
    const exists = (state.analysisEntries || []).some(a => a.date === ia.date && a.type === ia.type && String(a.clientId || "") === String(clientId || "") && norm(a.note) === norm(ia.note));
    if (exists) {
      count.skipped++;
      return;
    }
    state.analysisEntries.push({
      ...ia,
      id: uid(),
      clientId,
      createdAt: ia.createdAt || today(),
      importedAt: today()
    });
    count.analysisEntries++;
  });
  state.analysisPlans = {
    ...(state.analysisPlans || {}),
    ...(incoming.analysisPlans || {})
  };
  (incoming.referrals || []).forEach(ir => {
    const exists = (state.referrals || []).some(r => norm(r.from) === norm(ir.from) && norm(r.to) === norm(ir.to) && r.date === ir.date);
    if (exists) {
      count.skipped++;
      return;
    }
    state.referrals.push({
      ...ir,
      id: uid(),
      createdAt: ir.createdAt || today(),
      importedAt: today()
    });
    count.referrals++;
  });
  relinkAllStrongIdentities();
  return count;
}
function previewGoogleBackup() {
  setGoogleSyncStatus('Stahuji jen náhled zálohy...');
  googleSyncJsonp('load', {}, data => {
    try {
      if (!data || !data.ok) throw new Error(data?.error || 'Google nevrátil zálohu.');
      const payload = data.backup || data.payload || {},
        incoming = payload.state || payload;
      if (!incoming || !Array.isArray(incoming.clients)) throw new Error('Záloha nemá správný formát pro FILIP CRM.');
      googlePreviewState = normalizeState(incoming);
      setGoogleSyncStatus('<b>Náhled je připravený.</b><br>Lokální data ani Google záloha se tímto krokem nezměnily.');
      setBackupPreview(previewSummary(googlePreviewState));
    } catch (e) {
      setGoogleSyncStatus('Náhled se nepovedlo načíst: ' + e.message);
      setBackupPreview('Náhled zálohy není dostupný.');
    }
  });
}
function googlePayloadDate(payload, incoming) {
  return payload.exportDate || incoming?._syncMeta?.lastGoogleExportDate || incoming?.exportDate || payload.createdAt || payload.updatedAt || '';
}
function shouldAutoApplyGoogle(payload, incoming) {
  const remote = Date.parse(googlePayloadDate(payload, incoming) || ''),
    last = Date.parse(state._syncMeta?.lastGoogleImportAt || state._syncMeta?.lastGoogleExportDate || '');
  return Number.isFinite(remote) && (!Number.isFinite(last) || remote > last + 1500);
}
function loadGoogleBackup() {
  previewGoogleBackup();
}
function backupCountValue(s, key) {
  if (key === 'investments') return (s.investmentRecords || []).length;
  return Array.isArray(s[key]) ? s[key].length : 0;
}
function backupCountDrops(smaller, bigger) {
  return BACKUP_PROTECTED_KEYS.filter(k => (bigger[k] || 0) > (smaller[k] || 0)).map(k => ({
    key: k,
    label: BACKUP_COUNT_LABELS[k],
    local: smaller[k] || 0,
    remote: bigger[k] || 0,
    diff: (bigger[k] || 0) - (smaller[k] || 0)
  }));
}
function backupStateDelta(before, after) {
  const a = criticalBackupCounts(before),
    b = criticalBackupCounts(after),
    out = {};
  BACKUP_PROTECTED_KEYS.forEach(k => out[k] = (b[k] || 0) - (a[k] || 0));
  return out;
}
function backupDeltaText(delta) {
  return BACKUP_PROTECTED_KEYS.map(k => `${delta[k] >= 0 ? '+' : ''}${num(delta[k] || 0)} ${BACKUP_COUNT_LABELS[k]}`).join(' · ');
}
function restoreIncomingStateFromGoogle(incoming, source) {
  const before = normalizeState(state),
    next = normalizeState(incoming);
  if (!next || !Array.isArray(next.clients) || !Array.isArray(next.contracts) || !Array.isArray(next.deals)) throw new Error('Záloha nemá kompletní strukturu CRM.');
  dedupeInvestmentRecordsInState(next);
  next._syncMeta = {
    ...(next._syncMeta || {}),
    lastGoogleImportAt: new Date().toISOString(),
    lastGoogleImportDevice: source || deviceModeLabel(),
    lastGoogleImportMode: 'full-restore'
  };
  state = next;
  relinkAllStrongIdentities();
  return backupStateDelta(before, state);
}
function backupOverwriteConfirmText(local, remote) {
  const drops = backupCountDrops(local, remote),
    detail = drops.map(d => `${d.label}: ${num(d.remote)} -> ${num(d.local)} (rozdíl ${num(d.diff)})`).join('\n');
  return `Aktuální CRM obsahuje méně dat než Google záloha.\n\n${detail}\n\nLokálně: ${criticalCountsText(local)}\nGoogle: ${criticalCountsText(remote)}\n\nOpravdu chceš Google zálohu přepsat touto menší aktuální verzí?`;
}
function findOrCreateClientFromOld(old) {
  const name = old.name || old.klient || [old.surname, old.name].filter(Boolean).join(' ');
  if (!name) return null;
  const birthId = old.birthId || old.rc || old.rodneCislo || '',
    key = normalizeStrongId(birthId);
  let c = key ? state.clients.find(x => normalizeStrongId(x.birthId) === key) : null;
  if (!c) c = state.clients.find(x => norm(x.name) === norm(name));
  if (!c) {
    c = {
      id: uid(),
      name,
      phone: old.phone || old.tel || '',
      email: old.email || '',
      contactPref: old.contactPref || 'email',
      birthId,
      address: old.address || old.adresa || '',
      note: old.note || '',
      createdAt: today()
    };
    state.clients.push(c);
  } else {
    ['phone', 'email', 'birthId', 'address', 'note', 'contactPref'].forEach(k => {
      if (!c[k] && old[k]) c[k] = old[k];
    });
    if (!c.birthId && birthId) c.birthId = birthId;
    if (key && name && norm(c.name) !== norm(name)) c.aliases = [...new Set(String(c.aliases || '').split(',').map(x => x.trim()).concat(name).filter(Boolean))].join(', ');
  }
  return c;
}
function setOldGoogleStatus(html) {
  const el = byId('oldGoogleStatus');
  if (el) el.innerHTML = html;
}
function oldGoogleSyncSettings() {
  const url = val('oldGsyncUrl').trim(),
    key = val('oldGsyncKey').trim();
  if (!url || !key) {
    alert('Doplň starou Apps Script URL a starý soukromý klíč.');
    return null;
  }
  localStorage.setItem(OLD_GOOGLE_SYNC_URL_KEY, url);
  localStorage.setItem(OLD_GOOGLE_SYNC_KEY_KEY, key);
  return {
    url,
    key
  };
}
function googleSyncJsonpWithSettings(settings, app, action, params, done, onError) {
  const cb = 'filip_old_crm_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  let script;
  window[cb] = data => {
    delete window[cb];
    script.remove();
    done(data);
  };
  const q = new URLSearchParams({
    action,
    app,
    key: settings.key,
    callback: cb,
    ...(params || {})
  });
  script = document.createElement('script');
  script.onerror = () => {
    delete window[cb];
    script.remove();
    (onError || setOldGoogleStatus)('Nepovedlo se spojit se starou Google zálohou. Zkontroluj starou URL, klíč a nasazení Apps Scriptu.');
  };
  script.src = settings.url + (settings.url.includes('?') ? '&' : '?') + q.toString();
  document.body.appendChild(script);
}
function loadOldGoogleBackup(app, done) {
  const settings = oldGoogleSyncSettings();
  if (!settings) return;
  googleSyncJsonpWithSettings(settings, app, 'load', {}, data => {
    try {
      if (!data || !data.ok) throw new Error(data?.error || 'Google nevrátil zálohu.');
      const payload = data.backup || data.payload || {};
      done(payload.state || payload);
    } catch (e) {
      setOldGoogleStatus('Načtení staré zálohy se nepovedlo: ' + e.message);
    }
  });
}
function oldContractExists(clientId, os) {
  const next = {
    ...os,
    clientId
  };
  const key = contractMatchKey(next);
  return !!(key && state.contracts.some(s => contractMatchKey(s) === key));
}
function importOldContractsPayload(payload) {
  let count = {
    clients: 0,
    contracts: 0,
    skipped: 0
  };
  const old = payload?.state || payload || {};
  (old.clients || []).forEach(oc => {
    const before = state.clients.length,
      c = findOrCreateClientFromOld(oc);
    if (!c) return;
    if (state.clients.length > before) count.clients++;
    (oc.contracts || []).forEach(os => {
      if (oldContractExists(c.id, os)) {
        count.skipped++;
        return;
      }
      state.contracts.push({
        id: uid(),
        clientId: c.id,
        type: os.type || 'ostatní',
        source: os.source || sourceForType(os.type),
        company: os.company || '',
        product: os.product || '',
        number: os.number || '',
        anniv: os.anniv || '',
        amount: os.amount || '',
        rate: os.rate || '',
        status: os.status || '',
        statuses: Array.isArray(os.statuses) ? os.statuses : [],
        note: os.note || '',
        log: Array.isArray(os.log) && os.log.length ? os.log : [{
          d: today(),
          t: 'Přeneseno ze staré Google zálohy Smluv'
        }],
        createdAt: os.createdAt || today(),
        importedAt: today()
      });
      count.contracts++;
    });
  });
  return count;
}
function importOldDealsPayload(payload) {
  let count = {
    clients: 0,
    deals: 0,
    referrals: 0,
    skipped: 0
  };
  const old = payload?.state || payload || {};
  (old.deals || []).forEach(od => {
    const clientSource = {
      name: [od.surname, od.name].filter(Boolean).join(' ') || od.client || od.klient,
      phone: od.phone || od.tel || '',
      email: od.email || '',
      birthId: od.birthId || od.rc || ''
    };
    const before = state.clients.length,
      c = findOrCreateClientFromOld(clientSource);
    if (!c) return;
    if (state.clients.length > before) count.clients++;
    const next = {
      clientId: c.id,
      category: od.category || categoryFrom((od.product || '') + ' ' + (od.company || '')),
      company: od.company || '',
      product: od.product || '',
      date: od.date || today(),
      amount: dealVolume(od),
      bj: dealBJ(od),
      owner: od.owner || '',
      ownerPaid: !!od.ownerPaid,
      commissionPaid: !!od.commissionPaid,
      actualCommission: dealActualCommission(od)
    };
    if (state.deals.some(d => sameDeal(d, next))) {
      count.skipped++;
      return;
    }
    state.deals.push({
      ...next,
      id: uid(),
      createdAt: od.createdAt || today(),
      importedAt: today()
    });
    count.deals++;
  });
  if (old.plans && typeof old.plans === 'object') state.plans = {
    ...(state.plans || {}),
    ...old.plans
  };
  (old.referrals || []).forEach(r => {
    const exists = (state.referrals || []).some(x => norm(x.from) === norm(r.from) && norm(x.to) === norm(r.to));
    if (exists) {
      count.skipped++;
      return;
    }
    state.referrals.push({
      ...r,
      id: uid(),
      createdAt: r.createdAt || today(),
      importedAt: today()
    });
    count.referrals++;
  });
  if (old.settings?.bjCoef) state.settings.bjCoef = old.settings.bjCoef;
  return count;
}
function importOldInvestmentsPayload(payload) {
  let count = {
    clients: 0,
    records: 0,
    funds: 0,
    skipped: 0,
    replaced: 0
  };
  const old = payload?.state || payload || {},
    records = currentFkiSnapshot(old.records || old.recs || old.investmentRecords || []),
    identities = new Set(records.map(invClientIdentity).filter(Boolean)),
    names = new Set(records.map(r => norm(invInvestor(r))).filter(Boolean));
  dedupeInvestmentRecordsInState(state);
  records.forEach(r => {
    const before = state.clients.length;
    findOrCreateClientFromInvestment(r);
    if (state.clients.length > before) count.clients++;
  });
  const beforeLen = (state.investmentRecords || []).length;
  state.investmentRecords = (state.investmentRecords || []).filter(r => {
    const id = invClientIdentity(r),
      name = norm(invInvestor(r));
    return !((id && identities.has(id) || name && names.has(name)) && isFkiMirrorRecord(r));
  });
  count.replaced = beforeLen - state.investmentRecords.length;
  records.forEach(r => {
    state.investmentRecords.push(r);
    count.records++;
  });
  dedupeInvestmentRecordsInState(state);
  if (old.fundValues && typeof old.fundValues === 'object') {
    Object.entries(old.fundValues).forEach(([k, v]) => {
      if (!state.fundValues[k]) count.funds++;
      state.fundValues[k] = {
        ...(state.fundValues[k] || {}),
        ...v
      };
    });
  }
  if (old.lockedFunds && typeof old.lockedFunds === 'object') state.lockedFunds = {
    ...state.lockedFunds,
    ...old.lockedFunds
  };
  if (old.trailSettings && typeof old.trailSettings === 'object') state.trailSettings = {
    ...state.trailSettings,
    ...old.trailSettings
  };
  count.linked = relinkAllStrongIdentities();
  return count;
}
function finishOldGoogleImport(message) {
  selectedClientId = state.clients[0]?.id || selectedClientId;
  persist();
  renderAll();
  setOldGoogleStatus(message + '<br>Nová Google záloha se zatím nepřepsala. Nejdřív zkontroluj Dashboard a duplicity, potom teprve klikni nahoře na „Odeslat zálohu“.');
}
function importOldGoogleContracts(done) {
  setOldGoogleStatus('Načítám staré smlouvy z Google...');
  loadOldGoogleBackup('smlouvy_tracker', payload => {
    const c = importOldContractsPayload(payload);
    finishOldGoogleImport(`<b>Smlouvy načtené.</b><br>Přidáno: ${num(c.clients)} klientů · ${num(c.contracts)} smluv. Přeskočeno jako existující: ${num(c.skipped)}.`);
    if (done) done(c);
  });
}
function importOldGoogleDeals(done) {
  setOldGoogleStatus('Načítám staré obchody z Google...');
  loadOldGoogleBackup('obchody_tabulka', payload => {
    const c = importOldDealsPayload(payload);
    finishOldGoogleImport(`<b>Obchody načtené.</b><br>Přidáno: ${num(c.clients)} klientů · ${num(c.deals)} obchodů. Přeskočeno jako existující: ${num(c.skipped)}.`);
    if (done) done(c);
  });
}
function importOldGoogleInvestments(done) {
  setOldGoogleStatus('Načítám staré investice z Google...');
  loadOldGoogleBackup('investment_crm', payload => {
    const c = importOldInvestmentsPayload(payload);
    finishOldGoogleImport(`<b>Investice načtené.</b><br>Přidáno: ${num(c.clients)} klientů · načteno aktuálně ${num(c.records)} investičních záznamů · nahrazeno starých ${num(c.replaced || 0)} záznamů · ${num(c.funds)} fondů.`);
    if (done) done(c);
  });
}
function importAllOldGoogleBackups() {
  if (!confirm('Načíst staré smlouvy, obchody a investice z Google do lokálního CRM? Nová Google záloha se tím nepřepíše.')) return;
  setOldGoogleStatus('Načítám staré smlouvy, obchody a investice...');
  loadOldGoogleBackup('smlouvy_tracker', contractsPayload => {
    const a = importOldContractsPayload(contractsPayload);
    loadOldGoogleBackup('obchody_tabulka', dealsPayload => {
      const b = importOldDealsPayload(dealsPayload);
      loadOldGoogleBackup('investment_crm', investmentPayload => {
        const c = importOldInvestmentsPayload(investmentPayload);
        finishOldGoogleImport(`<b>Staré Google zálohy načtené.</b><br>Přidáno: ${num(a.clients + b.clients + c.clients)} klientů · ${num(a.contracts)} smluv · ${num(b.deals)} obchodů · ${num(c.records)} investičních záznamů · ${num(c.funds)} fondů.<br>Přeskočeno jako existující: ${num(a.skipped + b.skipped + c.skipped)} záznamů.`);
      });
    });
  });
}
function migrateOldLocalData() {
  let clientsAdded = 0,
    contractsAdded = 0,
    dealsAdded = 0;
  try {
    const raw = localStorage.getItem('crm_v18_restored_main');
    if (raw) {
      const old = JSON.parse(raw);
      (old.clients || []).forEach(oc => {
        const c = findOrCreateClientFromOld(oc);
        clientsAdded++;
        (oc.contracts || []).forEach(os => {
          const exists = state.contracts.some(s => s.number && os.number && s.number === os.number && s.clientId === c.id);
          if (!exists) {
            state.contracts.push({
              id: uid(),
              clientId: c.id,
              type: os.type || 'ostatní',
              source: os.source || sourceForType(os.type),
              company: os.company || '',
              product: os.product || '',
              number: os.number || '',
              anniv: os.anniv || '',
              amount: os.amount || '',
              rate: os.rate || '',
              status: os.status || '',
              statuses: Array.isArray(os.statuses) ? os.statuses : [],
              note: os.note || '',
              log: os.log || [{
                d: today(),
                t: 'Přeneseno ze Smluv'
              }],
              createdAt: today()
            });
            contractsAdded++;
          }
        });
      });
    }
  } catch (e) {
    console.warn(e);
  }
  try {
    const raw = localStorage.getItem('obchodyTabulka_v17');
    if (raw) {
      const old = JSON.parse(raw);
      (old.deals || []).forEach(od => {
        const c = findOrCreateClientFromOld({
          name: [od.surname, od.name].filter(Boolean).join(' ') || od.client
        });
        const exists = state.deals.some(d => d.clientId === c.id && d.date === od.date && norm(d.product) === norm(od.product) && dealBJ(d) === dealBJ(od));
        if (!exists) {
          state.deals.push({
            id: uid(),
            clientId: c.id,
            category: od.category || categoryFrom((od.product || '') + ' ' + (od.company || '')),
            company: od.company || '',
            product: od.product || '',
            date: od.date || today(),
            amount: dealVolume(od),
            bj: dealBJ(od),
            owner: od.owner || '',
            ownerPaid: !!od.ownerPaid,
            commissionPaid: !!od.commissionPaid,
            actualCommission: dealActualCommission(od),
            createdAt: today()
          });
          dealsAdded++;
        }
      });
      if (old.settings?.bjCoef) state.settings.bjCoef = old.settings.bjCoef;
    }
  } catch (e) {
    console.warn(e);
  }
  selectedClientId = state.clients[0]?.id || selectedClientId;
  persist();
  byId('migrationStatus').innerHTML = `Hotovo. Přeneseno: ${num(clientsAdded)} klientských záznamů, ${num(contractsAdded)} smluv, ${num(dealsAdded)} obchodů.`;
  renderAll();
}
function scenario_n(v) {
  if (typeof parseMoney === 'function') return parseMoney(v) || 0;
  const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
}
function scenario_rate(o) {
  for (const k of ['annualRate', 'rate', 'returnPa', 'yield', 'performance', 'vynos', 'zhodnoceni', 'ratePa']) {
    const v = scenario_n(o?.[k]);
    if (v) return v;
  }
  return 0;
}
function scenario_fmtPct(v) {
  if (typeof decimal === 'function') return decimal(v);
  return String(Math.round((+v || 0) * 100) / 100).replace('.', ',').replace(/,0+$/, '').replace(/,([1-9])0$/, '$1');
}
function scenario_amount(o) {
  for (const k of ['amount', 'aum', 'value', 'currentValue', 'hodnota', 'aktualni', 'current']) {
    const v = scenario_n(o?.[k]);
    if (v) return v;
  }
  return 0;
}
function scenario_invested(o) {
  for (const k of ['invested', 'inserted', 'amountInvested', 'principal', 'vlozeno', 'netInvested']) {
    const v = scenario_n(o?.[k]);
    if (v) return v;
  }
  return scenario_amount(o);
}
function scenario_selected() {
  return typeof scenarioSelectedClient === 'function' ? scenarioSelectedClient() : null;
}
function scenario_item() {
  return (typeof investmentScenarioCatalog === 'function' ? investmentScenarioCatalog() : []).find(x => x.key === val('scenarioFund'));
}
function scenario_approvedRateFor(row) {
  const defs = typeof window.defaultFundExpectedRate === 'function' ? window.defaultFundExpectedRate(row?.area, row?.key, row?.isin, row) : {};
  return scenario_n(defs.expectedRate) || scenario_n(row?.rate) || scenario_n(row?.expectedRate) || 5;
}
function scenario_applyApprovedRate(row) {
  const r = scenario_approvedRateFor(row);
  row.rate = r;
  row.minRate = scenario_n(row.minRate) || Math.max(0, r - 2);
  row.maxRate = scenario_n(row.maxRate) || r + 2;
  return row;
}
function scenario_normalizeScenarioRows() {
  (investmentScenario?.rows || []).forEach(scenario_applyApprovedRate);
}
function scenario_match(a, b) {
  const x = norm(String(a || '')),
    y = norm(String(b || ''));
  return x && y && (x === y || x.includes(y) || y.includes(x));
}
function scenario_observed(it, c) {
  const rows = c && typeof clientDisplayInvestmentItems === 'function' ? clientDisplayInvestmentItems(c.id) : [];
  const hits = rows.filter(x => (!it.isin || scenario_match(x.isin, it.isin)) && (scenario_match(x.product, it.product) || scenario_match(x.company, it.company)));
  let i = 0,
    v = 0;
  hits.forEach(x => {
    const p = scenario_invested(x);
    i += p;
    v += scenario_amount(x);
  });
  if (i && v) return (v / i - 1) * 100;
  return scenario_rate(it);
}
function scenario_catalog() {
  return typeof investmentScenarioCatalog === 'function' ? investmentScenarioCatalog() : [];
}
function scenario_scenarioAreaLabel() {
  return val('scenarioArea') === 'FKI' ? 'FKI' : 'Investice';
}
function scenario_fundOptions(area, selectedKey) {
  const rows = scenario_catalog().filter(x => x.area === area);
  return rows.map(x => `<option value="${esc(x.key)}" ${x.key === selectedKey ? 'selected' : ''}>${esc([x.company, x.product, x.isin].filter(Boolean).join(' - '))}</option>`).join('') || '<option value="">Nejdřív založ fond v Reportu</option>';
}
function scenario_syncFund(row, key) {
  const it = scenario_catalog().find(x => x.key === key);
  if (!it) return row;
  row.key = it.key;
  row.area = it.area;
  row.company = it.company;
  row.product = it.product;
  row.isin = it.isin;
  row.typ = it.typ;
  scenario_applyApprovedRate(row);
  return row;
}
function scenario_scenarioRowValue(r, years) {
  let v = scenario_n(r.amount);
  for (let y = 1; y <= years; y++) {
    v *= 1 + scenario_n(r.rate) / 100;
    if (scenario_n(r.topupYear) === y) v += scenario_n(r.topupAmount);
    if (scenario_n(r.dropYear) === y) v *= Math.max(0, 1 - scenario_n(r.dropPct) / 100);
  }
  return v;
}
function scenario_noteNumber(note, re) {
  const m = String(note || '').match(re);
  return m ? scenario_n(m[1] || m[2]) : 0;
}
function scenario_bestFundForOpportunity(o, area) {
  const rows = scenario_catalog().filter(x => x.area === area);
  return rows.find(x => x.isin && scenario_match(x.isin, o.isin)) || rows.find(x => scenario_match(x.product, o.product) && scenario_match(x.company, o.company)) || rows.find(x => scenario_match(x.product, o.product) || scenario_match(x.company, o.company)) || null;
}
function scenario_scenarioRowFromOpportunity(o) {
  const a = opportunityArea(o) === 'fki' || o.category === 'FKI' ? 'FKI' : 'Investice',
    it = scenario_bestFundForOpportunity(o, a),
    note = o.note || '',
    row = {
      ...(it || {
        key: o.fundKey || o.scenarioKey || '',
        area: a,
        company: o.company || '',
        product: o.product || a,
        isin: o.isin || o.fundIsin || '',
        typ: o.fundType || ''
      }),
      amount: scenario_n(o.amount),
      rate: scenario_noteNumber(note, /výnos\s+([0-9]+[,.]?[0-9]*)/i) || scenario_noteNumber(note, /zhodnocení\s+([0-9]+[,.]?[0-9]*)/i) || 5,
      topupYear: scenario_noteNumber(note, /dokup\s+([0-9]+)\.\s*rok/i),
      topupAmount: scenario_noteNumber(note, /dokup\s+[0-9]+.\s*rok\s+([0-9\s,.]+)/i),
      dropYear: scenario_noteNumber(note, /propad\s+([0-9]+)\.\s*rok/i),
      dropPct: scenario_noteNumber(note, /propad\s+[0-9]+.\s*rok\s+([0-9]+[,.]?[0-9]*)/i),
      opportunityId: o.id,
      source: 'Načteno z příležitosti'
    };
  row.key = row.key || o.fundKey || o.scenarioKey || '';
  row.isin = row.isin || o.isin || o.fundIsin || '';
  row.typ = row.typ || o.fundType || '';
  return scenario_applyApprovedRate(row);
}
function scenario_loadClientOpenProposalRows(force = false) {
  const c = scenario_selected();
  if (!c || val('scenarioClient') === '__new') return 0;
  if (!force && investmentScenario.rows?.length) return 0;
  const rows = clientOpenOpportunities(c.id).filter(o => ['investice', 'fki'].includes(opportunityArea(o))).map(scenario_scenarioRowFromOpportunity);
  if (force || !investmentScenario.rows?.length) investmentScenario.rows = rows;
  return rows.length;
}
function scenario_bindEditableRows() {
  const box = byId('scenarioSelectedFunds');
  if (!box || box.dataset.editBound) return;
  box.dataset.editBound = '1';
  box.addEventListener('input', e => {
    const el = e.target.closest('[data-scenario-row]');
    if (!el) return;
    const row = investmentScenario.rows[+el.dataset.scenarioRow];
    if (!row) return;
    const k = el.dataset.k;
    if (['amount', 'rate', 'topupYear', 'topupAmount', 'dropYear', 'dropPct'].includes(k)) row[k] = scenario_n(el.value);
    scenario_renderAdvanced();
  });
  box.addEventListener('change', e => {
    const el = e.target.closest('[data-scenario-row]');
    if (!el) return;
    const row = investmentScenario.rows[+el.dataset.scenarioRow];
    if (!row) return;
    const k = el.dataset.k;
    if (k === 'key') scenario_syncFund(row, el.value);else if (['amount', 'rate', 'topupYear', 'topupAmount', 'dropYear', 'dropPct'].includes(k)) row[k] = scenario_n(el.value);
    renderInvestmentScenario();
  });
  box.addEventListener('click', e => {
    const btn = e.target.closest('[data-scenario-remove]');
    if (!btn) return;
    removeInvestmentScenarioFund(+btn.dataset.scenarioRemove);
  });
}
function scenario_yearOptions(value, label = 'Bez') {
  const years = Math.max(1, scenario_n(val('scenarioYears')) || 10);
  let html = `<option value="">${esc(label)}</option>`;
  for (let y = 1; y <= years; y++) html += `<option value="${y}" ${scenario_n(value) === y ? 'selected' : ''}>${y}. rok</option>`;
  return html;
}
function scenario_renderEditableSelectedFunds() {
  const box = byId('scenarioSelectedFunds');
  if (!box) return;
  scenario_bindEditableRows();
  scenario_normalizeScenarioRows();
  const years = Math.max(1, scenario_n(val('scenarioYears')) || 10),
    rows = investmentScenario.rows || [],
    total = rows.reduce((s, x) => s + scenario_n(x.amount), 0),
    future = rows.reduce((s, x) => s + scenario_scenarioRowValue(x, years), 0),
    loaded = rows.filter(x => x.opportunityId).length,
    areaSum = rows.reduce((a, x) => {
      const k = x.area === 'FKI' ? 'FKI' : 'Investice';
      a[k] = (a[k] || 0) + scenario_n(x.amount);
      return a;
    }, {});
  box.innerHTML = `<div class="toolbar"><div><h3>Navržené investice</h3><div class="note">Horizont ${num(years)} let · jednorázově ${money(total)} · modelová hodnota ${money(future)} · Investice ${money(areaSum.Investice || 0)} · FKI ${money(areaSum.FKI || 0)}${loaded ? ` · ${num(loaded)} načteno z otevřených příležitostí` : ''}</div></div></div>${rows.length ? `<div class="table-wrap"><table class="compact-table scenario-edit-table"><thead><tr><th>Fond</th><th>Vklad</th><th>Výnos p.a.</th><th>Dokup rok</th><th>Dokup</th><th>Propad rok</th><th>Propad %</th><th>Modelová hodnota</th><th></th></tr></thead><tbody>${rows.map((x, i) => `<tr><td class="fund-cell"><select data-scenario-row="${i}" data-k="key">${scenario_fundOptions(x.area || scenario_scenarioAreaLabel(), x.key)}</select><span class="note"><span class="badge ${x.area === 'FKI' ? 'purple' : 'blue'}">${esc(x.area || scenario_scenarioAreaLabel())}</span> ${esc(x.company || '')} ${x.source ? `<span class="source-pill">${esc(x.source)}</span>` : ''}</span></td><td class="money-cell"><input data-scenario-row="${i}" data-k="amount" type="number" min="0" value="${esc(scenario_n(x.amount))}"></td><td class="rate-cell"><input data-scenario-row="${i}" data-k="rate" type="number" step="0.1" value="${esc(scenario_n(x.rate))}"></td><td class="year-cell"><select data-scenario-row="${i}" data-k="topupYear">${scenario_yearOptions(x.topupYear)}</select></td><td class="money-cell"><input data-scenario-row="${i}" data-k="topupAmount" type="number" min="0" value="${esc(scenario_n(x.topupAmount))}"></td><td class="year-cell"><select data-scenario-row="${i}" data-k="dropYear">${scenario_yearOptions(x.dropYear)}</select></td><td class="rate-cell"><input data-scenario-row="${i}" data-k="dropPct" type="number" min="0" max="100" step="0.1" value="${esc(scenario_n(x.dropPct))}"></td><td class="money money-cell"><b>${money(scenario_scenarioRowValue(x, years))}</b></td><td><button class="icon-btn" title="Odebrat" data-scenario-remove="${i}">×</button></td></tr>`).join('')}</tbody></table></div><div class="scenario-edit-summary">Řádky z Investic i FKI zůstávají v jednom společném návrhu. Uložení je rozdělí podle oblasti do příležitostí klienta, obchod vzniká až později po podpisu.</div>` : '<p class="note">Vyber oblast, fond a přidej jej do kombinovaného návrhu. Pokud má klient otevřené investiční příležitosti, načtou se sem automaticky napříč Investicemi i FKI.</p>'}`;
}
function scenario_ensure() {
  let el = byId('scenarioAdvancedControls');
  if (el) return el;
  const host = byId('scenarioSelectedFunds');
  if (!host) return null;
  host.insertAdjacentHTML('afterend', `<div id="scenarioAdvancedControls" class="scenario-advanced mini-card" style="margin-top:12px"><div class="toolbar"><div><div class="eyebrow">Modelace</div><h3>Vývoj portfolia</h3><div class="note">Stávající portfolio se načítá z evidence. U FKI zůstávají primární aktuální hodnoty z FKI kalkulačky/evidence.</div></div><button class="btn" onclick="loadInvestmentScenarioFundDefaults()">Načíst podklady</button></div><div class="scenario-kpis" id="scenarioKpis"></div><div class="form-grid"><div class="field"><label>Aktuální výnos fondu p.a. %</label><input id="scenarioObservedRate" type="number" step="0.1" readonly></div><div class="field"><label>Dokup v roce</label><input id="scenarioTopupYear" type="number" min="1"></div><div class="field"><label>Dokup</label><input id="scenarioTopupAmount" type="number" min="0"></div><div class="field"><label>Propad v roce</label><input id="scenarioDropYear" type="number" min="1"></div><div class="field"><label>Propad %</label><input id="scenarioDropPct" type="number" min="0" max="100" step="0.1"></div></div><div id="scenarioNarrative" class="scenario-source-note"></div><canvas id="investmentScenarioChart" height="180"></canvas><div id="scenarioYearTable"></div></div>`);
  ['scenarioTopupYear', 'scenarioTopupAmount', 'scenarioDropYear', 'scenarioDropPct', 'scenarioYears', 'scenarioRate', 'scenarioAmount'].forEach(id => byId(id)?.addEventListener('input', scenario_renderAdvanced));
  byId('scenarioFund')?.addEventListener('change', loadInvestmentScenarioFundDefaults);
  return el;
}
function scenario_projection() {
  scenario_normalizeScenarioRows();
  const years = Math.max(1, scenario_n(val('scenarioYears')) || 10),
    c = scenario_selected(),
    portfolio = c && typeof clientDisplayInvestmentItems === 'function' ? clientDisplayInvestmentItems(c.id) : [],
    current = portfolio.reduce((s, x) => s + scenario_amount(x), 0),
    currentInvested = portfolio.reduce((s, x) => s + scenario_invested(x), 0),
    rows = investmentScenario?.rows || [],
    newMoney = rows.reduce((s, x) => s + scenario_n(x.amount), 0),
    topups = rows.reduce((s, x) => s + scenario_n(x.topupAmount), 0),
    insertedTotal = currentInvested + newMoney + topups,
    weighted = rows.reduce((s, x) => s + scenario_n(x.amount) * scenario_n(x.rate), 0) / (newMoney || 1),
    curRate = current && currentInvested ? (current / Math.max(1, currentInvested) - 1) * 100 : 0;
  let values = rows.map(x => scenario_n(x.amount)),
    labels = ['0'],
    currentSeries = [current],
    newSeries = [0],
    totalSeries = [current],
    yearRows = [{
      label: 'Dnes',
      current,
      newValue: 0,
      total: current
    }];
  for (let y = 1; y <= years; y++) {
    values = values.map((v, i) => {
      const r = rows[i];
      let next = v * (1 + scenario_n(r.rate) / 100);
      if (scenario_n(r.topupYear) === y) next += scenario_n(r.topupAmount);
      if (scenario_n(r.dropYear) === y) next *= Math.max(0, 1 - scenario_n(r.dropPct) / 100);
      return next;
    });
    const nv = values.reduce((s, v) => s + v, 0),
      cv = current * Math.pow(1 + curRate / 100, y),
      tv = cv + nv,
      label = y === 1 ? '1. rok' : `${y}. rok`;
    labels.push(label);
    newSeries.push(nv);
    currentSeries.push(cv);
    totalSeries.push(tv);
    yearRows.push({
      label,
      current: cv,
      newValue: nv,
      total: tv
    });
  }
  const final = totalSeries.at(-1) || 0,
    gain = final - insertedTotal;
  return {
    years,
    current,
    currentInvested,
    newMoney,
    topups,
    insertedTotal,
    weighted,
    curRate,
    labels,
    currentSeries,
    newSeries,
    totalSeries,
    yearRows,
    final,
    gain,
    gainPct: insertedTotal ? gain / insertedTotal * 100 : 0
  };
}
function scenario_renderChart(p) {
  const c = byId('investmentScenarioChart');
  if (!c || typeof Chart === 'undefined') return;
  if (window.investmentScenarioChartInstance) window.investmentScenarioChartInstance.destroy();
  window.investmentScenarioChartInstance = new Chart(c, {
    type: 'line',
    data: {
      labels: p.labels,
      datasets: [{
        label: 'Stávající portfolio',
        data: p.currentSeries,
        borderColor: '#7d8ca5',
        backgroundColor: 'rgba(125,140,165,.12)',
        tension: .25
      }, {
        label: 'Nové investice',
        data: p.newSeries,
        borderColor: '#1d8cf2',
        backgroundColor: 'rgba(29,140,242,.12)',
        tension: .25
      }, {
        label: 'Celkem',
        data: p.totalSeries,
        borderColor: '#1f9d55',
        backgroundColor: 'rgba(31,157,85,.12)',
        tension: .25
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      },
      scales: {
        y: {
          ticks: {
            callback: v => money(v)
          }
        }
      }
    }
  });
}
function scenario_renderAdvanced() {
  scenario_ensure();
  const p = scenario_projection(),
    k = byId('scenarioKpis');
  if (k) k.innerHTML = `<div class="scenario-kpi"><small>Současná hodnota</small><strong>${money(p.current)}</strong></div><div class="scenario-kpi"><small>Nově vloženo</small><strong>${money(p.newMoney)}</strong></div><div class="scenario-kpi"><small>Celkem vloženo</small><strong>${money(p.insertedTotal)}</strong></div><div class="scenario-kpi"><small>Modelovaná hodnota</small><strong>${money(p.final)}</strong></div><div class="scenario-kpi"><small>Celkový výnos</small><strong class="${p.gain >= 0 ? 'green' : 'red'}">${money(p.gain)}</strong><em>${scenario_fmtPct(p.gainPct)} %</em></div><div class="scenario-kpi"><small>Vážený výnos p.a.</small><strong>${scenario_fmtPct(p.weighted)} %</strong></div>`;
  const nar = byId('scenarioNarrative');
  if (nar) nar.textContent = `Horizont ${p.years} let. Dokupy jsou započtené jako další vložené peníze, propad snižuje hodnotu v zadaném roce. CRM je pouze přehled; rozhodující zdroj zůstává kalkulačka/evidence.`;
  const tbl = byId('scenarioYearTable');
  if (tbl) tbl.innerHTML = `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Rok</th><th>Stávající portfolio</th><th>Nový návrh</th><th>Celkem</th></tr></thead><tbody>${p.yearRows.map(r => `<tr><td>${esc(r.label)}</td><td class="money">${money(r.current)}</td><td class="money">${money(r.newValue)}</td><td class="money"><b>${money(r.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
  scenario_renderChart(p);
}
function scenario_scenarioSaveMode() {
  return val('scenarioSaveMode') === 'signed' ? 'signed' : 'proposal';
}
function scenario_scenarioProposalKey(r) {
  return [r.area, r.company, r.product, r.isin || r.key, r.typ].filter(Boolean).join('|');
}
function scenario_scenarioRowNote(r, summary, horizon, title = 'Investiční návrh') {
  return [`${title} · ${r.area} · očekávaný výnos ${num(r.rate)} % p.a. · horizont ${num(horizon)} let`, r.topupYear ? `Dokup ${r.topupYear}. rok: ${money(r.topupAmount)}` : '', r.dropYear ? `Propad ${r.dropYear}. rok: ${num(r.dropPct)} %` : '', summary].filter(Boolean).join('\n');
}
function scenario_scenarioOpportunityDraft(c, r, summary, horizon) {
  const proposalKey = scenario_scenarioProposalKey(r);
  return {
    clientId: c.id,
    status: 'Oportunita',
    statusDate: today(),
    category: r.area,
    company: r.company,
    product: r.product,
    amount: scenario_n(r.amount),
    fundKey: r.key || '',
    scenarioKey: r.key || '',
    proposalKey,
    isin: r.isin || '',
    fundIsin: r.isin || '',
    fundType: r.typ || '',
    bj: 0,
    expectedDate: '',
    owner: '',
    ownerType: '',
    createContract: true,
    contractNumber: '',
    contractAnniv: '',
    contractRate: '',
    actualCommission: 0,
    note: scenario_scenarioRowNote(r, summary, horizon),
    updatedAt: today()
  };
}
function scenario_removeScenarioOpportunity(r, draft) {
  let target = (state.opportunities || []).find(o => String(o.id) === String(r.opportunityId));
  if (!target) target = (state.opportunities || []).find(o => sameOpenOpportunity(o, draft));
  if (!target) return 0;
  state.opportunities = state.opportunities.filter(o => String(o.id) !== String(target.id));
  return 1;
}
function scenario_addScenarioSnapshot(c, r, date) {
  if (r.area === 'FKI') return;
  state.investmentSnapshots = state.investmentSnapshots || [];
  const snap = {
    id: uid(),
    clientId: c.id,
    company: r.company || '',
    product: r.product || 'Investice',
    isin: r.isin || '',
    mergeKey: r.key || '',
    fundType: r.typ || 'Investice',
    date,
    current: scenario_n(r.amount),
    invested: scenario_n(r.amount),
    gainAmount: 0,
    gainPct: 0,
    regularAmount: 0,
    regularFrequency: '',
    source: 'Sjednáno z nové investice',
    note: 'Počáteční hodnota po propsání nové investice.',
    createdAt: today()
  };
  const key = investmentSnapshotKeyForSnapshot(snap),
    oldIndex = state.investmentSnapshots.findIndex(s => investmentSnapshotKeyForSnapshot(s) === key);
  if (oldIndex >= 0) state.investmentSnapshots[oldIndex] = {
    ...state.investmentSnapshots[oldIndex],
    ...snap,
    id: state.investmentSnapshots[oldIndex].id,
    updatedAt: today()
  };else state.investmentSnapshots.push(snap);
}
function scenario_addScenarioDeal(c, r, summary, horizon, date) {
  state.deals = state.deals || [];
  const d = {
    id: uid(),
    clientId: c.id,
    category: r.area === 'FKI' ? 'FKI' : 'Investice',
    date: date || today(),
    company: r.company || '',
    product: r.product || r.area || 'Investice',
    amount: scenario_n(r.amount),
    bj: 0,
    owner: '',
    ownerType: '',
    ownerCommissionPct: 0,
    ownerPaid: false,
    actualCommission: 0,
    commissionPaid: false,
    createContract: r.area === 'FKI',
    contractNumber: '',
    fundKey: r.key || '',
    scenarioKey: r.key || '',
    proposalKey: scenario_scenarioProposalKey(r),
    isin: r.isin || '',
    fundIsin: r.isin || '',
    fundType: r.typ || '',
    note: scenario_scenarioRowNote(r, summary, horizon, 'Investice sjednána'),
    createdAt: today(),
    signedAt: date || today(),
    source: 'investmentScenario'
  };
  state.deals.push(d);
  scenario_addScenarioSnapshot(c, r, date);
  scenario_removeScenarioOpportunity(r, scenario_scenarioOpportunityDraft(c, r, summary, horizon));
  return d;
}
function fkiEditor_fkEnc(v) {
  return encodeURIComponent(String(v || ''));
}
function fkiEditor_fkDec(v) {
  return decodeURIComponent(String(v || ''));
}
function fkiEditor_fkDate(v) {
  return String(v || '').slice(0, 10);
}
function fkiEditor_fkNum(v) {
  return typeof parseMoney === 'function' ? parseMoney(v) || 0 : +v || 0;
}
function fkiEditor_fkRecKey(r) {
  return typeof invRecordKey === 'function' ? invRecordKey(r) : JSON.stringify(r);
}
function fkiEditor_fkRecordsForItem(clientId, key) {
  return investmentRecordsForClient(clientId).filter(r => invPositionKey(r) === key && isFkiReportRecord(r)).sort((a, b) => String(invEmissionDate(a) || invPaymentDate(a)).localeCompare(String(invEmissionDate(b) || invPaymentDate(b))));
}
function fkiEditor_fkRecordCurrent(r) {
  return invCurrentValue(r) || invCurrent(r) || invDeposit(r) || 0;
}
function fkiEditor_fkSetFundValueForKey(key, nav, date, base = {}) {
  if (!key || !nav) return 0;
  state.fundValues = state.fundValues || {};
  state.fundValues[key] = {
    ...(state.fundValues[key] || {}),
    area: 'fki',
    company: base.company || state.fundValues[key]?.company || '',
    fond: base.fond || state.fundValues[key]?.fond || '',
    product: base.product || state.fundValues[key]?.product || 'FKI',
    isin: base.isin || state.fundValues[key]?.isin || '',
    typ: base.typ || state.fundValues[key]?.typ || '',
    nav,
    date: date || today()
  };
  let changed = 0;
  (state.investmentRecords || []).forEach(r => {
    if (invPositionKey(r) !== key) return;
    r['Poslední schválená hodnota CP'] = nav;
    r['Poslední schválená hodnota do'] = date || today();
    if (invEffectiveQty(r)) r['Aktuální hodnota investice'] = invCurrentValue(r);
    changed++;
  });
  return changed;
}
function fkiEditor_fkFundSelectOptions(selected = '') {
  return '<option value="">-- ručně / nový fond --</option>' + fkFundItems().map(f => `<option value="${esc(f.key)}" ${f.key === selected ? 'selected' : ''}>${esc([f.company, f.product, f.isin].filter(Boolean).join(' - '))}</option>`).join('');
}
function fkiPosition_d(v) {
  return decodeURIComponent(String(v || ''));
}
function fkiPosition_fundDefaults(key) {
  const f = fkFundItems().find(x => x.key === key) || {},
    fv = state.fundValues?.[key] || {};
  return {
    company: fv.company || f.company || '',
    fund: fv.fond || f.product || '',
    product: fv.product || 'FKI',
    isin: fv.isin || f.isin || '',
    typ: fv.typ || f.typ || '',
    nav: fv.nav || '',
    date: fv.date || f.date || ''
  };
}
function investmentPosition_enc(v) {
  return encodeURIComponent(String(v || ''));
}
function investmentPosition_invGroup(items) {
  const map = {};
  (items || []).forEach(x => {
    const key = investmentFundKey(x),
      raw = investmentFundRawKey(x),
      fv = state.fundValues?.[key] || state.fundValues?.[raw] || {},
      company = fv.company || x.company || 'Nezařazeno',
      product = fv.fond || x.product || x.kind || 'Investice',
      label = investmentFundLabel({
        company,
        product
      });
    if (!map[key]) map[key] = {
      key,
      label,
      company,
      product,
      isin: fv.isin || x.isin || '',
      typ: fv.typ || x.typ || x.kind || investmentFundProductType(x),
      amount: 0,
      invested: 0,
      realized: 0,
      items: []
    };
    map[key].amount += +x.amount || 0;
    map[key].invested += investmentInvestedAmount(x);
    map[key].realized += investmentRealizedAmount(x);
    map[key].items.push(x);
  });
  return Object.values(map).sort((a, b) => b.amount - a.amount);
}
function investmentPosition_invStatus(x) {
  return x.snapshot ? '<span class="badge green">ověřeno</span>' : '<span class="badge orange">bez aktualizace</span>';
}
function investmentPosition_invRowAction(x, clientId) {
  const key = investmentPosition_enc(investmentItemKey(x));
  return `${investmentEditButton(x)} <button class="btn slim" onclick="openInvestmentSnapshotModal(${clientId},'${esc(key)}')">Hodnota</button>`;
}
function investmentPosition_invPositionRows(f, clientId) {
  return `<div class="table-wrap" style="margin-top:12px"><table class="compact-table"><thead><tr><th>Pozice / záznam</th><th>Vloženo</th><th>Aktuální</th><th>Výnos</th><th>Datum</th><th>Zdroj</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${f.items.sort((a, b) => String(b.snapshot?.date || b.date || '').localeCompare(String(a.snapshot?.date || a.date || ''))).map((x, i) => {
    const put = investmentInvestedAmount(x),
      cur = +x.amount || 0,
      realized = investmentRealizedAmount(x),
      gain = investmentPerformanceGain(cur, put, realized),
      pct = investmentPerformancePct(cur, put, realized),
      valueDate = fundValueDateText('investice', f.key, x.isin, x.snapshot?.date || x.source?.valueDate || x.source?.date || '');
    return `<tr><td><b>${esc(x.product || x.kind || 'Investice')} #${i + 1}</b><br><span class="note">${esc([x.company, x.isin, x.typ || x.kind].filter(Boolean).join(' · '))}</span></td><td class="money">${money(put)}</td><td class="money">${money(cur)}<br><span class="note">k ${valueDate}</span></td><td class="money ${gain >= 0 ? 'green' : 'red'}">${money(gain)}<br><span>${pct.toFixed(1)} %</span></td><td>${esc(x.snapshot?.date || x.date || '')}</td><td>${esc(x.snapshot?.source || x.sourceType || 'CRM')}</td><td>${investmentPosition_invStatus(x)}</td><td>${investmentPosition_invRowAction(x, clientId)}</td></tr>`;
  }).join('') || '<tr><td colspan="8" class="note">Pod fondem není žádná pozice.</td></tr>'}</tbody></table></div>`;
}
function investmentPosition_invCard(f, clientId) {
  const gain = investmentPerformanceGain(f.amount, f.invested, f.realized),
    pct = investmentPerformancePct(f.amount, f.invested, f.realized),
    key = investmentPosition_enc(f.key),
    fv = state.fundValues?.[f.key] || {},
    valueDate = fundValueDateText('investice', f.key, f.isin, fv.date),
    locked = isInvestmentFundLocked(f.key);
  return `<details class="fki-work-card ${gain < 0 ? 'loss' : ''} ${locked ? 'locked' : ''}"><summary class="fki-work-head"><div class="fki-work-name"><b>${esc(f.label)}</b><div class="chips"><span class="chip">${esc(f.company)}</span><span class="badge blue">Investice</span><span class="chip">${num(f.items.length)} pozic</span>${locked ? '<span class="badge orange">zamčeno</span>' : ''}</div></div><div class="fki-work-metric"><small>Vloženo</small><strong>${money(f.invested)}</strong></div><div class="fki-work-metric"><small>Aktuální</small><strong class="${gain >= 0 ? 'green' : 'red'}">${money(f.amount)}</strong><small>k ${valueDate}</small></div><div class="fki-work-metric"><small>Výnos</small><strong class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</strong></div><div class="actions"><button class="btn slim primary" onclick="event.preventDefault();openInvestmentScenarioModal(${clientId},'Investice')">+ Nová investice</button><button class="btn slim" onclick="event.preventDefault();openInvestmentSnapshotModal(${clientId},'${esc(investmentPosition_enc(String(clientId) + '|' + f.key))}')">Hodnota</button><button class="btn slim" onclick="event.preventDefault();openInvestmentFundModal('${esc(key)}')">Fond</button><button class="icon-btn ${locked ? 'primary' : ''}" onclick="event.preventDefault();toggleInvestmentFundLock('${esc(key)}')" title="Zámek reportu">${locked ? '🔒' : '🔓'}</button></div></summary><div class="fki-work-detail"><div class="fki-detail-grid"><div><small>Investováno</small><b>${money(f.invested)}</b></div><div><small>Výnos</small><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div><small>Poslední hodnota</small><b>${money(f.amount)}</b></div><div><small>Hodnota CP / NAV</small><b>${fv.nav ? num(fv.nav) : '-'}</b></div><div><small>Hodnota fondu k datu</small><b>${valueDate}</b></div><div><small>ISIN</small><b>${esc(f.isin || '-')}</b></div><div><small>Typ</small><b>${esc(f.typ || '-')}</b></div><div><small>Pozic</small><b>${num(f.items.length)}</b></div></div>${investmentPosition_invPositionRows(f, clientId)}</div></details>`;
}
function fkiPortfolio_dec(v) {
  return decodeURIComponent(String(v || ''));
}
function fkiPortfolio_recordKey(r) {
  return typeof invRecordKey === 'function' ? invRecordKey(r) : JSON.stringify(r);
}
function fkiPortfolio_fkiRecordsForClientKey(clientId, key) {
  return investmentRecordsForClient(clientId).filter(r => invPositionKey(r) === key && (isFkiReportRecord(r) || isFkiMirrorRecord(r) || r._crmSourceType === 'deal' || r._crmSourceType === 'contract'));
}
function fkiPortfolio_fkiProposalRows(clientId) {
  return clientOpenOpportunities(clientId).filter(o => opportunityArea(o) === 'fki' || o.category === 'FKI');
}
function deleteFkiRecordByKey(encodedKey) {
  const key = fkiPortfolio_dec(encodedKey),
    r = (state.investmentRecords || []).find(x => fkiPortfolio_recordKey(x) === key);
  if (!r) return alert('Záznam už v CRM nevidím.');
  if (!confirm('Smazat tuto konkrétní FKI pozici klienta?')) return;
  state.investmentRecords = state.investmentRecords.filter(x => fkiPortfolio_recordKey(x) !== key);
  persist();
  renderAll();
  saveToast('FKI pozice smazána');
}
function deleteFkiClientFund(clientId, encodedKey) {
  const key = fkiPortfolio_dec(encodedKey),
    rows = fkiPortfolio_fkiRecordsForClientKey(clientId, key),
    c = findClient(clientId);
  if (!rows.length) return alert('U klienta už tento fond nevidím.');
  if (!confirm(`Smazat celý fond ${cleanInvFundName(invFund(rows[0]), invCompany(rows[0]))} u klienta ${clientName(c)}? Smaže se ${rows.length} klientských pozic, centrální fond zůstane zachovaný.`)) return;
  rows.forEach(r => {
    if (r._crmSourceType === 'deal') {
      const d = (state.deals || []).find(x => String(x.id) === String(r._crmSourceId));
      if (d) d._fkiExcluded = true;
    }
    if (r._crmSourceType === 'contract') {
      const s = (state.contracts || []).find(x => String(x.id) === String(r._crmSourceId));
      if (s) s._fkiExcluded = true;
    }
  });
  const keys = new Set(rows.map(fkiPortfolio_recordKey));
  state.investmentRecords = state.investmentRecords.filter(r => !keys.has(fkiPortfolio_recordKey(r)));
  addActivity(clientId, 'FKI', 'Smazán FKI fond klienta: ' + cleanInvFundName(invFund(rows[0]), invCompany(rows[0])), true);
  persist();
  renderAll();
  saveToast('FKI fond klienta smazán');
}
function fkiSync_sameMoney(a, b) {
  return Math.abs((+a || 0) - (+b || 0)) < 1;
}
function fkiSync_crmFkiMaster(company, product, isin = '') {
  const companyKey = norm(company),
    productKey = norm(product),
    isinKey = norm(isin);
  const entries = Object.entries(state.fundValues || {}).filter(([, v]) => v?.area !== 'investice');
  let found = entries.find(([, v]) => isinKey && norm(v.isin) === isinKey);
  if (!found) found = entries.find(([, v]) => norm(v.company) === companyKey && norm(cleanInvFundName(v.fond || v.product, v.company)) === norm(cleanInvFundName(product, company)));
  if (!found) found = entries.find(([, v]) => norm(cleanInvFundName(v.fond || v.product, v.company)).includes(productKey) || productKey.includes(norm(cleanInvFundName(v.fond || v.product, v.company))));
  return found ? {
    key: found[0],
    ...found[1]
  } : {};
}
function fkiSync_crmFkiRecordSeed(clientId, source, sourceType) {
  const c = findClient(clientId),
    amount = sourceType === 'contract' ? parseMoney(source.amount) : dealVolume(source),
    company = source.company || '',
    product = source.product || source.type || 'FKI',
    master = fkiSync_crmFkiMaster(company, product, source.isin || source.fundIsin || ''),
    date = source.date || source.dealDate || source.anniv || today(),
    nav = +(master.nav || source.nav || 0),
    qty = nav && amount ? amount / nav : 0,
    rc = normalizeStrongId(c?.birthId);
  return {
    Investor: clientName(c) || '',
    Poradce: 'Solár Filip',
    'RČ': c?.birthId || '',
    ClientID: rc ? 'RC_' + rc : String(clientId || ''),
    Fond: master.fond || product,
    'Investiční společnost': master.company || company,
    'Typ produktu': 'FKI',
    'Typ transakce': 'Platba',
    'Čistá investice': amount,
    'Aktuální hodnota investice': qty && nav ? qty * nav : amount,
    'Datum připsání platby': date,
    'Datum emise': date,
    'Poslední schválená hodnota CP': nav || '',
    'Poslední schválená hodnota do': master.date || date,
    'rp.ISIN': master.isin || source.isin || source.fundIsin || '',
    'Typ CP': master.typ || source.fundType || 'Investiční akcie',
    'Počet vydaných CP': qty || 0,
    'Upisovací hodnota': nav || 0,
    'Pravidelná částka': 0,
    'Datum narození': '',
    'Stav scénáře': '',
    _source: sourceType === 'contract' ? 'crm-fki-contract' : 'crm-fki-deal',
    _crmSourceType: sourceType,
    _crmSourceId: source.id,
    _crmDealId: sourceType === 'deal' ? source.id : source.fromDealId || '',
    _crmContractId: sourceType === 'contract' ? source.id : source.contractId || '',
    _updatedAt: today()
  };
}
function fkiSync_hasFkiRecordForSource(seed, sourceType, sourceId) {
  return (state.investmentRecords || []).some(r => String(r._crmSourceType || '') === sourceType && String(r._crmSourceId || '') === String(sourceId)) || (state.investmentRecords || []).some(r => isFkiReportRecord(r) && clientMatchesName({
    name: seed.Investor,
    birthId: seed['RČ']
  }, invInvestor(r)) && invPositionKey(r) === invPositionKey(seed) && fkiSync_sameMoney(invDeposit(r), invDeposit(seed)));
}
function fkiSync_upsertCrmFkiSeed(seed) {
  const idx = (state.investmentRecords || []).findIndex(r => String(r._crmSourceType || '') === String(seed._crmSourceType) && String(r._crmSourceId || '') === String(seed._crmSourceId));
  if (idx >= 0) {
    state.investmentRecords[idx] = {
      ...state.investmentRecords[idx],
      ...seed
    };
    return 1;
  }
  if (fkiSync_hasFkiRecordForSource(seed, seed._crmSourceType, seed._crmSourceId)) return 0;
  state.investmentRecords.push(seed);
  return 1;
}
function fkiSync_syncCrmFkiDealsToRecords() {
  state.investmentRecords = state.investmentRecords || [];
  let changed = 0;
  (state.deals || []).filter(d => !d._fkiExcluded && areaForDeal(d) === 'fki' && dealVolume(d) > 0).forEach(d => {
    changed += fkiSync_upsertCrmFkiSeed(fkiSync_crmFkiRecordSeed(d.clientId, d, 'deal'));
  });
  (state.contracts || []).filter(s => !s._fkiExcluded && areaForContract(s) === 'fki' && ['podepsano', 'vyrizeno'].includes(String(s.status || '')) && !s.fromDealId && parseMoney(s.amount) > 0).forEach(s => {
    changed += fkiSync_upsertCrmFkiSeed(fkiSync_crmFkiRecordSeed(s.clientId, s, 'contract'));
  });
  if (changed) dedupeInvestmentRecordsInState(state);
  return changed;
}
function fkiSync_removeOrphanCrmFkiRecords() {
  const dealIds = new Set((state.deals || []).map(d => String(d.id))),
    contractIds = new Set((state.contracts || []).map(s => String(s.id))),
    before = (state.investmentRecords || []).length;
  state.investmentRecords = (state.investmentRecords || []).filter(r => {
    if (r._crmSourceType === 'deal') return dealIds.has(String(r._crmSourceId));
    if (r._crmSourceType === 'contract') return contractIds.has(String(r._crmSourceId));
    return true;
  });
  return before - state.investmentRecords.length;
}
function annualAnalysis_yearFromDate(v) {
  const y = yearOf(v);
  return Number.isFinite(y) ? y : 0;
}
function annualAnalysis_analysisYearList() {
  const now = new Date().getFullYear(),
    years = new Set([now]);
  (state.deals || []).forEach(d => {
    const y = annualAnalysis_yearFromDate(d.date);
    if (y >= annualAnalysis_ANALYSIS_YEAR_START) years.add(y);
  });
  (state.analysisEntries || []).forEach(r => {
    const y = annualAnalysis_yearFromDate(r.date);
    if (y >= annualAnalysis_ANALYSIS_YEAR_START) years.add(y);
  });
  (state.activities || []).forEach(r => {
    const y = annualAnalysis_yearFromDate(r.date);
    if (y >= annualAnalysis_ANALYSIS_YEAR_START) years.add(y);
  });
  (state.referrals || []).forEach(r => {
    const y = annualAnalysis_yearFromDate(r.date);
    if (y >= annualAnalysis_ANALYSIS_YEAR_START) years.add(y);
  });
  const max = Math.max(now, ...years);
  const out = [];
  for (let y = annualAnalysis_ANALYSIS_YEAR_START; y <= max; y++) out.push(y);
  return out;
}
function annualAnalysis_analysisYearSelection() {
  state.settings = state.settings || {};
  const saved = state.settings.analysisCompareYears || {};
  return annualAnalysis_analysisYearList().filter(y => saved[String(y)] !== false);
}
function annualAnalysis_renderAnalysisYearToggles() {
  const years = annualAnalysis_analysisYearList(),
    saved = state.settings?.analysisCompareYears || {};
  ['analysisYearToggles', 'analysisBusinessYearToggles'].forEach(id => {
    const el = byId(id);
    if (!el) return;
    el.innerHTML = years.map((y, i) => {
      const on = saved[String(y)] !== false,
        color = annualAnalysis_ANALYSIS_YEAR_COLORS[i % annualAnalysis_ANALYSIS_YEAR_COLORS.length];
      return `<label class="analysis-year-toggle ${on ? 'active' : ''}" style="--year-color:${color}"><input type="checkbox" ${on ? 'checked' : ''} onchange="setAnalysisCompareYear(${y},this.checked)"> ${y}</label>`;
    }).join('');
  });
}
function annualAnalysis_monthBounds(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return {
    start,
    end
  };
}
function annualAnalysis_activityMetricValue(year, month, metric) {
  const r = annualAnalysis_monthBounds(year, month),
    a = analysisActuals(r.start, r.end);
  if (metric === 'meetings') return (+a.meetingsNew || 0) + (+a.meetingsExisting || 0);
  return +a[metric] || 0;
}
function annualAnalysis_businessMetricValue(year, month, metric) {
  return visibleDeals().reduce((sum, d) => {
    if (yearOf(d.date) !== year || monthOf(d.date) !== month) return sum;
    const area = areaForDeal(d);
    if (metric === 'investment') return sum + (area === 'investice' || area === 'fki' ? dealVolume(d) : 0);
    if (metric === 'bj') return sum + dealBJ(d);
    if (metric === 'mortgage') return sum + (d.category === 'Hypotéky' ? dealVolume(d) : 0);
    return sum;
  }, 0);
}
function annualAnalysis_chartDatasets(valueFn, metric) {
  const years = annualAnalysis_analysisYearSelection();
  return years.map((year, i) => {
    const color = annualAnalysis_ANALYSIS_YEAR_COLORS[i % annualAnalysis_ANALYSIS_YEAR_COLORS.length];
    return {
      label: String(year),
      data: annualAnalysis_ANALYSIS_MONTH_LABELS.map((_, m) => valueFn(year, m, metric)),
      borderColor: color,
      backgroundColor: color + '22',
      pointBackgroundColor: color,
      pointRadius: 3,
      borderWidth: 2,
      tension: .32,
      fill: false
    };
  });
}
function annualAnalysis_emptyChart(canvas, msg) {
  const wrap = canvas?.parentElement;
  if (wrap) wrap.innerHTML = `<div class="analysis-chart-empty">${esc(msg)}</div>`;
}
function annualAnalysis_ensureCanvas(id) {
  const el = byId(id);
  if (el) return el;
  const wrap = document.querySelector(id === 'analysisBusinessChart' ? '#analysisBusinessYearToggles + .chart-wrap' : '#analysisYearToggles + .chart-wrap');
  if (!wrap) return null;
  wrap.innerHTML = `<canvas id="${id}"></canvas>`;
  return byId(id);
}
function commissions_cNorm(v) {
  return norm(String(v || ''));
}
function commissions_cNum(v) {
  return typeof parseMoney === 'function' ? parseMoney(v) || 0 : +v || 0;
}
function commissions_cLabel(f) {
  return [f.company, f.fond || f.product, f.isin, f.typ].filter(Boolean).join(' · ') || 'Fond bez názvu';
}
function commissions_cPickMaster(area, current, candidates) {
  if (!candidates.length) return current;
  const options = [current, ...candidates.map(f => ({
    area,
    company: f.company || '',
    fond: f.fond || f.product || f.label || '',
    product: f.product || f.kind || area,
    isin: f.isin || '',
    typ: f.typ || '',
    mergeKey: f.mergeKey || '',
    nav: f.nav || '',
    date: f.date || '',
    trailPct: f.trailPct
  }))];
  const text = options.map((o, i) => `${i + 1}. ${commissions_cLabel(o)}`).join('\n');
  const choice = prompt(`Našel jsem stejný ISIN u více fondů.\n\nVyber číslo záznamu, jehož název/společnost/typ je správně. Tato informace se propíše ke všem klientům s tímto ISIN:\n\n${text}`, '1');
  if (choice === null) return null;
  const idx = Math.max(0, Math.min(options.length - 1, (parseInt(choice, 10) || 1) - 1));
  return {
    ...current,
    ...options[idx],
    isin: current.isin || options[idx].isin,
    nav: current.nav || options[idx].nav,
    date: current.date || options[idx].date || today(),
    trailPct: current.trailPct || options[idx].trailPct
  };
}
function commissions_trailKeysForItem(x) {
  const keys = [x?.key];
  if (typeof investmentAreaOfItem === 'function' && investmentAreaOfItem(x) === 'fki' && typeof fkItemKey === 'function') keys.push(fkItemKey(x));
  if (typeof investmentFundKey === 'function') keys.push(investmentFundKey(x));
  if (typeof investmentFundRawKey === 'function') keys.push(investmentFundRawKey(x));
  return [...new Set(keys.filter(Boolean).map(String))];
}
function commissions_investmentTrailPctForItem(x) {
  for (const key of commissions_trailKeysForItem(x)) {
    let current = key,
      seen = new Set();
    while (current && !seen.has(current)) {
      seen.add(current);
      const trail = state.trailSettings?.[current],
        fund = state.fundValues?.[current],
        pct = trail?.trailPct ?? fund?.trailPct;
      if (pct !== undefined && pct !== null && String(pct).trim() !== '') return parseMoney(pct) || 0;
      current = trail?._aliasTo || fund?._aliasTo || fund?.aliasKey || '';
    }
  }
  return 0;
}
function commissions_investmentTrailAnnualForItem(x) {
  const coef = +state.settings.bjCoef || 150,
    pct = commissions_investmentTrailPctForItem(x);
  return (+x.amount || 0) * (pct / 100) / 250 * coef;
}
function commissions_investmentTrailAnnualGross() {
  const items = typeof reportInvestmentItems === 'function' ? reportInvestmentItems() : fkiReportItems();
  return items.reduce((sum, x) => sum + commissions_investmentTrailAnnualForItem(x), 0);
}
function commissions_investmentTrailSplit() {
  const annualGross = commissions_investmentTrailAnnualGross();
  return {
    annualGross,
    monthlyPayout: annualGross * 0.9 / 12,
    yearEndBonus: annualGross * 0.1
  };
}
function commissions_fkiOnlyTrailAnnualGross() {
  return fkiReportItems().reduce((sum, x) => sum + commissions_investmentTrailAnnualForItem(x), 0);
}
function commissions_investmentCandidatesByIsin(oldKey, isin) {
  const i = commissions_cNorm(isin);
  if (!i) return [];
  const rows = investmentFundItems().filter(f => commissions_cNorm(f.isin) === i && String(f.key) !== String(oldKey));
  Object.entries(state.fundValues || {}).forEach(([key, v]) => {
    if (v?.area !== 'investice' || String(key) === String(oldKey) || commissions_cNorm(v.isin) !== i) return;
    if (!rows.some(f => String(f.key) === String(key))) rows.push({
      key,
      company: v.company,
      fond: v.fond,
      product: v.product,
      isin: v.isin,
      typ: v.typ,
      mergeKey: v.mergeKey,
      nav: v.nav,
      date: v.date,
      trailPct: v.trailPct,
      rawKeys: new Set([key])
    });
  });
  return rows;
}
function commissions_investmentMergeKeys(oldKey, key, candidates, chosen) {
  const keys = new Set([oldKey, key].filter(Boolean));
  const f = investmentFundItems().find(x => String(x.key) === String(oldKey) || String(x.key) === String(key));
  if (f?.rawKeys) [...f.rawKeys].forEach(k => keys.add(k));
  candidates.forEach(x => {
    keys.add(x.key);
    if (x.rawKeys) [...x.rawKeys].forEach(k => keys.add(k));
  });
  if (chosen?.isin) (state.investmentSnapshots || []).forEach(s => {
    if (commissions_cNorm(s.isin) === commissions_cNorm(chosen.isin)) keys.add(investmentSnapshotKeyForSnapshot(s));
  });
  return keys;
}
function commissions_applyInvestmentFundMerge(keys, data) {
  let changed = 0;
  (state.investmentSnapshots || []).forEach(s => {
    const sameKey = keys.has(investmentSnapshotKeyForSnapshot(s)),
      sameIsin = data.isin && commissions_cNorm(s.isin) === commissions_cNorm(data.isin);
    if (!sameKey && !sameIsin) return;
    s.company = data.company;
    s.product = data.fond || data.product;
    s.isin = data.isin;
    s.mergeKey = data.mergeKey || s.mergeKey || '';
    s.fundType = data.typ || data.product || s.fundType || '';
    s.typ = data.typ || s.typ || '';
    s.updatedAt = today();
    changed++;
  });
  ['deals', 'contracts', 'opportunities'].forEach(arr => (state[arr] || []).forEach(x => {
    const area = arr === 'deals' ? areaForDeal(x) : arr === 'contracts' ? areaForContract(x) : opportunityArea(x);
    if (area !== 'investice') return;
    const sameIsin = data.isin && commissions_cNorm(x.isin || x.fundIsin) === commissions_cNorm(data.isin);
    if (!sameIsin) return;
    x.company = data.company;
    x.product = data.fond || data.product;
    x.isin = data.isin;
    x.fundIsin = data.isin;
    x.fundType = data.typ || x.fundType || '';
    x.updatedAt = today();
    changed++;
  }));
  return changed;
}
function commissions_fkCandidatesByIsin(oldKey, isin) {
  const i = commissions_cNorm(isin);
  if (!i) return [];
  const rows = fkFundItems().filter(f => commissions_cNorm(f.isin) === i && String(f.key) !== String(oldKey));
  Object.entries(state.fundValues || {}).forEach(([key, v]) => {
    if (v?.area === 'investice' || String(key) === String(oldKey) || commissions_cNorm(v.isin) !== i) return;
    if (!rows.some(f => String(f.key) === String(key))) rows.push({
      key,
      company: v.company,
      fond: v.fond,
      product: v.product,
      isin: v.isin,
      typ: v.typ,
      nav: v.nav,
      date: v.date,
      trailPct: v.trailPct
    });
  });
  return rows;
}
function commissions_fkKey(isin, fond, company, typ) {
  return commissions_cNorm(isin) ? ['isin', commissions_cNorm(isin)].join('|') : ['fond', commissions_cNorm(cleanInvFundName(fond, company)), commissions_cNorm(typ)].join('|');
}
function commissions_applyFkFundMerge(keys, newKey, data) {
  let changed = 0;
  (state.investmentRecords || []).forEach(r => {
    const sameKey = keys.has(invPositionKey(r)),
      sameIsin = data.isin && commissions_cNorm(invIsin(r)) === commissions_cNorm(data.isin);
    if (!sameKey && !sameIsin) return;
    r['Investiční společnost'] = data.company;
    r.Fond = data.fond;
    r['Typ produktu'] = data.product || 'FKI';
    r['rp.ISIN'] = data.isin;
    if (data.typ) r['Typ CP'] = data.typ;
    if (data.nav) {
      r['Poslední schválená hodnota CP'] = data.nav;
      r['Poslední schválená hodnota do'] = data.date || today();
      if (invEffectiveQty(r)) r['Aktuální hodnota investice'] = invCurrentValue(r);
    }
    r._updatedAt = today();
    changed++;
  });
  state.fundValues = state.fundValues || {};
  state.trailSettings = state.trailSettings || {};
  state.lockedFunds = state.lockedFunds || {};
  [...keys].filter(Boolean).forEach(k => {
    if (k !== newKey) state.fundValues[k] = {
      ...(state.fundValues[k] || {}),
      ...data,
      area: 'fki',
      _aliasTo: newKey
    };
  });
  state.fundValues[newKey] = {
    ...(state.fundValues[newKey] || {}),
    ...data,
    area: 'fki'
  };
  state.trailSettings[newKey] = {
    ...(state.trailSettings[newKey] || {}),
    trailPct: data.trailPct
  };
  [...keys].forEach(k => {
    if (k === newKey) return;
    if (state.trailSettings[k]) state.trailSettings[k] = {
      ...state.trailSettings[k],
      _aliasTo: newKey
    };
    const oldLock = fkiGlobalLockKey(k),
      newLock = fkiGlobalLockKey(newKey);
    if (state.lockedFunds[oldLock]) {
      state.lockedFunds[newLock] = true;
      delete state.lockedFunds[oldLock];
    }
  });
  return changed;
}
function liquidity_q(id) {
  return document.getElementById(id);
}
function liquidity_set(id, v) {
  const el = liquidity_q(id);
  if (el) el.value = v ?? '';
}
function liquidity_valx(id) {
  return liquidity_q(id)?.value || '';
}
function liquidity_n(v) {
  return typeof parseMoney === 'function' ? parseMoney(v) || 0 : +v || 0;
}
function liquidity_enc(v) {
  return encodeURIComponent(String(v || ''));
}
function liquidity_dec(v) {
  return decodeURIComponent(String(v || ''));
}
function liquidity_isoDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  m = s.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function liquidity_localDate(v) {
  const s = liquidity_isoDate(v);
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function liquidity_toIso(d) {
  return d && !isNaN(d) ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
}
function liquidity_addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function liquidity_addMonths(d, months) {
  const x = new Date(d),
    day = x.getDate();
  x.setDate(1);
  x.setMonth(x.getMonth() + (+months || 0));
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, last));
  return x;
}
function liquidity_endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function liquidity_endOfQuarter(d) {
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 0);
}
function liquidity_nextRedemptionDate(from, frequency) {
  const f = String(frequency || 'quarterly');
  if (f === 'anytime') return new Date(from);
  if (f === 'monthly') return liquidity_endOfMonth(from);
  if (f === 'semiannual') return new Date(from.getFullYear(), from.getMonth() < 6 ? 5 : 11, from.getMonth() < 6 ? 30 : 31);
  if (f === 'yearly') return new Date(from.getFullYear(), 11, 31);
  return liquidity_endOfQuarter(from);
}
function liquidity_freqLabel(f) {
  return {
    monthly: 'měsíčně',
    quarterly: 'kvartálně',
    semiannual: 'pololetně',
    yearly: 'ročně',
    anytime: 'kdykoliv'
  }[f || 'quarterly'] || 'kvartálně';
}
function liquidity_fmtDate(v) {
  if (!v) return '-';
  const d = liquidity_localDate(v);
  return d ? d.toLocaleDateString('cs-CZ') : String(v);
}
function liquidity_fundRulesFromValue(fv = {}) {
  return {
    taxMonths: Math.max(0, liquidity_n(fv.taxMonths || fv.taxTestMonths || liquidity_TAX_DEFAULT) || liquidity_TAX_DEFAULT),
    redemptionFrequency: fv.redemptionFrequency || 'quarterly',
    settlementMonths: Math.max(0, liquidity_n(fv.settlementMonths || 0) || 0)
  };
}
function liquidity_findFundValue(area, key, isin) {
  const direct = state.fundValues?.[key];
  if (direct) return direct;
  const wanted = norm(isin || '');
  if (!wanted) return {};
  return Object.values(state.fundValues || {}).find(v => v?.area === area && norm(v.isin || '') === wanted) || {};
}
function liquidity_fundValueDateText(area, key, isin, fallback = '') {
  const fv = liquidity_findFundValue(area, key, isin);
  return liquidity_fmtDate(fv.date || fv.navDate || fv.valueDate || fallback);
}
function liquidity_liquidityInfo(area, key, isin, startDate) {
  const start = liquidity_localDate(startDate);
  if (!start) return null;
  const fv = liquidity_findFundValue(area, key, isin),
    rules = liquidity_fundRulesFromValue(fv);
  const taxReady = liquidity_addDays(liquidity_addMonths(start, rules.taxMonths), 1);
  const redemption = liquidity_nextRedemptionDate(taxReady, rules.redemptionFrequency);
  let payout = new Date(redemption);
  if (rules.settlementMonths > 0) payout = liquidity_endOfMonth(liquidity_addMonths(redemption, rules.settlementMonths));
  return {
    taxReady: liquidity_toIso(taxReady),
    redemption: liquidity_toIso(redemption),
    payout: liquidity_toIso(payout),
    rules
  };
}
function liquidity_liquidityNote(area, key, isin, startDate) {
  const info = liquidity_liquidityInfo(area, key, isin, startDate);
  if (!info) return '';
  return `Daňový test od ${liquidity_fmtDate(info.taxReady)} · odkup ${liquidity_freqLabel(info.rules.redemptionFrequency)} k ${liquidity_fmtDate(info.redemption)} · peníze nejpozději ${liquidity_fmtDate(info.payout)}`;
}
function liquidity_ready(info) {
  const d = liquidity_localDate(info?.redemption);
  if (!d) return false;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return d <= t;
}
function liquidity_liquidityBadge(info) {
  if (!info) return '<span class="chip">emise chybí</span>';
  return liquidity_ready(info) ? '<span class="badge green">odkup možný</span>' : `<span class="badge red">odkup od ${liquidity_fmtDate(info.redemption)}</span>`;
}
function liquidity_clientLiquidityStats(row) {
  let total = 0,
    readyCount = 0,
    next = '';
  (row?.items || []).forEach(item => liquidity_fkiRecordRows(row.client?.id, item.key).filter(r => !invIsWithdrawal(r)).forEach(r => {
    const info = liquidity_liquidityInfo('fki', item.key, invIsin(r) || item.isin, invEmissionDate(r));
    if (!info) return;
    total++;
    if (liquidity_ready(info)) readyCount++;else if (!next || String(info.redemption).localeCompare(next) < 0) next = info.redemption;
  }));
  return {
    total,
    readyCount,
    next
  };
}
function liquidity_redemptionAllocations(rows) {
  const buys = (rows || []).filter(r => !invIsWithdrawal(r)),
    outs = (rows || []).filter(r => invIsWithdrawal(r));
  const base = new Map(),
    used = new Map();
  buys.forEach(r => {
    const k = invRecordKey(r),
      cur = invCurrentValue(r) || invDeposit(r) || 0;
    base.set(k, Math.max(0, cur));
    used.set(k, 0);
  });
  outs.forEach(w => {
    let amount = invWithdrawalValue(w);
    const linked = w.redemptionSourceRecordKey || w['Odkup z nákupu'] || '';
    if (linked && used.has(linked)) {
      used.set(linked, (used.get(linked) || 0) + amount);
      return;
    }
    for (const b of buys) {
      if (amount <= 0) break;
      const k = invRecordKey(b),
        left = Math.max(0, (base.get(k) || 0) - (used.get(k) || 0));
      if (!left) continue;
      const part = Math.min(left, amount);
      used.set(k, (used.get(k) || 0) + part);
      amount -= part;
    }
  });
  return {
    redeemed: r => used.get(invRecordKey(r)) || 0,
    remaining: r => Math.max(0, (base.get(invRecordKey(r)) || 0) - (used.get(invRecordKey(r)) || 0))
  };
}
function liquidity_redemptionSourceLabel(r, i, remaining) {
  return `${r['Typ transakce'] || 'Platba'} #${i + 1} · ${money(invDeposit(r))} · emise ${liquidity_fmtDate(invEmissionDate(r))} · zbývá ${money(remaining)}`;
}
function liquidity_fillRedemptionSourceOptions(clientId, key, selected = '') {
  const el = liquidity_q('fkRecRedemptionSource');
  if (!el) return;
  const all = liquidity_fkiRecordRows(clientId, key),
    buys = all.filter(r => !invIsWithdrawal(r)),
    alloc = liquidity_redemptionAllocations(all);
  el.innerHTML = buys.map((r, i) => {
    const rk = invRecordKey(r);
    return `<option value="${esc(rk)}" ${String(selected) === String(rk) ? 'selected' : ''}>${esc(liquidity_redemptionSourceLabel(r, i, alloc.remaining(r)))}</option>`;
  }).join('') || '<option value="">Nejdřív musí existovat nákupová pozice</option>';
}
function liquidity_readRules(prefix) {
  return {
    taxMonths: liquidity_n(liquidity_valx(prefix + 'TaxMonths')) || liquidity_TAX_DEFAULT,
    redemptionFrequency: liquidity_valx(prefix + 'RedemptionFrequency') || 'quarterly',
    settlementMonths: liquidity_n(liquidity_valx(prefix + 'SettlementMonths')) || 0
  };
}
function liquidity_writeRules(prefix, fv) {
  const r = liquidity_fundRulesFromValue(fv);
  liquidity_set(prefix + 'TaxMonths', r.taxMonths);
  liquidity_set(prefix + 'RedemptionFrequency', r.redemptionFrequency);
  liquidity_set(prefix + 'SettlementMonths', r.settlementMonths);
}
function liquidity_selectedInvestmentKey() {
  const old = liquidity_valx('invFundSelect');
  return investmentFundKeyFromForm?.() || old;
}
function liquidity_selectedFkKey() {
  const old = liquidity_valx('fkFundSelect');
  return fkFundKeyFromForm?.() || old;
}
function liquidity_storeRules(area, key, isin, rules) {
  if (!key) return;
  state.fundValues = state.fundValues || {};
  const keys = new Set([key]);
  if (isin) Object.entries(state.fundValues).forEach(([k, v]) => {
    if (v?.area === area && norm(v.isin || '') === norm(isin)) keys.add(k);
  });
  keys.forEach(k => state.fundValues[k] = {
    ...(state.fundValues[k] || {}),
    area,
    ...rules
  });
}
function liquidity_investmentLiquidityRows(items) {
  const rows = (items || []).map(x => {
    const key = investmentFundKey(x),
      isin = x.isin || x.source?.isin || '',
      date = x.snapshot?.date || x.date || x.source?.date || '';
    const note = liquidity_liquidityNote('investice', key, isin, date);
    const info = liquidity_liquidityInfo('investice', key, isin, date);
    const valueDate = liquidity_fundValueDateText('investice', key, isin, x.snapshot?.date || x.source?.valueDate || x.source?.date || '');
    return note ? `<tr><td><b>${esc(x.product || 'Investice')}</b><br><span class="note">${esc(x.company || '')}</span></td><td>${liquidity_fmtDate(date)}</td><td>${valueDate}</td><td>${liquidity_liquidityBadge(info)}<br><span class="note">${esc(note)}</span></td></tr>` : '';
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="mini-card" style="margin-top:12px"><div class="eyebrow">Likvidita odkupu</div><h3>Daňový test a peníze na účtu</h3><div class="table-wrap"><table class="compact-table"><thead><tr><th>Fond</th><th>Datum nákupu</th><th>Hodnota fondu k datu</th><th>Informace pro klienta</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}
function liquidity_fkiRecordRows(clientId, key) {
  return investmentRecordsForClient(clientId).filter(r => invPositionKey(r) === key && isFkiReportRecord(r)).sort((a, b) => String(invEmissionDate(a) || invPaymentDate(a)).localeCompare(String(invEmissionDate(b) || invPaymentDate(b))));
}
function liquidity_fkiPositionRows(clientId, item) {
  const rows = liquidity_fkiRecordRows(clientId, item.key);
  const alloc = liquidity_redemptionAllocations(rows);
  return `<div class="table-wrap" style="margin-top:12px"><table class="compact-table"><thead><tr><th>Pozice / emise</th><th>Investováno</th><th>Aktuální</th><th>Výnos</th><th>Odkup / peníze</th><th>Akce</th></tr></thead><tbody>${rows.map((r, i) => {
    const isOut = invIsWithdrawal(r),
      redeemed = isOut ? 0 : alloc.redeemed(r),
      inv = isOut ? 0 : invDeposit(r),
      cur = isOut ? invWithdrawalValue(r) : alloc.remaining(r),
      gain = isOut ? invWithdrawalValue(r) : cur + redeemed - inv,
      issue = invEmissionDate(r),
      info = liquidity_liquidityInfo('fki', item.key, invIsin(r) || item.isin, issue),
      rd = liquidity_redemptionDatesForRecord('fki', item.key, invIsin(r) || item.isin, r),
      valueDate = liquidity_fundValueDateText('fki', item.key, invIsin(r) || item.isin, r['Poslední schválená hodnota do']),
      rk = liquidity_enc(invRecordKey(r));
    return `<tr><td><b>${esc(r['Typ transakce'] || 'Platba')} #${i + 1}</b><br><span class="note">Připsání ${liquidity_fmtDate(invPaymentDate(r))} · emise ${liquidity_fmtDate(issue)}</span></td><td class="money">${money(inv)}</td><td class="money">${money(cur)}<br><span class="note">k ${valueDate}</span></td><td class="money ${gain >= 0 ? 'green' : 'red'}">${isOut ? 'realizováno ' + money(gain) : money(gain)}</td><td>${isOut ? `<span class="badge green">odkup zadán</span><br><span class="note">zadán ${liquidity_fmtDate(rd.requested)} · realizace ${liquidity_fmtDate(rd.realized)} · peníze ${liquidity_fmtDate(rd.payout)}</span>` : `${liquidity_liquidityBadge(info)}<br><span class="note">${redeemed ? `odkoupeno ${money(redeemed)} · ` : ''}zbývá ${money(cur)} · test ${info ? liquidity_fmtDate(info.taxReady) : '-'} · peníze ${info ? liquidity_fmtDate(info.payout) : '-'}</span>`}</td><td><button class="btn slim" onclick="openFkRecordModal(${clientId},'${esc(liquidity_enc(item.key))}','${esc(rk)}')">Upravit</button></td></tr>`;
  }).join('') || '<tr><td colspan="6" class="note">Pod fondem není žádná konkrétní pozice.</td></tr>'}</tbody></table></div>`;
}
function liquidity_originalFkiCard(item, clientId) {
  const records = liquidity_fkiRecordRows(clientId, item.key),
    main = records.find(r => !invIsWithdrawal(r)) || records[0] || item.source || {},
    inv = records.reduce((s, r) => s + (invIsWithdrawal(r) ? 0 : invDeposit(r)), 0) || +item.invested || 0,
    realized = records.reduce((s, r) => s + (invIsWithdrawal(r) ? invWithdrawalValue(r) : 0), 0) || investmentRealizedAmount(item),
    cur = Math.max(0, records.reduce((s, r) => s + (invIsWithdrawal(r) ? -invWithdrawalValue(r) : invCurrentValue(r) || invDeposit(r) || 0), 0)) || +item.rawAmount || 0,
    gain = investmentPerformanceGain(cur, inv, realized),
    pct = investmentPerformancePct(cur, inv, realized),
    issue = invEmissionDate(main),
    info = liquidity_liquidityInfo('fki', item.key, item.isin || invIsin(main), issue),
    key = liquidity_enc(item.key),
    rk = liquidity_enc(invRecordKey(main));
  return `<details class="fki-work-card ${gain < 0 ? 'loss' : ''} ${item.locked ? 'locked' : ''}"><summary class="fki-work-head"><div class="fki-work-name"><b>${esc(cleanInvFundName(item.product || invFund(main), item.company))}</b><div class="chips"><span class="chip">${esc(item.company || invCompany(main) || '')}</span><span class="badge purple">FKI</span><span class="chip">${num(records.length)} pozic</span>${liquidity_liquidityBadge(info)}</div></div><div class="fki-work-metric"><small>Vloženo</small><strong>${money(inv)}</strong></div><div class="fki-work-metric"><small>Aktuální</small><strong class="${gain >= 0 ? 'green' : 'red'}">${money(cur)}</strong><small>k ${liquidity_fundValueDateText('fki', item.key, item.isin || invIsin(main), main['Poslední schválená hodnota do'])}</small></div><div class="fki-work-metric"><small>Výnos</small><strong class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</strong></div><div class="actions"><button class="btn slim primary" onclick="event.preventDefault();openInvestmentScenarioModal(${clientId},'FKI')">+ Dokup</button><button class="btn slim" onclick="event.preventDefault();openFkRecordModal(${clientId},'${esc(key)}','${esc(rk)}')">Upravit</button><button class="icon-btn ${item.locked ? 'primary' : ''}" onclick="event.preventDefault();toggleFkFundLock('${esc(key)}')" title="Zámek AUM">${item.locked ? '🔒' : '🔓'}</button></div></summary><div class="fki-work-detail"><div class="fki-detail-grid"><div><small>Investováno</small><b>${money(inv)}</b></div><div><small>Výnos</small><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div><small>Datum emise</small><b>${liquidity_fmtDate(issue)}</b></div><div><small>Hodnota fondu k datu</small><b>${liquidity_fundValueDateText('fki', item.key, item.isin || invIsin(main), main['Poslední schválená hodnota do'])}</b></div><div><small>Daňový test od</small><b>${info ? liquidity_fmtDate(info.taxReady) : '-'}</b></div><div><small>Odkup fondu</small><b class="${info ? liquidity_ready(info) ? 'green' : 'red' : ''}">${info ? liquidity_fmtDate(info.redemption) : '-'}</b></div><div><small>Peníze nejpozději</small><b>${info ? liquidity_fmtDate(info.payout) : '-'}</b></div><div><small>Frekvence</small><b>${info ? liquidity_freqLabel(info.rules.redemptionFrequency) : '-'}</b></div><div><small>Vypořádání</small><b>${info ? num(info.rules.settlementMonths) + ' měs.' : '-'}</b></div></div>${info ? `<div class="fki-timebar" style="--p:100%"><span>Emise</span><span></span><span>${liquidity_fmtDate(info.payout)}</span></div><div class="note">${esc(liquidity_liquidityNote('fki', item.key, item.isin || invIsin(main), issue))}</div>` : ''}${liquidity_fkiPositionRows(clientId, item)}</div></details>`;
}
function liquidity_redemptionDatesForRecord(area, key, isin, r) {
  const req = liquidity_isoDate(r?.redemptionRequestedDate || r?.['Odkup zadán'] || invPaymentDate(r) || r?.date);
  const issue = liquidity_isoDate(r?.redemptionSourceEmissionDate || r?.['Odkup z emise'] || invEmissionDate(r));
  const base = liquidity_liquidityInfo(area, key, isin, issue || req);
  const realized = liquidity_isoDate(r?.redemptionRealizedDate || r?.['Odkup realizován']) || (req && base ? liquidity_toIso(liquidity_nextRedemptionDate(liquidity_localDate(req), base.rules.redemptionFrequency)) : base?.redemption || '');
  const rules = base?.rules || liquidity_fundRulesFromValue(liquidity_findFundValue(area, key, isin));
  let payout = liquidity_isoDate(r?.redemptionPayoutDate || r?.['Peníze na účtu do']);
  if (!payout && realized) {
    let d = liquidity_localDate(realized);
    if (rules.settlementMonths > 0) d = liquidity_endOfMonth(liquidity_addMonths(d, rules.settlementMonths));
    payout = liquidity_toIso(d);
  }
  return {
    requested: req,
    realized,
    payout,
    sourceIssue: issue,
    rules
  };
}
function liquidity_fillRedemptionFields(r, key = '') {
  const dates = liquidity_redemptionDatesForRecord('fki', key, invIsin(r), r);
  const sourceKey = r.redemptionSourceRecordKey || r['Odkup z nákupu'] || '';
  liquidity_fillRedemptionSourceOptions(liquidity_fkModalClientId, key, sourceKey);
  liquidity_set('fkRecRedemptionSource', sourceKey);
  liquidity_set('fkRecRedemptionRequested', dates.requested);
  liquidity_set('fkRecRedemptionRealized', dates.realized);
  liquidity_set('fkRecRedemptionPayout', dates.payout);
}
function liquidity_saveRedemptionRecord() {
  const client = findClient(liquidity_fkModalClientId || selectedFkClientId || selectedClientId);
  if (!client) return alert('Vyber klienta.');
  const fund = liquidity_valx('fkRecFund').trim(),
    company = liquidity_valx('fkRecCompany').trim() || 'Nezařazeno',
    isin = liquidity_valx('fkRecIsin').trim(),
    typ = liquidity_valx('fkRecType').trim(),
    amount = liquidity_n(liquidity_valx('fkRecCurrent')) || liquidity_n(liquidity_valx('fkRecDeposit'));
  if (!fund) return alert('Vyplň fond.');
  if (!amount) return alert('Vyplň částku odkupu do pole Aktuální hodnota nebo Čistá investice.');
  const req = liquidity_valx('fkRecRedemptionRequested') || liquidity_valx('fkRecPaymentDate') || today(),
    real = liquidity_valx('fkRecRedemptionRealized'),
    pay = liquidity_valx('fkRecRedemptionPayout'),
    issue = liquidity_valx('fkRecEmissionDate') || req,
    sourceKey = liquidity_valx('fkRecRedemptionSource') || liquidity_fkRedemptionSourceKey;
  const rec = {
    'Investor': clientName(client),
    'RČ': client.birthId || '',
    'Datum narození': liquidity_valx('fkRecBirthDate') || '',
    'ClientID': client.birthId ? 'RC_' + normalizeStrongId(client.birthId) : String(client.id),
    'Fond': fund,
    'Investiční společnost': company,
    'Typ produktu': liquidity_valx('fkRecProduct').trim() || 'FKI',
    'Typ transakce': 'Odkup',
    'Čistá investice': amount,
    'Aktuální hodnota investice': amount,
    'Počet vydaných CP': liquidity_n(liquidity_valx('fkRecQty')),
    'Upisovací hodnota': liquidity_n(liquidity_valx('fkRecSubscribe')),
    'Datum připsání platby': req,
    'Datum emise': issue,
    'Poslední schválená hodnota CP': liquidity_n(liquidity_valx('fkRecNav')) || null,
    'Poslední schválená hodnota do': liquidity_valx('fkRecNavDate') || today(),
    'rp.ISIN': isin,
    'Typ CP': typ,
    'Pravidelná investice': liquidity_valx('fkRecRegular') || 'Jednorázové',
    'Pravidelná částka': liquidity_n(liquidity_valx('fkRecRegularAmount')),
    'Den v měsíci': liquidity_n(liquidity_valx('fkRecRegularDay')),
    'Poznámka': liquidity_valx('fkRecNote').trim(),
    redemptionRequestedDate: req,
    redemptionRealizedDate: real,
    redemptionPayoutDate: pay,
    redemptionSourceEmissionDate: issue,
    redemptionSourceRecordKey: sourceKey,
    'Odkup zadán': req,
    'Odkup realizován': real,
    'Peníze na účtu do': pay,
    'Odkup z emise': issue,
    'Odkup z nákupu': sourceKey,
    _source: 'local-fki',
    _updatedAt: today()
  };
  const idx = liquidity_fkModalRecordKey ? (state.investmentRecords || []).findIndex(r => invRecordKey(r) === liquidity_fkModalRecordKey) : -1;
  if (idx >= 0) state.investmentRecords[idx] = {
    ...state.investmentRecords[idx],
    ...rec
  };else state.investmentRecords.push(rec);
  dedupeInvestmentRecordsInState(state);
  selectedFkClientId = client.id;
  selectedClientId = client.id;
  addActivity(client.id, 'FKI', 'Zadán odkup: ' + fund + ' · ' + money(amount), true);
  closeModal('fkRecordModal');
  persist();
  renderAll();
  saveToast('Odkup uložen jako samostatný záznam');
}
function fundPerformance_n(v) {
  return typeof parseMoney === 'function' ? parseMoney(v) || 0 : +v || 0;
}
function fundPerformance_d(v) {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const cz = String(v).match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/);
  if (cz) return new Date(+cz[3], +cz[2] - 1, +cz[1]);
  const x = new Date(v);
  return isNaN(x) ? null : x;
}
function fundPerformance_yearsBetween(start, end) {
  const a = fundPerformance_d(start),
    b = fundPerformance_d(end) || new Date();
  if (!a || !b || b <= a) return 0;
  return Math.max((b - a) / 31557600000, 1 / 365);
}
function fundPerformance_annualizedPct(invested, current, realized, start, end) {
  invested = +invested || 0;
  const final = (+current || 0) + (+realized || 0);
  if (invested <= 0 || final <= 0) return null;
  const y = fundPerformance_yearsBetween(start, end);
  return (Math.pow(final / invested, 1 / y) - 1) * 100;
}
function fundPerformance_pctText(v) {
  return v === null || !isFinite(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1) + ' %';
}
function fundPerformance_fundValueBy(area, key, isin) {
  const direct = state.fundValues?.[key];
  if (direct) return direct;
  const wanted = norm(isin || '');
  if (!wanted) return {};
  return Object.values(state.fundValues || {}).find(x => (!area || x?.area === area) && norm(x?.isin || '') === wanted) || {};
}
function fundPerformance_fundComment(area, key, isin) {
  const fv = fundPerformance_fundValueBy(area, key, isin);
  return String(fv.comment || fv.reportComment || fv.note || fundPerformance_defaultFundComment(area, key, isin, fv)).trim();
}
function fundPerformance_defaultFundComment(area, key, isin, fv = {}) {
  const hay = norm([isin, key, fv.isin, fv.fond, fv.product, fv.company, fv.typ].filter(Boolean).join(' '));
  const rows = [[['cz0008043445', 'r2p invest'], 'Fond investuje do portfolií pohledávek, tedy do dluhů, které nakupuje levněji a následně je spravuje přes zkušené inkasní partnery. Jednoduše: klient se podílí na byznysu, kde se z problémových dluhů snaží udělat výnosná investice.'], [['cz0008043569', 'vihorev'], 'Fond investuje do rezidenčních a investičních nemovitostí, které skupina sama vyhledává, staví a spravuje. Jednoduše: klient se podílí na realitních projektech od nákupu až po dokončení a provoz.'], [['cz0008044880', 'realia fund', 'retail parks'], 'Fond investuje do retail parků, tedy obchodních areálů s nájemci pro každodenní nákupy. Jednoduše: klient se podílí na nájmech z obchodů, kam lidé chodí běžně nakupovat.'], [['cz0008043700', 'csnf sicav'], 'Fond se zaměřuje na rezidenční nemovitosti, hlavně výstavbu a následný prodej bydlení v dostupných lokalitách. Jednoduše: klient se podílí na projektech, kde se staví bydlení pro rodiny.'], [['cz0008051877', 'cz0008047263', 'csef aqua', 'čsef aqua'], 'Fond investuje do energetiky a vodního hospodářství. Jednoduše: klient se podílí na infrastruktuře, kterou lidé a firmy potřebují každý den.'], [['cz0008044195', 'aguila'], 'Fond poskytuje úvěry firmám, které jsou zajištěné nemovitostmi. Jednoduše: klient pomáhá financovat projekty, kde za půjčenými penězi stojí nemovitost jako zajištění.'], [['cz0008044179', 'domus'], 'Fond investuje do pohledávek zajištěných nemovitostmi a do nemovitostních příležitostí z trhu. Jednoduše: klient se podílí na projektech, kde se problémová nemovitost nebo pohledávka mění na hodnotu.'], [['cz0008042645', 'spilberk'], 'Fond financuje projekty a společnosti navázané na skupinu SPILBERK, zejména v oblasti nemovitostí. Jednoduše: klient se podílí na financování realitních projektů s předem nastaveným výnosovým modelem.'], [['cz0008050580', 'real luxembourg'], 'Fond nakupuje hlavně činžovní domy a nemovitosti, které umí zhodnotit a následně prodat. Jednoduše: klient se podílí na proměně domů na hodnotnější nemovitosti.'], [['cz0008053014', 'ebm residential'], 'Fond investuje do rezidenčního developmentu a nemovitostních projektů skupiny EBM. Jednoduše: klient se podílí na výstavbě a rozvoji kvalitního bydlení.'], [['cz1005202133', 'jrd eco living'], 'Fond investuje do moderního a úsporného bydlení s ekologickým přesahem. Jednoduše: klient se podílí na bydlení, které má být šetrnější, modernější a dlouhodobě udržitelné.'], [['cz0008053147', 'opc real estate', 'retail real estate'], 'Fond je zaměřený na retailové nemovitosti, tedy prostory využívané obchody a službami. Jednoduše: klient se podílí na nemovitostech, které vydělávají hlavně z nájmů obchodníků.'], [['cz0008045135', 'gartal'], 'Fond financuje vybrané projekty developerské skupiny GARTAL formou půjček s pevným úrokem. Jednoduše: klient nepodstupuje přímo celé developerské riziko, ale podílí se na financování projektů skupiny.'], [['cz0008046372', 'adax'], 'Fond investuje do malých a středních firem, hlavně v Česku a na Slovensku, kde řeší růst nebo generační výměnu. Jednoduše: klient se podílí na firmách, které mají potenciál dál růst.'], [['cz0008473139', 'atris realita'], 'Fond investuje do nemovitostí a nemovitostních aktiv s cílem stabilního dlouhodobého výnosu. Jednoduše: klient se podílí na velkém portfoliu nemovitostí, které vydělává hlavně nájmem a růstem hodnoty.'], [['cz0008477551', 'wood', 'realitni opf'], 'Fond investuje do komerčních nemovitostí v Česku, Polsku a na Slovensku, například kanceláří, retailu, logistiky nebo rezidenčních projektů. Jednoduše: klient se podílí na velkých realitních projektech, na které by sám běžně nedosáhl.'], [['cz0008477601', 'life balancovany'], 'Fond kombinuje akciové a dluhopisové strategie J&T v jednom vyváženém řešení. Jednoduše: klient má jednu investici, která se snaží růst, ale zároveň držet rozumnější míru kolísání.'], [['cz0008477593', 'life dynamicky'], 'Fond má větší zaměření na akciové investice a dlouhodobý růst majetku. Jednoduše: klient investuje odvážněji, s cílem vyššího výnosu za delší dobu.'], [['cz0008473634', 'bond a czk'], 'Fond investuje hlavně do podnikových a státních dluhopisů. Jednoduše: klient půjčuje peníze firmám a státům přes fond a dostává se k širokému dluhopisovému portfoliu.'], [['cz0008478187', 'nextgen', 'next gen'], 'Fond vyhledává světové investiční příležitosti, hlavně akcie firem s růstovým potenciálem. Jednoduše: klient se podílí na firmách nové generace, které mohou v dalších letech růst.'], [['mt7000024857', 'rentier'], 'Fond je smíšené řešení kombinující různé typy aktiv pro dlouhodobé budování majetku. Jednoduše: klient má rozloženou investici, která má pomáhat tvořit kapitál do budoucna.'], [['cz0008053642', 'penta equity'], 'Fond investuje do skupiny Penta a jejích firemních projektů. Jednoduše: klient se podílí na růstu velké investiční skupiny a firem, které vlastní nebo rozvíjí.'], [['penta real estate', 'penta re'], 'Fond investuje do realitních projektů skupiny Penta, hlavně do nemovitostí, které mají vydělávat nájmem nebo růstem hodnoty. Jednoduše: klient se podílí na velkých realitních projektech silné investiční skupiny.'], [['pffl', 'pffl i.podfond'], 'Fond je zaměřený na nemovitostní nebo projektové financování v rámci privátního investičního řešení. Jednoduše: klient se podílí na fondu, který dává peníze do vybraných projektů s cílem pravidelného zhodnocení.'], [['zdrr', 'zdr investments', 'zdr retail real estate'], 'Fond investuje do retailových nemovitostí a obchodních parků, které vydělávají hlavně z nájmů. Jednoduše: klient se podílí na obchodech a službách, kam lidé běžně chodí nakupovat.'], [['cz0008048162', 'silverline real estate'], 'Fond investuje do realitních projektů s preferovaným výnosem pro investory podle zvolené třídy akcií. Jednoduše: klient se podílí na nemovitostech, kde fond hledá výnos z projektů a růstu hodnoty.'], [['cz1005202968', 'cz1005202968', 'fidurock retail parks'], 'Fond investuje do retail parků v Česku a na Slovensku, tedy do míst pro běžné každodenní nákupy. Jednoduše: klient se podílí na obchodních areálech, které lidé pravidelně využívají.'], [['edward'], 'Edward je moderní investiční platforma pro správu a plánování klientského portfolia. Jednoduše: klient přes jedno řešení rozkládá peníze do více investičních nástrojů a může investici řídit v čase.'], [['vigo public', 'vigo', 'direct pro'], 'Vigo Public je retailový fond navázaný na Direct PRO, který zpřístupňuje investici i běžným klientům. Jednoduše: klient se dostává k řešení, které by jinak bylo dostupné hlavně pro kvalifikované investory.'], [['cz0008044385', 'fckd', 'fčkd'], 'FČKD je dluhopisově zaměřené FKI navázané na zkušenosti týmu kolem Dluhopisáře. Jednoduše: klient se podílí na portfoliu dluhopisových příležitostí, kde je hlavní myšlenkou půjčování kapitálu za výnos.'], [['cz0008049020', 'koor esg'], 'Fond investuje do projektu SeniorGarden v Pardubicích-Dražkovicích, který propojuje bydlení a péči pro seniory. Jednoduše: klient se podílí na zařízení, které má vydělávat a zároveň pomáhat lidem ve stáří.'], [['cz0008049293', 'care esg', 'seniorcare', 'senior care'], 'ESG SeniorCARE je fond zaměřený na zdravotně-sociální péči a nemovitosti pro seniory. Jednoduše: klient se podílí na provozu a zázemí služeb, které budou lidé s rostoucím věkem stále víc potřebovat.'], [['cz0008045374', '1frh', 'reverznich hypotek', 'reverzních hypoték'], '1. fond reverzních hypoték investuje do řešení, kde senioři získají peníze výměnou za budoucí vypořádání hodnoty nemovitosti. Jednoduše: klient se podílí na financování seniorů přes nemovitosti, které slouží jako zajištění.'], [['cz0008052529', 'julius meinl'], 'Fond dává peníze do skupiny Julius Meinl Living, která vlastní a provozuje luxusní hotelové/apartmánové domy ve velkých evropských městech. Jednoduše: klient se podílí na byznysu s krásným ubytováním pro cestující.']];
  const found = rows.find(([keys]) => keys.some(k => hay.includes(norm(k))));
  return found ? found[1] : '';
}
function fundPerformance_defaultFundExpectedRate(area, key, isin, fv = {}) {
  const hay = norm([isin, key, fv.isin, fv.fond, fv.product, fv.company, fv.typ].filter(Boolean).join(' '));
  const rows = [[['cz0008043445', 'r2p invest'], 9], [['cz0008043569', 'vihorev'], 8], [['cz0008044880', 'realia fund', 'retail parks'], 8], [['cz0008043700', 'csnf sicav'], null], [['cz0008051877', 'cz0008047263', 'csef aqua', 'čsef aqua'], 8], [['cz0008044195', 'aguila'], 7], [['cz0008044179', 'domus'], 8], [['cz0008042645', 'spilberk'], 7], [['cz0008050580', 'real luxembourg'], 10], [['cz0008053014', 'ebm residential'], 10], [['cz1005202133', 'jrd eco living'], 10], [['cz0008053147', 'opc real estate', 'retail real estate'], 11], [['cz0008045135', 'gartal'], 7], [['cz0008046372', 'adax'], 12], [['cz0008473139', 'atris realita'], 5.5], [['cz0008477551', 'wood', 'realitni opf'], 8], [['cz0008477601', 'life balancovany'], 8], [['cz0008477593', 'life dynamicky'], 10], [['cz0008473634', 'bond a czk'], 5], [['cz0008478187', 'nextgen', 'next gen'], 11], [['mt7000024857', 'rentier'], 10], [['cz0008053642', 'penta equity'], 10], [['penta real estate', 'penta re'], 10], [['pffl', 'pffl i.podfond'], 7], [['zdrr', 'zdr investments', 'zdr retail real estate'], 8], [['cz0008048154', 'silverline podfond re', 'silverline re'], 10], [['cz0008048162', 'silverline real estate', 'silverline fund sicav'], 12], [['cz1005202968', 'fidurock retail parks'], 8], [['edward'], 5], [['vigo public', 'vigo', 'direct pro'], 8], [['cz0008044385', 'fckd', 'fčkd'], 6], [['cz0008049020', 'koor esg'], 11], [['cz0008049293', 'care esg', 'seniorcare', 'senior care'], 7], [['cz0008045374', '1frh', 'reverznich hypotek', 'reverzních hypoték'], 6], [['cz0008052529', 'julius meinl'], 13]];
  const found = rows.find(([keys]) => keys.some(k => hay.includes(norm(k))));
  if (!found || found[1] === null) return {};
  const rate = found[1];
  return {
    expectedRate: rate,
    rate,
    minRate: Math.max(0, rate - 2),
    maxRate: rate + 2
  };
}
function fundPerformance_applyDefaultFundComments() {
  if (!state || !state.fundValues) return;
  let changed = 0;
  Object.entries(state.fundValues).forEach(([key, fv]) => {
    if (fv?.comment || fv?.reportComment || fv?.note) return;
    const comment = fundPerformance_defaultFundComment(fv?.area, key, fv?.isin, fv);
    if (!comment) return;
    state.fundValues[key] = {
      ...fv,
      comment
    };
    changed++;
  });
  if (changed) persist();
}
function fundPerformance_applyApprovedFundExpectedRates() {
  const marker = '2026.09.09-8';
  if (!state || !state.fundValues || state._fundExpectedRatesAppliedVersion === marker) return;
  let changed = 0;
  Object.entries(state.fundValues).forEach(([key, fv]) => {
    const defs = fundPerformance_defaultFundExpectedRate(fv?.area, key, fv?.isin, fv);
    if (!defs.expectedRate) return;
    state.fundValues[key] = {
      ...fv,
      expectedRate: defs.expectedRate,
      rate: defs.rate,
      minRate: defs.minRate,
      maxRate: defs.maxRate
    };
    changed++;
  });
  state._fundExpectedRatesAppliedVersion = marker;
  if (changed) persist();
}
function fundPerformance_storeFundComment(area, key, isin, comment) {
  state.fundValues = state.fundValues || {};
  const keys = new Set([key].filter(Boolean));
  if (isin) Object.entries(state.fundValues).forEach(([k, v]) => {
    if ((!area || v?.area === area) && norm(v?.isin || '') === norm(isin)) keys.add(k);
  });
  keys.forEach(k => state.fundValues[k] = {
    ...(state.fundValues[k] || {}),
    area: state.fundValues[k]?.area || area,
    comment
  });
}
function fundPerformance_classicGroups(items) {
  const map = {};
  (items || []).forEach(x => {
    const key = investmentFundKey(x),
      raw = typeof investmentFundRawKey === 'function' ? investmentFundRawKey(x) : key,
      fv = state.fundValues?.[key] || state.fundValues?.[raw] || {},
      company = fv.company || x.company || 'Nezařazeno',
      product = fv.fond || x.product || x.kind || 'Investice',
      label = investmentFundLabel({
        company,
        product
      });
    if (!map[key]) map[key] = {
      key,
      label,
      company,
      product,
      isin: fv.isin || x.isin || '',
      typ: fv.typ || x.typ || x.kind || investmentFundProductType(x),
      amount: 0,
      invested: 0,
      realized: 0,
      items: []
    };
    map[key].amount += +x.amount || 0;
    map[key].invested += investmentInvestedAmount(x);
    map[key].realized += investmentRealizedAmount(x);
    map[key].items.push(x);
  });
  return Object.values(map).sort((a, b) => b.amount - a.amount);
}
function fundPerformance_classicPositionRows(f, clientId) {
  return `<div class="table-wrap" style="margin-top:12px"><table class="compact-table"><thead><tr><th>Pozice / záznam</th><th>Vloženo</th><th>Aktuální</th><th>Celkový výnos</th><th>Výnos p.a.</th><th>Datum</th><th>Zdroj</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${(f.items || []).sort((a, b) => String(b.snapshot?.date || b.date || '').localeCompare(String(a.snapshot?.date || a.date || ''))).map((x, i) => {
    const put = investmentInvestedAmount(x),
      cur = +x.amount || 0,
      realized = investmentRealizedAmount(x),
      gain = investmentPerformanceGain(cur, put, realized),
      pct = investmentPerformancePct(cur, put, realized),
      start = x.date || x.snapshot?.purchaseDate || x.snapshot?.date || '',
      valueDate = typeof fundValueDateText === 'function' ? fundValueDateText('investice', f.key, x.isin, x.snapshot?.date || x.source?.valueDate || x.source?.date || '') : x.snapshot?.date || x.date || '',
      pa = fundPerformance_annualizedPct(put, cur, realized, start, valueDate || new Date());
    return `<tr><td><b>${esc(x.product || x.kind || 'Investice')} #${i + 1}</b><br><span class="note">${esc([x.company, x.isin, x.typ || x.kind].filter(Boolean).join(' · '))}</span></td><td class="money">${money(put)}</td><td class="money">${money(cur)}<br><span class="note">k ${esc(valueDate || '-')}</span></td><td class="money ${gain >= 0 ? 'green' : 'red'}">${money(gain)}<br><span>${pct.toFixed(1)} %</span></td><td class="money ${pa === null || pa >= 0 ? 'green' : 'red'}">${fundPerformance_pctText(pa)}</td><td>${esc(x.snapshot?.date || x.date || '')}</td><td>${esc(x.snapshot?.source || x.sourceType || 'CRM')}</td><td>${typeof invStatus === 'function' ? invStatus(x) : ''}</td><td>${typeof invRowAction === 'function' ? invRowAction(x, clientId) : ''}</td></tr>`;
  }).join('') || '<tr><td colspan="9" class="note">Pod fondem není žádná pozice.</td></tr>'}</tbody></table></div>`;
}
function fundPerformance_classicCard(f, clientId) {
  const gain = investmentPerformanceGain(f.amount, f.invested, f.realized),
    pct = investmentPerformancePct(f.amount, f.invested, f.realized),
    key = encodeURIComponent(String(f.key || '')),
    fv = state.fundValues?.[f.key] || {},
    valueDate = typeof fundValueDateText === 'function' ? fundValueDateText('investice', f.key, f.isin, fv.date) : fv.date || '',
    locked = isInvestmentFundLocked(f.key),
    comment = fundPerformance_fundComment('investice', f.key, f.isin);
  return `<details class="fki-work-card ${gain < 0 ? 'loss' : ''} ${locked ? 'locked' : ''}"><summary class="fki-work-head"><div class="fki-work-name"><b>${esc(f.label)}</b><div class="chips"><span class="chip">${esc(f.company)}</span><span class="badge blue">Investice</span><span class="chip">${num(f.items.length)} pozic</span>${locked ? '<span class="badge orange">zamčeno</span>' : ''}</div></div><div class="fki-work-metric"><small>Vloženo</small><strong>${money(f.invested)}</strong></div><div class="fki-work-metric"><small>Aktuální</small><strong class="${gain >= 0 ? 'green' : 'red'}">${money(f.amount)}</strong><small>k ${esc(valueDate || '-')}</small></div><div class="fki-work-metric"><small>Výnos celkem</small><strong class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</strong></div><div class="actions"><button class="btn slim primary" onclick="event.preventDefault();openInvestmentScenarioModal(${clientId},'Investice')">+ Nová investice</button><button class="btn slim" onclick="event.preventDefault();openInvestmentSnapshotModal(${clientId},'${esc(encodeURIComponent(String(clientId) + '|' + f.key))}')">Hodnota</button><button class="btn slim" onclick="event.preventDefault();openInvestmentFundModal('${esc(key)}')">Fond</button><button class="icon-btn ${locked ? 'primary' : ''}" onclick="event.preventDefault();toggleInvestmentFundLock('${esc(key)}')" title="Zámek reportu">${locked ? '🔒' : '🔓'}</button></div></summary><div class="fki-work-detail"><div class="fki-detail-grid"><div><small>Investováno</small><b>${money(f.invested)}</b></div><div><small>Výnos Kč</small><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div><small>Celkový výnos</small><b class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</b></div><div><small>Hodnota CP / NAV</small><b>${fv.nav ? num(fv.nav) : '-'}</b></div><div><small>Hodnota fondu k datu</small><b>${esc(valueDate || '-')}</b></div><div><small>ISIN</small><b>${esc(f.isin || '-')}</b></div><div><small>Typ</small><b>${esc(f.typ || '-')}</b></div><div><small>Pozic</small><b>${num(f.items.length)}</b></div></div>${comment ? `<div class="notice small"><b>Komentář fondu:</b> ${esc(comment)}</div>` : ''}${fundPerformance_classicPositionRows(f, clientId)}</div></details>`;
}
function fundPerformance_fkiRowsFor(clientId, key) {
  return (typeof investmentRecordsForClient === 'function' ? investmentRecordsForClient(clientId) : []).filter(r => invPositionKey(r) === key && isFkiReportRecord(r)).sort((a, b) => String(invEmissionDate(a) || invPaymentDate(a)).localeCompare(String(invEmissionDate(b) || invPaymentDate(b))));
}
function fundPerformance_redemptionSummary(rows) {
  const used = new Map(),
    buys = rows.filter(r => !invIsWithdrawal(r));
  buys.forEach(r => used.set(invRecordKey(r), 0));
  rows.filter(invIsWithdrawal).forEach(w => {
    let amount = typeof invWithdrawalValue === 'function' ? invWithdrawalValue(w) : Math.abs(invCurrentValue(w));
    const linked = w.redemptionSourceRecordKey || w['Odkup z nákupu'] || '';
    if (linked && used.has(linked)) {
      used.set(linked, (used.get(linked) || 0) + amount);
      return;
    }
    for (const b of buys) {
      if (amount <= 0) break;
      const k = invRecordKey(b),
        left = Math.max(0, (invCurrentValue(b) || invDeposit(b) || 0) - (used.get(k) || 0));
      const part = Math.min(left, amount);
      used.set(k, (used.get(k) || 0) + part);
      amount -= part;
    }
  });
  return r => used.get(invRecordKey(r)) || 0;
}
function fundPerformance_fkiPositionRowsPa(clientId, item) {
  const rows = fundPerformance_fkiRowsFor(clientId, item.key),
    redeemedFor = fundPerformance_redemptionSummary(rows);
  return `<div class="table-wrap" style="margin-top:12px"><table class="compact-table"><thead><tr><th>Pozice / emise</th><th>Investováno</th><th>Aktuální</th><th>Celkový výnos</th><th>Výnos p.a.</th><th>Odkup / peníze</th><th>Akce</th></tr></thead><tbody>${rows.map((r, i) => {
    const isOut = invIsWithdrawal(r),
      redeemed = isOut ? 0 : redeemedFor(r),
      inv = isOut ? 0 : invDeposit(r),
      cur = isOut ? typeof invWithdrawalValue === 'function' ? invWithdrawalValue(r) : Math.abs(invCurrentValue(r)) : Math.max(0, (invCurrentValue(r) || invDeposit(r) || 0) - redeemed),
      gain = isOut ? cur : cur + redeemed - inv,
      issue = invEmissionDate(r),
      valueDate = typeof fundValueDateText === 'function' ? fundValueDateText('fki', item.key, invIsin(r) || item.isin, r['Poslední schválená hodnota do']) : r['Poslední schválená hodnota do'] || '',
      pa = isOut ? null : fundPerformance_annualizedPct(inv, cur, redeemed, issue || invPaymentDate(r), valueDate || new Date()),
      info = typeof liquidityInfo === 'function' ? liquidityInfo('fki', item.key, invIsin(r) || item.isin, issue) : null,
      rk = encodeURIComponent(invRecordKey(r));
    return `<tr><td><b>${esc(r['Typ transakce'] || 'Platba')} #${i + 1}</b><br><span class="note">Připsání ${esc(invPaymentDate(r) || '-')} · emise ${esc(issue || '-')}</span></td><td class="money">${money(inv)}</td><td class="money">${money(cur)}<br><span class="note">k ${esc(valueDate || '-')}</span></td><td class="money ${gain >= 0 ? 'green' : 'red'}">${isOut ? 'realizováno ' + money(gain) : money(gain)}</td><td class="money ${pa === null || pa >= 0 ? 'green' : 'red'}">${fundPerformance_pctText(pa)}</td><td>${isOut ? '<span class="badge green">odkup zadán</span>' : `${typeof liquidityBadge === 'function' ? liquidityBadge(info) : ''}<br><span class="note">${redeemed ? `odkoupeno ${money(redeemed)} · ` : ''}zbývá ${money(cur)}</span>`}</td><td><button class="btn slim" onclick="openFkRecordModal(${clientId},'${esc(encodeURIComponent(item.key))}','${esc(rk)}')">Upravit</button></td></tr>`;
  }).join('') || '<tr><td colspan="7" class="note">Pod fondem není žádná konkrétní pozice.</td></tr>'}</tbody></table></div>`;
}
function fundPerformance_fkiCardPa(item, clientId) {
  const rows = fundPerformance_fkiRowsFor(clientId, item.key),
    main = rows.find(r => !invIsWithdrawal(r)) || rows[0] || item.source || {},
    inv = rows.reduce((s, r) => s + (invIsWithdrawal(r) ? 0 : invDeposit(r)), 0) || +item.invested || 0,
    realized = rows.reduce((s, r) => s + (invIsWithdrawal(r) ? typeof invWithdrawalValue === 'function' ? invWithdrawalValue(r) : Math.abs(invCurrentValue(r)) : 0), 0) || investmentRealizedAmount(item),
    cur = Math.max(0, rows.reduce((s, r) => s + (invIsWithdrawal(r) ? -(typeof invWithdrawalValue === 'function' ? invWithdrawalValue(r) : Math.abs(invCurrentValue(r))) : invCurrentValue(r) || invDeposit(r) || 0), 0)) || +item.rawAmount || 0,
    gain = investmentPerformanceGain(cur, inv, realized),
    pct = investmentPerformancePct(cur, inv, realized),
    issue = invEmissionDate(main),
    info = typeof liquidityInfo === 'function' ? liquidityInfo('fki', item.key, item.isin || invIsin(main), issue) : null,
    key = encodeURIComponent(item.key),
    comment = fundPerformance_fundComment('fki', item.key, item.isin || invIsin(main)),
    valueDate = typeof fundValueDateText === 'function' ? fundValueDateText('fki', item.key, item.isin || invIsin(main), main['Poslední schválená hodnota do']) : '';
  return `<details class="fki-work-card ${gain < 0 ? 'loss' : ''} ${item.locked ? 'locked' : ''}"><summary class="fki-work-head"><div class="fki-work-name"><b>${esc(cleanInvFundName(item.product || invFund(main), item.company))}</b><div class="chips"><span class="chip">${esc(item.company || invCompany(main) || '')}</span><span class="badge purple">FKI</span><span class="chip">${num(rows.length)} pozic</span>${typeof liquidityBadge === 'function' ? liquidityBadge(info) : ''}</div></div><div class="fki-work-metric"><small>Vloženo</small><strong>${money(inv)}</strong></div><div class="fki-work-metric"><small>Aktuální</small><strong class="${gain >= 0 ? 'green' : 'red'}">${money(cur)}</strong><small>k ${esc(valueDate || '-')}</small></div><div class="fki-work-metric"><small>Výnos celkem</small><strong class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</strong></div><div class="actions"><button class="btn slim primary" onclick="event.preventDefault();openInvestmentScenarioModal(${clientId},'FKI')">+ Dokup</button><button class="btn slim" onclick="event.preventDefault();openFkRecordModal(${clientId},'${esc(key)}','${esc(encodeURIComponent(invRecordKey(main)))}')">Upravit</button><button class="icon-btn ${item.locked ? 'primary' : ''}" onclick="event.preventDefault();toggleFkFundLock('${esc(key)}')" title="Zámek AUM">${item.locked ? '🔒' : '🔓'}</button></div></summary><div class="fki-work-detail"><div class="fki-detail-grid"><div><small>Investováno</small><b>${money(inv)}</b></div><div><small>Výnos Kč</small><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div><small>Celkový výnos</small><b class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</b></div><div><small>Datum emise</small><b>${esc(issue || '-')}</b></div><div><small>Hodnota fondu k datu</small><b>${esc(valueDate || '-')}</b></div><div><small>ISIN</small><b>${esc(item.isin || invIsin(main) || '-')}</b></div></div>${comment ? `<div class="notice small"><b>Komentář fondu:</b> ${esc(comment)}</div>` : ''}${fundPerformance_fkiPositionRowsPa(clientId, item)}</div></details>`;
}
function fundPerformance_scenarioSeries(rateKind) {
  const years = Math.max(1, fundPerformance_n(val('scenarioYears')) || 10),
    rows = investmentScenario?.rows || [],
    currentClient = val('scenarioClient') ? findClient(+val('scenarioClient')) : null,
    portfolio = currentClient && typeof clientDisplayInvestmentItems === 'function' ? clientDisplayInvestmentItems(currentClient.id) : [],
    current = portfolio.reduce((s, x) => s + (+x.amount || 0), 0);
  let vals = rows.map(r => fundPerformance_n(r.amount)),
    series = [current];
  for (let y = 1; y <= years; y++) {
    vals = vals.map((v, i) => {
      const r = rows[i],
        rate = rateKind === 'min' ? r.minRate ?? r.rate : rateKind === 'max' ? r.maxRate ?? r.rate : r.rate;
      let next = v * (1 + fundPerformance_n(rate) / 100);
      if (fundPerformance_n(r.topupYear) === y) next += fundPerformance_n(r.topupAmount);
      if (fundPerformance_n(r.dropYear) === y) next *= Math.max(0, 1 - fundPerformance_n(r.dropPct) / 100);
      return next;
    });
    series.push(current + vals.reduce((s, v) => s + v, 0));
  }
  return {
    labels: Array.from({
      length: years + 1
    }, (_, i) => i ? `${i}. rok` : 'Dnes'),
    current,
    series
  };
}
function fundPerformance_renderScenarioRange() {
  let host = byId('scenarioRangeBlock');
  const anchor = byId('scenarioAdvancedControls') || byId('scenarioSelectedFunds');
  if (!anchor) return;
  if (!host) {
    anchor.insertAdjacentHTML('afterend', '<div id="scenarioRangeBlock" class="mini-card scenario-range-block" style="margin-top:12px"><div class="toolbar"><div><div class="eyebrow">Rozptyl výnosu</div><h3>Minimální, očekávaný a maximální scénář</h3><div class="note">Pásmo ukazuje reálnější rozsah podle min/max p.a. u přidaných fondů.</div></div></div><div id="scenarioRangeTable"></div><div class="chart-wrap scenario-range-chart-wrap"><canvas id="scenarioRangeChart"></canvas></div><div id="scenarioRangeFallback" class="note"></div></div>');
    host = byId('scenarioRangeBlock');
  }
  const rows = investmentScenario?.rows || [],
    fallback = byId('scenarioRangeFallback');
  if (!rows.length) {
    if (window.scenarioRangeChartInstance) {
      window.scenarioRangeChartInstance.destroy();
      window.scenarioRangeChartInstance = null;
    }
    const tbl = byId('scenarioRangeTable');
    if (tbl) tbl.innerHTML = '<p class="note">Přidej alespoň jeden fond a CRM dopočítá minimální, očekávaný a maximální scénář.</p>';
    if (fallback) fallback.textContent = '';
    return;
  }
  const min = fundPerformance_scenarioSeries('min'),
    base = fundPerformance_scenarioSeries('base'),
    max = fundPerformance_scenarioSeries('max'),
    labels = base.labels;
  const tbl = byId('scenarioRangeTable');
  if (tbl) tbl.innerHTML = `<div class="table-wrap"><table class="compact-table"><thead><tr><th>Rok</th><th>Minimum</th><th>Očekávaně</th><th>Maximum</th></tr></thead><tbody>${labels.map((l, i) => `<tr><td>${esc(l)}</td><td class="money">${money(min.series[i])}</td><td class="money"><b>${money(base.series[i])}</b></td><td class="money">${money(max.series[i])}</td></tr>`).join('')}</tbody></table></div>`;
  const canvas = byId('scenarioRangeChart');
  if (canvas && typeof Chart !== 'undefined') {
    if (window.scenarioRangeChartInstance) window.scenarioRangeChartInstance.destroy();
    window.scenarioRangeChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Minimum',
          data: min.series,
          borderColor: '#dc2626',
          backgroundColor: 'rgba(220,38,38,.08)',
          fill: false,
          tension: .25
        }, {
          label: 'Očekávaně',
          data: base.series,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,.08)',
          fill: false,
          tension: .25
        }, {
          label: 'Maximum',
          data: max.series,
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22,163,74,.08)',
          fill: false,
          tension: .25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        resizeDelay: 80,
        plugins: {
          legend: {
            position: 'bottom'
          }
        },
        scales: {
          y: {
            ticks: {
              callback: v => money(v)
            }
          }
        }
      }
    });
    if (fallback) fallback.textContent = '';
  } else if (fallback) fallback.textContent = 'Graf se zobrazí po načtení knihovny Chart.js; tabulka hodnot je připravená výše.';
}
function pensions_pIsPensionContract(s) {
  if (!s) return false;
  if (typeof areaForContract === 'function' && areaForContract(s) === 'penze') return true;
  return /\bdps\b|\bdip\b|penz/.test(pensions_pNorm([s.type, s.product, s.company, s.source].join(' ')));
}
function pensions_pIsPensionDeal(d) {
  if (!d) return false;
  if (typeof areaForDeal === 'function' && areaForDeal(d) === 'penze') return true;
  return /\bdps\b|\bdip\b|penz/.test(pensions_pNorm([d.category, d.product, d.company].join(' ')));
}
function pensions_pStatuses(x) {
  return typeof getStatuses === 'function' ? getStatuses(x) : [x?.status].filter(Boolean);
}
function pensions_pIsActive(x) {
  return !pensions_pStatuses(x).some(s => pensions_pActiveStatusSet.has(pensions_pNorm(s)));
}
function pensions_pAmount(x) {
  return typeof parseMoney === 'function' ? parseMoney(x?.amount ?? x?.volume ?? x?.aum ?? x?.current ?? 0) : +String(x?.amount ?? x?.volume ?? x?.aum ?? x?.current ?? 0).replace(/[^\d.-]/g, '') || 0;
}
function pensions_pDealAmount(d) {
  return typeof dealVolume === 'function' ? dealVolume(d) : pensions_pAmount(d);
}
function pensions_pClient(id) {
  return typeof findClient === 'function' ? findClient(id) : (state.clients || []).find(c => String(c.id) === String(id)) || null;
}
function pensions_pTypeFromText(x) {
  const n = pensions_pNorm([x?.type, x?.category, x?.product].join(' '));
  if (/\bdip\b/.test(n)) return 'DIP';
  if (/\bdps\b/.test(n)) return 'DPS';
  return 'Penze';
}
function pensions_pIdentityBase(x) {
  const client = String(x.clientId || '');
  const company = pensions_pNorm(x.company || 'bez-spolecnosti');
  const product = pensions_pNorm(x.product || x.type || x.category || 'penze');
  const number = pensions_pNorm(x.number || x.contractNumber || '');
  return [client, company, product, number].join('|');
}
function pensions_pItems() {
  const contracts = (state.contracts || []).filter(s => pensions_pIsPensionContract(s) && pensions_pIsActive(s)).map(s => ({
    kind: 'contract',
    id: s.id,
    clientId: s.clientId,
    company: s.company || 'Bez společnosti',
    product: s.product || s.type || 'Penze',
    type: pensions_pTypeFromText(s),
    number: s.number || '',
    amount: pensions_pAmount(s),
    date: s.anniv || s.dealDate || s.createdAt || '',
    status: pensions_pStatuses(s),
    source: s
  }));
  const contractKeys = new Set(contracts.map(x => pensions_pIdentityBase(x.source)));
  const deals = (typeof visibleDeals === 'function' ? visibleDeals() : state.deals || []).filter(d => pensions_pIsPensionDeal(d) && pensions_pIsActive(d)).filter(d => !contractKeys.has(pensions_pIdentityBase(d))).map(d => ({
    kind: 'deal',
    id: d.id,
    clientId: d.clientId,
    company: d.company || 'Bez společnosti',
    product: d.product || 'Penze',
    type: pensions_pTypeFromText(d),
    number: d.contractNumber || '',
    amount: pensions_pDealAmount(d),
    date: d.date || '',
    status: pensions_pStatuses(d),
    source: d
  }));
  return [...contracts, ...deals].filter(x => x.clientId);
}
function pensions_pClientRows(items) {
  const map = new Map();
  items.forEach(x => {
    const c = pensions_pClient(x.clientId),
      name = pensions_pClientName(c);
    const row = map.get(String(x.clientId)) || {
      clientId: x.clientId,
      name,
      amount: 0,
      count: 0,
      companies: new Set(),
      types: new Set(),
      items: []
    };
    row.amount += x.amount;
    row.count++;
    row.companies.add(x.company || 'Bez společnosti');
    row.types.add(x.type || 'Penze');
    row.items.push(x);
    map.set(String(x.clientId), row);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'cs'));
}
function pensions_pCompanyRows(items) {
  const map = new Map();
  items.forEach(x => {
    const key = x.company || 'Bez společnosti',
      row = map.get(key) || {
        company: key,
        amount: 0,
        count: 0,
        clients: new Set(),
        types: {
          DPS: 0,
          DIP: 0,
          Penze: 0
        },
        items: []
      };
    row.amount += x.amount;
    row.count++;
    row.clients.add(String(x.clientId));
    row.types[x.type] = (row.types[x.type] || 0) + 1;
    row.items.push(x);
    map.set(key, row);
  });
  return [...map.values()].sort((a, b) => b.amount - a.amount || a.company.localeCompare(b.company, 'cs'));
}
function pensions_pItemStatusHtml(x) {
  return x.status?.length ? x.status.map(s => typeof statusBadge === 'function' ? statusBadge(s) : `<span class="badge blue">${pensions_pEsc(s)}</span>`).join(' ') : '<span class="badge green">aktivní</span>';
}
function pensions_pOpenItem(x) {
  x.kind === 'contract' ? openContractModal(x.clientId, x.id) : openDealModal(x.clientId, x.id);
}
function pensions_pRenderClientDetail(row) {
  const c = pensions_pClient(row.clientId),
    items = row.items.sort((a, b) => b.amount - a.amount || a.product.localeCompare(b.product, 'cs'));
  return `<div class="toolbar"><div><div class="eyebrow">Penze klienta</div><h2>${pensions_pEsc(row.name)}</h2><p class="note">${pensions_pEsc([...row.companies].join(' · ') || 'Bez společnosti')} · ${row.count} aktivních smluv/záznamů</p></div><div class="actions"><button class="btn" onclick="openClientModal(${row.clientId})">Klient</button><button class="btn primary" onclick="openPensionContractModal(${row.clientId})">+ Penze</button></div></div><div class="metric-strip"><div class="metric"><span class="note">AUM penzí</span><b>${pensions_pMoney(row.amount)}</b></div><div class="metric"><span class="note">Aktivních smluv</span><b>${row.count}</b></div><div class="metric"><span class="note">Společností</span><b>${row.companies.size}</b></div><div class="metric"><span class="note">Typy</span><b>${pensions_pEsc([...row.types].join(' / ') || 'Penze')}</b></div></div><div class="table-wrap" style="margin-top:12px"><table class="compact-table"><thead><tr><th>Produkt</th><th>Společnost</th><th>Typ</th><th>Číslo</th><th>AUM</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${items.map(x => `<tr><td><b>${pensions_pEsc(x.product)}</b><br><span class="note">${pensions_pEsc(x.kind === 'contract' ? 'Smlouva' : 'Obchod')}${x.date ? ' · ' + pensions_pEsc(typeof dateCZ === 'function' ? dateCZ(x.date) : x.date) : ''}</span></td><td>${pensions_pEsc(x.company)}</td><td>${pensions_pEsc(x.type)}</td><td>${pensions_pEsc(x.number || '-')}</td><td class="money"><b>${pensions_pMoney(x.amount)}</b></td><td>${pensions_pItemStatusHtml(x)}</td><td><button class="btn" onclick="editPensionItem('${x.kind}',${x.id})">Upravit</button></td></tr>`).join('')}</tbody></table></div>`;
}
function pensions_pRenderCompanies(companies) {
  return `<div class="toolbar"><div><div class="eyebrow">Penze</div><h2>Společnosti</h2><p class="note">Souhrn aktivních DPS/DIP podle penzijních společností.</p></div><button class="btn primary" onclick="openPensionContractModal(selectedClientId||null)">+ Penze</button></div><div class="table-wrap"><table class="compact-table"><thead><tr><th>Společnost</th><th>Klientů</th><th>Smluv/záznamů</th><th>DPS</th><th>DIP</th><th>AUM</th></tr></thead><tbody>${companies.map(r => `<tr><td><b>${pensions_pEsc(r.company)}</b></td><td>${r.clients.size}</td><td>${r.count}</td><td>${r.types.DPS || 0}</td><td>${r.types.DIP || 0}</td><td class="money"><b>${pensions_pMoney(r.amount)}</b></td></tr>`).join('') || '<tr><td colspan="6" class="note">Zatím nemáš evidované aktivní penzijní smlouvy.</td></tr>'}</tbody></table></div>`;
}
function pensions_pRenderAum(companies) {
  const total = companies.reduce((s, r) => s + r.amount, 0) || 1;
  return `<div class="toolbar"><div><div class="eyebrow">Penze</div><h2>AUM podle společností</h2><p class="note">Rychlý přehled, kde je penzijní portfolio rozložené.</p></div></div><div class="stack">${companies.map(r => {
    const pct = r.amount / total * 100;
    return `<div class="mini-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><b>${pensions_pEsc(r.company)}</b><br><span class="note">${r.clients.size} klientů · ${r.count} položek</span></div><strong>${pensions_pMoney(r.amount)}</strong></div><div class="progress" style="margin-top:8px"><span style="width:${Math.max(2, pct)}%"></span></div><div class="note">${pct.toFixed(1).replace('.', ',')} % penzijního AUM</div></div>`;
  }).join('') || '<p class="note">Zatím není co zobrazit.</p>'}</div>`;
}
function pensions_pListHtml(rows) {
  return rows.map(r => `<div class="investment-client ${String(pensions_selectedPensionClientId) === String(r.clientId) ? 'active' : ''}" onclick="selectPensionClient(${r.clientId})"><div><b>${pensions_pEsc(r.name)}</b><br><span class="note">${pensions_pEsc([...r.companies].join(' · ') || 'Bez společnosti')}</span></div><div style="text-align:right"><strong>${pensions_pMoney(r.amount)}</strong><br><span class="badge blue">${r.count}</span></div></div>`).join('') || '<p class="note">Zatím tu nejsou žádné penze.</p>';
}
function clientOutput_xPerf(current, invested, realized = 0) {
  const gain = typeof investmentPerformanceGain === 'function' ? investmentPerformanceGain(current, invested, realized) : (+current || 0) + (+realized || 0) - (+invested || 0),
    pct = typeof investmentPerformancePct === 'function' ? investmentPerformancePct(current, invested, realized) : +invested || 0 ? gain / (+invested || 0) * 100 : 0;
  return {
    gain,
    pct
  };
}
function clientOutput_xFundValue(area, key, isin) {
  const direct = state.fundValues?.[key];
  if (direct) return direct;
  const wanted = clientOutput_xNorm(isin || '');
  if (!wanted) return {};
  return Object.values(state.fundValues || {}).find(v => (!area || v?.area === area) && clientOutput_xNorm(v?.isin || '') === wanted) || {};
}
function clientOutput_xComment(area, key, isin) {
  const fv = clientOutput_xFundValue(area, key, isin);
  return String(fv.comment || fv.reportComment || fv.note || (typeof window.defaultFundComment === 'function' ? window.defaultFundComment(area, key, isin, fv) : '')).trim();
}
function clientOutput_xValueDate(area, key, isin, fallback = '') {
  return typeof fundValueDateText === 'function' ? fundValueDateText(area, key, isin, fallback) : fallback;
}
function clientOutput_xInvestmentKey(x) {
  return typeof investmentFundKey === 'function' ? investmentFundKey(x) : [x.company, x.product, x.isin].filter(Boolean).join('|');
}
function clientOutput_xClientInvestments(c) {
  const classic = (typeof clientClassicInvestmentReportItems === 'function' ? clientClassicInvestmentReportItems(c.id) : []).filter(x => !(typeof isPensionReportItem === 'function' && isPensionReportItem(x))).filter(x => !(typeof isInvestmentFundLocked === 'function' && isInvestmentFundLocked(clientOutput_xInvestmentKey(x)))).map(x => {
    const key = clientOutput_xInvestmentKey(x),
      fv = clientOutput_xFundValue('investice', key, x.isin);
    return {
      area: 'Investice',
      key,
      company: x.company || fv.company || '',
      product: x.product || fv.fond || 'Investice',
      isin: x.isin || fv.isin || '',
      typ: x.typ || fv.typ || '',
      invested: clientOutput_xN(x.invested),
      amount: clientOutput_xN(x.amount),
      realized: clientOutput_xN(x.realized),
      date: x.date || x.snapshot?.date || '',
      valueDate: clientOutput_xValueDate('investice', key, x.isin, x.date || ''),
      comment: clientOutput_xComment('investice', key, x.isin),
      rows: [x]
    };
  });
  const row = (typeof fkClientRows === 'function' ? fkClientRows() : []).find(r => String(r.client?.id) === String(c.id));
  const fki = (row?.items || []).filter(x => !x.locked).map(x => {
    const source = x.source || {},
      isin = x.isin || (typeof invIsin === 'function' ? invIsin(source) : ''),
      key = x.key || (typeof invPositionKey === 'function' ? invPositionKey(source) : '');
    return {
      area: 'FKI',
      key,
      company: x.company || (typeof invCompany === 'function' ? invCompany(source) : ''),
      product: x.product || (typeof invFund === 'function' ? invFund(source) : 'FKI'),
      isin,
      typ: x.typ || (typeof invType === 'function' ? invType(source) : ''),
      invested: clientOutput_xN(x.invested),
      amount: clientOutput_xN(x.amount),
      realized: clientOutput_xN(x.realized),
      date: x.date || (typeof invDate === 'function' ? invDate(source) : ''),
      valueDate: clientOutput_xValueDate('fki', key, isin, source['Poslední schválená hodnota do'] || x.date || ''),
      comment: clientOutput_xComment('fki', key, isin),
      rows: typeof investmentRecordsForClient === 'function' && typeof invPositionKey === 'function' ? investmentRecordsForClient(c.id).filter(r => invPositionKey(r) === key) : [source]
    };
  });
  return [...classic, ...fki].filter(x => x.amount > 0 || x.invested > 0 || x.realized > 0).sort((a, b) => b.amount - a.amount || String(a.product).localeCompare(String(b.product), 'cs'));
}
function clientOutput_xContracts(c, kind) {
  const rows = typeof clientContracts === 'function' ? clientContracts(c.id) : [],
    wanted = kind === 'loans' ? ['uvery', 'hypoteky'] : ['pojisteni'];
  return rows.filter(s => {
    const a = typeof areaForContract === 'function' ? areaForContract(s) : '';
    if (kind === 'loans') return ['uvery', 'hypoteky'].includes(a) || /hypot|uver|úvěr/.test(clientOutput_xNorm([s.type, s.product, s.company].join(' ')));
    if (kind === 'insurance') return !['uvery', 'hypoteky', 'investice', 'fki', 'penze'].includes(a);
    return false;
  });
}
function clientOutput_xOpen(c) {
  return (typeof clientOpenOpportunities === 'function' ? clientOpenOpportunities(c.id) : []).filter(o => typeof isOpenOpportunity !== 'function' || isOpenOpportunity(o)).map(o => ({
    kind: 'Příležitost',
    area: typeof areaLabel === 'function' ? areaLabel(typeof opportunityArea === 'function' ? opportunityArea(o) : o.category) : o.category,
    title: o.product || o.category || 'Příležitost',
    company: o.company || '',
    status: o.status || '',
    date: o.expectedDate || o.statusDate || o.date || ''
  }));
}
function clientOutput_xTotals(items) {
  const invested = items.reduce((s, x) => s + clientOutput_xN(x.invested), 0),
    current = items.reduce((s, x) => s + clientOutput_xN(x.amount), 0),
    realized = items.reduce((s, x) => s + clientOutput_xN(x.realized), 0);
  return {
    invested,
    current,
    realized,
    ...clientOutput_xPerf(current, invested, realized)
  };
}
function clientOutput_xSeries(items, years = 10, minmax = false) {
  const labels = Array.from({
    length: years + 1
  }, (_, i) => i ? `${i}. rok` : 'Dnes');
  const current = items.reduce((s, x) => s + clientOutput_xN(x.amount), 0);
  const calc = rateKey => labels.map((_, i) => i === 0 ? current : items.reduce((s, x) => {
    const base = clientOutput_xN(minmax ? x.invested || x.amount : x.amount || x.invested),
      rate = clientOutput_xN(x[rateKey] ?? x.rate ?? x.expectedRate ?? 6);
    return s + base * Math.pow(1 + rate / 100, i);
  }, 0));
  return {
    labels,
    current,
    base: calc('rate'),
    min: minmax ? calc('minRate') : null,
    max: minmax ? calc('maxRate') : null
  };
}
function clientOutput_xLineChart(series, minmax = false) {
  const vals = [...series.base, ...(series.min || []), ...(series.max || [])],
    w = 860,
    h = 360,
    pad = 66,
    max = Math.max(1, ...vals) * 1.08,
    min = 0,
    step = (w - pad - 34) / (series.labels.length - 1 || 1),
    y = v => h - 60 - (v - min) / (max - min || 1) * (h - 104),
    x = i => pad + i * step,
    line = arr => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const grid = [0, .25, .5, .75, 1].map(p => {
    const val = max * p,
      yy = y(val);
    return `<line x1="${pad}" x2="${w - 34}" y1="${yy}" y2="${yy}" stroke="#e2e8f0"/><text class="chart-label" x="8" y="${yy + 4}">${clientOutput_xMoney(val).replace(' Kč', '')}</text>`;
  }).join('');
  const labels = series.labels.map((l, i) => i % 2 === 0 || i === series.labels.length - 1 ? `<text class="chart-label" x="${x(i)}" y="${h - 18}" text-anchor="middle">${clientOutput_xEsc(l.replace('. rok', 'r'))}</text>` : '').join('');
  const band = minmax && series.min && series.max ? `<polygon points="${line(series.max)} ${[...series.min].reverse().map((v, i) => `${x(series.min.length - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}" fill="rgba(22,163,74,.08)"/>` : '';
  return `<svg class="sim-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${grid}${band}${minmax && series.max ? `<polyline points="${line(series.max)}" class="line max"/>` : ''}${minmax && series.min ? `<polyline points="${line(series.min)}" class="line min"/>` : ''}<polyline points="${line(series.base)}" class="line base"/>${series.base.map((v, i) => i % 2 === 0 || i === series.base.length - 1 ? `<circle cx="${x(i)}" cy="${y(v)}" r="4"/><text class="chart-value" x="${x(i) + 6}" y="${y(v) - 7}">${clientOutput_xEsc(clientOutput_xMoney(v).replace(' Kč', ''))}</text>` : '').join('')}${labels}</svg>`;
}
function clientOutput_xDonut(items, total) {
  let start = 0;
  const parts = items.map((x, i) => {
    const pct = total ? clientOutput_xN(x.amount) / total * 100 : 0,
      end = start + pct,
      s = `${clientOutput_colors[i % clientOutput_colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    start = end;
    return s;
  }).join(',');
  return `<div class="donut" style="background:conic-gradient(${parts || '#dbe7f3 0 100%'})"><div class="donut-mid"><b>${clientOutput_xMoney(total)}</b><span>portfolio</span></div></div>`;
}
function clientOutput_xDateObj(v) {
  const s = clientOutput_xIso(v);
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d) ? null : d;
}
function clientOutput_xAnnualized(invested, current, realized = 0, start = '', end = '') {
  invested = clientOutput_xN(invested);
  current = clientOutput_xN(current);
  realized = clientOutput_xN(realized);
  const final = current + realized;
  if (invested <= 0 || final <= 0) return null;
  const a = clientOutput_xDateObj(start),
    b = clientOutput_xDateObj(end) || new Date();
  if (!a || b <= a) return null;
  const years = Math.max((b - a) / 31557600000, 1 / 365);
  return (Math.pow(final / invested, 1 / years) - 1) * 100;
}
function clientOutput_xPctPlain(v) {
  return v === null || !isFinite(v) ? '-' : clientOutput_xPct(v);
}
function clientOutput_xPick(o, keys) {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}
function clientOutput_xRowTitle(r, i) {
  const tx = typeof invTx === 'function' ? invTx(r) : clientOutput_xPick(r, ['Typ transakce', 'transactionType', 'type']);
  return `${String(tx || 'Platba').replace(/^./, m => m.toUpperCase())} #${i + 1}`;
}
function clientOutput_xRowDate(r) {
  return typeof invPaymentDate === 'function' ? invPaymentDate(r) : typeof invDate === 'function' ? invDate(r) : clientOutput_xPick(r, ['Datum připsání platby', 'Datum pripsani platby', 'date', 'paymentDate']);
}
function clientOutput_xRowEmission(r) {
  return typeof invEmissionDate === 'function' ? invEmissionDate(r) : clientOutput_xPick(r, ['Datum emise', 'emissionDate']);
}
function clientOutput_xRowInvested(r) {
  const direct = typeof invDeposit === 'function' ? Math.abs(clientOutput_xN(invDeposit(r))) : 0;
  return direct || Math.abs(clientOutput_xN(clientOutput_xPick(r, ['Čistá investice', 'Cista investice', 'investment', 'invested', 'amount'])));
}
function clientOutput_xRowCurrentDirect(r) {
  const direct = typeof invCurrentValue === 'function' ? clientOutput_xN(invCurrentValue(r)) : typeof invCurrent === 'function' ? clientOutput_xN(invCurrent(r)) : 0;
  return direct || clientOutput_xN(clientOutput_xPick(r, ['Aktuální hodnota investice', 'Aktualni hodnota investice', 'current', 'value', 'amount']));
}
function clientOutput_xRowCp(r) {
  const direct = typeof invQty === 'function' ? clientOutput_xN(invQty(r)) : 0;
  return direct || clientOutput_xN(clientOutput_xPick(r, ['Počet vydaných CP', 'Pocet vydanych CP', 'Počet CP', 'Pocet CP', 'qty', 'cpCount']));
}
function clientOutput_xRowCpValue(r) {
  const direct = typeof invCurrentNav === 'function' ? clientOutput_xN(invCurrentNav(r)) : 0;
  return direct || clientOutput_xN(clientOutput_xPick(r, ['Poslední schválená hodnota CP', 'Posledni schvalena hodnota CP', 'Hodnota CP', 'valueCp', 'nav']));
}
function clientOutput_xFundRows(f) {
  const rows = (Array.isArray(f.rows) && f.rows.length ? f.rows : [f]).filter(Boolean),
    positive = rows.filter(r => !(typeof invIsWithdrawal === 'function' && invIsWithdrawal(r))),
    baseRows = positive.length ? positive : rows,
    totalInvested = baseRows.reduce((s, r) => s + clientOutput_xRowInvested(r), 0);
  return baseRows.map((r, i) => {
    const invested = clientOutput_xRowInvested(r),
      direct = clientOutput_xRowCurrentDirect(r),
      share = totalInvested > 0 ? invested / totalInvested : 0,
      current = direct > 0 ? direct : clientOutput_xN(f.amount) * share,
      realized = typeof investmentRealizedAmount === 'function' ? clientOutput_xN(investmentRealizedAmount(r)) : clientOutput_xN(r?.realized || r?.redemptionAmount || 0),
      date = clientOutput_xRowDate(r) || clientOutput_xRowEmission(r) || f.date,
      valueDate = clientOutput_xValueDate(f.area === 'FKI' ? 'fki' : 'investice', f.key, f.isin, f.valueDate || date),
      perf = clientOutput_xPerf(current, invested, realized),
      pa = clientOutput_xAnnualized(invested, current, realized, date, valueDate || f.valueDate);
    return {
      r,
      i,
      invested,
      current,
      realized,
      date,
      valueDate,
      perf,
      pa,
      cp: clientOutput_xRowCp(r),
      cpValue: clientOutput_xRowCpValue(r),
      emission: clientOutput_xRowEmission(r)
    };
  });
}
function clientOutput_xFundDetail(f, i, scenario = false) {
  const perf = clientOutput_xPerf(f.amount, f.invested, f.realized),
    valueDate = f.valueDate || clientOutput_xValueDate(f.area === 'FKI' ? 'fki' : 'investice', f.key, f.isin, f.date || ''),
    comment = f.comment || clientOutput_xComment(f.area === 'FKI' ? 'fki' : 'investice', f.key, f.isin),
    rows = clientOutput_xFundRows(f),
    title = f.product || 'Investice',
    sub = [f.company, f.area, f.isin].filter(Boolean).join(' · ');
  if (scenario) {
    const years = Math.max(1, clientOutput_xN(document.getElementById('scenarioYears')?.value) || 10);
    return `<article class="report-fund-detail scenario-simple-fund"><div class="report-fund-head"><div><h3>${clientOutput_xEsc(title)}</h3><div class="fund-tags">${[f.company, f.area, f.isin && 'ISIN ' + f.isin].filter(Boolean).map(x => `<span>${clientOutput_xEsc(x)}</span>`).join('')}</div></div></div><div class="metrics"><div><small>Investováno</small><b>${clientOutput_xMoney(f.invested)}</b></div><div><small>Období modelace</small><b>${clientOutput_xNum(years)} let</b></div><div><small>Modelovaná hodnota</small><b>${clientOutput_xMoney(f.amount)}</b></div><div><small>Čistý výnos za období</small><b class="${perf.gain >= 0 ? 'green' : 'red'}">${clientOutput_xMoney(perf.gain)}</b></div></div><p class="fund-note">${clientOutput_xEsc(comment || 'Popis fondu zatím není doplněný v CRM.')}</p></article>`;
  }
  const rowHtml = rows.map(x => `<tr><td><b>${clientOutput_xEsc(clientOutput_xRowTitle(x.r, x.i))}</b><br><small>${clientOutput_xEsc([x.date && 'připsání ' + clientOutput_xDate(x.date), x.emission && 'emise ' + clientOutput_xDate(x.emission)].filter(Boolean).join(' · '))}</small></td><td class="money">${clientOutput_xMoney(x.invested)}</td><td class="money">${x.cp ? clientOutput_xNum(Math.round(x.cp)) : '-'}</td><td>${x.cpValue ? clientOutput_xNum(x.cpValue) : '-'}</td><td class="money"><b>${clientOutput_xMoney(x.current)}</b><br><small>${x.valueDate ? 'k ' + clientOutput_xDate(x.valueDate) : ''}</small></td><td class="money"><b class="${x.perf.gain >= 0 ? 'green' : 'red'}">${clientOutput_xPct(x.perf.pct)}</b><br><small>${clientOutput_xMoney(x.perf.gain)}</small></td><td><b class="${(x.pa || 0) >= 0 ? 'green' : 'red'}">${clientOutput_xPctPlain(x.pa)}</b></td></tr>`).join('');
  return `<article class="report-fund-detail"><div class="report-fund-head"><div><h3>${clientOutput_xEsc(title)}</h3><div class="fund-tags">${[f.company, f.area, f.isin && 'ISIN ' + f.isin, valueDate && 'hodnota k ' + clientOutput_xDate(valueDate)].filter(Boolean).map(x => `<span>${clientOutput_xEsc(x)}</span>`).join('')}</div></div><div class="fund-return ${perf.gain >= 0 ? 'green' : 'red'}">${clientOutput_xPct(perf.pct)}</div></div><div class="metrics"><div><small>Investováno</small><b>${clientOutput_xMoney(f.invested)}</b></div><div><small>${scenario ? 'Modelovaná hodnota' : 'Aktuální hodnota'}</small><b>${clientOutput_xMoney(f.amount)}</b></div><div><small>Čistý výnos</small><b class="${perf.gain >= 0 ? 'green' : 'red'}">${clientOutput_xMoney(perf.gain)}</b></div><div><small>Celkový výnos</small><b class="${perf.gain >= 0 ? 'green' : 'red'}">${clientOutput_xPct(perf.pct)}</b></div><div><small>Časový test</small><b>${rows.length > 1 ? clientOutput_xNum(rows.length) + ' transakcí' : valueDate ? 'k ' + clientOutput_xDate(valueDate) : '-'}</b></div></div><p class="fund-note">${clientOutput_xEsc(comment || 'Popis fondu zatím není doplněný v CRM.')}</p><table class="fund-transactions"><thead><tr><th>Transakce</th><th>Investice</th><th>Počet CP</th><th>Hodnota CP</th><th>${scenario ? 'Modelovaná hodnota' : 'Aktuální hodnota'}</th><th>Celkové zhodnocení</th><th>Výnos p.a.</th></tr></thead><tbody>${rowHtml || `<tr><td colspan="7" class="muted">Bez samostatných transakcí.</td></tr>`}</tbody></table></article>`;
}
function clientOutput_xCompactReportCss() {
  return `.allocation-note{margin:10px 0 0;color:#64748b;font-size:13px;line-height:1.45}.report-fund-detail{background:rgba(255,255,255,.82);border:1px solid var(--line);border-radius:22px;padding:18px;margin:14px 0;break-inside:avoid;box-shadow:0 14px 34px rgba(15,39,68,.06)}.report-fund-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}.report-fund-head h3{margin:0 0 7px;font-size:24px;line-height:1.12}.fund-tags{display:flex;flex-wrap:wrap;gap:7px}.fund-tags span{background:#eaf6fb;color:#0f4168;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:850}.fund-return{font-size:24px;font-weight:950;white-space:nowrap}.fund-note{margin:14px 0 16px;color:#274563;font-size:15px;line-height:1.55}.fund-transactions th,.fund-transactions td{padding:10px 12px}.fund-transactions small{color:#64748b;font-weight:750}@media(max-width:760px){.report-fund-head{display:block}.fund-return{margin-top:10px}.fund-transactions{font-size:12px}}@media print{.report-fund-detail{box-shadow:none;page-break-inside:avoid}.allocation-note{font-size:12px}}`;
}
function clientOutput_xTable(title, heads, rows, empty = 'Bez položek.') {
  return `<section class="card"><div class="section-head"><div><span>${clientOutput_xEsc(title)}</span><h2>${clientOutput_xEsc(title)}</h2></div><div class="section-sum"><b>${clientOutput_xNum(rows.length)}</b><small>položek</small></div></div><table><thead><tr>${heads.map(h => `<th>${clientOutput_xEsc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.join('') : `<tr><td colspan="${heads.length}" class="muted">${clientOutput_xEsc(empty)}</td></tr>`}</tbody></table></section>`;
}
function clientOutput_xCss() {
  return `:root{--ink:#0f2744;--muted:#64748b;--line:#dbe7f3;--blue:#2563eb;--cyan:#44b5c6;--green:#16a34a;--red:#dc2626;--bg:#eef6ff}*{box-sizing:border-box}body{margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;background:radial-gradient(circle at 12% 0%,rgba(210,244,250,.9),transparent 35%),linear-gradient(135deg,#f8fcff,#eef6ff);color:var(--ink)}.wrap{max-width:1120px;margin:0 auto;padding:32px}.hero,.card,.fund-card{background:rgba(255,255,255,.78);border:1px solid var(--line);border-radius:24px;box-shadow:0 18px 50px rgba(15,39,68,.08);backdrop-filter:blur(14px)}.hero{padding:32px;margin-bottom:22px}.eyebrow{font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--cyan)}h1{font-size:38px;margin:8px 0 10px}h2{font-size:22px;margin:0 0 14px}.lead{font-size:16px;line-height:1.6;color:var(--muted)}.kpis,.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px}.kpi,.metrics>div{background:rgba(255,255,255,.9);border:1px solid var(--line);border-radius:18px;padding:14px}.kpi small,.metrics small{display:block;color:#8aa0b8;text-transform:uppercase;font-weight:850;font-size:11px}.kpi b,.metrics b{font-size:21px}.green{color:var(--green)!important}.red{color:var(--red)!important}.muted{color:var(--muted)}.card{padding:24px;margin:18px 0}.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.section-head span{font-size:11px;color:#8aa0b8;text-transform:uppercase;font-weight:850;letter-spacing:.6px}.section-sum{text-align:right}.section-sum b{display:block;font-size:22px}.section-sum small{font-weight:850;color:var(--green)}.alloc{display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:center}.donut{width:240px;height:240px;border-radius:50%;position:relative;margin:auto}.donut:after{content:'';position:absolute;inset:58px;background:#fff;border-radius:50%;box-shadow:inset 0 0 0 8px #e8eef5}.donut-mid{position:absolute;inset:82px 38px auto;z-index:2;text-align:center}.donut-mid b{display:block;font-size:18px}.donut-mid span{display:block;color:#8aa0b8;font-size:11px;font-weight:850;text-transform:uppercase;margin-top:4px}.legend-row{display:flex;justify-content:space-between;gap:14px;border:1px solid #e8eef5;border-radius:12px;padding:10px 13px;margin-bottom:8px;background:rgba(255,255,255,.72)}.legend-row span{display:flex;align-items:center;gap:9px}.legend-row i{width:13px;height:13px;border-radius:50%;display:inline-block;flex:0 0 13px}.legend-row small{color:#8aa0b8}.sim-box{border:1px solid var(--line);border-radius:22px;padding:18px;background:rgba(255,255,255,.82)}.sim-head{display:flex;justify-content:space-between;gap:16px}.sim-head h4{margin:0 0 4px}.sim-chart{width:100%;height:auto}.chart-label{font-size:12px;fill:#64748b}.chart-value{font-size:9px;font-weight:850;fill:#0f2744}.line{fill:none;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round}.line.base{stroke:#2563eb}.line.max{stroke:#16a34a}.line.min{stroke:#14b8a6;stroke-dasharray:7 5}.sim-chart circle{fill:#fff;stroke:#2563eb;stroke-width:3}.fund-card{padding:20px;margin:12px 0}.fund-card h3{margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;text-transform:uppercase;color:#8aa0b8}.money{text-align:right;white-space:nowrap}.fund-slide{position:relative;overflow:hidden;background:#fff;border:1px solid #dbe7f3;border-radius:0;min-height:560px;margin:22px 0;box-shadow:0 18px 50px rgba(15,39,68,.08);break-inside:avoid}.fund-slide:after{content:'';position:absolute;top:0;bottom:0;right:210px;width:10px;background:var(--accent,#0d2c54)}.fund-slide-top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding:48px 62px 24px}.fund-slide-top h3{font-size:44px;line-height:1.03;margin:0;color:#0d416a;text-transform:uppercase;letter-spacing:.02em}.fund-slide-top p{font-size:24px;line-height:1.25;margin:14px 0 0;color:#0d416a}.lion-mark{font-size:42px;color:#0d416a}.slide-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;background:#f4f5f6;padding:26px 62px;margin:0}.slide-stat b{display:block;font-size:38px;line-height:1;color:#0d416a}.slide-stat span{display:block;font-size:17px;color:#0d416a;margin-top:10px;line-height:1.25}.fund-slide-body{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:30px;padding:38px 62px 30px}.fund-slide-body ul{margin:0;padding-left:22px;font-size:19px;line-height:1.45;color:#0d416a}.fund-visual{display:flex;align-items:center;justify-content:center}.fund-shape{width:220px;height:176px;border-radius:55% 45% 50% 50%;background:linear-gradient(135deg,var(--accent,#0d2c54),#111827);color:white;display:flex;align-items:center;justify-content:center;font-size:72px;font-weight:900;opacity:.86}.fund-slide-foot{display:flex;justify-content:space-between;gap:18px;padding:0 62px 30px;color:#139db0;font-size:17px}.print{position:fixed;right:18px;bottom:18px;border:0;border-radius:15px;padding:13px 17px;font-weight:950;background:#2563eb;color:#fff;box-shadow:0 16px 40px rgba(37,99,235,.28);cursor:pointer;z-index:5}@media(max-width:760px){.wrap{padding:16px}.alloc{grid-template-columns:1fr}.fund-slide{min-height:auto}.fund-slide:after{right:22px}.fund-slide-top,.slide-stats,.fund-slide-body,.fund-slide-foot{padding-left:24px;padding-right:44px}.fund-slide-top h3{font-size:30px}.fund-slide-top p{font-size:18px}.slide-stats{grid-template-columns:1fr;gap:16px}.slide-stat b{font-size:30px}.fund-slide-body{grid-template-columns:1fr}.fund-visual{display:none}}@media print{body{background:white}.wrap{padding:0}.hero,.card,.fund-card{box-shadow:none;break-inside:avoid}.print{display:none}.fund-slide{page-break-inside:avoid;break-inside:avoid;box-shadow:none;margin:0 0 12mm}}`;
}
function clientOutput_xInvestmentSection(items, opts = {}, scenario = false) {
  const shown = scenario ? items.map(x => ({
      ...x,
      amount: x.invested
    })) : items,
    total = clientOutput_xTotals(shown),
    legend = shown.map((x, i) => `<div class="legend-row"><span><i style="background:${clientOutput_colors[i % clientOutput_colors.length]}"></i><span><b>${clientOutput_xEsc(x.product)}</b><br><small>${clientOutput_xEsc(x.company || x.area || '')}</small></span></span><b>${total.current ? clientOutput_xPct(x.amount / total.current * 100) : '0 %'}<br><small>${clientOutput_xMoney(x.amount)}</small></b></div>`).join('');
  const years = Math.max(1, clientOutput_xN(document.getElementById('scenarioYears')?.value) || 10),
    series = scenario ? clientOutput_xSeries(shown, years, true) : clientOutput_xSeries(items, Math.max(4, Math.min(10, new Date().getFullYear() - 2022 + 1)), false);
  return `<section class="card"><div class="section-head"><div><span>Rozložení portfolia</span><h2>${scenario ? 'Skladba nového nákupu' : 'Skladba investic'}</h2></div><div class="section-sum"><b>${clientOutput_xMoney(total.current)}</b><small>${clientOutput_xPct(total.pct)}</small></div></div><div class="alloc">${clientOutput_xDonut(shown, total.current)}<div>${legend || '<p class="muted">Zatím bez investičních položek.</p>'}</div></div><p class="allocation-note">Koláčový graf ukazuje procentuální rozložení podle aktuální hodnoty jednotlivých investic. Nejde o porovnání výnosů fondů.</p></section><section class="card"><h2>${scenario ? 'Model vývoje portfolia' : 'Vývoj portfolia'}</h2><div class="sim-box"><div class="sim-head"><div><h4>${scenario ? 'Minimální, očekávaný a maximální scénář' : 'Vývoj hodnoty v čase'}</h4><div class="muted">${scenario ? 'Pásmo ukazuje orientační rozsah podle min/max zhodnocení u jednotlivých fondů.' : 'Graf slouží jako přehled vývoje podle dat uložených v CRM.'}</div></div></div>${clientOutput_xLineChart(series, scenario)}<div class="muted">${scenario ? 'Nejde o garanci budoucího výnosu.' : 'Hodnoty se mohou měnit podle aktuálních výpisů a dat fondů.'}</div></div></section><section class="card"><div class="section-head"><div><span>Detail jednotlivých fondů</span><h2>${scenario ? 'Navržené fondy' : 'Fondy a transakce'}</h2></div><div class="section-sum"><b>${clientOutput_xNum(items.length)}</b><small>fondů</small></div></div>${items.length ? items.map((x, i) => clientOutput_xFundDetail(x, i, scenario)).join('') : '<p class="muted">Bez investičních položek.</p>'}</section>`;
}
function clientOutput_xReportHtml(c, opts = {}, note = '') {
  const items = clientOutput_xClientInvestments(c),
    total = clientOutput_xTotals(items),
    insurance = clientOutput_xContracts(c, 'insurance'),
    loans = clientOutput_xContracts(c, 'loans'),
    open = clientOutput_xOpen(c),
    today = new Date().toLocaleDateString('cs-CZ'),
    sections = [];
  if (opts.summary !== false) sections.push(`<section class="card"><div class="kpis"><div class="kpi"><small>Investiční portfolio</small><b>${clientOutput_xMoney(total.current)}</b></div><div class="kpi"><small>Vloženo</small><b>${clientOutput_xMoney(total.invested)}</b></div><div class="kpi"><small>Celkový výnos</small><b class="${total.gain >= 0 ? 'green' : 'red'}">${clientOutput_xMoney(total.gain)}</b></div><div class="kpi"><small>Zhodnocení</small><b class="${total.gain >= 0 ? 'green' : 'red'}">${clientOutput_xPct(total.pct)}</b></div><div class="kpi"><small>Pojištění</small><b>${clientOutput_xNum(insurance.length)}</b></div><div class="kpi"><small>Úvěry a hypotéky</small><b>${clientOutput_xNum(loans.length)}</b></div></div></section>`);
  if (note) sections.push(`<section class="card"><div class="section-head"><div><span>Poznámka</span><h2>Doplnění k reportu</h2></div></div><p class="lead">${clientOutput_xEsc(note).replace(/\n/g, '<br>')}</p></section>`);
  if (opts.open) sections.push(clientOutput_xTable('Aktuálně rozpracováno', ['Oblast', 'Produkt', 'Společnost', 'Stav', 'Termín'], open.map(x => `<tr><td>${clientOutput_xEsc(x.area)}</td><td><b>${clientOutput_xEsc(x.title)}</b></td><td>${clientOutput_xEsc(x.company)}</td><td>${clientOutput_xEsc(x.status)}</td><td>${clientOutput_xEsc(x.date ? clientOutput_xDate(x.date) : '')}</td></tr>`)));
  if (opts.insurance) sections.push(clientOutput_xTable('Pojištění', ['Produkt', 'Společnost', 'Číslo smlouvy', 'Stav', 'Výročí'], insurance.map(s => `<tr><td><b>${clientOutput_xEsc(s.product || s.type || 'Pojištění')}</b></td><td>${clientOutput_xEsc(s.company || '')}</td><td>${clientOutput_xEsc(s.number || '')}</td><td>${clientOutput_xEsc((typeof getStatuses === 'function' ? getStatuses(s) : [s.status]).filter(Boolean).map(x => STATUS_LABELS?.[x] || x).join(', '))}</td><td>${clientOutput_xEsc(s.anniv ? clientOutput_xDate(s.anniv) : '')}</td></tr>`)));
  if (opts.loans) sections.push(clientOutput_xTable('Úvěry a hypotéky', ['Produkt', 'Společnost', 'Objem', 'Stav', 'Termín'], loans.map(s => `<tr><td><b>${clientOutput_xEsc(s.product || s.type || 'Úvěr')}</b></td><td>${clientOutput_xEsc(s.company || '')}</td><td class="money">${clientOutput_xMoney(s.amount || s.volume || 0)}</td><td>${clientOutput_xEsc((typeof getStatuses === 'function' ? getStatuses(s) : [s.status]).filter(Boolean).map(x => STATUS_LABELS?.[x] || x).join(', '))}</td><td>${clientOutput_xEsc(s.anniv ? clientOutput_xDate(s.anniv) : '')}</td></tr>`)));
  if (opts.investments !== false && items.length) sections.push(clientOutput_xInvestmentSection(items, opts, false));
  if (opts.notice !== false) sections.push(`<section class="card muted">Report je informativní přehled k datu ${clientOutput_xEsc(today)}. Hodnota investic se může měnit a rozhodující jsou vždy oficiální dokumenty, výpisy a aktuální podklady jednotlivých společností.</section>`);
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Klientský report - ${clientOutput_xEsc(clientOutput_xName(c))}</title><style>${clientOutput_xCss()}${clientOutput_xCompactReportCss()}</style></head><body><button class="print" onclick="window.print()">Tisk / PDF</button><div class="wrap"><section class="hero"><div class="eyebrow">Klientský přehled</div><h1>${clientOutput_xEsc(clientOutput_xName(c))}</h1><p class="lead">Přehled aktuálně evidovaných produktů, rozpracovaných témat a investičního portfolia.</p><div class="kpis"><div class="kpi"><small>Datum reportu</small><b>${clientOutput_xEsc(today)}</b></div><div class="kpi"><small>Aktuální hodnota investic</small><b>${clientOutput_xMoney(total.current)}</b></div><div class="kpi"><small>Celkový výnos</small><b class="${total.gain >= 0 ? 'green' : 'red'}">${clientOutput_xMoney(total.gain)}</b></div></div></section>${sections.join('')}</div></body></html>`;
}
function clientOutput_xScenarioRate(r) {
  const defs = typeof window.defaultFundExpectedRate === 'function' ? window.defaultFundExpectedRate(r?.area, r?.key, r?.isin, r) : {};
  return clientOutput_xN(defs.expectedRate) || clientOutput_xN(r?.rate) || clientOutput_xN(r?.expectedRate) || 5;
}
function clientOutput_xScenarioValue(r, years, rate) {
  let v = clientOutput_xN(r.amount || r.invested);
  for (let y = 1; y <= years; y++) {
    v *= 1 + clientOutput_xN(rate) / 100;
    if (clientOutput_xN(r.topupYear) === y) v += clientOutput_xN(r.topupAmount);
    if (clientOutput_xN(r.dropYear) === y) v *= Math.max(0, 1 - clientOutput_xN(r.dropPct) / 100);
  }
  return v;
}
function clientOutput_xScenarioHtml(c) {
  const years = Math.max(1, clientOutput_xN(document.getElementById('scenarioYears')?.value) || 10),
    rows = (investmentScenario?.rows || []).map(r => {
      const rate = clientOutput_xScenarioRate(r),
        defs = typeof window.defaultFundExpectedRate === 'function' ? window.defaultFundExpectedRate(r?.area, r?.key, r?.isin, r) : {},
        minRate = clientOutput_xN(defs.minRate) || clientOutput_xN(r.minRate) || Math.max(0, rate - 2),
        maxRate = clientOutput_xN(defs.maxRate) || clientOutput_xN(r.maxRate) || rate + 2,
        model = clientOutput_xScenarioValue(r, years, rate);
      return {
        area: r.area,
        company: r.company,
        product: r.product,
        isin: r.isin,
        typ: r.typ,
        key: r.key,
        invested: clientOutput_xN(r.amount),
        amount: model,
        current: model,
        rate,
        minRate,
        maxRate,
        topupYear: r.topupYear,
        topupAmount: r.topupAmount,
        dropYear: r.dropYear,
        dropPct: r.dropPct,
        comment: clientOutput_xComment(r.area === 'FKI' ? 'fki' : 'investice', String(r.key || '').replace(/^(Investice|FKI)\|/, ''), r.isin)
      };
    }),
    name = c ? clientOutput_xName(c) : typeof scenarioClientDraft === 'function' ? scenarioClientDraft().name || 'Nový klient' : 'Nový klient',
    currentItems = c ? clientOutput_xClientInvestments(c) : [],
    current = clientOutput_xTotals(currentItems).current,
    added = rows.reduce((s, x) => s + x.invested, 0),
    min = rows.reduce((s, x) => s + clientOutput_xScenarioValue({
      ...x,
      amount: x.invested
    }, years, x.minRate), 0),
    max = rows.reduce((s, x) => s + clientOutput_xScenarioValue({
      ...x,
      amount: x.invested
    }, years, x.maxRate), 0),
    existingDetail = currentItems.length ? `<section class="card"><div class="section-head"><div><span>Stávající portfolio</span><h2>Detail stávajících investic</h2></div><div class="section-sum"><b>${clientOutput_xNum(currentItems.length)}</b><small>fondů</small></div></div>${currentItems.map((x, i) => clientOutput_xFundDetail(x, i, false)).join('')}</section>` : '';
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Investiční návrh - ${clientOutput_xEsc(name)}</title><style>${clientOutput_xCss()}${clientOutput_xCompactReportCss()}</style></head><body><button class="print" onclick="window.print()">Tisk / PDF</button><div class="wrap"><section class="hero"><div class="eyebrow">Scénář investice</div><h1>${clientOutput_xEsc(name)}</h1><p class="lead">Scénář pracuje se současným portfoliem ${clientOutput_xMoney(current)}, novým vkladem ${clientOutput_xMoney(added)} a horizontem ${clientOutput_xNum(years)} let. Orientační rozpětí vychází od ${clientOutput_xMoney(min)} do ${clientOutput_xMoney(max)} podle zadaného minimálního a maximálního zhodnocení.</p><div class="kpis"><div class="kpi"><small>Současné portfolio</small><b>${clientOutput_xMoney(current)}</b></div><div class="kpi"><small>Nové vklady</small><b>${clientOutput_xMoney(added)}</b></div><div class="kpi"><small>Minimum za ${clientOutput_xNum(years)} let</small><b>${clientOutput_xMoney(min)}</b></div><div class="kpi"><small>Maximum za ${clientOutput_xNum(years)} let</small><b>${clientOutput_xMoney(max)}</b></div></div></section>${existingDetail}${clientOutput_xInvestmentSection(rows, {}, true)}<section class="card muted">Výstup je modelový scénář. Nejedná se o garanci budoucího výnosu ani investiční doporučení; rozhodující jsou oficiální dokumenty produktů.</section></div></body></html>`;
}
function activities_aNorm(v) {
  return typeof norm === 'function' ? norm(v) : String(v || '').toLowerCase();
}
function activities_aNum(v) {
  return typeof parseMoney === 'function' ? parseMoney(v) || 0 : +v || 0;
}
function activities_aToday() {
  return typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10);
}
function activities_aUid() {
  return typeof uid === 'function' ? uid() : 'a_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function activities_aVal(id) {
  return typeof val === 'function' ? val(id) : document.getElementById(id)?.value || '';
}
function activities_aSet(id, v) {
  if (typeof setVal === 'function') setVal(id, v ?? '');else {
    const el = document.getElementById(id);
    if (el) el.value = v ?? '';
  }
}
function activities_aSetText(id, v) {
  if (typeof setText === 'function') setText(id, v ?? '');else {
    const el = document.getElementById(id);
    if (el) el.textContent = v ?? '';
  }
}
function activities_aClient(id) {
  return typeof findClient === 'function' ? findClient(id) : (state.clients || []).find(c => String(c.id) === String(id));
}
function activities_aClientName(c) {
  return typeof clientName === 'function' ? clientName(c) : [c?.firstName, c?.lastName, c?.name].filter(Boolean).join(' ') || 'Klient';
}
function activities_aEsc(v) {
  return typeof esc === 'function' ? esc(v) : String(v ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
function activities_aPlusDays(date, days) {
  const d = new Date((date || activities_aToday()) + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function activities_aOutcome(a) {
  if (a?.outcome) return a.outcome;
  if (a?.completed || a?.completedAt) return 'realized';
  if (a?.status === 'hotovo' || a?.status === 'done') return 'realized';
  return 'agreed';
}
function activities_aOutcomeLabel(a) {
  return activities_A_OUTCOME_LABELS[activities_aOutcome(a)] || activities_A_OUTCOME_LABELS.realized;
}
function activities_aOutcomeBadge(a) {
  return activities_A_OUTCOME_BADGES[activities_aOutcome(a)] || activities_A_OUTCOME_BADGES.realized;
}
function activities_aDefaultAnalysisType(a) {
  if (a?.analysisType && activities_A_TYPES.includes(a.analysisType)) return a.analysisType;
  const t = activities_aNorm(a?.type);
  if (t.includes('telefon') || t.includes('whatsapp') || t.includes('vol') || t.includes('hovor')) return 'Volání';
  if (t.includes('sms') || t.includes('email')) return 'Poznámka';
  if (t.includes('schuz')) return 'Schůzka stávající klient';
  if (t.includes('doporuc')) return 'Doporučení';
  if (t.includes('analy')) return 'Analýza';
  if (t.includes('prezent')) return 'Prezentace';
  if (t.includes('podpis')) return 'Podpis';
  if (t.includes('spolupr')) return 'Spolupráce';
  if (t.includes('poznam') || t.includes('ukol')) return 'Poznámka';
  return '';
}
function activities_aCreateFollowUp(source) {
  const followType = String(source.followType || '').trim();
  const followDate = String(source.followDate || '').trim();
  if (!followDate && activities_aOutcome(source) !== 'moved') return null;
  const type = followType || source.type || 'Telefon';
  const date = followDate || source.date || activities_aToday();
  let next = (state.activities || []).find(x => String(x.sourceActivityId) === String(source.id) && String(x.id) === String(source.followActivityId || ''));
  if (!next && source.followActivityId) next = (state.activities || []).find(x => String(x.id) === String(source.followActivityId));
  if (!next) {
    next = {
      id: activities_aUid(),
      createdAt: activities_aToday(),
      clientId: source.clientId,
      source: 'activity',
      sourceActivityId: source.id
    };
    state.activities.push(next);
    source.followActivityId = next.id;
  }
  Object.assign(next, {
    clientId: source.clientId,
    type,
    date,
    time: source.followTime || '09:00',
    duration: type === 'Schůzka' ? 60 : 15,
    location: '',
    text: source.followText || 'Navazuje na: ' + (source.text || source.type || 'aktivitu'),
    completed: false,
    outcome: 'agreed',
    analysisType: activities_aDefaultAnalysisType({
      type
    }),
    updatedAt: activities_aToday()
  });
  return next;
}
function activities_aContactAction(x) {
  const type = activities_aNorm(x.type || '');
  if (type.includes('email')) return `<button class="btn slim" onclick="composeEmailForClient(${JSON.stringify(String(x.clientId || ''))})">Email</button>`;
  if (type.includes('sms') || type.includes('telefon') || type.includes('hovor') || type.includes('vol')) return '<span class="badge blue">Volat</span>';
  return '';
}
function activities_aRecordEmail(clientId, subject) {
  state.activities = state.activities || [];
  const emailAct = {
    id: activities_aUid(),
    clientId,
    type: 'Email',
    date: activities_aToday(),
    time: '',
    duration: 0,
    text: subject || 'Odeslán e-mail klientovi',
    completed: true,
    completedAt: activities_aToday(),
    outcome: 'realized',
    analysisType: 'Poznámka',
    createdAt: activities_aToday()
  };
  const follow = {
    id: activities_aUid(),
    clientId,
    type: 'Telefon',
    date: activities_aPlusDays(activities_aToday(), 2),
    time: '09:00',
    duration: 15,
    text: 'Kontrola po e-mailu',
    completed: false,
    outcome: 'agreed',
    analysisType: 'Volání',
    source: 'email',
    sourceActivityId: emailAct.id,
    createdAt: activities_aToday()
  };
  emailAct.followActivityId = follow.id;
  state.activities.push(emailAct, follow);
}
function quickAnalysis_t() {
  return typeof today === 'function' ? today() : new Date().toISOString().slice(0, 10);
}
function quickAnalysis_v(id) {
  return typeof val === 'function' ? val(id) : document.getElementById(id)?.value || '';
}
function quickAnalysis_s(id, x) {
  if (typeof setVal === 'function') setVal(id, x ?? '');else {
    const el = document.getElementById(id);
    if (el) el.value = x ?? '';
  }
}
function quickAnalysis_n(x) {
  return typeof parseMoney === 'function' ? parseMoney(x) || 0 : Number(String(x || '').replace(',', '.')) || 0;
}
function quickAnalysis_fmt(x) {
  return typeof num === 'function' ? num(x) : new Intl.NumberFormat('cs-CZ', {
    maximumFractionDigits: 0
  }).format(+x || 0);
}
function quickAnalysis_html(x) {
  return typeof esc === 'function' ? esc(x) : String(x ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}
function quickAnalysis_id() {
  return typeof uid === 'function' ? uid() : 'qa_' + Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function quickAnalysis_wk(d = quickAnalysis_t()) {
  return typeof weekKey === 'function' ? weekKey(d) : String(d).slice(0, 10);
}
function quickAnalysis_range(key) {
  return typeof weekRange === 'function' ? weekRange(key) : {
    start: quickAnalysis_t(),
    end: quickAnalysis_t()
  };
}
function quickAnalysis_inRange(d, a, b) {
  return typeof dateInRange === 'function' ? dateInRange(d, a, b) : String(d || '') >= String(a || '') && String(d || '') <= String(b || '9999-12-31');
}
function quickAnalysis_selectedWeek() {
  return quickAnalysis_v('analysisWeek') || quickAnalysis_wk();
}
function quickAnalysis_selectedMonth() {
  return quickAnalysis_v('analysisMonth') || quickAnalysis_t().slice(0, 7);
}
function quickAnalysis_plan(key = quickAnalysis_selectedWeek()) {
  state.analysisPlans = state.analysisPlans || {};
  state.analysisPlans[key] = state.analysisPlans[key] || {};
  state.analysisPlans[key].weeklyActivity = state.analysisPlans[key].weeklyActivity || {};
  return state.analysisPlans[key];
}
function quickAnalysis_rowKey(type) {
  const x = typeof norm === 'function' ? norm(type) : String(type || '').toLowerCase();
  if (x.includes('vol') || x.includes('telefon') || x.includes('hovor')) return 'calls';
  if (x.includes('schuz')) return 'meetings';
  if (x.includes('doporuc')) return 'referrals';
  if (x.includes('analy')) return 'analyses';
  if (x.includes('prezent')) return 'presentations';
  if (x.includes('podpis')) return 'signatures';
  if (x.includes('spolupr')) return 'coop';
  return '';
}
function quickAnalysis_outcome(x) {
  return x?.outcome || x?.result || 'realized';
}
function quickAnalysis_rows(start, end) {
  return (state.analysisEntries || []).filter(x => !x.sourceActivityId && quickAnalysis_inRange(x.date, start, end)).map(x => ({
    ...x,
    source: x.source || 'Rychlý zápis',
    clientId: null,
    count: +x.count || 1,
    minutes: +x.minutes || 0,
    outcome: quickAnalysis_outcome(x)
  }));
}
function quickAnalysis_summary(list, key) {
  const chosen = list.filter(x => quickAnalysis_rowKey(x.type) === key),
    planned = chosen.filter(x => quickAnalysis_outcome(x) === 'agreed').reduce((a, x) => a + (+x.count || 0), 0),
    realized = chosen.filter(x => quickAnalysis_outcome(x) === 'realized').reduce((a, x) => a + (+x.count || 0), 0),
    moved = chosen.filter(x => quickAnalysis_outcome(x) === 'moved').reduce((a, x) => a + (+x.count || 0), 0),
    noShow = chosen.filter(x => quickAnalysis_outcome(x) === 'no_show').reduce((a, x) => a + (+x.count || 0), 0),
    next = key === 'calls' ? chosen.filter(x => x.nextType).reduce((a, x) => a + (+x.count || 0), 0) : 0;
  return {
    planned: planned + next,
    realized,
    moved,
    noShow,
    done: realized + moved + noShow,
    next,
    minutes: chosen.reduce((a, x) => a + (+x.minutes || 0), 0)
  };
}
function quickAnalysis_dayKey(date) {
  const d = new Date(String(date || quickAnalysis_t()).slice(0, 10) + 'T12:00:00');
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getDay()] || '';
}
function quickAnalysis_callMinutesByDay(list) {
  const out = {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0
  };
  list.filter(x => quickAnalysis_rowKey(x.type) === 'calls').forEach(x => {
    const k = quickAnalysis_dayKey(x.date);
    if (k in out) out[k] += +x.minutes || 0;
  });
  return out;
}
function quickAnalysis_weekTable(key, list) {
  return `<thead><tr><th>Aktivita</th><th>Domluveno</th><th>Zrealizováno</th><th>Přesunuto</th><th>Nedorazil</th><th>Úspěšnost</th></tr></thead><tbody>${quickAnalysis_ROWS.map(([k, label]) => {
    const su = quickAnalysis_summary(list, k),
      pct = su.planned ? Math.round(su.realized / su.planned * 100) : null,
      cls = pct === null ? '' : pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'red';
    return `<tr><td><b>${quickAnalysis_html(label)}</b></td><td class="num">${quickAnalysis_fmt(su.planned)}</td><td class="num green">${quickAnalysis_fmt(su.realized)}</td><td class="num orange">${quickAnalysis_fmt(su.moved)}</td><td class="num red">${quickAnalysis_fmt(su.noShow)}</td><td class="num ${cls}" id="weekly_${k}_pct">${pct === null ? 'bez domluvených' : quickAnalysis_fmt(pct) + ' %'}</td></tr>`;
  }).join('')}</tbody>`;
}
function getFilipCrmState() {
  return state;
}
function renderReferrerHub() {
  renderReferrerHubCore();
  const y = +val('dealYear') || new Date().getFullYear();
  renderReferrerPayoutTable(y);
}
function mergeIncomingStateWithSnapshots(incoming) {
  const incomingState = normalizeState(incoming),
    count = mergeIncomingStateCore(incomingState),
    existing = new Set((state.investmentSnapshots || []).map(investmentSnapshotMergeKey));
  let added = 0,
    skipped = 0;
  (incomingState.investmentSnapshots || []).forEach(s => {
    const sourceClient = incomingState.clients.find(c => String(c.id) === String(s.clientId)),
      localClient = sourceClient ? findMatchingClient(sourceClient) : findClient(s.clientId);
    if (!localClient) {
      skipped++;
      return;
    }
    const next = {
        ...s,
        clientId: localClient.id
      },
      key = investmentSnapshotMergeKey(next);
    if (existing.has(key)) {
      skipped++;
      return;
    }
    existing.add(key);
    state.investmentSnapshots.push({
      ...next,
      id: uid(),
      importedAt: today()
    });
    added++;
  });
  count.investmentSnapshots = added;
  count.skipped += skipped;
  return count;
}
function mergeIncomingState(incoming) {
  const incomingState = normalizeState(incoming),
    count = mergeIncomingStateWithSnapshots(incomingState);
  state.referrerPayouts = state.referrerPayouts || [];
  let added = 0,
    skipped = 0;
  (incomingState.referrerPayouts || []).forEach(p => {
    const exists = state.referrerPayouts.some(x => x.date === p.date && norm(x.name) === norm(p.name) && (+x.amount || 0) === (+p.amount || 0) && norm(x.note) === norm(p.note));
    if (exists) {
      skipped++;
      return;
    }
    state.referrerPayouts.push({
      ...p,
      id: uid(),
      createdAt: p.createdAt || today(),
      importedAt: today()
    });
    added++;
  });
  count.referrerPayouts = added;
  count.skipped = (count.skipped || 0) + skipped;
  return count;
}
function stateCountsText(s = state) {
  s = normalizeState(s);
  return `${num((s.clients || []).length)} klientů · ${num((s.contracts || []).length)} smluv · ${num((s.deals || []).length)} obchodů · ${num((s.opportunities || []).length)} příležitostí · ${num((s.notes || []).length)} poznámek · ${num((s.analysisEntries || []).length)} analytických aktivit · ${num((s.investmentRecords || []).length)} investičních záznamů · ${num((s.investmentSnapshots || []).length)} aktualizací investic · ${num((s.activities || []).length)} aktivit · ${num((s.commissionImports || []).length)} provizních importů · ${num((s.referrerPayouts || []).length)} výplat tipařům`;
}
function criticalBackupCounts(s = state) {
  s = normalizeState(s);
  return {
    clients: s.clients.length,
    contracts: s.contracts.length,
    deals: s.deals.length,
    opportunities: s.opportunities.length,
    notes: s.notes.length,
    investments: s.investmentRecords.length,
    investmentSnapshots: s.investmentSnapshots.length,
    activities: s.activities.length,
    analysisEntries: s.analysisEntries.length,
    commissionImports: (s.commissionImports || []).length,
    referrerPayouts: (s.referrerPayouts || []).length,
    referrals: (s.referrals || []).length
  };
}
function criticalCountsText(c) {
  return BACKUP_PROTECTED_KEYS.map(k => `${num(c[k] || 0)} ${BACKUP_COUNT_LABELS[k]}`).join(' · ');
}
function isDangerousOverwrite(local, remote) {
  return backupCountDrops(local, remote).length > 0;
}
function backupRiskWarning(local, remote, mode) {
  const drops = backupCountDrops(mode === 'save' ? local : remote, mode === 'save' ? remote : local),
    detail = drops.map(d => `${d.label}: chybí ${num(d.diff)}`).join(' · ');
  return `<b>Pozor, ${mode === 'save' ? 'Google záloha obsahuje víc dat než aktuální CRM. Pro přepsání menší verzí je potřeba potvrzení.' : 'načtená Google záloha obsahuje méně dat než lokální CRM. Automatické převzetí jsem zastavil.'}</b><br>${detail ? `Rozdíl: ${esc(detail)}.<br>` : ''}Lokálně: ${criticalCountsText(local)}.<br>Google: ${criticalCountsText(remote)}.<br>${mode === 'save' ? 'Pokud jsi klienty nebo záznamy smazal záměrně, můžeš odeslání potvrdit a Google záloha se přepíše aktuálním CRM.' : 'Nejdřív načti náhled a zkontroluj, která verze je opravdu správná.'}`;
}
function saveGoogleBackup() {
  const s = googleSyncSettings();
  if (!s) return;
  const payload = googleSyncPayload(),
    localCounts = criticalBackupCounts(payload.state);
  setGoogleSyncStatus('Kontroluji, jestli aktuální CRM neobsahuje méně dat než Google záloha...');
  googleSyncJsonp('load', {}, data => {
    try {
      if (data && data.ok) {
        const oldPayload = data.backup || data.payload || {},
          incoming = oldPayload.state || oldPayload;
        if (incoming && Array.isArray(incoming.clients)) {
          const remoteCounts = criticalBackupCounts(incoming);
          if (isDangerousOverwrite(localCounts, remoteCounts)) {
            const warning = backupRiskWarning(localCounts, remoteCounts, 'save');
            setGoogleSyncStatus(warning);
            setBackupPreview(warning);
            if (!confirm(backupOverwriteConfirmText(localCounts, remoteCounts))) {
              setGoogleSyncStatus('Odeslání zálohy zrušeno. Google záloha zůstala beze změny.');
              return;
            }
            submitGoogleBackup(payload, s);
            return;
          }
        }
      }
      if (!confirm('Odeslat aktuální FILIP CRM na Google jako kompletní zálohu? Přepíše se předchozí Google záloha.')) {
        setGoogleSyncStatus('Odeslání zálohy zrušeno.');
        return;
      }
      submitGoogleBackup(payload, s);
    } catch (e) {
      if (!confirm('Nepovedlo se bezpečně porovnat starou Google zálohu. Opravdu chceš i tak odeslat aktuální CRM na Google a přepsat předchozí zálohu?')) {
        setGoogleSyncStatus('Odeslání zálohy zrušeno.');
        return;
      }
      submitGoogleBackup(payload, s);
    }
  });
}
function submitGoogleBackup(payload, s) {
  state = normalizeState(payload.state);
  localStorageWriteState();
  const info = stateCountsText(payload.state);
  setVal('gsyncLocalInfo', info);
  setGoogleSyncStatus('Odesílám kompletní zálohu...');
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = s.url;
  form.target = 'gsyncFrame';
  form.style.display = 'none';
  [['action', 'save'], ['app', GOOGLE_SYNC_APP], ['key', s.key], ['payload', JSON.stringify(payload)]].forEach(([k, v]) => {
    const i = document.createElement(k === 'payload' ? 'textarea' : 'input');
    i.name = k;
    i.value = v;
    form.appendChild(i);
  });
  document.body.appendChild(form);
  form.submit();
  setTimeout(() => {
    form.remove();
    setGoogleSyncStatus(`<b>Záloha odeslaná.</b><br>Uloženo: ${info}.`);
  }, 900);
}
function previewSummary(incoming) {
  incoming = normalizeState(incoming);
  const localDup = duplicateGroups(),
    backupDup = duplicateGroups(incoming),
    localCounts = criticalBackupCounts(state),
    remoteCounts = criticalBackupCounts(incoming),
    warning = isDangerousOverwrite(remoteCounts, localCounts) ? `<br><br>${backupRiskWarning(localCounts, remoteCounts, 'restore')}` : '';
  return `<b>Náhled Google zálohy načtený.</b><br>V záloze: ${stateCountsText(incoming)}.<br>Lokálně teď: ${stateCountsText(state)}.<br>Převzetí nahradí lokální CRM přesně celou Google zálohou a Google zálohu samo nepřepíše.<br>Duplicity v záloze: ${num(backupDup.clients.length)} klientských skupin · ${num(backupDup.contracts.length)} smluvních čísel.<br>Aktuální lokální duplicity: ${num(localDup.clients.length)} klientských skupin · ${num(localDup.contracts.length)} smluvních čísel.${warning}`;
}
function applyGooglePreview() {
  if (!googlePreviewState) return alert('Nejdřív klikni na „Načíst náhled z Google“.');
  if (!confirm('Převzít načtenou Google zálohu jako kompletní aktuální CRM? Lokální stav se nahradí celou zálohou, Google záloha se tím nepřepíše.')) return;
  try {
    const delta = restoreIncomingStateFromGoogle(googlePreviewState, 'manual-google-restore');
    persist();
    selectedClientId = state.clients[0]?.id || selectedClientId;
    renderAll();
    setGoogleSyncStatus('<b>Obnova hotová.</b><br>Lokální CRM teď odpovídá celé načtené Google záloze. Google záloha zůstala beze změny.');
    setBackupPreview(`Změna proti předchozímu lokálnímu stavu: ${backupDeltaText(delta)}.`);
  } catch (e) {
    setGoogleSyncStatus('Obnova se nepovedla: ' + e.message);
  }
}
function autoPullGoogleBackup() {
  if (!googleAutoPullEnabled() || !hasGoogleSyncSettings()) return;
  setGoogleSyncStatus('Kontroluji, jestli je na Googlu novější záloha...');
  googleSyncJsonp('load', {}, data => {
    try {
      if (!data || !data.ok) throw new Error(data?.error || 'Google nevrátil zálohu.');
      const payload = data.backup || data.payload || {},
        incoming = normalizeState(payload.state || payload);
      if (!incoming || !Array.isArray(incoming.clients)) throw new Error('Záloha nemá správný formát pro FILIP CRM.');
      if (!shouldAutoApplyGoogle(payload, incoming)) {
        setGoogleSyncStatus('<b>Google zkontrolován.</b><br>Na Macu už je stejná nebo novější verze dat.');
        return;
      }
      const localCounts = criticalBackupCounts(state),
        remoteCounts = criticalBackupCounts(incoming);
      if (isDangerousOverwrite(remoteCounts, localCounts)) {
        const warning = backupRiskWarning(localCounts, remoteCounts, 'restore');
        setGoogleSyncStatus(warning);
        setBackupPreview(warning);
        return;
      }
      const remoteDate = googlePayloadDate(payload, incoming) || new Date().toISOString(),
        delta = restoreIncomingStateFromGoogle(incoming, 'mac-disk-auto');
      state._syncMeta = {
        ...(state._syncMeta || {}),
        lastGoogleImportAt: remoteDate,
        lastGoogleImportDevice: 'mac-disk-auto',
        lastGoogleImportMode: 'full-restore'
      };
      persist();
      selectedClientId = state.clients[0]?.id || selectedClientId;
      renderAll();
      setGoogleSyncStatus(`<b>Novější Google záloha převzatá do Macu jako kompletní CRM.</b><br>Datum zálohy: ${esc(remoteDate)}<br>Změna: ${backupDeltaText(delta)}.<br>Disková záloha se uloží automaticky.`);
    } catch (e) {
      setGoogleSyncStatus('Automatické převzetí Google zálohy se nepovedlo: ' + e.message);
    }
  });
}
function loadInvestmentScenarioFundDefaults() {
  const it = scenario_item(),
    r = scenario_observed(it, scenario_selected()),
    approved = scenario_approvedRateFor(it),
    obs = byId('scenarioObservedRate');
  if (obs) obs.value = r ? decimal(r) : '';
  setVal('scenarioRate', decimal(approved));
  setVal('scenarioMinRate', decimal(Math.max(0, approved - 2)));
  setVal('scenarioMaxRate', decimal(approved + 2));
  scenario_renderAdvanced();
}
function fundPerformance_oldRenderScenario() {
  const scope = String(val('scenarioClient') || '');
  if (scope !== scenario_editableScope) {
    scenario_editableScope = scope;
    investmentScenario.rows = [];
    scenario_loadClientOpenProposalRows(true);
  } else scenario_loadClientOpenProposalRows(false);
  scenario_normalizeScenarioRows();
  if (typeof scenario_originalRender === 'function') scenario_originalRender();
  scenario_renderEditableSelectedFunds();
  scenario_renderAdvanced();
}
function fundPerformance_oldAddScenario() {
  const it = scenario_item(),
    a = scenario_n(val('scenarioAmount'));
  if (!it) return alert('Vyber fond.');
  if (a <= 0) return alert('Vyplň částku nové investice.');
  const y = Math.max(1, scenario_n(val('scenarioYears')) || 10),
    ty = scenario_n(val('scenarioTopupYear')),
    dy = scenario_n(val('scenarioDropYear'));
  if (ty > y || dy > y) return alert('Rok dokupu nebo propadu je mimo zvolený horizont.');
  const row = scenario_applyApprovedRate({
    ...it,
    amount: a,
    observedRate: scenario_n(val('scenarioObservedRate')),
    topupYear: ty,
    topupAmount: scenario_n(val('scenarioTopupAmount')),
    dropYear: dy,
    dropPct: scenario_n(val('scenarioDropPct')),
    source: 'Ručně přidáno'
  });
  investmentScenario.rows.push(row);
  ['scenarioAmount', 'scenarioTopupYear', 'scenarioTopupAmount', 'scenarioDropYear', 'scenarioDropPct'].forEach(x => setVal(x, ''));
  renderInvestmentScenario();
  saveToast('Fond přidán do návrhu');
}
function removeInvestmentScenarioFund(i) {
  investmentScenario.rows.splice(i, 1);
  renderInvestmentScenario();
}
function updateInvestmentScenarioSaveMode() {
  const signed = scenario_scenarioSaveMode() === 'signed',
    date = byId('scenarioSignedDate'),
    btn = byId('scenarioSaveBtn');
  if (date) {
    date.disabled = !signed;
    if (signed && !date.value) date.value = today();
    date.parentElement.style.opacity = signed ? '1' : '.58';
  }
  if (btn) btn.textContent = signed ? 'Uložit jako sjednáno' : 'Uložit návrh';
}
function openInvestmentScenarioModal(clientId = null, area = 'Investice') {
  if (typeof scenario_originalOpen === 'function') scenario_originalOpen(clientId, area);
  setVal('scenarioSaveMode', 'proposal');
  setVal('scenarioSignedDate', today());
  updateInvestmentScenarioSaveMode();
  setTimeout(() => {
    scenario_ensure();
    scenario_loadClientOpenProposalRows(true);
    loadInvestmentScenarioFundDefaults();
    renderInvestmentScenario();
    updateInvestmentScenarioSaveMode();
  }, 0);
}
function fillInvestmentScenarioFunds() {
  if (typeof scenario_originalFill === 'function') scenario_originalFill();
  setTimeout(() => {
    scenario_ensure();
    loadInvestmentScenarioFundDefaults();
    renderInvestmentScenario();
  }, 0);
}
function saveInvestmentScenario() {
  if (!investmentScenario.rows.length) return alert('Nejdřív přidej alespoň jeden fond.');
  const c = ensureInvestmentScenarioClient();
  if (!c) return;
  state.opportunities = state.opportunities || [];
  state.deals = state.deals || [];
  const p = scenario_projection(),
    summary = `Modelace: současná hodnota ${money(p.current)}, celkem vloženo ${money(p.insertedTotal)}, modelovaná hodnota ${money(p.final)}, celkový výnos ${money(p.gain)}, vážený výnos ${scenario_fmtPct(p.weighted)} % p.a.`,
    horizon = scenario_n(val('scenarioYears')) || 10,
    total = investmentScenario.rows.reduce((s, x) => s + scenario_n(x.amount), 0);
  if (scenario_scenarioSaveMode() === 'signed') {
    const date = val('scenarioSignedDate') || today();
    if (!confirm(`Uložit ${num(investmentScenario.rows.length)} fondů rovnou jako sjednané obchody k datu ${date}?`)) return;
    let added = 0;
    investmentScenario.rows.forEach(r => {
      scenario_addScenarioDeal(c, r, summary, horizon, date);
      added++;
    });
    if (typeof syncCrmFkiDealsToRecords === 'function') syncCrmFkiDealsToRecords();
    if (typeof dedupeInvestmentSnapshotsInState === 'function') dedupeInvestmentSnapshotsInState(state);
    addActivity(c.id, 'Obchod', `Investice/FKI sjednáno rovnou: ${num(added)} fondů, ${money(total)}`, true);
    selectedClientId = c.id;
    clientSection = 'portfolio';
    persist();
    closeModal('investmentScenarioModal');
    showView('clients');
    saveToast(`Sjednáno uloženo · ${num(added)} obchodů`);
    return;
  }
  let added = 0,
    updated = 0;
  investmentScenario.rows.forEach(r => {
    const draft = scenario_scenarioOpportunityDraft(c, r, summary, horizon);
    let target = state.opportunities.find(o => String(o.id) === String(r.opportunityId));
    if (!target) target = state.opportunities.find(o => sameOpenOpportunity(o, draft));
    if (target) {
      Object.assign(target, draft, {
        id: target.id,
        createdAt: target.createdAt || today(),
        history: [...(target.history || []), {
          d: today(),
          t: 'Upraven investiční návrh'
        }]
      });
      updated++;
    } else {
      state.opportunities.push({
        id: uid(),
        ...draft,
        createdAt: today(),
        history: [{
          d: today(),
          t: 'Oportunita'
        }]
      });
      added++;
    }
  });
  addActivity(c.id, 'Investiční návrh', `Uložen návrh: ${num(added)} nových, ${num(updated)} upravených, ${money(total)}`, true);
  selectedClientId = c.id;
  clientSection = 'opportunities';
  persist();
  closeModal('investmentScenarioModal');
  showView('clients');
  saveToast(`Návrh uložen ke klientovi · nové ${num(added)} · upravené ${num(updated)}`);
}
function loadFkRecordFundDefaults() {
  const key = val('fkRecFundSelect'),
    f = fkFundItems().find(x => x.key === key),
    fv = state.fundValues?.[key] || {};
  if (!f) return;
  setVal('fkRecCompany', fv.company || f.company || '');
  setVal('fkRecFund', fv.fond || f.product || '');
  setVal('fkRecProduct', fv.product || 'FKI');
  setVal('fkRecIsin', fv.isin || f.isin || '');
  setVal('fkRecType', fv.typ || f.typ || '');
  if (fv.nav) setVal('fkRecNav', fv.nav);
  if (fv.date) setVal('fkRecNavDate', fv.date);
}
function fkiPosition_previousOpen(clientId, encodedKey = '', encodedRecordKey = '') {
  const c = findClient(clientId);
  if (!c) return alert('Vyber klienta.');
  fkiEditor_editingFkClientId = clientId;
  const key = encodedKey ? fkiEditor_fkDec(encodedKey) : '',
    records = key ? fkiEditor_fkRecordsForItem(clientId, key) : [],
    recordKey = encodedRecordKey ? fkiEditor_fkDec(encodedRecordKey) : '',
    r = records.find(x => fkiEditor_fkRecKey(x) === recordKey) || records[0] || {};
  fkiEditor_editingFkRecordKey = r && Object.keys(r).length ? fkiEditor_fkRecKey(r) : '';
  byId('deleteFkRecordBtn').style.display = fkiEditor_editingFkRecordKey ? 'inline-flex' : 'none';
  byId('fkRecFundSelect').innerHTML = fkiEditor_fkFundSelectOptions(key);
  setVal('fkRecFundSelect', key);
  setText('fkRecordTitle', fkiEditor_editingFkRecordKey ? 'Upravit záznam' : 'Nový FKI záznam');
  setVal('fkRecInvestor', invInvestor(r) || clientName(c));
  setVal('fkRecBirthDate', fkiEditor_fkDate(r['Datum narození'] || r.birthDate));
  setVal('fkRecBirthId', invBirthId(r) || c.birthId || '');
  setVal('fkRecFund', invFund(r) || '');
  setVal('fkRecCompany', invCompany(r) || '');
  setVal('fkRecProduct', invProductType(r) || 'FKI');
  setVal('fkRecTx', r['Typ transakce'] || 'Platba');
  setVal('fkRecDeposit', invDeposit(r) || '');
  setVal('fkRecCurrent', invCurrent(r) || fkiEditor_fkRecordCurrent(r) || '');
  setVal('fkRecQty', invQty(r) || '');
  setVal('fkRecSubscribe', invSubscribeValue(r) || '');
  setVal('fkRecType', invType(r) || '');
  setVal('fkRecRegular', r['Pravidelná investice'] || 'Jednorázové');
  setVal('fkRecRegularAmount', r['Pravidelná částka'] || '');
  setVal('fkRecRegularDay', r['Den v měsíci'] || '');
  setVal('fkRecPaymentDate', fkiEditor_fkDate(invPaymentDate(r)));
  setVal('fkRecEmissionDate', fkiEditor_fkDate(invEmissionDate(r)));
  setVal('fkRecIsin', invIsin(r) || '');
  setVal('fkRecNav', invCurrentNav(r) || '');
  setVal('fkRecNavDate', fkiEditor_fkDate(r['Poslední schválená hodnota do'] || state.fundValues?.[key]?.date));
  setVal('fkRecNote', r.note || r.Poznámka || '');
  openModal('fkRecordModal');
}
function liquidity_prevSaveFkRecord2() {
  const client = findClient(fkiEditor_editingFkClientId);
  if (!client) return alert('Vyber klienta.');
  const investor = val('fkRecInvestor').trim() || clientName(client),
    fund = val('fkRecFund').trim(),
    company = val('fkRecCompany').trim() || inferFkiCompany(fund),
    isin = val('fkRecIsin').trim(),
    typ = val('fkRecType').trim(),
    deposit = fkiEditor_fkNum(val('fkRecDeposit')),
    qty = fkiEditor_fkNum(val('fkRecQty')),
    nav = fkiEditor_fkNum(val('fkRecNav')),
    subscribe = fkiEditor_fkNum(val('fkRecSubscribe')),
    current = fkiEditor_fkNum(val('fkRecCurrent')) || (qty && nav ? qty * nav : deposit);
  if (!fund) return alert('Vyplň fond.');
  if (!deposit) return alert('Vyplň čistou investici.');
  const rec = {
    'Investor': investor,
    'RČ': val('fkRecBirthId').trim() || client.birthId || '',
    'Datum narození': val('fkRecBirthDate') || '',
    'ClientID': client.birthId ? 'RC_' + normalizeStrongId(client.birthId) : String(client.id),
    'Fond': fund,
    'Investiční společnost': company,
    'Typ produktu': val('fkRecProduct').trim() || 'FKI',
    'Typ transakce': val('fkRecTx') || 'Platba',
    'Čistá investice': deposit,
    'Aktuální hodnota investice': current,
    'Počet vydaných CP': qty,
    'Upisovací hodnota': subscribe,
    'Datum připsání platby': val('fkRecPaymentDate') || today(),
    'Datum emise': val('fkRecEmissionDate') || val('fkRecPaymentDate') || today(),
    'Poslední schválená hodnota CP': nav || null,
    'Poslední schválená hodnota do': val('fkRecNavDate') || today(),
    'rp.ISIN': isin,
    'Typ CP': typ,
    'Pravidelná investice': val('fkRecRegular'),
    'Pravidelná částka': fkiEditor_fkNum(val('fkRecRegularAmount')),
    'Den v měsíci': fkiEditor_fkNum(val('fkRecRegularDay')),
    'Poznámka': val('fkRecNote').trim(),
    _source: 'local-fki',
    _updatedAt: today()
  };
  if (qty && nav) rec['Aktuální hodnota investice'] = qty * nav;
  const oldIndex = (state.investmentRecords || []).findIndex(r => fkiEditor_fkRecKey(r) === fkiEditor_editingFkRecordKey);
  if (oldIndex >= 0) state.investmentRecords[oldIndex] = {
    ...state.investmentRecords[oldIndex],
    ...rec
  };else state.investmentRecords.push(rec);
  const key = invPositionKey(rec);
  if (nav) fkiEditor_fkSetFundValueForKey(key, nav, val('fkRecNavDate') || today(), {
    company,
    fond: fund,
    product: rec['Typ produktu'],
    isin,
    typ
  });
  dedupeInvestmentRecordsInState(state);
  findOrCreateClientFromInvestment(rec);
  selectedFkClientId = client.id;
  selectedClientId = client.id;
  addActivity(client.id, 'FKI', 'Upraven FKI záznam: ' + fund + ' · ' + money(rec['Aktuální hodnota investice']), true);
  closeModal('fkRecordModal');
  persist();
  renderAll();
  saveToast('FKI záznam uložen a hodnota CP propsaná');
}
function deleteFkRecord() {
  if (!fkiEditor_editingFkRecordKey) return;
  const r = (state.investmentRecords || []).find(x => fkiEditor_fkRecKey(x) === fkiEditor_editingFkRecordKey);
  if (!r) return;
  if (!confirm('Smazat tento FKI záznam klienta? Centrální fond zůstane zachovaný.')) return;
  state.investmentRecords = state.investmentRecords.filter(x => fkiEditor_fkRecKey(x) !== fkiEditor_editingFkRecordKey);
  closeModal('fkRecordModal');
  persist();
  renderAll();
  saveToast('FKI záznam smazán');
}
function showFkFundClients(encodedKey) {
  const key = fkiEditor_fkDec(encodedKey),
    rows = fkClientRows().map(r => ({
      c: r.client,
      items: r.items.filter(x => x.key === key)
    })).filter(x => x.items.length),
    box = byId('fkFundClients_' + key.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (box) box.innerHTML = box.innerHTML ? '' : `<div class="mini-card" style="margin:8px 0 0"><h3>Klienti ve fondu</h3>${rows.map(x => `<div class="product-row"><div><b>${esc(clientName(x.c))}</b><span class="note">${num(x.items.length)} pozic</span></div><button class="btn slim" onclick="selectFkClient(${x.c.id})">${money(x.items.reduce((s, i) => s + (+i.rawAmount || 0), 0))}</button></div>`).join('') || '<p class="note">Bez klientů.</p>'}</div>`;
}
function deleteFkFundMaster(encodedKey) {
  const key = fkiEditor_fkDec(encodedKey),
    f = fkFundItems().find(x => x.key === key);
  if (!f) return;
  if (!confirm(`Smazat centrální nastavení fondu ${f.product}? Klientské transakce zůstanou zachované.`)) return;
  delete state.fundValues[key];
  delete state.trailSettings?.[key];
  delete state.lockedFunds?.[fkiGlobalLockKey(key)];
  persist();
  renderAll();
  saveToast('Centrální fond odebrán');
}
function renderFkFunds(funds) {
  const groups = {};
  (funds || []).forEach(f => {
    const k = f.company || 'Nezařazeno';
    groups[k] = groups[k] || [];
    groups[k].push(f);
  });
  return `<div class="toolbar"><div><div class="eyebrow">Fondy</div><h2>Centrální hodnoty, klienti a zámky</h2><p class="note">Hodnota CP se po uložení propíše všem klientům stejného ISIN / typu CP.</p></div><button class="btn primary" onclick="openFkFundModal()">+ Fond / hodnota</button></div>${Object.entries(groups).map(([company, rows]) => `<div class="mini-card" style="margin-bottom:10px"><div class="toolbar"><h3>${esc(company)}</h3><span class="badge blue">${num(rows.length)} fondů</span></div><div class="table-wrap"><table class="compact-table fki-fund-table"><thead><tr><th>Fond</th><th>Hodnota CP</th><th>Platnost</th><th>Klientů</th><th>Transakcí</th><th>Akce</th></tr></thead><tbody>${rows.map(f => {
    const fv = state.fundValues?.[f.key] || {},
      locked = isFkiFundGloballyLocked(f.key),
      safe = f.key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return `<tr class="${locked ? 'row-soon' : ''}"><td><b>${esc(f.product)}</b>${locked ? ' <span class="badge orange">zamčeno</span>' : ''}<br><span class="note">${esc([f.isin || 'ISIN chybí', f.typ || 'typ CP chybí', fv.trailPct !== undefined ? 'následná ' + num(fv.trailPct) + ' %' : ''].filter(Boolean).join(' · '))}</span><div id="fkFundClients_${esc(safe)}"></div></td><td><b>${fv.nav ? num(fv.nav) : '—'}</b></td><td>${esc(fv.date || f.date || '')}</td><td><button class="btn slim" onclick="showFkFundClients('${esc(fkiEditor_fkEnc(f.key))}')">${num(f.clients.size)} klientů</button></td><td class="num">${num(f.tx)}</td><td><div class="actions"><button class="btn slim" onclick="openFkFundModal('${esc(fkiEditor_fkEnc(f.key))}')">Upravit</button><button class="btn slim" onclick="showFkFundClients('${esc(fkiEditor_fkEnc(f.key))}')">Klienti</button><button class="icon-btn" title="Smazat centrální fond" onclick="deleteFkFundMaster('${esc(fkiEditor_fkEnc(f.key))}')">×</button><button class="icon-btn ${locked ? 'primary' : ''}" title="Zámek AUM" onclick="toggleFkFundLock('${esc(fkiEditor_fkEnc(f.key))}')">${locked ? '🔒' : '🔓'}</button></div></td></tr>`;
  }).join('')}</tbody></table></div></div>`).join('') || '<div class="note">Zatím tu nejsou FK fondy.</div>'}`;
}
function liquidity_prevOpenFkRecordModal2(clientId, encodedKey = '', encodedRecordKey = '') {
  if (typeof fkiPosition_previousOpen === 'function') fkiPosition_previousOpen(clientId, encodedKey, encodedRecordKey);
  const key = encodedKey ? fkiPosition_d(encodedKey) : '',
    recordKey = encodedRecordKey ? fkiPosition_d(encodedRecordKey) : '';
  if (!key || recordKey) return;
  const current = val('fkRecFund').trim() + val('fkRecIsin').trim() + val('fkRecType').trim();
  if (current) return;
  const f = fkiPosition_fundDefaults(key),
    c = findClient(clientId);
  setVal('fkRecInvestor', clientName(c) || '');
  setVal('fkRecBirthId', c?.birthId || '');
  setVal('fkRecFund', f.fund);
  setVal('fkRecCompany', f.company);
  setVal('fkRecProduct', f.product);
  setVal('fkRecIsin', f.isin);
  setVal('fkRecType', f.typ);
  setVal('fkRecNav', f.nav);
  setVal('fkRecNavDate', f.date || today());
  setVal('fkRecPaymentDate', today());
  setVal('fkRecEmissionDate', today());
  setVal('fkRecTx', 'Platba');
  setText('fkRecordTitle', 'Nová pozice klienta ve fondu');
}
function liquidity_oldRenderInvestmentDetail(row) {
  const c = row?.client,
    items = row?.items || [],
    current = row?.current || 0,
    invested = row?.invested || 0,
    realized = row?.realized || 0,
    gain = investmentPerformanceGain(current, invested, realized),
    gainPct = investmentPerformancePct(current, invested, realized),
    snaps = latestInvestmentSnapshots(c?.id).slice(0, 8),
    last = snaps[0],
    funds = investmentPosition_invGroup(items);
  if (!c) return '<div class="investment-empty"><h2>Vyber klienta</h2><p>Vlevo klikni na klienta s běžnou investicí.</p></div>';
  return `<div class="investment-detail-head"><div class="avatar">${esc(initials(c.name))}</div><div><div class="eyebrow">Investiční karta klienta</div><h2>${esc(clientName(c))}</h2><div class="chips"><span class="badge blue">${num(funds.length)} fondů</span><span class="chip">${row.providers.length ? esc(row.providers.join(' · ')) : 'bez společnosti'}</span>${last ? `<span class="badge green">ověřeno ${esc(last.date || '')}</span>` : '<span class="badge orange">čeká na aktualizaci</span>'}</div></div><div class="actions"><button class="btn slim" onclick="selectedClientId=${c.id};showView('clients');clientSection='portfolio';renderClients()">Klient</button><button class="btn slim" onclick="openInvestmentSnapshotModal(${c.id})">Aktualizovat hodnoty</button><button class="btn slim primary" onclick="openInvestmentScenarioModal(${c.id},'Investice')">+ Nová investice</button></div></div><div class="investment-summary"><div class="metric"><span class="note">AUM / hodnota</span><b>${money(current)}</b></div><div class="metric"><span class="note">Vloženo</span><b>${money(invested)}</b></div><div class="metric"><span class="note">Rozdíl</span><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div class="metric"><span class="note">Zhodnocení</span><b class="${gain >= 0 ? 'green' : 'red'}">${gainPct.toFixed(1)} %</b></div></div>${renderInvestmentAllocation(items, current)}<div class="mini-card"><div class="toolbar"><div><div class="eyebrow">Detail investičních fondů</div><h3>Fondy klienta, pozice a hodnoty</h3></div><button class="btn" onclick="openInvestmentFundModal()">Fondy</button></div><div class="fki-work-list">${funds.map(f => investmentPosition_invCard(f, c.id)).join('') || '<p class="note">Klient zatím nemá evidované investice.</p>'}</div></div>${snaps.length ? `<div class="mini-card" style="margin-top:12px"><h3>Poslední ruční aktualizace</h3><div class="table-wrap"><table class="compact-table"><thead><tr><th>Datum</th><th>Produkt</th><th>Zdroj</th><th>Vloženo</th><th>AUM</th><th>Výnos</th><th>Pravidelně</th></tr></thead><tbody>${snaps.map(s => `<tr><td>${esc(s.date || '')}</td><td><b>${esc(s.product || 'Investice')}</b><br><span class="note">${esc(s.company || '')}</span></td><td>${esc(s.source || '')}${s.redemptionAmount ? `<br><span class="badge orange">${esc(investmentRedemptionText(s))}</span>` : ''}</td><td class="money">${money(s.invested)}</td><td class="money">${money(s.current)}</td><td class="money">${money(s.gainAmount)}${s.gainPct ? `<br><span class="${(+s.gainPct || 0) >= 0 ? 'green' : 'red'}">${num(s.gainPct)} %</span>` : ''}</td><td>${s.regularAmount ? `${money(s.regularAmount)}<br><span class="note">${esc(s.regularFrequency || '')}</span>` : '<span class="note">nezadáno</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
}
function renderInvestmentFunds(funds) {
  if (funds.length && !funds.some(f => f.key === selectedInvestmentFundKey)) selectedInvestmentFundKey = funds[0].key;
  if (!funds.length) selectedInvestmentFundKey = null;
  const selected = funds.find(f => f.key === selectedInvestmentFundKey),
    groups = {};
  (funds || []).forEach(f => {
    const k = f.company || 'Nezařazeno';
    groups[k] = groups[k] || [];
    groups[k].push(f);
  });
  return `<div class="toolbar"><div><div class="eyebrow">Fondy</div><h2>Centrální hodnoty a klienti</h2><p class="note">Stejný pracovní styl jako FKI: fond, hodnota/NAV, klienti, zámek a detail držitelů.</p></div><button class="btn primary" onclick="openInvestmentFundModal()">+ Fond / hodnota</button></div>${Object.entries(groups).map(([company, rows]) => `<div class="mini-card" style="margin-bottom:10px"><div class="toolbar"><h3>${esc(company)}</h3><span class="badge blue">${num(rows.length)} fondů</span></div><div class="table-wrap"><table class="compact-table fki-fund-table"><thead><tr><th>Fond</th><th>AUM</th><th>V reportu</th><th>Hodnota/NAV</th><th>Klientů</th><th>Akce</th></tr></thead><tbody>${rows.map(f => {
    const fv = investmentFundStoredValue(f),
      locked = isInvestmentFundLocked(f.key);
    return `<tr class="${locked ? 'row-soon' : ''}"><td><b>${esc(f.label || investmentFundLabel(f))}</b>${locked ? ' <span class="badge orange">zamčeno</span>' : ''}<br><span class="note">${esc([f.isin || 'ISIN chybí', f.mergeKey ? 'sloučeno: ' + f.mergeKey : '', f.typ || 'typ neuveden'].filter(Boolean).join(' · '))}</span></td><td class="money">${money(f.rawCurrent)}</td><td class="money">${money(f.amount)}</td><td>${fv.nav ? num(fv.nav) : '—'}<br><span class="note">${esc(fv.date || f.date || '')}</span></td><td><button class="btn slim" onclick="selectInvestmentFund('${esc(investmentPosition_enc(f.key))}')">${num(f.clients.size)} klientů</button></td><td><div class="actions"><button class="btn slim" onclick="openInvestmentFundModal('${esc(investmentPosition_enc(f.key))}')">Upravit</button><button class="btn slim" onclick="selectInvestmentFund('${esc(investmentPosition_enc(f.key))}')">Klienti</button><button class="icon-btn ${locked ? 'primary' : ''}" onclick="toggleInvestmentFundLock('${esc(investmentPosition_enc(f.key))}')">${locked ? '🔒' : '🔓'}</button></div></td></tr>`;
  }).join('')}</tbody></table></div></div>`).join('') || '<div class="note">Zatím tu nejsou investiční fondy.</div>'}${renderInvestmentFundClients(selected)}`;
}
function renderInvestments() {
  const list = byId('investmentClientList'),
    detail = byId('investmentDetail');
  if (!list || !detail) return;
  const q = norm(val('investmentSearch')),
    funds = investmentFundItems();
  let rows = investmentClientRows().filter(r => !q || norm([clientName(r.client), r.providers.join(' '), r.items.map(x => [x.product, x.company, x.kind].join(' ')).join(' ')].join(' ')).includes(q));
  let visibleFunds = funds.filter(f => !q || norm([f.label, f.company, f.product, f.isin, f.typ, f.mergeKey].join(' ')).includes(q));
  const all = investmentClientRows(),
    allItems = classicInvestmentItems();
  setText('invClientCount', num(all.length));
  setText('invProductCount', num(funds.length || allItems.length));
  setText('invTotalInvested', money(all.reduce((s, x) => s + x.invested, 0)));
  setText('invTotalVolume', money(funds.reduce((s, x) => s + (+x.rawCurrent || 0), 0)));
  if (rows.length && !rows.some(r => String(r.client?.id) === String(selectedInvestmentClientId))) selectedInvestmentClientId = rows[0].client?.id;
  if (!rows.length) selectedInvestmentClientId = null;
  list.innerHTML = rows.map(r => `<button class="investment-client ${String(r.client?.id) === String(selectedInvestmentClientId) ? 'active' : ''}" onclick="selectInvestmentClient(${r.client?.id})"><div class="row"><b>${esc(clientName(r.client))}</b><span class="badge blue">${num(r.products)}</span></div><div class="row"><span class="note">AUM</span><span class="money">${money(r.current)}</span></div><div class="row"><span class="note">Vloženo: ${money(r.invested)}</span><span class="${investmentPerformanceGain(r.current, r.invested, r.realized) >= 0 ? 'green' : 'red'}">${investmentPerformancePct(r.current, r.invested, r.realized).toFixed(1)} %</span></div></button>`).join('') || '<div class="investment-empty">Zatím tu nejsou běžné investice.</div>';
  byId('investmentTabClient')?.classList.toggle('active', investmentMode === 'client');
  byId('investmentTabFunds')?.classList.toggle('active', investmentMode === 'funds');
  byId('investmentTabAum')?.classList.toggle('active', investmentMode === 'aum');
  detail.innerHTML = investmentMode === 'funds' ? window.renderInvestmentFunds(visibleFunds) : investmentMode === 'aum' ? renderInvestmentAum(visibleFunds) : window.renderInvestmentDetail(rows.find(r => String(r.client?.id) === String(selectedInvestmentClientId)));
}
function fkClientRows() {
  return state.clients.map(c => {
    const items = fkItemsForClient(c.id),
      opps = fkiPortfolio_fkiProposalRows(c.id),
      aum = items.reduce((s, x) => s + (+x.amount || 0), 0),
      invested = items.reduce((s, x) => s + (+x.invested || 0), 0),
      realized = items.reduce((s, x) => s + investmentRealizedAmount(x), 0),
      trail = items.reduce((s, x) => s + fkTrailForItem(x), 0),
      providers = [...new Set([...items.map(x => x.company), ...opps.map(o => o.company)].filter(Boolean))];
    return {
      client: c,
      items,
      opps,
      aum,
      invested,
      realized,
      trail,
      products: items.length + opps.length,
      providers
    };
  }).filter(r => r.items.length || r.opps.length || r.aum > 0).sort((a, b) => b.aum - a.aum || clientName(a.client).localeCompare(clientName(b.client), 'cs'));
}
function saveDeal() {
  const result = fkiSync_before_saveDeal.apply(this, arguments),
    changed = fkiSync_syncCrmFkiDealsToRecords() + fkiSync_removeOrphanCrmFkiRecords();
  if (changed) {
    persist();
    renderAll();
  }
  return result;
}
function saveContract() {
  const result = fkiSync_before_saveContract.apply(this, arguments),
    changed = fkiSync_syncCrmFkiDealsToRecords() + fkiSync_removeOrphanCrmFkiRecords();
  if (changed) {
    persist();
    renderAll();
  }
  return result;
}
function moveDealToOpportunity() {
  const result = fkiSync_before_moveDealToOpportunity.apply(this, arguments),
    changed = fkiSync_syncCrmFkiDealsToRecords() + fkiSync_removeOrphanCrmFkiRecords();
  if (changed) {
    persist();
    renderAll();
  }
  return result;
}
function deleteDeal() {
  const result = fkiSync_before_deleteDeal.apply(this, arguments),
    changed = fkiSync_syncCrmFkiDealsToRecords() + fkiSync_removeOrphanCrmFkiRecords();
  if (changed) {
    persist();
    renderAll();
  }
  return result;
}
function deleteContract() {
  const result = fkiSync_before_deleteContract.apply(this, arguments),
    changed = fkiSync_syncCrmFkiDealsToRecords() + fkiSync_removeOrphanCrmFkiRecords();
  if (changed) {
    persist();
    renderAll();
  }
  return result;
}
function fkFundItems() {
  return fundIdentity_previousFkFundItems().filter(f => !state.fundValues?.[f.key]?._aliasTo);
}
function setAnalysisCompareYear(year, on) {
  state.settings = state.settings || {};
  state.settings.analysisCompareYears = state.settings.analysisCompareYears || {};
  state.settings.analysisCompareYears[String(year)] = !!on;
  persist();
  annualAnalysis_renderAnalysisYearToggles();
  renderAnalysisActivityChart();
  renderAnalysisBusinessChart();
}
function renderAnalysisActivityChart() {
  annualAnalysis_renderAnalysisYearToggles();
  const canvas = annualAnalysis_ensureCanvas('analysisActivityChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const metric = val('analysisChartMetric') || 'calls',
    select = byId('analysisChartMetric'),
    label = select?.selectedOptions?.[0]?.textContent || 'Aktivita';
  const datasets = annualAnalysis_chartDatasets(annualAnalysis_activityMetricValue, metric);
  if (!datasets.length) {
    if (analysisActivityChart) analysisActivityChart.destroy();
    annualAnalysis_emptyChart(canvas, 'Zapni alespoň jeden rok.');
    return;
  }
  if (analysisActivityChart) analysisActivityChart.destroy();
  analysisActivityChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: annualAnalysis_ANALYSIS_MONTH_LABELS,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            title: x => `${label} · ${x[0].label}`,
            label: x => `${x.dataset.label}: ${metric === 'signedBj' ? num(x.parsed.y) + ' BJ' : num(x.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(100,120,150,.14)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}
function renderAnalysisBusinessChart() {
  annualAnalysis_renderAnalysisYearToggles();
  const canvas = annualAnalysis_ensureCanvas('analysisBusinessChart');
  if (!canvas || typeof Chart === 'undefined') return;
  const metric = val('analysisBusinessMetric') || 'investment',
    select = byId('analysisBusinessMetric'),
    label = select?.selectedOptions?.[0]?.textContent || 'Výkon',
    moneyMetric = metric !== 'bj';
  const datasets = annualAnalysis_chartDatasets(annualAnalysis_businessMetricValue, metric);
  if (!datasets.length) {
    if (annualAnalysis_analysisBusinessChart) annualAnalysis_analysisBusinessChart.destroy();
    annualAnalysis_emptyChart(canvas, 'Zapni alespoň jeden rok.');
    return;
  }
  if (annualAnalysis_analysisBusinessChart) annualAnalysis_analysisBusinessChart.destroy();
  annualAnalysis_analysisBusinessChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: annualAnalysis_ANALYSIS_MONTH_LABELS,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            title: x => `${label} · ${x[0].label}`,
            label: x => `${x.dataset.label}: ${moneyMetric ? money(x.parsed.y) : num(x.parsed.y) + ' BJ'}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: v => moneyMetric ? money(v) : num(v)
          },
          grid: {
            color: 'rgba(100,120,150,.14)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}
function investmentTrailMonthlyPayout() {
  return commissions_investmentTrailSplit().monthlyPayout;
}
function investmentTrailYearEndBonus() {
  return commissions_investmentTrailSplit().yearEndBonus;
}
function investmentTrailForItem(x) {
  return commissions_investmentTrailAnnualForItem(x) * 0.9 / 12;
}
function fkiTrailYearEndBonus() {
  return commissions_fkiOnlyTrailAnnualGross() * 0.1;
}
function fkiTrailMonthlyPayout() {
  return commissions_fkiOnlyTrailAnnualGross() * 0.9 / 12;
}
function fkiTrailEstimate() {
  return window.fkiTrailMonthlyPayout();
}
function fkTrailForItem(x) {
  return window.investmentTrailForItem(x);
}
function liquidity_oldSaveInv() {
  const oldKey = val('invFundSelect'),
    chosen = investmentFundItems().find(x => x.key === oldKey),
    fallbackKey = chosen?.rawKeys?.values ? chosen.rawKeys.values().next().value : '',
    key = investmentFundKeyFromForm() || oldKey || fallbackKey,
    storeKey = fallbackKey || oldKey || key,
    company = val('invFundCompany').trim() || 'Nezařazeno',
    fond = val('invFundName').trim() || 'Investice',
    isin = val('invFundIsin').trim(),
    mergeKey = val('invFundMergeKey').trim(),
    typ = val('invFundType').trim(),
    product = val('invFundProduct').trim() || 'Investice',
    nav = commissions_cNum(val('invFundNav')),
    date = val('invFundDate') || today(),
    trailPct = commissions_cNum(val('invFundTrail'));
  let master = {
    area: 'investice',
    company,
    fond,
    product,
    typ,
    isin,
    mergeKey,
    nav,
    date,
    trailPct
  };
  const candidates = commissions_investmentCandidatesByIsin(oldKey, isin);
  if (candidates.length) {
    master = commissions_cPickMaster('Investice', master, candidates);
    if (!master) return;
    ['invFundCompany', 'invFundName', 'invFundProduct', 'invFundType'].forEach((id, i) => setVal(id, [master.company, master.fond || master.product, master.product, master.typ][i] || ''));
  }
  const fundValue = {
    area: 'investice',
    company: master.company || company,
    fond: master.fond || master.product || fond,
    isin: master.isin || isin,
    mergeKey: master.mergeKey || mergeKey,
    typ: master.typ || typ,
    product: master.product || product,
    nav: master.nav || nav,
    date: master.date || date,
    trailPct: master.trailPct ?? trailPct
  };
  const keys = commissions_investmentMergeKeys(oldKey, key, candidates, fundValue);
  keys.add(storeKey);
  [...keys].filter(Boolean).forEach(k => state.fundValues[k] = {
    ...(state.fundValues[k] || {}),
    ...fundValue
  });
  state.trailSettings = state.trailSettings || {};
  state.trailSettings[key] = {
    ...(state.trailSettings[key] || {}),
    trailPct: fundValue.trailPct
  };
  state.lockedFunds = state.lockedFunds || {};
  const lockKey = investmentFundLockKey(key);
  if (val('invFundLocked') === 'yes') state.lockedFunds[lockKey] = true;else delete state.lockedFunds[lockKey];
  const changed = commissions_applyInvestmentFundMerge(keys, fundValue);
  selectedInvestmentFundKey = key;
  persist();
  closeModal('investmentFundModal');
  investmentMode = 'funds';
  renderAll();
  saveToast(`Investiční fond uložen · sloučeno ${num(keys.size)} klíčů · propsáno ${num(changed)} záznamů`);
}
function liquidity_oldSaveFk() {
  const oldKey = val('fkFundSelect'),
    company = val('fkFundCompany').trim() || 'Nezařazeno',
    fond = cleanInvFundName(val('fkFundName').trim() || 'FKI', company),
    isin = val('fkFundIsin').trim(),
    typ = val('fkFundType').trim(),
    product = val('fkFundProduct').trim() || 'FKI',
    nav = commissions_cNum(val('fkFundNav')),
    date = val('fkFundDate') || today(),
    trailPct = commissions_cNum(val('fkFundTrail'));
  let master = {
    area: 'fki',
    company,
    fond,
    product,
    typ,
    isin,
    nav,
    date,
    trailPct
  };
  const candidates = commissions_fkCandidatesByIsin(oldKey, isin);
  if (candidates.length) {
    master = commissions_cPickMaster('FKI', master, candidates);
    if (!master) return;
    ['fkFundCompany', 'fkFundName', 'fkFundProduct', 'fkFundType'].forEach((id, i) => setVal(id, [master.company, master.fond || master.product, master.product, master.typ][i] || ''));
  }
  const data = {
      area: 'fki',
      company: master.company || company,
      fond: master.fond || master.product || fond,
      isin: master.isin || isin,
      typ: master.typ || typ,
      product: master.product || product,
      nav: master.nav || nav,
      date: master.date || date,
      trailPct: master.trailPct ?? trailPct
    },
    newKey = commissions_fkKey(data.isin, data.fond, data.company, data.typ),
    keys = new Set([oldKey, newKey].filter(Boolean));
  commissions_fkCandidatesByIsin(oldKey, data.isin).forEach(f => keys.add(f.key));
  (state.investmentRecords || []).forEach(r => {
    if (data.isin && commissions_cNorm(invIsin(r)) === commissions_cNorm(data.isin)) keys.add(invPositionKey(r));else if (oldKey && invPositionKey(r) === oldKey) keys.add(oldKey);
  });
  const changed = commissions_applyFkFundMerge(keys, newKey, data),
    lock = fkiGlobalLockKey(newKey);
  if (val('fkFundLocked') === 'yes') state.lockedFunds[lock] = true;else delete state.lockedFunds[lock];
  dedupeInvestmentRecordsInState(state);
  persist();
  closeModal('fkFundModal');
  renderAll();
  saveToast(`FKI fond uložen · sloučeno ${num(keys.size)} klíčů · propsáno ${num(changed)} pozic`);
}
function liquidity_oldReportSettings() {
  const out = commissions_baseReportFundSettings.apply(this, arguments);
  const el = byId('reportFundSettingsTable');
  if (el) {
    const note = document.createElement('caption');
    note.style.captionSide = 'bottom';
    note.className = 'note';
    note.textContent = `Investiční provize: měsíčně se zobrazuje 90 % roční následné provize ze všech nezamčených investic, FKI a Edwarda (${money(window.investmentTrailMonthlyPayout())}), 10 % roční doplatek je ${money(window.investmentTrailYearEndBonus())}.`;
    if (!el.querySelector('caption')) el.appendChild(note);
  }
  return out;
}
function dashboardOpenClient(id) {
  if (!id) return;
  selectedClientId = +id || id;
  clientSection = 'overview';
  showView('clients');
}
function openDashboardTask(kind, id) {
  if (kind === 'contract') {
    const s = (state.contracts || []).find(x => String(x.id) === String(id));
    if (s) openContractModal(s.clientId, s.id);
    return;
  }
  openActivityModal(null, id);
}
function openOpportunityModal(clientId = null, id = null) {
  dashboard_prevOpenOpp.apply(this, arguments);
  const o = id ? (state.opportunities || []).find(x => String(x.id) === String(id)) : null;
  setVal('oActivityType', 'Telefon');
  setVal('oActivityDate', o?.expectedDate || today());
  setVal('oActivityTime', '09:00');
  setVal('oActivityText', o ? `Navázat na příležitost: ${o.product || o.category || 'příležitost'}` : '');
}
function fundPerformance_oldLoadInvFund() {
  if (typeof liquidity_oldLoadInv === 'function') liquidity_oldLoadInv.apply(this, arguments);
  const key = liquidity_valx('invFundSelect'),
    fv = liquidity_findFundValue('investice', key, liquidity_valx('invFundIsin'));
  liquidity_writeRules('invFund', fv);
}
function fundPerformance_oldLoadFkFund() {
  if (typeof liquidity_oldLoadFk === 'function') liquidity_oldLoadFk.apply(this, arguments);
  const key = liquidity_valx('fkFundSelect'),
    fv = liquidity_findFundValue('fki', key, liquidity_valx('fkFundIsin'));
  liquidity_writeRules('fkFund', fv);
}
function fundPerformance_oldSaveInvFund() {
  const rules = liquidity_readRules('invFund'),
    isin = liquidity_valx('invFundIsin').trim(),
    key = liquidity_selectedInvestmentKey();
  if (typeof liquidity_oldSaveInv === 'function') liquidity_oldSaveInv.apply(this, arguments);
  liquidity_storeRules('investice', key, isin, rules);
  persist();
  renderAll();
  saveToast('Investiční fond uložen včetně pravidel odkupu');
}
function fundPerformance_oldSaveFkFund() {
  const rules = liquidity_readRules('fkFund'),
    isin = liquidity_valx('fkFundIsin').trim(),
    key = liquidity_selectedFkKey();
  if (typeof liquidity_oldSaveFk === 'function') liquidity_oldSaveFk.apply(this, arguments);
  liquidity_storeRules('fki', key, isin, rules);
  persist();
  renderAll();
  saveToast('FKI fond uložen včetně pravidel odkupu');
}
function fundPerformance_prevRenderInvestmentDetail(row) {
  const html = typeof liquidity_oldRenderInvestmentDetail === 'function' ? liquidity_oldRenderInvestmentDetail.apply(this, arguments) : '';
  return html + liquidity_investmentLiquidityRows(row?.items || []);
}
function liquidity_prevFkiCard(row) {
  const c = row?.client,
    items = row?.items || [],
    aum = row?.aum || 0,
    invested = row?.invested || 0,
    realized = row?.realized || 0,
    gain = investmentPerformanceGain(aum, invested, realized),
    gainPct = investmentPerformancePct(aum, invested, realized),
    locked = items.filter(x => x.locked),
    stats = liquidity_clientLiquidityStats(row);
  if (!c) return '<div class="investment-empty"><h2>Vyber FK klienta</h2><p>Vlevo klikni na klienta s FK portfoliem.</p></div>';
  return `<div class="investment-detail-head"><div class="avatar">${esc(initials(c.name))}</div><div><div class="eyebrow">FK karta klienta</div><h2>${esc(clientName(c))}</h2><div class="chips"><span class="badge purple">${num(items.length)} fondů</span><span class="badge ${stats.readyCount ? 'green' : 'red'}">${num(stats.readyCount)}/${num(stats.total)} k odkupu</span>${stats.next ? `<span class="badge red">nejbližší ${liquidity_fmtDate(stats.next)}</span>` : ''}<span class="chip">${esc(row.providers.join(' · ') || 'bez společnosti')}</span>${locked.length ? `<span class="badge orange">${num(locked.length)} zamčeno mimo AUM</span>` : '<span class="badge green">AUM aktivní</span>'}</div></div><div class="actions"><button class="btn slim" onclick="selectedClientId=${c.id};showView('clients');clientSection='portfolio';renderClients()">Klient</button><button class="btn slim" onclick="setFkMode('funds')">Fondy</button><button class="btn slim" onclick="openFkRecordModal(${c.id})">+ FKI záznam</button><button class="btn slim primary" onclick="openInvestmentScenarioModal(${c.id},'FKI')">+ Nová investice</button></div></div><div class="investment-summary"><div class="metric"><span class="note">Aktuálně vloženo netto</span><b>${money(invested)}</b></div><div class="metric"><span class="note">Aktuální hodnota</span><b>${money(aum)}</b></div><div class="metric"><span class="note">Aktuální výnos</span><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b><small>${gainPct.toFixed(1)} %</small></div><div class="metric"><span class="note">Odkupy připravené</span><b class="${stats.readyCount ? 'green' : 'red'}">${num(stats.readyCount)} / ${num(stats.total)}</b><small>${stats.next ? 'další ' + liquidity_fmtDate(stats.next) : 'bez čekajícího termínu'}</small></div></div>${renderInvestmentAllocation(items, aum)}<div class="mini-card"><div class="toolbar"><div><div class="eyebrow">Detail investičních fondů</div><h3>Fondy klienta, daňový test a odkup</h3></div><button class="btn" onclick="openFkClientReportModal(${c.id})">Report FKI + investice</button></div><div class="fki-work-list">${items.sort((a, b) => b.rawAmount - a.rawAmount).map(x => liquidity_fkiCard(x, c.id)).join('') || '<p class="note">Klient zatím nemá FKI fondy.</p>'}</div></div>`;
}
function renderFk() {
  const list = liquidity_q('fkClientList'),
    detail = liquidity_q('fkDetail');
  if (!list || !detail) return;
  const search = norm(liquidity_valx('fkSearch')),
    all = fkClientRows(),
    rows = all.filter(r => !search || norm([clientName(r.client), r.providers.join(' '), r.items.map(x => [x.product, x.company, x.isin, x.typ].join(' ')).join(' '), r.opps?.map(o => [o.product, o.company, o.isin, o.fundIsin].join(' ')).join(' ')].join(' ')).includes(search));
  if (rows.length && !rows.some(r => String(r.client?.id) === String(selectedFkClientId))) selectedFkClientId = rows[0].client?.id;
  if (!rows.length) selectedFkClientId = null;
  const funds = fkFundItems(),
    aum = funds.reduce((s, x) => s + (+x.amount || 0), 0);
  setText('fkClientCount', num(all.length));
  setText('fkFundCount', num(funds.length));
  setText('fkTotalAum', money(aum));
  setText('fkTrailTotal', money(fkiTrailEstimate()));
  list.innerHTML = rows.map(r => {
    const gain = investmentPerformanceGain(r.aum, r.invested, r.realized),
      pct = investmentPerformancePct(r.aum, r.invested, r.realized),
      stats = liquidity_clientLiquidityStats(r);
    return `<button class="investment-client ${String(r.client?.id) === String(selectedFkClientId) ? 'active' : ''}" onclick="selectFkClient(${r.client?.id})"><div class="row"><b>${esc(clientName(r.client))}</b><span class="badge purple">${num(r.products)}</span></div><div class="row"><span class="note">FK AUM</span><span class="money">${money(r.aum)}</span></div><div class="row"><span class="note">${esc(r.providers.slice(0, 2).join(' · ') || 'bez společnosti')}</span><span class="${gain >= 0 ? 'green' : 'red'}">${pct.toFixed(1)} %</span></div><div class="row"><span class="badge ${stats.readyCount ? 'green' : 'red'}">${num(stats.readyCount)}/${num(stats.total)} odkup</span><span class="note">${stats.next ? 'od ' + liquidity_fmtDate(stats.next) : 'připraveno'}</span></div></button>`;
  }).join('') || '<div class="investment-empty">Zatím tu nejsou FK data.</div>';
  liquidity_q('fkTabClient')?.classList.toggle('active', fkMode === 'client');
  liquidity_q('fkTabFunds')?.classList.toggle('active', fkMode === 'funds');
  liquidity_q('fkTabAum')?.classList.toggle('active', fkMode === 'aum');
  detail.innerHTML = fkMode === 'funds' ? window.renderFkFunds(funds) : fkMode === 'aum' ? renderFkAum(funds) : window.renderFkClientDetail(rows.find(r => String(r.client?.id) === String(selectedFkClientId)));
}
function renderReportFundSettings() {
  const out = typeof liquidity_oldReportSettings === 'function' ? liquidity_oldReportSettings.apply(this, arguments) : undefined;
  const table = liquidity_q('reportFundSettingsTable');
  if (table && !table.querySelector('thead th:last-child')?.textContent.includes('Odkupy')) {
    [...table.querySelectorAll('thead tr')].forEach(tr => tr.insertAdjacentHTML('beforeend', '<th>Odkupy</th>'));
    [...table.querySelectorAll('tbody tr')].forEach(tr => tr.insertAdjacentHTML('beforeend', '<td><span class="note">nastavíš přes Upravit fond</span></td>'));
  }
  return out;
}
function openFkRecordModal(clientId, encodedKey = '', encodedRecordKey = '') {
  if (typeof liquidity_prevOpenFkRecordModal2 === 'function') liquidity_prevOpenFkRecordModal2.apply(this, arguments);
  const key = encodedKey ? liquidity_dec(encodedKey) : '',
    rk = encodedRecordKey ? liquidity_dec(encodedRecordKey) : '';
  liquidity_fkModalClientId = clientId;
  liquidity_fkModalRecordKey = rk;
  liquidity_fkModalIsNewRedemption = false;
  const r = key && rk ? liquidity_fkiRecordRows(clientId, key).find(x => invRecordKey(x) === rk) : null;
  if (r && invIsWithdrawal(r)) liquidity_fillRedemptionFields(r, key);else {
    liquidity_fillRedemptionSourceOptions(clientId, key, '');
    ['fkRecRedemptionRequested', 'fkRecRedemptionRealized', 'fkRecRedemptionPayout'].forEach(id => liquidity_set(id, ''));
  }
}
function openFkRedemptionModal(clientId, encodedKey = '', encodedRecordKey = '') {
  window.openFkRecordModal(clientId, encodedKey, encodedRecordKey);
  const key = encodedKey ? liquidity_dec(encodedKey) : '',
    rk = encodedRecordKey ? liquidity_dec(encodedRecordKey) : '';
  const source = key && rk ? liquidity_fkiRecordRows(clientId, key).find(x => invRecordKey(x) === rk) : liquidity_fkiRecordRows(clientId, key).find(x => !invIsWithdrawal(x));
  const info = source ? liquidity_liquidityInfo('fki', key, invIsin(source), invEmissionDate(source)) : null;
  liquidity_fkRedemptionSourceKey = source ? invRecordKey(source) : '';
  liquidity_fillRedemptionSourceOptions(clientId, key, liquidity_fkRedemptionSourceKey);
  liquidity_set('fkRecTx', 'Odkup');
  liquidity_set('fkRecPaymentDate', today());
  liquidity_set('fkRecEmissionDate', source ? invEmissionDate(source) : today());
  liquidity_set('fkRecRedemptionRequested', today());
  liquidity_set('fkRecRedemptionRealized', info ? info.redemption : '');
  liquidity_set('fkRecRedemptionPayout', info ? info.payout : '');
  liquidity_set('fkRecDeposit', '');
  liquidity_set('fkRecCurrent', '');
  liquidity_set('fkRecRedemptionSource', liquidity_fkRedemptionSourceKey);
  setText('fkRecordTitle', 'Nový odkup klienta');
  liquidity_fkModalClientId = clientId;
  liquidity_fkModalRecordKey = '';
  liquidity_fkModalIsNewRedemption = true;
}
function saveFkRecord() {
  const wasWithdrawal = String(liquidity_valx('fkRecTx') || '').toLowerCase().includes('odkup');
  const req = liquidity_valx('fkRecRedemptionRequested'),
    real = liquidity_valx('fkRecRedemptionRealized'),
    pay = liquidity_valx('fkRecRedemptionPayout'),
    sourceIssue = liquidity_valx('fkRecEmissionDate'),
    sourceKey = liquidity_valx('fkRecRedemptionSource') || liquidity_fkRedemptionSourceKey;
  if (wasWithdrawal && (liquidity_fkModalIsNewRedemption || !liquidity_fkModalRecordKey || !liquidity_fkiRecordRows(liquidity_fkModalClientId, liquidity_valx('fkRecFundSelect')).some(r => invRecordKey(r) === liquidity_fkModalRecordKey && invIsWithdrawal(r)))) {
    liquidity_saveRedemptionRecord();
    return;
  }
  if (typeof liquidity_prevSaveFkRecord2 === 'function') liquidity_prevSaveFkRecord2.apply(this, arguments);
  if (!wasWithdrawal) return;
  const clientId = selectedFkClientId || selectedClientId;
  const rows = investmentRecordsForClient(clientId).filter(r => String(invTx(r)).toLowerCase().includes('odkup'));
  const rec = rows.find(r => liquidity_fkModalRecordKey && invRecordKey(r) === liquidity_fkModalRecordKey) || rows.sort((a, b) => String(b._updatedAt || '').localeCompare(String(a._updatedAt || '')))[0];
  if (rec) {
    rec.redemptionRequestedDate = req || rec['Datum připsání platby'] || today();
    rec.redemptionRealizedDate = real || '';
    rec.redemptionPayoutDate = pay || '';
    rec.redemptionSourceEmissionDate = sourceIssue || rec['Datum emise'] || '';
    rec.redemptionSourceRecordKey = sourceKey || rec.redemptionSourceRecordKey || '';
    rec['Odkup zadán'] = rec.redemptionRequestedDate;
    rec['Odkup realizován'] = rec.redemptionRealizedDate;
    rec['Peníze na účtu do'] = rec.redemptionPayoutDate;
    rec['Odkup z emise'] = rec.redemptionSourceEmissionDate;
    rec['Odkup z nákupu'] = rec.redemptionSourceRecordKey;
    persist();
    renderAll();
    saveToast('Odkup uložen včetně termínů a vazby na nákup');
  }
}
function liquidity_fkiCard(item, clientId) {
  let html = liquidity_originalFkiCard(item, clientId);
  const first = liquidity_fkiRecordRows(clientId, item.key).find(r => !invIsWithdrawal(r));
  const button = `<button class="btn slim red" onclick="event.preventDefault();openFkRedemptionModal(${clientId},'${esc(liquidity_enc(item.key))}','${first ? esc(liquidity_enc(invRecordKey(first))) : ''}')">+ Odkup</button>`;
  html = html.replace('<button class="btn slim" onclick="event.preventDefault();openFkRecordModal', button + '<button class="btn slim" onclick="event.preventDefault();openFkRecordModal');
  html = html.replaceAll(/(<b>Odkup #[^<]*<\/b><br><span class="note">)([^<]*)(<\/span>)/g, (m, a, b, c) => a + b + ' · termíny odkupu vpravo' + c);
  return html;
}
function fundPerformance_prevRenderFkDetail(row) {
  return liquidity_prevFkiCard.apply(this, arguments);
}
function loadInvestmentFundToForm() {
  if (typeof fundPerformance_oldLoadInvFund === 'function') fundPerformance_oldLoadInvFund.apply(this, arguments);
  const key = val('invFundSelect'),
    isin = val('invFundIsin');
  setVal('invFundComment', fundPerformance_fundComment('investice', key, isin));
}
function loadFkFundToForm() {
  if (typeof fundPerformance_oldLoadFkFund === 'function') fundPerformance_oldLoadFkFund.apply(this, arguments);
  const key = val('fkFundSelect'),
    isin = val('fkFundIsin');
  setVal('fkFundComment', fundPerformance_fundComment('fki', key, isin));
}
function saveInvestmentFund() {
  const keyBefore = val('invFundSelect') || (typeof investmentFundKeyFromForm === 'function' ? investmentFundKeyFromForm() : ''),
    isin = val('invFundIsin').trim(),
    comment = val('invFundComment').trim();
  if (typeof fundPerformance_oldSaveInvFund === 'function') fundPerformance_oldSaveInvFund.apply(this, arguments);
  const keyAfter = keyBefore || (typeof investmentFundKeyFromForm === 'function' ? investmentFundKeyFromForm() : '');
  fundPerformance_storeFundComment('investice', keyAfter, isin, comment);
  persist();
  renderAll();
  saveToast('Investiční fond uložen včetně komentáře do reportu');
}
function saveFkFund() {
  const keyBefore = val('fkFundSelect') || (typeof fkFundKeyFromForm === 'function' ? fkFundKeyFromForm() : ''),
    isin = val('fkFundIsin').trim(),
    comment = val('fkFundComment').trim();
  if (typeof fundPerformance_oldSaveFkFund === 'function') fundPerformance_oldSaveFkFund.apply(this, arguments);
  const keyAfter = keyBefore || (typeof fkFundKeyFromForm === 'function' ? fkFundKeyFromForm() : '');
  fundPerformance_storeFundComment('fki', keyAfter, isin, comment);
  persist();
  renderAll();
  saveToast('FKI fond uložen včetně komentáře do reportu');
}
function renderInvestmentDetail(row) {
  const c = row?.client,
    items = row?.items || [],
    current = row?.current || 0,
    invested = row?.invested || 0,
    realized = row?.realized || 0,
    gain = investmentPerformanceGain(current, invested, realized),
    gainPct = investmentPerformancePct(current, invested, realized),
    snaps = typeof latestInvestmentSnapshots === 'function' ? latestInvestmentSnapshots(c?.id).slice(0, 8) : [],
    last = snaps[0],
    funds = fundPerformance_classicGroups(items);
  if (!c) return typeof fundPerformance_prevRenderInvestmentDetail === 'function' ? fundPerformance_prevRenderInvestmentDetail.apply(this, arguments) : '<div class="investment-empty"><h2>Vyber klienta</h2></div>';
  return `<div class="investment-detail-head"><div class="avatar">${esc(initials(c.name))}</div><div><div class="eyebrow">Investiční karta klienta</div><h2>${esc(clientName(c))}</h2><div class="chips"><span class="badge blue">${num(funds.length)} fondů</span><span class="chip">${row.providers.length ? esc(row.providers.join(' · ')) : 'bez společnosti'}</span>${last ? `<span class="badge green">ověřeno ${esc(last.date || '')}</span>` : '<span class="badge orange">čeká na aktualizaci</span>'}</div></div><div class="actions"><button class="btn slim" onclick="selectedClientId=${c.id};showView('clients');clientSection='portfolio';renderClients()">Klient</button><button class="btn slim" onclick="openInvestmentSnapshotModal(${c.id})">Aktualizovat hodnoty</button><button class="btn slim primary" onclick="openInvestmentScenarioModal(${c.id},'Investice')">+ Nová investice</button></div></div><div class="investment-summary"><div class="metric"><span class="note">AUM / hodnota</span><b>${money(current)}</b></div><div class="metric"><span class="note">Vloženo</span><b>${money(invested)}</b></div><div class="metric"><span class="note">Výnos Kč</span><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b></div><div class="metric"><span class="note">Zhodnocení celkem</span><b class="${gain >= 0 ? 'green' : 'red'}">${gainPct.toFixed(1)} %</b></div></div>${renderInvestmentAllocation(items, current)}<div class="mini-card"><div class="toolbar"><div><div class="eyebrow">Detail investičních fondů</div><h3>Fondy klienta, pozice a hodnoty</h3></div><button class="btn" onclick="openInvestmentFundModal()">Fondy</button></div><div class="fki-work-list">${funds.map(f => fundPerformance_classicCard(f, c.id)).join('') || '<p class="note">Klient zatím nemá evidované investice.</p>'}</div></div>`;
}
function renderFkClientDetail(row) {
  const c = row?.client,
    items = row?.items || [],
    aum = row?.aum || 0,
    invested = row?.invested || 0,
    realized = row?.realized || 0,
    gain = investmentPerformanceGain(aum, invested, realized),
    gainPct = investmentPerformancePct(aum, invested, realized),
    locked = items.filter(x => x.locked);
  if (!c) return typeof fundPerformance_prevRenderFkDetail === 'function' ? fundPerformance_prevRenderFkDetail.apply(this, arguments) : '<div class="investment-empty"><h2>Vyber FK klienta</h2></div>';
  const stats = typeof clientLiquidityStats === 'function' ? clientLiquidityStats(row) : {
    readyCount: 0,
    total: items.length,
    next: ''
  };
  return `<div class="investment-detail-head"><div class="avatar">${esc(initials(c.name))}</div><div><div class="eyebrow">FK karta klienta</div><h2>${esc(clientName(c))}</h2><div class="chips"><span class="badge purple">${num(items.length)} fondů</span><span class="badge ${stats.readyCount ? 'green' : 'red'}">${num(stats.readyCount)} / ${num(stats.total)} k odkupu</span>${stats.next ? `<span class="badge red">nejbližší ${esc(stats.next)}</span>` : ''}<span class="chip">${esc(row.providers.join(' · ') || 'bez společnosti')}</span>${locked.length ? `<span class="badge orange">${num(locked.length)} zamčeno mimo AUM</span>` : '<span class="badge green">AUM aktivní</span>'}</div></div><div class="actions"><button class="btn slim" onclick="selectedClientId=${c.id};showView('clients');clientSection='portfolio';renderClients()">Klient</button><button class="btn slim" onclick="setFkMode('funds')">Fondy</button><button class="btn slim" onclick="openFkRecordModal(${c.id})">+ FKI záznam</button><button class="btn slim primary" onclick="openInvestmentScenarioModal(${c.id},'FKI')">+ Nová investice</button></div></div><div class="investment-summary"><div class="metric"><span class="note">Aktuálně vloženo netto</span><b>${money(invested)}</b></div><div class="metric"><span class="note">Aktuální hodnota</span><b>${money(aum)}</b></div><div class="metric"><span class="note">Aktuální výnos</span><b class="${gain >= 0 ? 'green' : 'red'}">${money(gain)}</b><small>${gainPct.toFixed(1)} % celkem</small></div><div class="metric"><span class="note">Odkupy připravené</span><b class="${stats.readyCount ? 'green' : 'red'}">${num(stats.readyCount)} / ${num(stats.total)}</b></div></div>${renderInvestmentAllocation(items, aum)}<div class="mini-card"><div class="toolbar"><div><div class="eyebrow">Detail investičních fondů</div><h3>Fondy klienta, daňový test a odkup</h3></div><button class="btn" onclick="openFkClientReportModal(${c.id})">Report FKI + investice</button></div><div class="fki-work-list">${items.sort((a, b) => b.rawAmount - a.rawAmount).map(x => fundPerformance_fkiCardPa(x, c.id)).join('') || '<p class="note">Klient zatím nemá FKI fondy.</p>'}</div></div>`;
}
function addInvestmentScenarioFund() {
  const before = (investmentScenario?.rows || []).length,
    minRate = fundPerformance_n(val('scenarioMinRate')),
    maxRate = fundPerformance_n(val('scenarioMaxRate'));
  if (typeof fundPerformance_oldAddScenario === 'function') fundPerformance_oldAddScenario.apply(this, arguments);
  const rows = investmentScenario?.rows || [];
  if (rows.length > before) {
    const row = rows[rows.length - 1];
    row.minRate = minRate || row.minRate || Math.max(0, fundPerformance_n(row.rate) - 2);
    row.maxRate = maxRate || row.maxRate || fundPerformance_n(row.rate) + 2;
    setVal('scenarioMinRate', '');
    setVal('scenarioMaxRate', '');
  }
  fundPerformance_renderScenarioRange();
}
function renderInvestmentScenario() {
  const out = typeof fundPerformance_oldRenderScenario === 'function' ? fundPerformance_oldRenderScenario.apply(this, arguments) : undefined;
  setTimeout(fundPerformance_renderScenarioRange, 0);
  return out;
}
function openFkClientReportModal(clientId) {
  window.openClientReportModal(clientId);
}
function renderPensions() {
  if (!document.getElementById('pensions')) return;
  const q = pensions_pNorm(pensions_pVal('pensionSearch')),
    items = pensions_pItems().filter(x => {
      const c = pensions_pClient(x.clientId);
      return !q || pensions_pNorm([pensions_pClientName(c), x.company, x.product, x.type, x.number].join(' ')).includes(q);
    }),
    rows = pensions_pClientRows(items),
    companies = pensions_pCompanyRows(items),
    detail = document.getElementById('pensionDetail');
  if (!pensions_selectedPensionClientId && rows[0]) pensions_selectedPensionClientId = rows[0].clientId;
  if (pensions_selectedPensionClientId && !rows.some(r => String(r.clientId) === String(pensions_selectedPensionClientId)) && rows[0]) pensions_selectedPensionClientId = rows[0].clientId;
  if (typeof setText === 'function') {
    setText('pensionClientCount', rows.length);
    setText('pensionContractCount', items.length);
    setText('pensionTotalAum', pensions_pMoney(items.reduce((s, x) => s + x.amount, 0)));
    setText('pensionCompanyCount', companies.length);
  }
  ['Client', 'Companies', 'Aum'].forEach(k => {
    const el = document.getElementById('pensionTab' + k);
    if (el) el.classList.toggle('active', pensions_pensionMode.toLowerCase() === k.toLowerCase());
  });
  const list = document.getElementById('pensionClientList');
  if (list) list.innerHTML = pensions_pListHtml(rows);
  if (!detail) return;
  if (pensions_pensionMode === 'companies') detail.innerHTML = pensions_pRenderCompanies(companies);else if (pensions_pensionMode === 'aum') detail.innerHTML = pensions_pRenderAum(companies);else {
    const row = rows.find(r => String(r.clientId) === String(pensions_selectedPensionClientId));
    detail.innerHTML = row ? pensions_pRenderClientDetail(row) : '<div class="empty-state"><h2>Penze</h2><p class="note">Zatím tu nejsou žádné aktivní DPS/DIP smlouvy.</p></div>';
  }
}
function selectPensionClient(id) {
  pensions_selectedPensionClientId = id;
  pensions_pensionMode = 'client';
  renderPensions();
}
function setPensionMode(mode) {
  pensions_pensionMode = mode || 'client';
  renderPensions();
}
function editPensionItem(kind, id) {
  const x = pensions_pItems().find(i => i.kind === kind && String(i.id) === String(id));
  if (x) pensions_pOpenItem(x);
}
function openPensionContractModal(clientId = null) {
  if (typeof openContractModal !== 'function') return;
  openContractModal(clientId || pensions_selectedPensionClientId || selectedClientId || null);
  setTimeout(() => {
    const t = document.getElementById('sType');
    if (t && !t.value) t.value = 'DPS';else if (t && t.value === 'auto') t.value = 'DPS';
    if (typeof syncContractDealDefaults === 'function') syncContractDealDefaults(true);
  }, 0);
}
function openClientReportModal(id) {
  const c = typeof findClient === 'function' ? findClient(id) : null;
  if (!c) return;
  reportClientId = id;
  const items = clientOutput_xClientInvestments(c),
    insurance = clientOutput_xContracts(c, 'insurance'),
    loans = clientOutput_xContracts(c, 'loans'),
    open = clientOutput_xOpen(c),
    opts = [['summary', 'Souhrn', 'Hlavní čísla portfolia a produktů', true], ['open', 'Rozpracováno', 'Aktuálně řešené návrhy a servis', open.length], ['insurance', 'Pojištění', 'Sjednané pojistné produkty', insurance.length], ['loans', 'Úvěry a hypotéky', 'Úvěrové a hypoteční produkty', loans.length], ['investments', 'Investice', 'Portfolio, grafy a fondové karty', items.length], ['notice', 'Upozornění', 'Krátké upozornění k reportu', true]];
  if (typeof setText === 'function') setText('clientReportTitle', 'Report pro klienta: ' + clientOutput_xName(c));
  if (typeof setVal === 'function') setVal('clientReportNote', '');
  const box = document.getElementById('clientReportOptions');
  if (box) box.innerHTML = opts.filter(x => x[3]).map(x => `<label class="mini-card" style="display:flex;gap:10px;align-items:flex-start;margin:0"><input type="checkbox" class="report-section-check" value="${clientOutput_xEsc(x[0])}" checked><span><b>${clientOutput_xEsc(x[1])}</b><br><span class="note">${clientOutput_xEsc(x[2])}</span></span></label>`).join('');
  openModal('clientReportModal');
}
function downloadClientReport() {
  const c = findClient(reportClientId);
  if (!c) return alert('Vyber klienta.');
  const opts = {};
  document.querySelectorAll('.report-section-check').forEach(x => opts[x.value] = x.checked);
  if (!Object.values(opts).some(Boolean)) return alert('Vyber aspoň jednu část reportu.');
  const html = clientOutput_xReportHtml(c, opts, byId('clientReportNote')?.value?.trim() || '');
  downloadHtmlFile(html, 'klientsky-report-' + (normId(clientName(c)) || 'klient') + '.html');
  closeModal('clientReportModal');
  toast('Klientský report připraven ke stažení');
}
function clientOverviewReportHtml(c, opts, note) {
  return clientOutput_xReportHtml(c, opts || {
    summary: true,
    open: true,
    insurance: true,
    loans: true,
    investments: true,
    notice: true
  }, note || '');
}
function fkClientReportHtml(c, row, opts = {}) {
  return clientOutput_xReportHtml(c, {
    summary: true,
    open: true,
    insurance: false,
    loans: false,
    investments: true,
    notice: true
  }, '');
}
function downloadFkClientReport(clientId) {
  const c = findClient(clientId);
  if (!c) return alert('Vyber klienta.');
  downloadHtmlFile(fkClientReportHtml(c), 'klientsky-report-' + (normId(clientName(c)) || 'klient') + '.html');
  toast('Klientský report připraven ke stažení');
}
function investmentScenarioReportHtml(c) {
  return clientOutput_xScenarioHtml(c);
}
function downloadInvestmentScenario() {
  if (!investmentScenario?.rows?.length) return alert('Nejdřív přidej alespoň jeden fond.');
  const c = scenarioSelectedClient();
  const name = c ? clientName(c) : scenarioClientDraft().name || 'novy-klient';
  downloadHtmlFile(investmentScenarioReportHtml(c), 'investicni-navrh-' + (normId(name) || 'klient') + '.html');
  toast('HTML návrh připraven ke stažení');
}
function crmActivityAnalysisType(a) {
  return activities_aDefaultAnalysisType(a);
}
function openActivityModal(clientId = null, id = null) {
  editingActivityId = id;
  const a = id ? (state.activities || []).find(x => String(x.id) === String(id)) : null;
  if (typeof fillClientSelect === 'function') fillClientSelect('aClient', a?.clientId || clientId || selectedClientId);
  activities_aSet('aClient', a?.clientId || clientId || selectedClientId || '');
  activities_aSet('aType', a?.type || 'Telefon');
  activities_aSet('aDate', a?.date || activities_aToday());
  activities_aSet('aTime', a?.time || '09:00');
  activities_aSet('aDuration', a?.duration || 60);
  activities_aSet('aLocation', a?.location || '');
  activities_aSet('aOutcome', activities_aOutcome(a));
  activities_aSet('aAnalysisType', activities_aDefaultAnalysisType(a || {
    type: 'Telefon'
  }));
  activities_aSet('aFollowDate', a?.followDate || '');
  activities_aSet('aFollowType', a?.followType || '');
  activities_aSet('aFollowTime', a?.followTime || '');
  activities_aSet('aFollowText', a?.followText || '');
  activities_aSet('aText', a?.text || '');
  activities_aSetText('activityModalTitle', a ? 'Upravit aktivitu' : 'Aktivita');
  if (typeof openModal === 'function') openModal('activityModal');
}
function saveActivity(markDone = false) {
  const clientId = +activities_aVal('aClient');
  if (!clientId) return alert('Vyber klienta.');
  state.activities = state.activities || [];
  let a = editingActivityId ? (state.activities || []).find(x => String(x.id) === String(editingActivityId)) : null;
  const isNew = !a;
  if (!a) {
    a = {
      id: activities_aUid(),
      createdAt: activities_aToday()
    };
    state.activities.push(a);
  }
  const outcome = activities_aVal('aOutcome') || 'agreed';
  const completed = !!markDone || outcome === 'realized' || outcome === 'no_show' || outcome === 'moved';
  Object.assign(a, {
    clientId,
    type: activities_aVal('aType') || 'Telefon',
    date: activities_aVal('aDate') || activities_aToday(),
    time: activities_aVal('aTime'),
    duration: activities_aNum(activities_aVal('aDuration')) || 0,
    location: activities_aVal('aLocation').trim(),
    text: activities_aVal('aText').trim(),
    outcome,
    analysisType: activities_aVal('aAnalysisType') || activities_aDefaultAnalysisType({
      type: activities_aVal('aType')
    }),
    followDate: activities_aVal('aFollowDate') || '',
    followType: activities_aVal('aFollowType') || '',
    followTime: activities_aVal('aFollowTime') || '',
    followText: activities_aVal('aFollowText').trim(),
    completed,
    completedAt: completed ? a.completedAt || activities_aToday() : '',
    updatedAt: activities_aToday()
  });
  if ((a.followDate || a.followType) && completed) activities_aCreateFollowUp(a);
  selectedClientId = clientId;
  editingActivityId = null;
  if (typeof closeModal === 'function') closeModal('activityModal');
  if (typeof persist === 'function') persist();
  if (typeof renderAll === 'function') renderAll();
  if (typeof saveToast === 'function') saveToast(completed ? 'Aktivita vyhodnocena' : 'Aktivita uložena');
  if (isNew && a.type === 'Schůzka' && !completed && typeof googleCalendarUrl === 'function') window.open(googleCalendarUrl(a), '_blank');
}
function addActivity(clientId, type, text, silent = false) {
  if (!clientId) return;
  state.activities = state.activities || [];
  state.activities.push({
    id: activities_aUid(),
    clientId,
    type,
    date: activities_aToday(),
    text,
    completed: !!silent,
    outcome: silent ? 'realized' : 'agreed',
    analysisType: activities_aDefaultAnalysisType({
      type
    }),
    createdAt: activities_aToday(),
    completedAt: silent ? activities_aToday() : ''
  });
  if (!silent && typeof renderAll === 'function') renderAll();
}
function completeDashboardTask(kind, id) {
  if (kind === 'contract') {
    const s = (state.contracts || []).find(x => String(x.id) === String(id));
    if (!s) return;
    s.statuses = [...new Set([...(Array.isArray(s.statuses) ? s.statuses : []), 'vyrizeno'])];
    s.log = s.log || [];
    s.log.push({
      d: activities_aToday(),
      t: 'Označeno jako hotovo z Dashboardu'
    });
    if (s.clientId) addActivity(s.clientId, 'Podpis', 'Smlouva vyřízena: ' + (s.product || s.type || 'smlouva'), true);
    if (typeof persist === 'function') persist();
    if (typeof renderAll === 'function') renderAll();
    if (typeof saveToast === 'function') saveToast('Smlouva označena jako hotovo');
    return;
  }
  const a = (state.activities || []).find(x => String(x.id) === String(id));
  if (!a) return;
  a.completed = true;
  a.completedAt = activities_aToday();
  a.outcome = 'realized';
  a.analysisType = activities_aDefaultAnalysisType(a) || 'Poznámka';
  a.updatedAt = activities_aToday();
  if (typeof persist === 'function') persist();
  if (typeof renderAll === 'function') renderAll();
  if (typeof saveToast === 'function') saveToast('Aktivita hotová a zapsaná do analýzy');
}
function dashboardWorkRows() {
  const source = typeof val === 'function' ? val('dashLeadSourceFilter') : '',
    todayText = activities_aToday();
  const acts = (state.activities || []).filter(a => !a.completed && String(a.date || todayText) <= todayText).map(a => ({
    kind: 'activity',
    id: a.id,
    clientId: a.clientId,
    c: activities_aClient(a.clientId),
    type: a.type || 'Aktivita',
    title: a.text || a.type || 'Aktivita',
    date: a.date || todayText,
    time: a.time || '',
    sortDate: a.date || todayText,
    days: Math.ceil((new Date((a.date || todayText) + 'T00:00:00') - new Date(todayText + 'T00:00:00')) / 86400000),
    status: `<span class="badge ${activities_aOutcomeBadge(a)}">${activities_aEsc(activities_aOutcomeLabel(a))}</span>`,
    text: a.location || '',
    rowClass: String(a.date || todayText) < todayText ? 'row-hot' : ''
  })).filter(x => !source || typeof leadSourceType !== 'function' || leadSourceType(x.c) === source).sort((a, b) => String(b.sortDate + ' ' + (b.time || '')).localeCompare(String(a.sortDate + ' ' + (a.time || '')), 'cs'));
  const contracts = (state.contracts || []).filter(s => typeof hasStatus !== 'function' || !hasStatus(s, 'vyrizeno') && !hasStatus(s, 'nechce')).map(s => {
    const d = typeof contractDays === 'function' ? contractDays(s) : 999;
    return {
      kind: 'contract',
      id: s.id,
      clientId: s.clientId,
      c: activities_aClient(s.clientId),
      s,
      d,
      type: 'Smlouva',
      title: [s.type, s.product].filter(Boolean).join(' · ') || 'Smlouva',
      date: s.anniv || '',
      sortDate: s.anniv || todayText,
      days: d,
      status: typeof getStatuses === 'function' ? getStatuses(s).map(statusBadge).join(' ') : '',
      text: s.company || '',
      rowClass: typeof rowClassContract === 'function' ? rowClassContract(s) : ''
    };
  }).filter(x => (!source || typeof leadSourceType !== 'function' || leadSourceType(x.c) === source) && (x.days <= 100 || typeof isActiveContract === 'function' && isActiveContract(x.s))).sort(typeof compareContractRows === 'function' ? compareContractRows : (a, b) => String(a.date).localeCompare(String(b.date)));
  return [...acts, ...contracts];
}
function renderDashboardWorkQueue() {
  const table = document.getElementById('dashTasks');
  if (!table) return;
  const rows = dashboardWorkRows(),
    shown = rows.slice(0, 180),
    more = rows.length - shown.length;
  table.innerHTML = `<thead><tr><th>Typ</th><th>Klient</th><th>Co řešit</th><th>Termín</th><th>Stav</th><th>Akce</th></tr></thead><tbody>${shown.map(x => `<tr class="${x.rowClass || ''}"><td><span class="badge ${x.kind === 'activity' ? 'blue' : 'orange'}">${activities_aEsc(x.type)}</span></td><td><b>${activities_aEsc(activities_aClientName(x.c))}</b><br><span class="note">${activities_aEsc(x.c?.phone || 'bez telefonu')} ${x.c?.email ? '· ' + activities_aEsc(x.c.email) : ''}</span></td><td><b>${activities_aEsc(x.title)}</b>${x.text ? `<br><span class="note">${activities_aEsc(x.text)}</span>` : ''}</td><td>${activities_aEsc(x.date || '')} ${x.time ? `<br><span class="note">${activities_aEsc(x.time)}</span>` : ''}${x.kind === 'contract' && typeof daysBadge === 'function' ? `<br>${daysBadge(x.days)}` : ''}</td><td>${x.status}</td><td><div class="actions"><button class="btn slim green" data-dash-action="done" data-kind="${activities_aEsc(x.kind)}" data-id="${activities_aEsc(x.id)}">Hotovo</button><button class="btn slim" data-dash-action="edit" data-kind="${activities_aEsc(x.kind)}" data-id="${activities_aEsc(x.id)}">Upravit</button><button class="btn slim" data-dash-action="client" data-client="${activities_aEsc(x.clientId)}">Klient</button>${activities_aContactAction(x)}</div></td></tr>`).join('') || '<tr><td colspan="6" class="note">Na dnešek nevidím žádné otevřené úkoly ani aktivity.</td></tr>'}${more > 0 ? `<tr><td colspan="6" class="note">Zobrazuji prvních ${shown.length} položek. Dalších ${more} je bezpečně skryto, aby se Dashboard nezasekl.</td></tr>` : ''}</tbody>`;
}
function renderDashboard() {
  renderDashboardMetrics();
  try {
    renderDashboardWorkQueue();
  } catch (e) {
    console.error('Render denních úkolů', e);
  }
}
function createActivityFromOpportunity() {
  const clientId = +activities_aVal('oClient');
  if (!clientId) return alert('Vyber klienta.');
  const type = activities_aVal('oActivityType') || 'Telefon',
    date = activities_aVal('oActivityDate') || activities_aToday(),
    time = activities_aVal('oActivityTime') || '',
    product = activities_aVal('oProduct') || activities_aVal('oCategory') || 'příležitost';
  const text = activities_aVal('oActivityText').trim() || `Příležitost: ${product}`;
  state.activities = state.activities || [];
  state.activities.push({
    id: activities_aUid(),
    clientId,
    type,
    date,
    time,
    duration: type === 'Schůzka' ? 60 : 15,
    location: '',
    text,
    completed: false,
    outcome: 'agreed',
    analysisType: activities_aDefaultAnalysisType({
      type
    }),
    createdAt: activities_aToday(),
    source: 'opportunity',
    sourceOpportunityId: editingOpportunityId || null
  });
  selectedClientId = clientId;
  if (typeof persist === 'function') persist();
  if (typeof renderAll === 'function') renderAll();
  if (typeof saveToast === 'function') saveToast('Aktivita naplánovaná k příležitosti');
}
function composeEmailForClient(clientId) {
  const c = activities_aClient(clientId),
    email = (typeof clientEmails === 'function' ? clientEmails(c) : [c?.email]).filter(Boolean)[0] || '';
  activities_aRecordEmail(clientId, 'Odeslán e-mail klientovi' + (email ? ' na ' + email : ' · bez uložené adresy'));
  if (typeof persist === 'function') persist();
  if (typeof renderAll === 'function') renderAll();
  window.location.href = 'mailto:' + encodeURIComponent(email);
}
function composeEmailForContract(clientId, contractId = null) {
  const c = activities_aClient(clientId),
    email = (typeof clientEmails === 'function' ? clientEmails(c) : [c?.email]).filter(Boolean)[0] || '',
    s = contractId ? (state.contracts || []).find(x => String(x.id) === String(contractId)) : null,
    subject = s ? [s.type, s.product, s.company].filter(Boolean).join(' · ') : 'Smlouvy';
  if (s) {
    s.statuses = [...new Set([...(Array.isArray(s.statuses) ? s.statuses : []), 'email'])];
    s.log = s.log || [];
    s.log.push({
      d: activities_aToday(),
      t: 'Email klientovi' + (email ? ' na ' + email : ' · bez uložené adresy')
    });
  }
  activities_aRecordEmail(clientId, 'Smlouva: ' + (s?.product || s?.type || 'bez produktu') + (email ? ' · ' + email : ' · bez uložené adresy'));
  if (typeof persist === 'function') persist();
  if (typeof renderAll === 'function') renderAll();
  window.location.href = 'mailto:' + encodeURIComponent(email) + (subject ? '?subject=' + encodeURIComponent(subject) : '');
}
function analysisRows(start, end) {
  return quickAnalysis_rows(start, end).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}
function updateQuickCallNextFields() {
  const show = String(quickAnalysis_v('quickCallNext') || '') === 'Schůzka' || String(quickAnalysis_v('quickCallNext') || '') === 'Zavolat později';
  document.querySelectorAll('#referrers .quick-call-follow').forEach(el => el.classList.toggle('is-hidden', !show));
}
function analysisActuals(start, end, key = '') {
  const list = analysisRows(start, end),
    signed = typeof analysisSignedDeals === 'function' ? analysisSignedDeals(start, end) : [],
    get = k => quickAnalysis_summary(list, k),
    calls = get('calls'),
    meetings = get('meetings'),
    referrals = get('referrals'),
    analyses = get('analyses'),
    presentations = get('presentations'),
    signatures = get('signatures'),
    coop = get('coop'),
    realized = list.filter(x => quickAnalysis_outcome(x) === 'realized');
  const all = quickAnalysis_ROWS.reduce((a, [k]) => {
    const su = get(k);
    a.agreed += su.planned;
    a.realized += su.realized;
    a.moved += su.moved;
    a.noShow += su.noShow;
    return a;
  }, {
    agreed: 0,
    realized: 0,
    moved: 0,
    noShow: 0
  });
  return {
    calls: calls.realized,
    minutes: calls.minutes,
    dayMinutes: calls.minutes,
    crmMinutes: calls.minutes,
    meetingsNew: 0,
    meetingsExisting: meetings.realized,
    referrals: referrals.realized,
    analyses: analyses.realized,
    presentations: presentations.realized,
    signatures: signatures.realized,
    coop: coop.realized,
    activities: realized.reduce((a, x) => a + (+x.count || 0), 0),
    signedDeals: signed.length,
    signedBj: signed.reduce((a, d) => a + (typeof dealBJ === 'function' ? dealBJ(d) : 0), 0),
    signedCommission: signed.reduce((a, d) => a + (typeof dealCash === 'function' ? dealCash(d) : 0), 0),
    rows: list,
    summary: {
      calls,
      meetings,
      all
    }
  };
}
function saveQuickAnalysis(kind) {
  const call = kind === 'call',
    date = quickAnalysis_v(call ? 'quickCallDate' : 'quickMeetingDate') || quickAnalysis_t(),
    minutes = quickAnalysis_n(quickAnalysis_v(call ? 'quickCallMinutes' : 'quickMeetingMinutes')),
    type = call ? 'Volání' : quickAnalysis_v('quickMeetingType') || 'Schůzka stávající klient',
    out = call ? quickAnalysis_v('quickCallOutcome') || 'realized' : quickAnalysis_v('quickMeetingOutcome') || 'realized',
    next = call ? quickAnalysis_v('quickCallNext') : quickAnalysis_v('quickMeetingNext');
  const followDate = call && next && (next === 'Schůzka' || next === 'Zavolat později') ? quickAnalysis_v('quickCallNextDate') : '',
    followTime = call && next ? quickAnalysis_v('quickCallNextTime') : '';
  if (call && next === 'Schůzka' && !followDate) return alert('Doplň datum schůzky. Díky tomu se započte do správného týdne.');
  if (call && next === 'Zavolat později' && !followDate) return alert('Doplň datum dalšího hovoru.');
  const note = call ? [quickAnalysis_v('quickCallNote'), next ? 'vedlo k: ' + next : ''].filter(Boolean).join(' · ') : [quickAnalysis_v('quickMeetingNote'), next ? 'výsledek: ' + next : ''].filter(Boolean).join(' · ');
  state.analysisEntries = state.analysisEntries || [];
  const baseId = quickAnalysis_id();
  state.analysisEntries.push({
    id: baseId,
    date,
    type,
    clientId: null,
    count: 1,
    minutes,
    note: note || '',
    outcome: out,
    nextType: next || '',
    nextDate: followDate || '',
    source: call ? 'Nový hovor' : 'Nová schůzka',
    createdAt: new Date().toISOString()
  });
  const shouldCreateNext = next && (call ? ['realized', 'agreed', 'moved'].includes(out) : out === 'realized');
  if (shouldCreateNext) {
    const nextType = next === 'Schůzka' ? 'Schůzka stávající klient' : next === 'Zavolat později' ? 'Volání' : next,
      entryDate = call && followDate ? followDate : date,
      entryOutcome = call ? 'agreed' : 'realized';
    state.analysisEntries.push({
      id: quickAnalysis_id(),
      date: entryDate,
      time: followTime || '',
      type: nextType,
      clientId: null,
      count: 1,
      minutes: 0,
      note: (call ? 'Navazující krok z hovoru' : 'Výsledek schůzky') + (followDate ? ' · termín ' + followDate : '') + (quickAnalysis_v(call ? 'quickCallNote' : 'quickMeetingNote') ? ' · ' + quickAnalysis_v(call ? 'quickCallNote' : 'quickMeetingNote') : ''),
      outcome: entryOutcome,
      source: call ? 'Výsledek hovoru' : 'Výsledek schůzky',
      parentId: baseId,
      createdAt: new Date().toISOString()
    });
  }
  if (call) {
    quickAnalysis_s('quickCallMinutes', '');
    quickAnalysis_s('quickCallNote', '');
    quickAnalysis_s('quickCallNext', '');
    quickAnalysis_s('quickCallNextDate', '');
    quickAnalysis_s('quickCallNextTime', '');
    quickAnalysis_s('quickCallOutcome', 'realized');
    updateQuickCallNextFields();
  } else {
    quickAnalysis_s('quickMeetingMinutes', '');
    quickAnalysis_s('quickMeetingNote', '');
    quickAnalysis_s('quickMeetingNext', '');
    quickAnalysis_s('quickMeetingOutcome', 'realized');
  }
  if (typeof persist === 'function') persist();
  if (typeof renderReferrerHub === 'function') renderReferrerHub();else renderAnalysis();
  if (typeof saveToast === 'function') saveToast(call ? 'Hovor zapsán do týdne' : 'Schůzka zapsána do týdne');
}
function saveAnalysisWeek(show = false) {
  const key = quickAnalysis_selectedWeek(),
    p = quickAnalysis_plan(key);
  p.updatedAt = new Date().toISOString();
  if (typeof persist === 'function') persist();
  if (typeof renderReferrerHub === 'function') renderReferrerHub();else renderAnalysis();
  if (show && typeof saveToast === 'function') saveToast('Týdenní vyhodnocení uloženo');
}
function renderAnalysisWeeklyPreview() {
  const key = quickAnalysis_selectedWeek(),
    r = quickAnalysis_range(key),
    list = analysisRows(r.start, r.end);
  let planned = 0,
    realized = 0;
  quickAnalysis_ROWS.forEach(([k]) => {
    const su = quickAnalysis_summary(list, k),
      p = su.planned,
      el = document.getElementById('weekly_' + k + '_pct');
    planned += p;
    realized += su.realized;
    if (el) {
      const pct = p ? Math.round(su.realized / p * 100) : null;
      el.textContent = pct === null ? 'bez domluvených' : quickAnalysis_fmt(pct) + ' %';
      el.className = 'num ' + (pct === null ? '' : pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'red');
    }
  });
  const days = quickAnalysis_callMinutesByDay(list),
    total = Object.values(days).reduce((a, b) => a + b, 0),
    box = document.getElementById('analysisCallDays');
  if (box) box.innerHTML = quickAnalysis_DAYS.map(([k, label]) => `<div class="analysis-day-pill"><span>${quickAnalysis_html(label)}</span><b>${quickAnalysis_fmt(days[k] || 0)} min</b></div>`).join('');
  const totalEl = document.getElementById('analysisCallTotal');
  if (totalEl) totalEl.textContent = quickAnalysis_fmt(total) + ' min';
  return {
    planned,
    realized,
    minutes: total,
    pct: planned ? Math.round(realized / planned * 100) : null
  };
}
function saveAnalysisActivity() {
  state.analysisEntries = state.analysisEntries || [];
  state.analysisEntries.push({
    id: quickAnalysis_id(),
    date: quickAnalysis_t(),
    type: 'Poznámka',
    clientId: null,
    count: 1,
    minutes: 0,
    note: 'Rychlý zápis',
    outcome: 'realized',
    source: 'Rychlý zápis',
    createdAt: new Date().toISOString()
  });
  if (typeof persist === 'function') persist();
  if (typeof renderReferrerHub === 'function') renderReferrerHub();else renderAnalysis();
}
function deleteAnalysisEntry(entryId) {
  if (!confirm('Smazat analytickou aktivitu?')) return;
  state.analysisEntries = (state.analysisEntries || []).filter(a => String(a.id) !== String(entryId) && String(a.parentId || '') !== String(entryId));
  if (typeof persist === 'function') persist();
  if (typeof renderReferrerHub === 'function') renderReferrerHub();else renderAnalysis();
  if (typeof saveToast === 'function') saveToast('Aktivita smazána');
}
function editAnalysisEntry(entryId) {
  const x = (state.analysisEntries || []).find(a => String(a.id) === String(entryId));
  if (!x) return alert('Zápis už v analýze nevidím.');
  const date = prompt('Datum zápisu', x.date || quickAnalysis_t());
  if (date === null) return;
  const type = prompt('Typ aktivity', x.type || 'Volání');
  if (type === null) return;
  const out = prompt('Výsledek: agreed = domluveno, realized = zrealizováno, moved = přesunuto, no_show = nedorazil', quickAnalysis_outcome(x));
  if (out === null) return;
  const next = prompt('Navazuje na: Schůzka, Analýza, Prezentace, Podpis, Doporučení, Spolupráce nebo prázdné', x.nextType || '');
  if (next === null) return;
  const minutes = prompt('Minuty', String(x.minutes || 0));
  if (minutes === null) return;
  const note = prompt('Poznámka', x.note || '');
  if (note === null) return;
  x.date = date || x.date;
  x.type = type || x.type;
  x.outcome = ['agreed', 'realized', 'moved', 'no_show'].includes(out) ? out : x.outcome;
  x.nextType = next || '';
  x.minutes = quickAnalysis_n(minutes);
  x.note = note;
  x.updatedAt = new Date().toISOString();
  state.analysisEntries = (state.analysisEntries || []).filter(a => !(String(a.parentId || '') === String(x.id) && String(a.source || '') === 'Výsledek schůzky'));
  if (quickAnalysis_rowKey(x.type) === 'meetings' && x.outcome === 'realized' && x.nextType) {
    state.analysisEntries.push({
      id: quickAnalysis_id(),
      date: x.date,
      type: x.nextType,
      clientId: null,
      count: 1,
      minutes: 0,
      note: 'Výsledek schůzky' + (x.note ? ' · ' + x.note : ''),
      outcome: 'realized',
      source: 'Výsledek schůzky',
      parentId: x.id,
      createdAt: new Date().toISOString()
    });
  }
  if (typeof persist === 'function') persist();
  if (typeof renderReferrerHub === 'function') renderReferrerHub();else renderAnalysis();
  if (typeof saveToast === 'function') saveToast('Zápis upraven');
}
function analysisWeekKeys() {
  const keys = new Set([quickAnalysis_wk()]);
  Object.keys(state.analysisPlans || {}).forEach(k => keys.add(k));
  (state.analysisEntries || []).forEach(x => {
    if (x.date) keys.add(quickAnalysis_wk(x.date));
  });
  if (typeof visibleDeals === 'function') visibleDeals().forEach(d => {
    if (d.date) keys.add(quickAnalysis_wk(d.date));
  });
  return [...keys].sort().reverse().slice(0, 36);
}
function renderAnalysisWeekHistory() {
  const table = document.getElementById('analysisWeekHistoryTable');
  if (!table) return;
  const out = analysisWeekKeys().map(k => {
    const r = quickAnalysis_range(k),
      a = analysisActuals(r.start, r.end, k),
      all = a.summary.all,
      pct = all.agreed ? Math.round(all.realized / all.agreed * 100) : null;
    return {
      k,
      r,
      a,
      all,
      pct
    };
  });
  table.innerHTML = `<thead><tr><th>Týden</th><th>Domluveno</th><th>Realizováno</th><th>Úspěšnost</th><th>Volání</th><th>Schůzky</th><th>Doporučení</th><th>Podpisy</th><th></th></tr></thead><tbody>${out.map(x => `<tr><td><b>${quickAnalysis_html(x.k)}</b><br><span class="note">${quickAnalysis_html(x.r.start)} až ${quickAnalysis_html(x.r.end)}</span></td><td class="num">${quickAnalysis_fmt(x.all.agreed)}</td><td class="num green">${quickAnalysis_fmt(x.all.realized)}</td><td class="num">${x.pct === null ? 'bez domluvených' : quickAnalysis_fmt(x.pct) + ' %'}</td><td class="num">${quickAnalysis_fmt(x.a.calls)}<br><span class="note">${quickAnalysis_fmt(x.a.minutes)} min</span></td><td class="num">${quickAnalysis_fmt(x.a.meetingsExisting)}</td><td class="num">${quickAnalysis_fmt(x.a.referrals)}</td><td class="num">${quickAnalysis_fmt(x.a.signatures)}</td><td><button class="btn slim" onclick="setAnalysisWeek('${quickAnalysis_html(x.k)}')">Otevřít</button></td></tr>`).join('') || '<tr><td colspan="9" class="note">Zatím není uložený žádný týden.</td></tr>'}</tbody>`;
}
function renderAnalysis() {
  const weekEl = document.getElementById('analysisWeek'),
    monthEl = document.getElementById('analysisMonth');
  if (!weekEl) return;
  if (!weekEl.value) weekEl.value = quickAnalysis_wk();
  if (monthEl && !monthEl.value) monthEl.value = quickAnalysis_t().slice(0, 7);
  ['quickCallDate', 'quickMeetingDate'].forEach(x => {
    if (!quickAnalysis_v(x)) quickAnalysis_s(x, quickAnalysis_t());
  });
  updateQuickCallNextFields();
  const key = quickAnalysis_selectedWeek(),
    r = quickAnalysis_range(key),
    list = analysisRows(r.start, r.end),
    a = analysisActuals(r.start, r.end, key),
    month = quickAnalysis_selectedMonth(),
    m = analysisActuals(month + '-01', month + '-31'),
    all = a.summary.all,
    pct = all.agreed ? Math.round(all.realized / all.agreed * 100) : null,
    metrics = document.getElementById('analysisMetrics');
  if (metrics) metrics.innerHTML = `<div class="metric"><span class="note">Úspěšnost týdne</span><b>${pct === null ? '—' : quickAnalysis_fmt(pct) + ' %'}</b><small>${quickAnalysis_fmt(all.realized)} z ${quickAnalysis_fmt(all.agreed)} domluvených kroků</small></div><div class="metric"><span class="note">Navoláno</span><b>${quickAnalysis_fmt(a.minutes)} min</b><small>${quickAnalysis_fmt(a.calls)} hovorů</small></div><div class="metric"><span class="note">Hovor → schůzka</span><b>${a.calls ? quickAnalysis_fmt(Math.round(a.summary.meetings.planned / a.calls * 100)) + ' %' : '—'}</b><small>${quickAnalysis_fmt(a.summary.meetings.planned)} domluveno</small></div><div class="metric"><span class="note">Doporučení / podpisy</span><b>${quickAnalysis_fmt(a.referrals)} / ${quickAnalysis_fmt(a.signatures)}</b></div>`;
  const table = document.getElementById('analysisPlanStatus');
  if (table) {
    table.classList.add('analysis-week-table');
    table.innerHTML = quickAnalysis_weekTable(key, list);
  }
  renderAnalysisWeeklyPreview();
  const activity = document.getElementById('analysisActivityTable'),
    quick = list.slice(0, 35);
  if (activity) activity.innerHTML = `<thead><tr><th>Datum</th><th>Aktivita</th><th>Výsledek</th><th>Navazuje</th><th>Minuty</th><th>Poznámka</th><th></th></tr></thead><tbody>${quick.map(x => `<tr><td>${quickAnalysis_html(x.date)}</td><td><b>${quickAnalysis_html(x.type)}</b><br><span class="note">${quickAnalysis_html(x.source || '')}</span></td><td><span class="badge ${quickAnalysis_outcome(x) === 'realized' ? 'green' : quickAnalysis_outcome(x) === 'agreed' ? 'blue' : quickAnalysis_outcome(x) === 'moved' ? 'orange' : 'red'}">${quickAnalysis_html({
    agreed: 'Domluveno',
    realized: 'Zrealizováno',
    moved: 'Přesunuto',
    no_show: 'Nedorazil'
  }[quickAnalysis_outcome(x)] || 'Zrealizováno')}</span></td><td>${quickAnalysis_html(x.nextType || '')}</td><td class="num">${quickAnalysis_fmt(x.minutes || 0)}</td><td>${quickAnalysis_html(x.note || '')}</td><td><button class="btn slim" onclick="editAnalysisEntry('${quickAnalysis_html(x.id)}')">Upravit</button> <button class="btn slim red" onclick="deleteAnalysisEntry('${quickAnalysis_html(x.id)}')">Smazat</button></td></tr>`).join('') || '<tr><td colspan="7" class="note">Zatím není zapsaný žádný hovor ani schůzka.</td></tr>'}</tbody>`;
  const mt = document.getElementById('analysisMonthTable'),
    monthRows = analysisRows(month + '-01', month + '-31');
  if (mt) mt.innerHTML = `<thead><tr><th>Aktivita</th><th>Domluveno</th><th>Zrealizováno</th><th>Přesunuto</th><th>Nedorazil</th><th>Úspěšnost</th><th>Minuty</th></tr></thead><tbody>${quickAnalysis_ROWS.map(([k, label]) => {
    const su = quickAnalysis_summary(monthRows, k),
      mp = su.planned ? Math.round(su.realized / su.planned * 100) : null;
    return `<tr><td><b>${quickAnalysis_html(label)}</b></td><td class="num">${quickAnalysis_fmt(su.planned)}</td><td class="num green">${quickAnalysis_fmt(su.realized)}</td><td class="num orange">${quickAnalysis_fmt(su.moved)}</td><td class="num red">${quickAnalysis_fmt(su.noShow)}</td><td class="num">${mp === null ? 'bez domluvených' : quickAnalysis_fmt(mp) + ' %'}</td><td class="num">${k === 'calls' ? quickAnalysis_fmt(su.minutes) + ' min' : '-'}</td></tr>`;
  }).join('')}</tbody>`;
  if (typeof renderAnalysisActivityChart === 'function') renderAnalysisActivityChart();
  if (typeof renderAnalysisBusinessChart === 'function') renderAnalysisBusinessChart();
  if (typeof renderAnalysisWeekHistory === 'function') renderAnalysisWeekHistory();
}
var syncCrmFkiDealsToRecords = fkiSync_syncCrmFkiDealsToRecords,
  investmentTrailPctForItem = commissions_investmentTrailPctForItem,
  investmentTrailAnnualForItem = commissions_investmentTrailAnnualForItem,
  investmentTrailAnnualGross = commissions_investmentTrailAnnualGross,
  investmentTrailSplit = commissions_investmentTrailSplit,
  fkiTrailAnnualGross = commissions_fkiOnlyTrailAnnualGross,
  fundValueDateText = liquidity_fundValueDateText,
  defaultFundComment = fundPerformance_defaultFundComment,
  defaultFundExpectedRate = fundPerformance_defaultFundExpectedRate,
  completeDashboardItem = completeDashboardTask;
const VERSION = '2026.09.16-1';
const VERSION_NOTE = 'Sjednocená aplikační logika, klidnější modrý glass vzhled a ověřené klientské HTML výstupy.';
const STORE = 'filip_crm_main_v1';
const DISK_STORAGE_URL = 'http://127.0.0.1:48730';
const GOOGLE_SYNC_APP = 'filip_crm';
const GOOGLE_SYNC_URL_KEY = 'filip_crm_google_sync_url';
const GOOGLE_SYNC_KEY_KEY = 'filip_crm_google_sync_key';
const GOOGLE_AUTO_PULL_KEY = 'filip_crm_google_auto_pull';
const OLD_GOOGLE_SYNC_URL_KEY = 'filip_crm_old_google_sync_url';
const OLD_GOOGLE_SYNC_KEY_KEY = 'filip_crm_old_google_sync_key';
const MONTHS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
const CATEGORIES = ['Investice', 'FKI', 'Životní pojištění', 'Neživotní pojištění', 'Úvěry', 'Hypotéky', 'Penze', 'Následná provize', 'Ostatní'];
const PLAN_CATEGORIES = ['Investice', 'Hypotéky', 'Životní pojištění', 'Neživotní pojištění', 'Úvěry'];
const OPPORTUNITY_STATUSES = ['Oportunita', 'Čekám na podklady', 'Ve schvalování', 'Schváleno', 'Podepsáno', 'Zamítnuto'];
const STATUS_LABELS = {
  '': 'Bez stavu',
  kontakt: 'Ke kontaktu',
  reseni: 'V řešení',
  prepojistit: 'K přepojištění',
  vypoved: 'Odeslána výpověď',
  nabidka: 'Odeslána nabídka',
  ceka_nabidka: 'Čekám na nabídku',
  ceka_podklady: 'Čekám na podklady',
  vyrizeno: 'Vyřízeno',
  podepsano: 'Podepsáno',
  nechce: 'Nechce',
  domluveno: 'Domluvena schůzka',
  nedovolano: 'Nedovoláno',
  sms: 'SMS',
  email: 'Email',
  telefon: 'Telefon',
  whatsapp: 'WhatsApp'
};
const ACTIVE_STATUS_IDS = ['reseni', 'prepojistit', 'vypoved', 'nabidka', 'ceka_nabidka', 'ceka_podklady', 'domluveno', 'kontakt', 'nedovolano', 'sms', 'email', 'telefon', 'whatsapp'];
let state = loadState(),
  selectedClientId = null,
  selectedInvestmentClientId = null,
  selectedInvestmentFundKey = null,
  selectedFkClientId = null,
  investmentMode = 'client',
  fkMode = 'client',
  clientSection = 'overview',
  clientPortfolioFocus = null,
  editingClientId = null,
  editingContractId = null,
  editingDealId = null,
  editingNoteId = null,
  viewingNoteId = null,
  editingOpportunityId = null,
  editingActivityId = null,
  pendingOpportunityToDealId = null,
  pendingContractToDealId = null,
  reportClientId = null,
  fkReportClientId = null,
  referralSourceClientId = null,
  mergingClientIds = [],
  contractAttachmentDraft = [],
  selectedMonth = new Date().getMonth(),
  googlePreviewState = null,
  bjChart = null,
  investmentChart = null,
  aumProviderChart = null,
  analysisActivityChart = null,
  localFkiSyncHash = '',
  diskStorageStatus = {
    ok: false,
    checked: false,
    message: 'Diskové úložiště zatím nebylo zkontrolované.'
  },
  diskSaveTimer = null,
  diskSaveInFlight = false,
  diskSavePending = false,
  diskLoadDone = false;
let fkReportManualItems = [];
let investmentScenario = {
  rows: []
};
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) m.classList.remove('show');
}));
const BACKUP_COUNT_LABELS = {
  clients: 'klientů',
  contracts: 'smluv',
  deals: 'obchodů',
  opportunities: 'příležitostí',
  notes: 'poznámek',
  activities: 'aktivit',
  analysisEntries: 'analytických aktivit',
  investments: 'investičních záznamů',
  investmentSnapshots: 'aktualizací investic',
  commissionImports: 'provizních importů',
  referrerPayouts: 'výplat tipařům',
  referrals: 'doporučení'
};
const BACKUP_PROTECTED_KEYS = ['clients', 'contracts', 'deals', 'opportunities', 'notes', 'activities', 'analysisEntries', 'investments', 'investmentSnapshots', 'commissionImports', 'referrerPayouts', 'referrals'];
let scenario_editableScope = '';
let fkiEditor_editingFkRecordKey = '',
  fkiEditor_editingFkClientId = null;
const fundIdentity_previousFkFundItems = collectFkFunds;
const annualAnalysis_ANALYSIS_YEAR_START = 2022;
const annualAnalysis_ANALYSIS_MONTH_LABELS = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čer', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
const annualAnalysis_ANALYSIS_YEAR_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#475569'];
let annualAnalysis_analysisBusinessChart = null;
const commissions_baseReportFundSettings = renderFundSettingsTable;
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-dash-action]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const action = btn.dataset.dashAction;
  if (action === 'done') completeDashboardTask(btn.dataset.kind, btn.dataset.id);
  if (action === 'client') window.dashboardOpenClient(btn.dataset.client);
  if (action === 'edit') window.openDashboardTask(btn.dataset.kind, btn.dataset.id);
});
const dashboard_prevOpenOpp = populateOpportunityForm;
const liquidity_TAX_DEFAULT = 36;
let liquidity_fkModalClientId = null,
  liquidity_fkModalRecordKey = '',
  liquidity_fkModalIsNewRedemption = false,
  liquidity_fkRedemptionSourceKey = '';
;
['scenarioMinRate', 'scenarioMaxRate', 'scenarioYears'].forEach(id => document.addEventListener('input', e => {
  if (e.target?.id === id) fundPerformance_renderScenarioRange();
}));
let pensions_selectedPensionClientId = null,
  pensions_pensionMode = 'client';
const pensions_pEsc = v => typeof esc === 'function' ? esc(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[m]);
const pensions_pMoney = v => typeof money === 'function' ? money(v || 0) : Math.round(+v || 0).toLocaleString('cs-CZ') + ' Kč';
const pensions_pNorm = v => typeof norm === 'function' ? norm(v || '') : String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pensions_pClientName = c => typeof clientName === 'function' ? clientName(c) : c?.name || 'Bez klienta';
const pensions_pVal = id => typeof val === 'function' ? val(id) : document.getElementById(id)?.value || '';
const pensions_pActiveStatusSet = new Set(['nechce', 'zruseno', 'zrušeno', 'ukonceno', 'ukončeno', 'storno', 'vypoved', 'výpověď']);
const clientOutput_colors = ['#0b3558', '#2aa7b8', '#93b9ad', '#f4cfaa', '#63779e', '#9fb9d8', '#d4b3e8', '#b9d78f', '#2563eb', '#16a34a'];
const clientOutput_xEsc = v => typeof esc === 'function' ? esc(v ?? '') : String(v ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
})[m]);
const clientOutput_xN = v => typeof parseMoney === 'function' ? parseMoney(v) || 0 : +String(v || 0).replace(/[^\d.-]/g, '') || 0;
const clientOutput_xMoney = v => typeof money === 'function' ? money(v || 0) : Math.round(+v || 0).toLocaleString('cs-CZ') + ' Kč';
const clientOutput_xNum = v => typeof num === 'function' ? num(v) : String(v || 0);
const clientOutput_xNorm = v => typeof norm === 'function' ? norm(v || '') : String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const clientOutput_xName = c => typeof clientName === 'function' ? clientName(c) : c?.name || 'Klient';
const clientOutput_xPct = v => isFinite(v) ? (v >= 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + ' %' : '-';
const clientOutput_xIso = v => {
  if (!v) return '';
  const s = String(v).trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const clientOutput_xDate = v => {
  const s = clientOutput_xIso(v);
  if (!s) return String(v || '');
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('cs-CZ');
};
const activities_A_OUTCOME_LABELS = {
  agreed: 'Domluveno',
  realized: 'Zrealizováno',
  moved: 'Přesunuto',
  no_show: 'Nedorazil'
};
const activities_A_OUTCOME_BADGES = {
  agreed: 'blue',
  realized: 'green',
  moved: 'orange',
  no_show: 'red'
};
const activities_A_TYPES = ['Volání', 'Doporučení', 'Schůzka nový klient', 'Schůzka stávající klient', 'Analýza', 'Prezentace', 'Podpis', 'Spolupráce', 'Poznámka'];
const quickAnalysis_ROWS = [['calls', 'Volání'], ['meetings', 'Schůzky'], ['referrals', 'Doporučení'], ['analyses', 'Analýzy'], ['presentations', 'Prezentace / poradenství'], ['signatures', 'Podpisy'], ['coop', 'Spolupráce']];
const quickAnalysis_DAYS = [['mon', 'Pondělí'], ['tue', 'Úterý'], ['wed', 'Středa'], ['thu', 'Čtvrtek'], ['fri', 'Pátek']];
scenario_ensure();
renderAll();
initDiskStorage().then(() => {
  fundPerformance_applyDefaultFundComments();
  fundPerformance_applyApprovedFundExpectedRates();
  renderAll();
});
