const SPREADSHEET_ID = 'PASTE_GOOGLE_SHEET_ID_HERE';
const SYNC_KEY = 'CHANGE_THIS_PRIVATE_KEY';
const CHUNK_SIZE = 45000;

const SHEETS = {
  backups: 'backups',
  chunks: 'backup_chunks',
  log: 'sync_log'
};

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const callback = safeCallbackName(p.callback || 'filipCrmSyncCallback');

  try {
    requireKey_(p.key);
    ensureSheets_();

    if (p.action === 'status') {
      return jsonp_(callback, { ok: true, latest: latestMeta_(p.app || 'filip_crm') });
    }

    if (p.action === 'load') {
      const app = p.app || 'filip_crm';
      const meta = latestMeta_(app);
      if (!meta) return jsonp_(callback, { ok: false, error: 'Pro tuto aplikaci zatim neni ulozena zadna zaloha.' });
      const payload = loadPayload_(app, meta.backupId);
      return jsonp_(callback, { ok: true, meta, backup: payload });
    }

    return jsonp_(callback, { ok: false, error: 'Neznama akce.' });
  } catch (err) {
    return jsonp_(callback, { ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};

  try {
    requireKey_(p.key);
    ensureSheets_();

    if (p.action !== 'save') throw new Error('Neznama akce.');

    const app = p.app || 'filip_crm';
    const payload = String(p.payload || '');
    if (!payload) throw new Error('Chybi data zalohy.');

    const parsed = JSON.parse(payload);
    const backupId = Utilities.getUuid();
    const createdAt = new Date();
    const chunks = chunkText_(payload, CHUNK_SIZE);

    const ss = spreadsheet_();
    const backups = ss.getSheetByName(SHEETS.backups);
    const chunkSheet = ss.getSheetByName(SHEETS.chunks);
    const log = ss.getSheetByName(SHEETS.log);

    backups.appendRow([
      app,
      backupId,
      createdAt,
      parsed.version || '',
      parsed.schemaVersion || '',
      parsed.build || '',
      parsed.state && Array.isArray(parsed.state.clients) ? parsed.state.clients.length : '',
      parsed.state && Array.isArray(parsed.state.contracts) ? parsed.state.contracts.length : '',
      chunks.length,
      payload.length
    ]);

    const rows = chunks.map((text, index) => [app, backupId, index, chunks.length, text]);
    chunkSheet.getRange(chunkSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    log.appendRow([createdAt, app, 'save', backupId, 'OK', payload.length]);

    return html_('Zaloha FILIP CRM byla ulozena do Google Sheets.');
  } catch (err) {
    try {
      const log = spreadsheet_().getSheetByName(SHEETS.log);
      if (log) log.appendRow([new Date(), p.app || 'filip_crm', 'save', '', 'ERROR', String(err && err.message ? err.message : err)]);
    } catch (ignored) {}
    return html_('Zalohu se nepodarilo ulozit: ' + String(err && err.message ? err.message : err));
  }
}

function spreadsheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PASTE_GOOGLE_SHEET_ID_HERE') {
    throw new Error('V Apps Scriptu neni nastavene SPREADSHEET_ID.');
  }
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function requireKey_(key) {
  if (!SYNC_KEY || SYNC_KEY === 'CHANGE_THIS_PRIVATE_KEY') {
    throw new Error('V Apps Scriptu neni nastaveny soukromy SYNC_KEY.');
  }
  if (String(key || '') !== SYNC_KEY) throw new Error('Neplatny sync klic.');
}

function ensureSheets_() {
  const ss = spreadsheet_();
  const specs = [
    [SHEETS.backups, ['app', 'backup_id', 'created_at', 'version', 'schema_version', 'build', 'client_count', 'contract_count', 'chunk_count', 'payload_length']],
    [SHEETS.chunks, ['app', 'backup_id', 'chunk_index', 'chunk_count', 'chunk_text']],
    [SHEETS.log, ['created_at', 'app', 'action', 'backup_id', 'status', 'note']]
  ];

  specs.forEach(([name, headers]) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    }
  });
}

function latestMeta_(app) {
  const sh = spreadsheet_().getSheetByName(SHEETS.backups);
  if (!sh || sh.getLastRow() < 2) return null;

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
  const rows = values
    .filter(row => row[0] === app)
    .map(row => ({
      app: row[0],
      backupId: row[1],
      createdAt: row[2] instanceof Date ? row[2].toISOString() : String(row[2] || ''),
      version: row[3],
      schemaVersion: row[4],
      build: row[5],
      clientCount: row[6],
      contractCount: row[7],
      chunkCount: row[8],
      payloadLength: row[9]
    }));

  if (!rows.length) return null;
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows[0];
}

function loadPayload_(app, backupId) {
  const sh = spreadsheet_().getSheetByName(SHEETS.chunks);
  if (!sh || sh.getLastRow() < 2) throw new Error('Datove chunky nejsou dostupne.');

  const values = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  const parts = values
    .filter(row => row[0] === app && row[1] === backupId)
    .sort((a, b) => Number(a[2]) - Number(b[2]));

  if (!parts.length) throw new Error('Zaloha nema zadna ulozena data.');

  const expected = Number(parts[0][3]);
  if (parts.length !== expected) throw new Error('Zaloha neni kompletni. Chybi nektera cast dat.');

  return JSON.parse(parts.map(row => row[4]).join(''));
}

function chunkText_(text, size) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

function jsonp_(callback, data) {
  return ContentService
    .createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function html_(message) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px;color:#172033">' +
    '<strong>' + escapeHtml_(message) + '</strong>' +
    '</body>'
  );
}

function safeCallbackName(name) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(name || '')) ? String(name) : 'filipCrmSyncCallback';
}

function escapeHtml_(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
