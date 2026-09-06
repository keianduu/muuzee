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
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  conflicts: string[];
  errors: string[];
  sourceType: string;
  fieldSourceUrls: Record<string, string>;
  generatedByAiFields: string[];
  aiConfidenceByField: Record<string, "high" | "medium" | "low">;
  aiNotes: string;
  relationValues?: {
    artistId?: string; artistName?: string; venueId?: string; venueName?: string;
    holdingType?: string; presentationType?: string; presentationStatus?: string;
    presentationStartDate?: string; presentationEndDate?: string; sourceUrl?: string;
  };
};

export type CurrentProvenance = { field_name: string; source: string; source_url?: string | null; review_status: string; is_current: boolean; generated_by_ai?: boolean };

export const SOURCE_PRIORITY: Record<string, number> = {
  manual: 400,
  official_website: 300,
  wikipedia: 150,
  trusted_api: 200,
  // CSV is a transport, not evidence of source authority. Source B exports
  // declare official_website explicitly; undeclared CSV stays lowest.
  csv_import: 0,
  wikidata: 100,
};

const venueMetadataHeaders = [
  "source_type", "crawl_status", "crawled_at", "crawl_source_url", "description_generated_by_ai",
  "description_source_url", "description_source_text", "phone", "address_source_url", "postal_code_source_url",
  "opening_hours_source_url", "closed_days_source_url", "access_source_url", "ambiguous_fields", "notes",
  "official_source_text", "ai_notes", "generated_by_ai", "address_confidence", "postal_code_confidence",
  "opening_hours_text_confidence", "closed_days_text_confidence", "access_text_confidence", "description_confidence",
];
const workRelationHeaders = ["artist_id", "artist_name", "venue_id", "venue_name", "holding_type", "presentation_type", "presentation_status", "presentation_start_date", "presentation_end_date", "source_url"];

const aiFields = ["address", "postal_code", "opening_hours_text", "closed_days_text", "access_text", "description"] as const;
const sourceUrlHeader: Record<string, string> = {
  address: "address_source_url", postal_code: "postal_code_source_url", opening_hours_text: "opening_hours_source_url",
  closed_days_text: "closed_days_source_url", access_text: "access_source_url", description: "description_source_url",
};

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
  return ["id", ...MASTER_CONFIGS[entity].fields.filter((field) => field.csv).map((field) => field.key), ...(entity === "works" ? workRelationHeaders : [])];
}

export function acceptedCsvHeaders(entity: MasterEntity) {
  return entity === "venues" ? [...csvHeaders(entity), ...venueMetadataHeaders] : csvHeaders(entity);
}

