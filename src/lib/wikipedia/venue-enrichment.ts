import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeAddress } from "@/lib/venue-canonicalization/matcher";
import { SOURCE_PRIORITY } from "@/lib/venue-enrichment/source-application";
import { fetchWikipediaAddress, resolveWikipediaSite } from "./client";
import { decideWikipediaAddressApplication, hasMultipleLocationSignal, isSafeAutomaticWikipediaAddress, wikipediaProvenanceRow } from "./venue-address";

export type WikipediaVenueScope = "A" | "A-B" | "A-C" | "selected";
export type WikipediaVenueResult = {
  venueId: string; venueName: string; tier: string; qid: string | null;
  status: "applied" | "unchanged" | "no_article" | "address_not_found" | "conflict" | "unsafe_language" | "error";
  wikipediaTitle?: string; wikipediaUrl?: string; address?: string; sourceField?: string; message?: string;
};

export type WikipediaVenueBatchResult = {
  dryRun: boolean; requested: number; processed: number; wikipediaArticleFound: number; addressFound: number;
  addressAdded: number; unchanged: number; noArticle: number; addressNotFound: number; conflict: number; error: number;
  results: WikipediaVenueResult[]; errors: Array<{ venueId: string; venueName: string; message: string }>;
};

function tiersFor(scope: WikipediaVenueScope) {
  if (scope === "A") return ["A"];
  if (scope === "A-B") return ["A", "B"];
  return ["A", "B", "C"];
}

function qidFor(venue: Record<string, unknown>) {
  if (/^Q\d+$/.test(String(venue.best_wikidata_candidate_qid || ""))) return String(venue.best_wikidata_candidate_qid);
  const candidates = (venue.venue_external_match_candidates || []) as Array<{ external_id?: string; status?: string; provider?: string }>;
  const matched = candidates.find((row) => row.provider === "wikidata" && row.status === "matched" && /^Q\d+$/.test(row.external_id || ""));
  if (matched?.external_id) return matched.external_id;
  const sources = (venue.source_records || []) as Array<{ external_id?: string; data_sources?: { key?: string } | Array<{ key?: string }> }>;
  return sources.find((row) => /^Q\d+$/.test(row.external_id || "") && (Array.isArray(row.data_sources) ? row.data_sources : [row.data_sources]).some((source) => source?.key === "wikidata"))?.external_id || null;
}

function matchedQidDescription(venue: Record<string, unknown>, qid: string) {
  const candidates = (venue.venue_external_match_candidates || []) as Array<{ external_id?: string; status?: string; provider?: string; description?: string }>;
  return candidates.find((row) => row.provider === "wikidata" && row.status === "matched" && row.external_id === qid)?.description || null;
}

export function isWikipediaAddressTarget(
  venue: Record<string, unknown>,
  options: { selectedIds?: Set<string>; selectedOnly?: boolean; force?: boolean } = {},
) {
  if (options.selectedOnly && !options.selectedIds?.has(String(venue.id))) return false;
  if (!options.force && String(venue.address || "").trim()) return false;
  return Boolean(qidFor(venue));
}

async function targets(db: SupabaseClient, options: { scope: WikipediaVenueScope; limit: number; venueIds?: string[]; force?: boolean }) {
  const { data, error } = await db.from("venues").select("id,name,address,postal_code,effective_priority_tier,best_wikidata_candidate_qid,wikidata_match_status,venue_field_sources(field_name,source,is_current),source_records!source_records_venue_id_fkey(external_id,data_sources(key)),venue_external_match_candidates(external_id,status,provider,description)")
    .in("effective_priority_tier", tiersFor(options.scope)).is("merged_into_venue_id", null).order("effective_priority_tier").order("name");
  if (error) throw error;
  const selected = new Set(options.venueIds || []);
  const eligible = (data || []).filter((venue) => isWikipediaAddressTarget(venue, {
    selectedIds: selected,
    selectedOnly: options.scope === "selected",
    force: options.force,
  }));
  if (options.scope === "A" || options.scope === "selected") return eligible.slice(0, options.limit);
  const groups = new Map(tiersFor(options.scope).map((tier) => [tier, eligible.filter((venue) => venue.effective_priority_tier === tier)]));
  const balanced: typeof eligible = [];
  for (let index = 0; balanced.length < options.limit; index += 1) {
    let added = false;
    for (const tier of tiersFor(options.scope)) {
      const venue = groups.get(tier)?.[index];
      if (venue) { balanced.push(venue); added = true; }
      if (balanced.length >= options.limit) break;
    }
    if (!added) break;
  }
  return balanced;
}

async function saveSourceRecord(db: SupabaseClient, venueId: string, qid: string, article: Awaited<ReturnType<typeof fetchWikipediaAddress>>) {
  if (!article) throw new Error("Wikipedia article missing");
  const { data: source, error: sourceError } = await db.from("data_sources").select("id").eq("key", "wikipedia").single();
  if (sourceError || !source) throw sourceError || new Error("Wikipedia source is not registered");
  const rawPayload = { qid, language: article.language, title: article.title, pageId: article.pageId, address: article.address, rawAddress: article.rawAddress, sourceField: article.sourceField, postalCode: article.postalCode, notes: article.notes };
  const externalId = `venue:${venueId}:${article.language}:${article.pageId ?? article.title}`;
  const { data: record, error } = await db.from("source_records").upsert({
    data_source_id: source.id, external_id: externalId, venue_id: venueId, source_url: article.url, raw_payload: rawPayload,
    checksum: createHash("sha256").update(JSON.stringify(rawPayload)).digest("hex"), fetched_at: new Date().toISOString(),
  }, { onConflict: "data_source_id,external_id" }).select("id").single();
  if (error || !record) throw error || new Error("Wikipedia source record could not be saved");
  return record.id as string;
}

