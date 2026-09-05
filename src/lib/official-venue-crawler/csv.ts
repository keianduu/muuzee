import type { OfficialCrawlResult } from "./types";

export const OFFICIAL_CRAWL_CSV_HEADERS = [
  "id", "name", "official_url", "source_type", "crawl_status", "crawled_at", "crawl_source_url",
  "address", "postal_code", "opening_hours_text", "closed_days_text", "access_text",
  "description", "description_generated_by_ai", "description_source_url", "description_source_text", "phone",
  "address_source_url", "postal_code_source_url", "opening_hours_source_url", "closed_days_source_url", "access_source_url",
  "ambiguous_fields", "notes",
] as const;

export const OFFICIAL_AI_ENRICHMENT_CSV_HEADERS = [
  "id", "name", "official_url", "source_type", "crawl_status", "crawled_at", "crawl_source_url",
  "address", "postal_code", "opening_hours_text", "closed_days_text", "access_text", "description",
  "address_source_url", "postal_code_source_url", "opening_hours_source_url", "closed_days_source_url",
  "access_source_url", "description_source_url", "description_source_text", "official_source_text",
  "ai_notes", "address_confidence", "postal_code_confidence", "opening_hours_text_confidence",
  "closed_days_text_confidence", "access_text_confidence", "description_confidence", "generated_by_ai",
  "ambiguous_fields",
] as const;

function escapeCsv(value: unknown) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function createOfficialCrawlCsv(rows: OfficialCrawlResult[]) {
  return [OFFICIAL_CRAWL_CSV_HEADERS.join(","), ...rows.map((row) => {
    const record: Record<string, unknown> = { ...row, id: row.venue_id, source_type: "official_website", description_generated_by_ai: "false" };
    return OFFICIAL_CRAWL_CSV_HEADERS.map((header) => escapeCsv(record[header])).join(",");
  })].join("\r\n");
}

export function createOfficialAiEnrichmentCsv(rows: OfficialCrawlResult[]) {
  return [OFFICIAL_AI_ENRICHMENT_CSV_HEADERS.join(","), ...rows.map((row) => {
    const record: Record<string, unknown> = {
      ...row,
      id: row.venue_id,
      source_type: "official_website",
      generated_by_ai: "",
      ai_notes: "",
      official_source_text: row.official_source_text || [
        row.description_source_text,
        Object.entries(row.ambiguous_fields || {}).map(([field, values]) => `${field}: ${values.join(" | ")}`).join("\n"),
      ].filter(Boolean).join("\n"),
    };
    return OFFICIAL_AI_ENRICHMENT_CSV_HEADERS.map((header) => escapeCsv(record[header])).join(",");
  })].join("\r\n");
}
