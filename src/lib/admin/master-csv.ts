import { MASTER_CONFIGS, type MasterEntity } from "./master-config";
import { normalizeMasterValues, valuesEqual, type MasterValues } from "./master-validation";

export type CsvPreviewStatus = "new" | "update" | "unchanged" | "invalid";
export type CsvPreviewRow = {
  line: number;
  id: string | null;
  label: string;
  status: CsvPreviewStatus;
  values: MasterValues;
  changedFields: string[];
  conflicts: string[];
  errors: string[];
};

export type CurrentProvenance = { field_name: string; source: string; review_status: string; is_current: boolean };

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(cell); cell = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  if (cell || row.length) { row.push(cell); if (row.some((value) => value.trim())) rows.push(row); }
  if (quoted) throw new Error("CSVの引用符が閉じられていません。");
  if (!rows.length) throw new Error("CSVが空です。");
  const headers = rows[0].map((header) => header.trim().replace(/^\uFEFF/, ""));
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) throw new Error(`CSV headerが重複しています: ${[...new Set(duplicates)].join("、")}`);
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function escapeCsv(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvHeaders(entity: MasterEntity) {
  return ["id", ...MASTER_CONFIGS[entity].fields.filter((field) => field.csv).map((field) => field.key)];
}

export function createCsv(entity: MasterEntity, rows: Array<Record<string, unknown>>) {
  const headers = csvHeaders(entity);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","))].join("\r\n");
}

export function createCsvTemplate(entity: MasterEntity) {
  const config = MASTER_CONFIGS[entity];
  const example: Record<string, unknown> = { id: "" };
  for (const field of config.fields) example[field.key] = field.required ? `${config.label} sample` : "";
  example.publication_status = "draft";
  if (entity === "venues") { example.venue_type = "museum"; example.is_active = "true"; }
  return createCsv(entity, [example]);
}

export function buildCsvPreview(
  entity: MasterEntity,
  inputRows: Array<Record<string, unknown>>,
  existing: Map<string, Record<string, unknown>>,
  provenance: Map<string, CurrentProvenance[]>,
) {
  const config = MASTER_CONFIGS[entity];
  const allowed = new Set(csvHeaders(entity));
  return inputRows.map<CsvPreviewRow>((input, index) => {
    const errors: string[] = [];
    const unknown = Object.keys(input).filter((key) => key && !allowed.has(key));
    if (unknown.length) errors.push(`未対応header: ${unknown.join("、")}`);
    const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : null;
    let values: MasterValues = {};
    try { values = normalizeMasterValues(entity, input); delete values.publication_status; } catch (error) { errors.push(error instanceof Error ? error.message : "値が不正です。"); }
    const current = id ? existing.get(id) : undefined;
    if (id && !current) errors.push("指定IDのレコードが見つかりません。");
    const label = String(values[config.titleKey] || input[config.titleKey] || `Line ${index + 2}`);
    if (errors.length) return { line: index + 2, id, label, status: "invalid", values, changedFields: [], conflicts: [], errors };
    if (!current) return { line: index + 2, id: null, label, status: "new", values, changedFields: Object.keys(values), conflicts: [], errors: [] };
    const changedFields = Object.keys(values).filter((key) => !valuesEqual(current[key], values[key]));
    const protectedFields = new Set((provenance.get(id!) || []).filter((item) => item.is_current && (item.source === "manual" || item.review_status === "approved")).map((item) => item.field_name));
    const conflicts = changedFields.filter((key) => protectedFields.has(key));
    return { line: index + 2, id, label, status: changedFields.length ? "update" : "unchanged", values, changedFields, conflicts, errors: [] };
  });
}

export function summarizeCsvPreview(rows: CsvPreviewRow[]) {
  return {
    total: rows.length,
    new: rows.filter((row) => row.status === "new").length,
    update: rows.filter((row) => row.status === "update").length,
    unchanged: rows.filter((row) => row.status === "unchanged").length,
    invalid: rows.filter((row) => row.status === "invalid").length,
    conflicts: rows.reduce((sum, row) => sum + row.conflicts.length, 0),
  };
}