export function createCsv(entity: MasterEntity, rows: Array<Record<string, unknown>>) {
  const headers = csvHeaders(entity);
  return [headers.join(","), ...rows.map((row) => headers.map((header) => {
    if (entity !== "works") return escapeCsv(row[header]);
    const artist = ((row.work_artists || []) as Array<Record<string, unknown>>)[0]; const artistRecord = artist?.artists as Record<string, unknown> | undefined;
    const holding = ((row.collection_holdings || []) as Array<Record<string, unknown>>)[0]; const venueRecord = holding?.venues as Record<string, unknown> | undefined;
    const presentation = ((row.work_presentations || []) as Array<Record<string, unknown>>)[0];
    const relational: Record<string, unknown> = { artist_id: artist?.artist_id, artist_name: artistRecord?.name, venue_id: holding?.venue_id, venue_name: venueRecord?.name, holding_type: holding?.holding_type, presentation_type: presentation?.presentation_type, presentation_status: presentation?.status, presentation_start_date: presentation?.start_date, presentation_end_date: presentation?.end_date, source_url: holding?.source_url || artist?.source_url || presentation?.source_url };
    return escapeCsv(relational[header] ?? row[header]);
  }).join(","))].join("\r\n");
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
  const allowed = new Set(acceptedCsvHeaders(entity));
  return inputRows.map<CsvPreviewRow>((input, index) => {
    const errors: string[] = [];
    const unknown = Object.keys(input).filter((key) => key && !allowed.has(key));
    if (unknown.length) errors.push(`未対応header: ${unknown.join("、")}`);
    if (entity === "venues" && input.source_type && !["official_website", "trusted_api", "csv_import"].includes(String(input.source_type))) errors.push(`未対応source_type: ${input.source_type}`);
    const id = typeof input.id === "string" && input.id.trim() ? input.id.trim() : null;
    const sourceType = entity === "venues" && input.source_type === "official_website" ? "official_website"
      : entity === "venues" && input.source_type === "trusted_api" ? "trusted_api" : "csv_import";
    const isPartialSource = sourceType === "official_website";
    const fieldInput = isPartialSource
      ? Object.fromEntries(Object.entries(input).filter(([key, value]) => allowed.has(key) && csvHeaders(entity).includes(key) && String(value || "").trim()))
      : Object.fromEntries(Object.entries(input).filter(([key]) => !workRelationHeaders.includes(key)));
    let values: MasterValues = {};
    try { values = normalizeMasterValues(entity, fieldInput, { partial: isPartialSource }); delete values.publication_status; } catch (error) { errors.push(error instanceof Error ? error.message : "値が不正です。"); }
    const current = id ? existing.get(id) : undefined;
    if (id && !current) errors.push("指定IDのレコードが見つかりません。");
    const label = String(values[config.titleKey] || input[config.titleKey] || `Line ${index + 2}`);
    const fieldSourceUrls = Object.fromEntries(Object.keys(values).flatMap((field) => {
      const key = sourceUrlHeader[field] || `${field}_source_url`;
      const value = String(input[key] || input.crawl_source_url || input.official_url || "").trim();
      return value ? [[field, value]] : [];
    }));
    const declaredAiFields = String(input.generated_by_ai || "").split("|").map((field) => field.trim()).filter(Boolean);
    if (declaredAiFields.some((field) => !aiFields.includes(field as typeof aiFields[number]))) errors.push("generated_by_aiに未対応Fieldがあります。");
    const generatedByAiFields = [...new Set([
      ...declaredAiFields.filter((field) => values[field] != null && String(values[field]).trim()),
      ...(input.description_generated_by_ai === "true" && values.description ? ["description"] : []),
    ])];
    const aiConfidenceByField = Object.fromEntries(generatedByAiFields.flatMap((field) => {
      const confidence = String(input[`${field}_confidence`] || "").trim();
      if (!confidence) return [];
      if (!["high", "medium", "low"].includes(confidence)) { errors.push(`${field}_confidenceはhigh / medium / lowで入力してください。`); return []; }
      return [[field, confidence]];
    })) as Record<string, "high" | "medium" | "low">;
    for (const field of generatedByAiFields) {
      if (!fieldSourceUrls[field]) errors.push(`${field}: AI生成Fieldには公式source URLが必要です。`);
    }
    const aiNotes = String(input.ai_notes || "").trim();
    const relationValues = entity === "works" ? {
      artistId: String(input.artist_id || "").trim() || undefined, artistName: String(input.artist_name || "").trim() || undefined,
      venueId: String(input.venue_id || "").trim() || undefined, venueName: String(input.venue_name || "").trim() || undefined,
      holdingType: String(input.holding_type || "").trim() || "collection", presentationType: String(input.presentation_type || "").trim() || undefined,
      presentationStatus: String(input.presentation_status || "").trim() || undefined, presentationStartDate: String(input.presentation_start_date || "").trim() || undefined,
      presentationEndDate: String(input.presentation_end_date || "").trim() || undefined, sourceUrl: String(input.source_url || "").trim() || undefined,
    } : undefined;
    if (relationValues?.artistId && !/^[0-9a-f-]{36}$/i.test(relationValues.artistId)) errors.push("artist_idがUUIDではありません。");
    if (relationValues?.venueId && !/^[0-9a-f-]{36}$/i.test(relationValues.venueId)) errors.push("venue_idがUUIDではありません。");
    if (relationValues?.holdingType && !["collection", "long_term_loan", "deposit", "other"].includes(relationValues.holdingType)) errors.push("holding_typeが不正です。");
    if (relationValues?.presentationType && !["permanent", "temporary", "unknown"].includes(relationValues.presentationType)) errors.push("presentation_typeが不正です。");
    if (relationValues?.presentationStatus && !["currently_displayed", "not_displayed", "unknown"].includes(relationValues.presentationStatus)) errors.push("presentation_statusが不正です。");
    if ((relationValues?.presentationType || relationValues?.presentationStatus) && !(relationValues.venueId || relationValues.venueName)) errors.push("Presentationにはvenue_idまたはvenue_nameが必要です。");
    const base = { sourceType, fieldSourceUrls, generatedByAiFields, aiConfidenceByField, aiNotes, relationValues };
    if (errors.length) return { line: index + 2, id, label, status: "invalid", values, changedFields: [], changes: [], conflicts: [], errors, ...base };
    if (!current) return { line: index + 2, id: null, label, status: "new", values, changedFields: Object.keys(values), changes: Object.entries(values).map(([field, after]) => ({ field, before: null, after })), conflicts: [], errors: [], ...base };
    const changedFields = Object.keys(values).filter((key) => !valuesEqual(current[key], values[key]));
    const currentSources = new Map((provenance.get(id!) || []).filter((item) => item.is_current).map((item) => [item.field_name, item]));
    const incomingPriority = SOURCE_PRIORITY[sourceType] || 0;
    const conflicts = changedFields.filter((key) => {
      const currentSource = currentSources.get(key);
      if (!currentSource) return false;
      const currentPriority = SOURCE_PRIORITY[currentSource.source] || 0;
      return currentPriority > incomingPriority || (currentPriority === incomingPriority && currentSource.source !== sourceType);
    });
    try {
      const ambiguous = JSON.parse(String(input.ambiguous_fields || "{}")) as Record<string, unknown>;
      for (const field of changedFields) if (ambiguous[field] && !conflicts.includes(field)) conflicts.push(field);
    } catch { if (input.ambiguous_fields) errors.push("ambiguous_fieldsのJSONが不正です。"); }
    const changes = changedFields.map((field) => ({ field, before: current[field], after: values[field] }));
    const hasRelationInput = Boolean(relationValues?.artistId || relationValues?.artistName || relationValues?.venueId || relationValues?.venueName);
    return { line: index + 2, id, label, status: errors.length ? "invalid" : changedFields.length || hasRelationInput ? "update" : "unchanged", values, changedFields, changes, conflicts, errors, ...base };
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
