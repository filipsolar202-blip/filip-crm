(() => {
'use strict';

// Investicni scenar: jednotlive fondy, vklady, dokupy, propady a graf.

  // Scenar pracuje jako samostatna vrstva nad evidenci fondu a neprepise puvodni data.
// Scenario module for the unified investment/FKI model.
  if (window.__filipScenarioEnhancement) return;
  window.__filipScenarioEnhancement = true;

  const VERSION = 'v2026.08.10-1';
  // Row-based scenario model: every selected fund keeps its own assumptions.
  // Row-based scenario editor: each fund keeps its own rate, top-up and drop settings.
  const state = { funds: [], clients: [], rows: [], horizon: 10, selectedClient: '' };
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const money = (v) => `${Math.round(num(v)).toLocaleString('cs-CZ')} Kč`;
  const pct = (v) => {
    const n = num(v);
    return `${Number.isInteger(n) ? n : Number(n.toFixed(2)).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} %`;
  };
  const norm = (v) => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  function addCss() {
    const css = `
      .filip-scenario-launch{position:fixed;right:24px;bottom:24px;z-index:9000;border:0;border-radius:14px;padding:13px 18px;background:linear-gradient(135deg,#2468ed,#1499bd);color:#fff;font:700 14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-shadow:0 12px 28px rgba(32,93,190,.24);cursor:pointer}
      .filip-scenario-layer{position:fixed;inset:0;z-index:9100;background:rgba(31,43,65,.42);backdrop-filter:blur(12px);display:none;padding:20px;overflow:auto}
      .filip-scenario-layer.is-open{display:block}
      .filip-scenario-shell{max-width:1500px;margin:0 auto;border:1px solid rgba(255,255,255,.86);border-radius:26px;background:linear-gradient(135deg,rgba(246,251,255,.96),rgba(236,243,255,.94));box-shadow:0 24px 70px rgba(22,50,90,.26);padding:24px;color:#17243b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .filip-scenario-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;border-bottom:1px solid #d9e3f1;padding-bottom:18px;margin-bottom:18px}
      .filip-scenario-kicker{font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#667c9d}.filip-scenario-head h2{margin:4px 0 3px;font-size:26px}.filip-scenario-head p{margin:0;color:#70829e}
      .filip-scenario-close{border:1px solid #d4dfed;background:#fff;border-radius:12px;padding:10px 14px;font-weight:800;cursor:pointer;color:#24344d}
      .filip-scenario-section{border:1px solid #d8e4f2;border-radius:18px;background:rgba(255,255,255,.72);padding:18px;margin:14px 0;box-shadow:0 8px 24px rgba(59,96,143,.07)}
      .filip-scenario-section h3{margin:0 0 14px;font-size:18px}.filip-scenario-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.filip-scenario-field{display:flex;flex-direction:column;gap:6px}.filip-scenario-field label{font-size:11px;font-weight:800;text-transform:uppercase;color:#7184a0;letter-spacing:.06em}.filip-scenario-field input,.filip-scenario-field select{width:100%;min-height:40px;border:1px solid #cedcec;border-radius:11px;background:#fff;padding:8px 10px;font:inherit;color:#1b2b45;box-sizing:border-box}
      .filip-scenario-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.filip-scenario-btn{border:1px solid #d5e0ee;border-radius:11px;background:#fff;color:#24344d;padding:10px 13px;font-weight:800;cursor:pointer}.filip-scenario-btn.primary{border-color:#2671e8;background:#2671e8;color:#fff}.filip-scenario-btn.green{border-color:#36bf75;background:#eafff2;color:#14854c}.filip-scenario-btn.danger{color:#a72e2e;background:#fff3f3;border-color:#f4c2c2}
      .filip-scenario-note{border:1px solid #ffd7a5;background:#fff8ed;color:#a45a18;border-radius:12px;padding:11px 13px;font-size:13px;margin-top:12px}
      .filip-scenario-table{width:100%;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d7e2f0;border-radius:14px;background:#fff}.filip-scenario-table th{background:#f3f7fd;color:#667b9b;font-size:11px;text-align:left;padding:10px 9px;text-transform:uppercase;letter-spacing:.05em}.filip-scenario-table td{border-top:1px solid #e3eaf4;padding:9px;font-size:13px;vertical-align:middle}.filip-scenario-table input,.filip-scenario-table select{width:100%;min-width:76px;box-sizing:border-box;border:1px solid #d3dfed;border-radius:9px;padding:8px;background:#fff;font:inherit}.filip-scenario-table .fund-select{min-width:260px}.filip-scenario-table .remove-row{border:0;border-radius:9px;background:#fff0f0;color:#b52828;padding:8px 10px;font-weight:800;cursor:pointer}
      .filip-scenario-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin-top:14px}.filip-scenario-kpi{border:1px solid #dce6f2;border-radius:13px;background:rgba(255,255,255,.78);padding:12px}.filip-scenario-kpi span{display:block;color:#8192aa;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.filip-scenario-kpi strong{display:block;margin-top:4px;font-size:18px}.filip-scenario-kpi.positive strong{color:#13964c}
      .filip-scenario-chart{width:100%;height:280px;display:block;border:1px solid #d9e5f3;border-radius:14px;background:#fff}.filip-scenario-proposal td{font-size:13px}.filip-scenario-foot{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:16px}.filip-scenario-status{font-size:12px;color:#59708f}.filip-scenario-empty{text-align:center;padding:22px;color:#8092aa;border:1px dashed #cad8e9;border-radius:12px}
      @media(max-width:1000px){.filip-scenario-grid{grid-template-columns:1fr 1fr}.filip-scenario-summary{grid-template-columns:repeat(3,1fr)}.filip-scenario-table{display:block;overflow:auto;white-space:nowrap}}
      @media(max-width:650px){.filip-scenario-layer{padding:8px}.filip-scenario-shell{padding:14px;border-radius:18px}.filip-scenario-grid,.filip-scenario-summary{grid-template-columns:1fr}.filip-scenario-head{display:block}.filip-scenario-close{margin-top:10px}}
    `;
    document.head.insertAdjacentHTML('beforeend', `<style id="filip-scenario-enhancement-css">${css}</style>`);
  }

  function parseLocalStorage() {
    const values = [];
    try { for (let i = 0; i < localStorage.length; i += 1) { const key = localStorage.key(i); const raw = localStorage.getItem(key); if (raw && raw.length < 12000000) { try { values.push(JSON.parse(raw)); } catch (_) {} } } } catch (_) {}
    return values;
  }
  function walk(value, visit, depth = 0, seen = new Set()) {
    if (!value || depth > 5 || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value); visit(value);
    if (Array.isArray(value)) value.slice(0, 3000).forEach((v) => walk(v, visit, depth + 1, seen));
    else Object.values(value).slice(0, 3000).forEach((v) => walk(v, visit, depth + 1, seen));
  }
  function collectData() {
    const funds = [], clients = [], fundSeen = new Set(), clientSeen = new Set();
    const addFund = (obj, fallback = '') => {
      const label = obj && typeof obj === 'object' ? (obj.fundName || obj.fond || obj.fund || obj.productName || obj.produkt || obj.name || obj.nazev) : fallback;
      if (!label || typeof label !== 'string' || label.length < 2) return;
      const company = obj && typeof obj === 'object' ? (obj.company || obj.spolecnost || obj.producer || obj.producent || obj.manager || '') : '';
      const area = obj && typeof obj === 'object' ? (obj.area || obj.oblast || obj.type || obj.typ || (norm(label).includes('fki') ? 'FKI' : 'Investice')) : 'Investice';
      const rate = obj && typeof obj === 'object' ? num(obj.yieldPa ?? obj.vynosPa ?? obj.annualReturn ?? obj.rocniVynos ?? obj.rate) : 0;
      const key = norm(`${company}|${label}`);
      if (!fundSeen.has(key)) { fundSeen.add(key); funds.push({ label, company: String(company || ''), area: String(area || 'Investice'), rate }); }
    };
    const addClient = (obj, fallback = '') => {
      const raw = obj && typeof obj === 'object' ? (obj.clientName || obj.klient || obj.client || obj.owner || obj.name || '') : fallback;
      if (!raw || typeof raw !== 'string' || raw.trim().split(/\s+/).length < 2) return;
      const key = norm(raw); if (!clientSeen.has(key)) { clientSeen.add(key); clients.push(raw.trim()); }
    };
    parseLocalStorage().forEach((root) => walk(root, (obj) => { addFund(obj); addClient(obj); }));
    document.querySelectorAll('select option').forEach((option) => {
      const text = option.textContent.trim();
      if (text.split(/\s+/).length >= 2 && !/^(ano|ne|vse|vše|bez|ihned)$/i.test(text)) addClient(null, text);
      if (/fond|opf|fki|dps|dip|invest|avant|codya|edward|atris|wood|penta|csnf|vigo|realia/i.test(text)) addFund(null, text);
    });
    [
      ['Vi horev.Capital SICAV, a.s.', 'Avant', 'FKI', 7], ['r2p invest SICAV, a.s.', 'Avant', 'FKI', 6.4],
      ['REALIA Podfond Retail Parks', 'Avant', 'FKI', 7.2], ['JULIUS MEINL SUB-FUND 2024 tř.A_CZK', 'Codya', 'FKI', 13],
      ['Podfond ČSEF AQUA', 'Avant', 'FKI', 8.3], ['Atris - Realita OPF', 'Atris', 'Investice', 5],
      ['Edward invest - Edward', 'Edward invest', 'Investice', 5], ['ČS - DPS', 'ČS', 'Investice', 3]
    ].forEach(([label, company, area, rate]) => addFund({ label, company, area, rate }));
    return { funds: funds.sort((a,b) => a.label.localeCompare(b.label, 'cs')), clients: clients.sort((a,b) => a.localeCompare(b, 'cs')) };
  }

  function fundOptions(selected = '') { return `<option value="">Vyberte fond…</option>${state.funds.map((f, i) => `<option value="${i}" ${String(selected) === String(i) ? 'selected' : ''}>${esc(f.label)} · ${esc(f.company || 'Nezařazeno')} · ${esc(f.area)}</option>`).join('')}`; }
  function clientOptions() { return `<option value="">Nový / bez klienta</option>${state.clients.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}`; }
  function newRow(fundIndex = '') { const f = state.funds[fundIndex]; return { fundIndex, amount: 0, rate: f?.rate || 0, topYear: 0, topUp: 0, dropYear: 0, dropPct: 0 }; }
  function rowValue(row) {
    let value = num(row.amount);
    const horizon = Math.max(1, Math.round(num(state.horizon) || 1));
    for (let year = 1; year <= horizon; year += 1) {
      value *= 1 + (num(row.rate) / 100);
      if (num(row.topYear) === year) value += num(row.topUp);
      if (num(row.dropYear) === year) value *= Math.max(0, 1 - num(row.dropPct) / 100);
    }
    return value;
  }
  function currentValue(row) { return num(row.amount); }
  function rowsMarkup() {
    if (!state.rows.length) return `<div class="filip-scenario-empty">Zatím není vybraný žádný fond. Klikněte na „+ Přidat fond“ a nastavte investici jako v původní kalkulačce.</div>`;
    return `<table class="filip-scenario-table"><thead><tr><th>Fond</th><th>Vklad</th><th>Zhodnocení p.a.</th><th>Dokup rok</th><th>Dokup</th><th>Propad rok</th><th>Propad %</th><th></th></tr></thead><tbody>${state.rows.map((r, i) => `<tr data-row="${i}"><td><select class="fund-select" data-field="fundIndex">${fundOptions(r.fundIndex)}</select></td><td><input type="number" min="0" step="0.01" data-field="amount" value="${num(r.amount)}"></td><td><input type="number" step="0.01" data-field="rate" value="${num(r.rate)}"></td><td><select data-field="topYear"><option value="0">Nikdy</option>${Array.from({length: Math.max(1, Math.round(num(state.horizon) || 1))}, (_, y) => `<option value="${y + 1}" ${num(r.topYear) === y + 1 ? 'selected' : ''}>${y + 1}. rok</option>`).join('')}</select></td><td><input type="number" min="0" step="0.01" data-field="topUp" value="${num(r.topUp)}"></td><td><select data-field="dropYear"><option value="0">Bez propadu</option>${Array.from({length: Math.max(1, Math.round(num(state.horizon) || 1))}, (_, y) => `<option value="${y + 1}" ${num(r.dropYear) === y + 1 ? 'selected' : ''}>${y + 1}. rok</option>`).join('')}</select></td><td><input type="number" min="0" max="100" step="0.01" data-field="dropPct" value="${num(r.dropPct)}"></td><td><button class="remove-row" data-remove="${i}" title="Odstranit fond">×</button></td></tr>`).join('')}</tbody></table>`;
  }
  function calcSummary() {
    const current = state.rows.reduce((s, r) => s + currentValue(r), 0);
    const newMoney = state.rows.reduce((s, r) => s + num(r.topUp), 0);
    const invested = state.rows.reduce((s, r) => s + num(r.amount) + num(r.topUp), 0);
    const modeled = state.rows.reduce((s, r) => s + rowValue(r), 0);
    const weighted = current ? state.rows.reduce((s, r) => s + currentValue(r) * num(r.rate), 0) / current : 0;
    return { current, newMoney, invested, modeled, gain: modeled - invested, weighted };
  }
  function proposalMarkup() {
    if (!state.rows.length) return '';
    return `<div class="filip-scenario-section"><h3>Navržené investice</h3><p style="margin:0 0 12px;color:#70829e">Horizont ${Math.round(num(state.horizon) || 1)} let · celkový vklad ${money(state.rows.reduce((s,r)=>s+num(r.amount),0))} · modelovaná hodnota ${money(state.rows.reduce((s,r)=>s+rowValue(r),0))}</p><table class="filip-scenario-table filip-scenario-proposal"><thead><tr><th>Fond</th><th>Oblast</th><th>Částka</th><th>Výnos p.a.</th><th>Modelovaná hodnota</th></tr></thead><tbody>${state.rows.map((r) => { const f=state.funds[r.fundIndex] || {}; return `<tr><td><strong>${esc(f.label || 'Fond')}</strong><br><span style="color:#7184a0">${esc(f.company || 'Nezařazeno')}</span></td><td>${esc(f.area || 'Investice')}</td><td>${money(r.amount)}</td><td>${pct(r.rate)}</td><td>${money(rowValue(r))}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function drawChart() {
    const canvas = $('filip-scenario-chart'); if (!canvas) return;
    const ctx = canvas.getContext('2d'); const width = canvas.clientWidth * (window.devicePixelRatio || 1); const height = canvas.clientHeight * (window.devicePixelRatio || 1); canvas.width = width; canvas.height = height; ctx.clearRect(0,0,width,height);
    const horizon = Math.max(1, Math.round(num(state.horizon) || 1)); const totals = []; let max = 1;
    for (let year = 0; year <= horizon; year += 1) { let total = 0; state.rows.forEach((r) => { let v=num(r.amount); for(let y=1;y<=year;y++){v*=1+num(r.rate)/100;if(num(r.topYear)===y)v+=num(r.topUp);if(num(r.dropYear)===y)v*=Math.max(0,1-num(r.dropPct)/100);} total+=v; }); totals.push(total); max=Math.max(max,total); }
    const pad=42, w=width-pad*1.5, h=height-50; ctx.strokeStyle='#dfe7f2';ctx.lineWidth=1; for(let i=0;i<4;i++){const y=20+h*i/3;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(pad+w,y);ctx.stroke();}
    ctx.fillStyle='#7184a0';ctx.font=`${12*(window.devicePixelRatio||1)}px -apple-system`; ctx.fillText('0 Kč',5,height-18);ctx.fillText(money(max),5,22);
    ctx.strokeStyle='#2570eb';ctx.lineWidth=3*(window.devicePixelRatio||1);ctx.beginPath(); totals.forEach((v,i)=>{const x=pad+w*i/horizon,y=20+h-(v/max)*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
    ctx.fillStyle='#7184a0'; for(let i=0;i<=horizon;i++)ctx.fillText(`${i} r`,pad+w*i/horizon-8,height-10);
  }
  function render() {
    const s=calcSummary(); const host=$('filip-scenario-content'); if(!host)return;
    host.innerHTML=`<div class="filip-scenario-section"><h3>1) Klient a vstupy scénáře</h3><div class="filip-scenario-grid"><div class="filip-scenario-field"><label>Klient</label><select id="filip-scenario-client">${clientOptions()}</select></div><div class="filip-scenario-field"><label>Doba modelace (roky)</label><input id="filip-scenario-horizon" type="number" min="1" max="60" step="1" value="${Math.round(num(state.horizon)||10)}"></div><div class="filip-scenario-field"><label>Požadovaná renta</label><input id="filip-scenario-rent" type="number" min="0" step="0.01" placeholder="Nepovinné"></div></div><div class="filip-scenario-summary"><div class="filip-scenario-kpi"><span>Současná hodnota</span><strong>${money(s.current)}</strong></div><div class="filip-scenario-kpi"><span>Nově vloženo</span><strong>${money(s.newMoney)}</strong></div><div class="filip-scenario-kpi"><span>Celkem vloženo</span><strong>${money(s.invested)}</strong></div><div class="filip-scenario-kpi"><span>Modelovaná hodnota</span><strong>${money(s.modeled)}</strong></div><div class="filip-scenario-kpi positive"><span>Celkový výnos</span><strong>${money(s.gain)}</strong></div><div class="filip-scenario-kpi positive"><span>Vážený výnos p.a.</span><strong>${pct(s.weighted)}</strong></div></div></div><div class="filip-scenario-section"><div class="filip-scenario-head" style="border:0;padding:0;margin:0 0 12px"><div><h3>2) Dokup a model investice</h3><p style="margin:0;color:#70829e">Každý fond má vlastní vklad, výnos, dokup i propad. Výnos se načte z evidence fondů a můžete ho ručně upravit.</p></div><button class="filip-scenario-btn primary" id="filip-scenario-add">+ Přidat fond</button></div>${rowsMarkup()}<div class="filip-scenario-note">U existujícího klienta se portfolio načte jako výchozí stav modelace. Změny v tomto scénáři jsou pouze návrh, do CRM se zapíší až po potvrzení.</div></div>${proposalMarkup()}<div class="filip-scenario-section"><h3>3) Vývoj portfolia v čase</h3><canvas id="filip-scenario-chart" class="filip-scenario-chart"></canvas></div><div class="filip-scenario-foot"><span class="filip-scenario-status">Scénář ${VERSION}. Hodnoty jsou orientační modelace.</span><div class="filip-scenario-actions"><button class="filip-scenario-btn" id="filip-scenario-save">Uložit scénář</button><button class="filip-scenario-btn" id="filip-scenario-export">HTML pro klienta</button><button class="filip-scenario-btn primary" id="filip-scenario-close-bottom">Zavřít</button></div></div>`;
    $('filip-scenario-client').value=state.selectedClient; $('filip-scenario-horizon').addEventListener('input',(e)=>{state.horizon=num(e.target.value)||1;render();}); $('filip-scenario-client').addEventListener('change',(e)=>{state.selectedClient=e.target.value;render();}); $('filip-scenario-add').addEventListener('click',()=>{state.rows.push(newRow(0));render();}); $('filip-scenario-close-bottom').addEventListener('click',close);
    host.querySelectorAll('[data-field]').forEach((el)=>el.addEventListener('change',(e)=>{const tr=e.target.closest('tr');const i=num(tr.dataset.row);const field=e.target.dataset.field;state.rows[i][field]=field==='fundIndex'?e.target.value:num(e.target.value);if(field==='fundIndex'){state.rows[i].rate=state.funds[num(e.target.value)]?.rate||0;}render();}));
    host.querySelectorAll('[data-remove]').forEach((el)=>el.addEventListener('click',()=>{state.rows.splice(num(el.dataset.remove),1);render();})); $('filip-scenario-save').addEventListener('click',()=>{try{const old=JSON.parse(localStorage.getItem('filip_crm_scenarios')||'[]');old.push({version:VERSION,date:new Date().toISOString(),client:state.selectedClient,horizon:state.horizon,rows:state.rows,summary:s});localStorage.setItem('filip_crm_scenarios',JSON.stringify(old));alert('Scénář byl uložen.');}catch(_){alert('Scénář se nepodařilo uložit do prohlížeče.');}}); $('filip-scenario-export').addEventListener('click',exportHtml); drawChart();
  }
  function open(){state.funds=collectData().funds;state.clients=collectData().clients;state.rows=[];state.horizon=10;state.selectedClient='';$('filip-scenario-layer').classList.add('is-open');render();}
  function close(){$('filip-scenario-layer')?.classList.remove('is-open');}
  function exportHtml(){const s=calcSummary();const html=`<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Investiční scénář</title><style>body{font:16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17243b;background:#eef5ff;margin:0;padding:30px}main{max-width:1100px;margin:auto;background:#fff;border:1px solid #d8e4f2;border-radius:22px;padding:28px}h1{margin-top:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px;border-bottom:1px solid #e2eaf4}th{color:#68809f;background:#f4f8fd}.k{display:inline-block;width:30%;padding:12px 0}.k b{display:block;font-size:22px}</style><main><small>INVESTIČNÍ SCÉNÁŘ</small><h1>${esc(state.selectedClient||'Klient')}</h1><p>Horizont ${Math.round(num(state.horizon)||1)} let</p><div class="k">Současná hodnota<b>${money(s.current)}</b></div><div class="k">Celkem vloženo<b>${money(s.invested)}</b></div><div class="k">Modelovaná hodnota<b>${money(s.modeled)}</b></div><table><thead><tr><th>Fond</th><th>Oblast</th><th>Vklad</th><th>Výnos p.a.</th><th>Modelovaná hodnota</th></tr></thead><tbody>${state.rows.map(r=>{const f=state.funds[r.fundIndex]||{};return `<tr><td>${esc(f.label||'Fond')}<br><small>${esc(f.company||'')}</small></td><td>${esc(f.area||'')}</td><td>${money(r.amount)}</td><td>${pct(r.rate)}</td><td>${money(rowValue(r))}</td></tr>`}).join('')}</tbody></table></main></html>`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));a.download='investicni-scenar-klient.html';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  function init(){addCss();document.body.insertAdjacentHTML('beforeend',`<button class="filip-scenario-launch" id="filip-scenario-launch">+ Scénář investice</button><div class="filip-scenario-layer" id="filip-scenario-layer"><div class="filip-scenario-shell"><div class="filip-scenario-head"><div><div class="filip-scenario-kicker">Návrh investice</div><h2>Investiční scénář</h2><p>Fondy se načítají z evidence Investice a FKI.</p></div><button class="filip-scenario-close" id="filip-scenario-close">Zavřít</button></div><div id="filip-scenario-content"></div></div></div>`);$('filip-scenario-launch').addEventListener('click',open);$('filip-scenario-close').addEventListener('click',close);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
