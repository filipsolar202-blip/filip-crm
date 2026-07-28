import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/a./Documents/Codex/FILIP-CRM/google-sync";
const workbook = Workbook.create();

const sheets = [
  {
    name: "backups",
    headers: ["app", "backup_id", "created_at", "version", "schema_version", "build", "client_count", "contract_count", "chunk_count", "payload_length"],
    widths: [18, 34, 22, 12, 16, 14, 14, 16, 14, 16],
    note: "Prehled ulozenych zaloh FILIP CRM. Tento list vyplnuje Apps Script automaticky."
  },
  {
    name: "backup_chunks",
    headers: ["app", "backup_id", "chunk_index", "chunk_count", "chunk_text"],
    widths: [18, 34, 14, 14, 80],
    note: "Datove casti zaloh. Tento list needituj rucne."
  },
  {
    name: "sync_log",
    headers: ["created_at", "app", "action", "backup_id", "status", "note"],
    widths: [22, 18, 14, 34, 14, 60],
    note: "Log ulozeni a chyb synchronizace."
  }
];

for (const spec of sheets) {
  const sheet = workbook.worksheets.add(spec.name);
  sheet.showGridLines = false;
  sheet.getRange("A1").values = [[spec.name]];
  sheet.getRange("A2").values = [[spec.note]];
  sheet.getRangeByIndexes(3, 0, 1, spec.headers.length).values = [spec.headers];
  sheet.getRangeByIndexes(4, 0, 1, spec.headers.length).values = [spec.headers.map(() => "")];
  sheet.freezePanes.freezeRows(4);

  const title = sheet.getRangeByIndexes(0, 0, 1, spec.headers.length);
  title.merge();
  title.format.fill.color = "#172033";
  title.format.font.color = "#FFFFFF";
  title.format.font.bold = true;
  title.format.font.size = 14;

  const note = sheet.getRangeByIndexes(1, 0, 1, spec.headers.length);
  note.merge();
  note.format.fill.color = "#EEF4F8";
  note.format.font.color = "#64748B";
  note.format.wrapText = true;
  note.format.rowHeightPx = 34;

  const header = sheet.getRangeByIndexes(3, 0, 1, spec.headers.length);
  header.format.fill.color = "#DBEAFE";
  header.format.font.bold = true;
  header.format.font.color = "#1E3A8A";
  header.format.borders = { preset: "all", style: "thin", color: "#CBD5E1" };

  const data = sheet.getRangeByIndexes(4, 0, 20, spec.headers.length);
  data.format.borders = { preset: "inside", style: "thin", color: "#E2E8F0" };

  for (let i = 0; i < spec.widths.length; i++) {
    sheet.getRangeByIndexes(0, i, 1, 1).format.columnWidth = spec.widths[i];
  }
}

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/filip-crm-zaloha.xlsx`);
console.log(`${outputDir}/filip-crm-zaloha.xlsx`);
