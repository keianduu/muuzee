import type { SupabaseClient } from "@supabase/supabase-js";
import { buildVenueFieldReviewRows, eligibleSelectedVenueFields, OFFICIAL_REVIEW_FIELDS, type ReviewSource, type VenueFieldReviewRow } from "./venue-data-review";

async function venueAndSources(db: SupabaseClient, venueId: string) {
  const [{ data: venue, error: venueError }, { data: sources, error: sourceError }] = await Promise.all([
    db.from("venues").select("*").eq("id", venueId).single(),
    db.from("venue_field_sources").select("field_name,source,source_url,is_current").eq("venue_id", venueId).eq("is_current", true),
  ]);
  if (venueError || !venue) throw venueError || new Error("Venue not found");
  if (sourceError) throw sourceError;
  return { venue: venue as Record<string, unknown>, sources: sources || [] };
}

export async function previewOfficialVenueFields(db: SupabaseClient, venueId: string, runId?: string | null) {
  let query = db.from("official_venue_crawl_results").select("*").eq("venue_id", venueId);
  if (runId) query = query.eq("import_run_id", runId);
  const { data: crawl, error } = await query.order("crawled_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!crawl) throw new Error("公式サイト取得結果が見つかりません。");
  const { venue, sources } = await venueAndSources(db, venueId);
  const values = (crawl.extracted_values || {}) as Record<string, unknown>;
  const sourceUrls = (crawl.field_source_urls || {}) as Record<string, string | null>;
  if (crawl.description_source_url) sourceUrls.description = crawl.description_source_url;
  return {
    runId: crawl.import_run_id as string,
    crawlStatus: crawl.crawl_status as string,
    notes: crawl.notes as string | null,
    rows: buildVenueFieldReviewRows(venue, sources, values, "official_website", sourceUrls, OFFICIAL_REVIEW_FIELDS),
  };
}

async function recordCurrentProvenance(db: SupabaseClient, venueId: string, row: VenueFieldReviewRow, source: ReviewSource) {
  const { error: clearError } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", row.key).eq("is_current", true);
  if (clearError) throw clearError;
  const { error } = await db.from("venue_field_sources").insert({
    venue_id: venueId,
    field_name: row.key,
    source,
    source_url: row.candidateSourceUrl,
    source_record_id: null,
    value_snapshot: row.candidateValue,
    generated_by_ai: false,
    review_status: "applied",
    is_current: true,
  });
  if (error) throw error;
}

export async function applyOfficialVenueFields(db: SupabaseClient, venueId: string, runId: string, selectedFields: string[]) {
  const allowed = new Set(OFFICIAL_REVIEW_FIELDS.map(([key]) => key));
  if (selectedFields.some((field) => !allowed.has(field as typeof OFFICIAL_REVIEW_FIELDS[number][0]))) throw new Error("Unsupported official website field");
  const preview = await previewOfficialVenueFields(db, venueId, runId);
  const eligible = eligibleSelectedVenueFields(preview.rows, selectedFields);
  if (!eligible.length) return { applied: [], protectedFields: preview.rows.filter((row) => row.protected).map((row) => row.key) };
  const updates = Object.fromEntries(eligible.map((row) => [row.key, row.candidateValue]));
  const { error } = await db.from("venues").update(updates).eq("id", venueId);
  if (error) throw error;
  for (const row of eligible) await recordCurrentProvenance(db, venueId, row, "official_website");
  return { applied: eligible.map((row) => row.key), protectedFields: preview.rows.filter((row) => row.protected).map((row) => row.key) };
}