export async function enrichVenueAddressFromWikipedia(venue: Record<string, unknown>, options: { dryRun?: boolean } = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<WikipediaVenueResult> {
  const venueId = String(venue.id); const venueName = String(venue.name); const tier = String(venue.effective_priority_tier || ""); const qid = qidFor(venue);
  if (!qid) return { venueId, venueName, tier, qid: null, status: "no_article", message: "Confirmed Wikidata QID not found" };
  const site = await resolveWikipediaSite(qid);
  if (!site) return { venueId, venueName, tier, qid, status: "no_article", message: "No ja/en Wikipedia sitelink" };
  const article = await fetchWikipediaAddress(site);
  if (!article) return { venueId, venueName, tier, qid, status: "no_article", message: "Wikipedia page could not be fetched" };
  const base = { venueId, venueName, tier, qid, wikipediaTitle: article.title, wikipediaUrl: article.url, sourceField: article.sourceField || undefined };
  if (!article.address) return { ...base, status: "address_not_found", message: article.notes.join("; ") };
  if (hasMultipleLocationSignal(matchedQidDescription(venue, qid))) return { ...base, address: article.address, status: "address_not_found", message: "Matched entity explicitly represents multiple locations; Official Website or Manual resolution required" };
  if (!isSafeAutomaticWikipediaAddress(article.address, article.language)) return { ...base, address: article.address, status: "unsafe_language", message: "Extracted address contains unsafe language or markup" };
  const currentSource = ((venue.venue_field_sources || []) as Array<{ field_name?: string; source?: string; is_current?: boolean }>).find((row) => row.field_name === "address" && row.is_current)?.source || null;
  const decision = decideWikipediaAddressApplication({ currentAddress: typeof venue.address === "string" ? venue.address : null, currentSource, incomingAddress: article.address });
  if (decision === "conflict") return { ...base, address: article.address, status: "conflict", message: `Current source ${currentSource || "unknown"} is preserved` };
  if (decision === "unchanged") return { ...base, address: article.address, status: "unchanged" };
  if (options.dryRun) return { ...base, address: article.address, status: "applied" };
  const sourceRecordId = await saveSourceRecord(db, venueId, qid, article);
  const { error: clearError } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", "address").eq("is_current", true);
  if (clearError) throw clearError;
  const { error: provenanceError } = await db.from("venue_field_sources").insert(wikipediaProvenanceRow({ venueId, sourceRecordId, articleUrl: article.url, address: article.address }));
  if (provenanceError) throw provenanceError;
  const updates: Record<string, unknown> = { address: article.address, normalized_address: normalizeAddress(article.address) || null };
  if (!String(venue.postal_code || "").trim() && article.postalCode) {
    updates.postal_code = article.postalCode;
    const { error: postalClearError } = await db.from("venue_field_sources").update({ is_current: false }).eq("venue_id", venueId).eq("field_name", "postal_code").eq("is_current", true);
    if (postalClearError) throw postalClearError;
    const { error: postalSourceError } = await db.from("venue_field_sources").insert({ ...wikipediaProvenanceRow({ venueId, sourceRecordId, articleUrl: article.url, address: article.postalCode }), field_name: "postal_code", value_snapshot: article.postalCode });
    if (postalSourceError) throw postalSourceError;
  }
  const { error: updateError } = await db.from("venues").update(updates).eq("id", venueId);
  if (updateError) throw updateError;
  return { ...base, address: article.address, status: "applied" };
}

export async function enrichVenueAddressesFromWikipedia(options: { scope?: WikipediaVenueScope; limit?: number; venueIds?: string[]; force?: boolean; dryRun?: boolean } = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<WikipediaVenueBatchResult> {
  const scope = options.scope || "A-C";
  const safeLimit = Math.max(1, Math.min(200, Math.floor(options.limit || 20)));
  const rows = await targets(db, { scope, limit: safeLimit, venueIds: options.venueIds, force: options.force });
  const results: WikipediaVenueResult[] = [];
  const errors: WikipediaVenueBatchResult["errors"] = [];
  for (const [index, venue] of rows.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 250));
    try { results.push(await enrichVenueAddressFromWikipedia(venue as Record<string, unknown>, { dryRun: options.dryRun }, db)); }
    catch (error) { const message = error instanceof Error ? error.message : "Wikipedia enrichment failed"; errors.push({ venueId: venue.id, venueName: venue.name, message }); results.push({ venueId: venue.id, venueName: venue.name, tier: venue.effective_priority_tier, qid: qidFor(venue), status: "error", message }); }
  }
  return {
    dryRun: Boolean(options.dryRun), requested: rows.length, processed: results.length,
    wikipediaArticleFound: results.filter((row) => !["no_article", "error"].includes(row.status)).length,
    addressFound: results.filter((row) => ["applied", "unchanged", "conflict", "unsafe_language"].includes(row.status)).length,
    addressAdded: results.filter((row) => row.status === "applied").length,
    unchanged: results.filter((row) => row.status === "unchanged").length,
    noArticle: results.filter((row) => row.status === "no_article").length,
    addressNotFound: results.filter((row) => ["address_not_found", "unsafe_language"].includes(row.status)).length,
    conflict: results.filter((row) => row.status === "conflict").length,
    error: errors.length, results, errors,
  };
}

export function wikipediaSourcePriority() { return SOURCE_PRIORITY.wikipedia; }
