import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapArtCommonsItem } from "@/lib/art-commons/mapper";
import type { ArtCommonsItem } from "@/lib/art-commons/types";
import { matchArtistMention, type MatchableArtist } from "@/lib/artist-matching/mention";
import { resolveVenue as resolveCanonicalVenue } from "@/lib/venue-resolution/shared";
import { searchWikidataVenues } from "@/lib/wikidata/client";
import { rankWikidataCandidates } from "@/lib/wikidata/matcher";
import { resolveWikidataArtistNames } from "@/lib/wikidata/artist-discovery";
import { importWikidataVenues } from "@/lib/wikidata/venue-importer";
import { importWikidataArtists } from "@/lib/wikidata/artist-importer";

export const DEFAULT_RESOLUTION_BATCH_SIZE = 10;
export const MAX_RESOLUTION_BATCH_SIZE = 50;
const SAFE_VENUE_CONFIDENCE = 0.85;
const PLAUSIBLE_VENUE_CONFIDENCE = 0.6;

export type ResolutionEntity = "venue" | "artist";
export type ResolutionOutcome = "resolved_existing" | "resolved_new_master" | "ambiguous" | "no_candidate" | "failed" | "skipped";
export type ResolutionItem = {
  entityType: ResolutionEntity; mentionId: string; sourceValue: string; sourceExhibition: string;
  outcome: ResolutionOutcome; candidateCount: number; candidate?: string | null; externalId?: string | null;
  resolvedMasterId?: string | null; matchMethod?: string | null; reason: string; relationCreated?: boolean;
};
export type ResolutionResult = {
  dryRun: boolean; runId: string | null; scanned: number; items: ResolutionItem[];
  venue: Record<ResolutionOutcome, number>; artist: Record<ResolutionOutcome, number>;
  tierChanges: { venue: number; artist: number };
};

type Mention = Record<string, unknown> & {
  id: string; exhibition_id: string; source_record_id: string | null; resolution_status: string;
  source_venue_name?: string; source_artist_name?: string; role?: string | null;
  targeted_import_qid?: string | null; resolution_diagnostics?: unknown; resolution_attempts?: number;
  exhibitions?: { title?: string } | null; source_records?: { raw_payload?: unknown } | null;
};

const emptyCounts = () => ({ resolved_existing: 0, resolved_new_master: 0, ambiguous: 0, no_candidate: 0, failed: 0, skipped: 0 });
export function clampResolutionBatchSize(value?: number) {
  return Math.max(1, Math.min(MAX_RESOLUTION_BATCH_SIZE, Math.floor(value || DEFAULT_RESOLUTION_BATCH_SIZE)));
}
export function isClearVenueCandidate(candidates: Array<{ confidence: number }>) {
  return Boolean(candidates[0] && candidates[0].confidence >= SAFE_VENUE_CONFIDENCE && (!candidates[1] || candidates[0].confidence - candidates[1].confidence >= 0.15));
}

async function tierSnapshot(db: SupabaseClient, table: "venues" | "artists") {
  const result = new Map<string, string | null>();
  for (let from = 0;; from += 1000) { const { data, error } = await db.from(table).select("id,effective_priority_tier").order("id").range(from, from + 999); if (error) throw error; for (const row of data || []) result.set(row.id as string, row.effective_priority_tier as string | null); if ((data || []).length < 1000) break; }
  return result;
}
function changedTiers(before: Map<string, string | null>, after: Map<string, string | null>) { let count = 0; for (const [id, tier] of after) if (before.get(id) !== tier) count += 1; return count; }

async function masters(db: SupabaseClient) {
  const artists: MatchableArtist[] = [];
  for (let from = 0;; from += 1000) { const result = await db.from("artists").select("id,name,name_en,aliases,birth_year").order("id").range(from, from + 999); if (result.error) throw result.error; artists.push(...((result.data || []) as MatchableArtist[])); if ((result.data || []).length < 1000) break; }
  return { artists };
}

async function pendingMentions(db: SupabaseClient, entity: ResolutionEntity, limit: number) {
  const table = entity === "venue" ? "exhibition_venue_mentions" : "exhibition_artist_mentions";
  const sourceField = entity === "venue" ? "source_venue_name" : "source_artist_name";
  const { data, error } = await db.from(table)
    .select(`*,exhibitions(title),source_records(raw_payload)`)
    .eq("is_active", true).in("resolution_status", ["pending", "failed"])
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(limit);
  if (error) throw error;
  return ((data || []) as Mention[]).filter((row) => Boolean(row[sourceField]));
}

async function updateOutcome(db: SupabaseClient, entity: ResolutionEntity, mention: Mention, item: ResolutionItem) {
  const table = entity === "venue" ? "exhibition_venue_mentions" : "exhibition_artist_mentions";
  const status = item.outcome === "failed" ? "failed" : item.outcome;
  const resolutionStatus = status === "no_candidate" || status === "ambiguous" || status === "failed" ? status : "pending";
  const { error } = await db.from(table).update({
    resolution_status: resolutionStatus,
    match_status: status === "ambiguous" ? (entity === "venue" ? "ambiguous" : "candidate") : status === "failed" ? "failed" : entity === "venue" ? "unresolved" : "unmatched",
    match_reason: item.reason,
    resolution_diagnostics: item,
    resolution_attempts: Number(mention.resolution_attempts || 0) + 1,
    last_attempted_at: new Date().toISOString(),
  }).eq("id", mention.id);
  if (error) throw error;
}

async function wikidataVenueMasterId(db: SupabaseClient, qid: string) {
  const { data, error } = await db.from("source_records").select("venue_id,data_sources!inner(key)").eq("external_id", qid).eq("data_sources.key", "wikidata").maybeSingle();
  if (error) throw error;
  return data?.venue_id as string | null;
}
async function wikidataArtistMasterId(db: SupabaseClient, qid: string) {
  const { data, error } = await db.from("source_records").select("artist_id,data_sources!inner(key)").eq("external_id", qid).eq("data_sources.key", "wikidata").maybeSingle();
  if (error) throw error;
  return data?.artist_id as string | null;
}

async function applyVenueRelation(db: SupabaseClient, mention: Mention, venueId: string, method: string, confidence: number, item: ResolutionItem) {
  const raw = mention.source_records?.raw_payload as ArtCommonsItem | undefined;
  const normalized = raw?.id ? mapArtCommonsItem(raw) : null;
  const { data, error } = await db.rpc("resolve_exhibition_venue_mention", {
    p_mention_id: mention.id, p_venue_id: venueId, p_method: method, p_confidence: confidence,
    p_reason: item.reason, p_diagnostics: item, p_start_date: normalized?.occurrence.startDate || null,
    p_end_date: normalized?.occurrence.endDate || null, p_opening_hours_text: normalized?.occurrence.openingHoursText || null,
    p_closed_days_text: normalized?.occurrence.closedDaysText || null, p_ticket_url: normalized?.occurrence.ticketUrl || null,
  });
  if (error) throw error;
  return data as { status: string; relationCreated: boolean };
}

async function resolveVenue(db: SupabaseClient, mention: Mention, dryRun: boolean): Promise<ResolutionItem> {
  const source = String(mention.source_venue_name);
  const base = { entityType: "venue" as const, mentionId: mention.id, sourceValue: source, sourceExhibition: mention.exhibitions?.title || mention.exhibition_id };
  const priorExternalId = String((mention.resolution_diagnostics as Record<string, unknown> | undefined)?.externalId || "");
  const existing = await resolveCanonicalVenue(db, { sourceName: source, sourceKey: /^Q\d+$/.test(priorExternalId) ? "wikidata" : null, externalId: priorExternalId || null });
  if (existing.status === "ambiguous") return { ...base, outcome: "ambiguous", candidateCount: existing.candidateIds.length, candidate: existing.candidates.map((row) => row.name).join(" / "), matchMethod: existing.matchMethod, reason: existing.reason };
  if (existing.status === "resolved" && existing.venueId) {
    const item: ResolutionItem = { ...base, outcome: "resolved_existing", candidateCount: 1, candidate: existing.candidates[0]?.name || null, externalId: priorExternalId || null, resolvedMasterId: existing.venueId, matchMethod: existing.matchMethod, reason: existing.reason };
    if (!dryRun) item.relationCreated = (await applyVenueRelation(db, mention, existing.venueId, item.matchMethod!, 1, item)).relationCreated;
    return item;
  }
  const ranked = rankWikidataCandidates({ name: source }, await searchWikidataVenues(source, 10));
  const plausible = ranked.filter((candidate) => candidate.confidence >= PLAUSIBLE_VENUE_CONFIDENCE);
  if (!plausible.length) return { ...base, outcome: "no_candidate", candidateCount: 0, matchMethod: "wikidata_targeted_search", reason: "No plausible Wikidata Venue candidate" };
  if (!isClearVenueCandidate(plausible)) return { ...base, outcome: "ambiguous", candidateCount: plausible.length, candidate: plausible.map((row) => `${row.labelJa || row.labelEn || row.id} (${row.confidence})`).join(" / "), externalId: plausible[0].id, matchMethod: "wikidata_targeted_search", reason: "Wikidata candidates did not meet the single clear candidate safety gate" };
  const selected = plausible[0];
  const priorId = await wikidataVenueMasterId(db, selected.id);
  const item: ResolutionItem = { ...base, outcome: priorId ? "resolved_existing" : "resolved_new_master", candidateCount: plausible.length, candidate: selected.labelJa || selected.labelEn || selected.id, externalId: selected.id, resolvedMasterId: priorId, matchMethod: "wikidata_targeted_single_clear", reason: `Single clear Wikidata Venue candidate (${selected.confidence}): ${selected.reasons.join("; ")}` };
  if (dryRun) return item;
  if (!priorId) {
    const imported = await importWikidataVenues({ mode: "count", qids: [selected.id] }, db);
    if (imported.errors.length) throw new Error(imported.errors.map((error) => error.message).join("; "));
  }
  const venueId = priorId || await wikidataVenueMasterId(db, selected.id);
  if (!venueId) return { ...item, outcome: "ambiguous", resolvedMasterId: null, reason: "Targeted importer retained the Wikidata identity as a candidate instead of applying it" };
  item.resolvedMasterId = venueId;
  item.relationCreated = (await applyVenueRelation(db, mention, venueId, item.matchMethod!, selected.confidence, item)).relationCreated;
  return item;
}

async function resolveArtist(db: SupabaseClient, mention: Mention, artists: MatchableArtist[], dryRun: boolean): Promise<ResolutionItem> {
  const source = String(mention.source_artist_name);
  const base = { entityType: "artist" as const, mentionId: mention.id, sourceValue: source, sourceExhibition: mention.exhibitions?.title || mention.exhibition_id };
  const priorExternalId = String((mention.resolution_diagnostics as Record<string, unknown> | undefined)?.externalId || mention.targeted_import_qid || "");
  if (/^Q\d+$/.test(priorExternalId)) {
    const externalArtistId = await wikidataArtistMasterId(db, priorExternalId);
    if (externalArtistId) {
      const item: ResolutionItem = { ...base, outcome: "resolved_existing", candidateCount: 1, externalId: priorExternalId, resolvedMasterId: externalArtistId, matchMethod: "source_external_id", reason: "Previously audited Wikidata external ID resolves to one Artist Master" };
      if (!dryRun) { const { data, error } = await db.rpc("resolve_exhibition_artist_mention", { p_mention_id: mention.id, p_artist_id: externalArtistId, p_method: item.matchMethod, p_reason: item.reason, p_diagnostics: item }); if (error) throw error; item.relationCreated = Boolean((data as { relationCreated?: boolean })?.relationCreated); }
      return item;
    }
  }
  const existing = matchArtistMention(source, artists);
  if (existing.status === "ambiguous") return { ...base, outcome: "ambiguous", candidateCount: existing.candidates.length, candidate: existing.candidates.map((row) => row.name).join(" / "), matchMethod: "existing_exact", reason: "Multiple exact canonical Artist matches; human selection required" };
  if (existing.status === "matched") {
    const item: ResolutionItem = { ...base, outcome: "resolved_existing", candidateCount: 1, candidate: existing.candidates[0].name, resolvedMasterId: existing.candidates[0].id, matchMethod: "existing_exact", reason: "Single exact canonical Artist name/name_en/alias match" };
    if (!dryRun) { const { data, error } = await db.rpc("resolve_exhibition_artist_mention", { p_mention_id: mention.id, p_artist_id: existing.candidates[0].id, p_method: item.matchMethod, p_reason: item.reason, p_diagnostics: item }); if (error) throw error; item.relationCreated = Boolean((data as { relationCreated?: boolean })?.relationCreated); }
    return item;
  }
  const [resolution] = await resolveWikidataArtistNames([source]);
  if (!resolution || resolution.status === "not_found") return { ...base, outcome: "no_candidate", candidateCount: 0, matchMethod: "wikidata_targeted_search", reason: "No exact Wikidata Artist label/alias candidate" };
  if (resolution.status === "ambiguous" || !resolution.qid) return { ...base, outcome: "ambiguous", candidateCount: resolution.candidateQids.length, externalId: resolution.candidateQids[0] || null, matchMethod: "wikidata_targeted_search", reason: "Multiple exact Wikidata Artist candidates; human selection required" };
  const priorId = await wikidataArtistMasterId(db, resolution.qid);
  const item: ResolutionItem = { ...base, outcome: priorId ? "resolved_existing" : "resolved_new_master", candidateCount: 1, externalId: resolution.qid, resolvedMasterId: priorId, matchMethod: "wikidata_targeted_exact", reason: "Single exact Wikidata Artist label/alias candidate" };
  if (dryRun) return item;
  if (!priorId) { const imported = await importWikidataArtists({ mode: "count", qids: [resolution.qid] }, db); if (imported.errors.length) throw new Error(imported.errors.map((error) => error.message).join("; ")); }
  const artistId = priorId || await wikidataArtistMasterId(db, resolution.qid);
  if (!artistId) return { ...item, outcome: "ambiguous", resolvedMasterId: null, reason: "Targeted importer retained the Wikidata identity as a candidate instead of applying it" };
  item.resolvedMasterId = artistId;
  const { data, error } = await db.rpc("resolve_exhibition_artist_mention", { p_mention_id: mention.id, p_artist_id: artistId, p_method: item.matchMethod, p_reason: item.reason, p_diagnostics: item });
  if (error) throw error;
  item.relationCreated = Boolean((data as { relationCreated?: boolean })?.relationCreated);
  return item;
}

export async function getResolutionOverview(db: SupabaseClient = createSupabaseAdminClient()) {
  const [venue, artist] = await Promise.all([
    db.from("exhibition_venue_mentions").select("id,resolution_status,source_venue_name,match_method,match_reason,resolution_diagnostics,matched_venue_id,exhibitions(title)").eq("is_active", true).order("updated_at", { ascending: false }),
    db.from("exhibition_artist_mentions").select("id,resolution_status,source_artist_name,match_method:extraction_method,match_reason,resolution_diagnostics,matched_artist_id,exhibitions(title)").eq("is_active", true).order("updated_at", { ascending: false }),
  ]);
  if (venue.error) throw venue.error; if (artist.error) throw artist.error;
  const rows = [...(venue.data || []).map((row) => ({ ...row, entity_type: "venue", source_value: row.source_venue_name, resolved_master_id: row.matched_venue_id })), ...(artist.data || []).map((row) => ({ ...row, entity_type: "artist", source_value: row.source_artist_name, resolved_master_id: row.matched_artist_id }))];
  const counts = Object.fromEntries(["pending", "resolved", "ambiguous", "no_candidate", "failed"].map((status) => [status, rows.filter((row) => row.resolution_status === status).length]));
  return { counts: { ...counts, venuePending: rows.filter((row) => row.entity_type === "venue" && row.resolution_status === "pending").length, artistPending: rows.filter((row) => row.entity_type === "artist" && row.resolution_status === "pending").length }, items: rows.filter((row) => row.resolution_status !== "resolved").slice(0, 100) };
}

export async function runTargetedMasterResolution(options: { dryRun?: boolean; batchSize?: number; entityType?: ResolutionEntity | "all" } = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<ResolutionResult> {
  const dryRun = options.dryRun !== false; const limit = clampResolutionBatchSize(options.batchSize); const entityType = options.entityType || "all";
  const loaded = await masters(db); const result: ResolutionResult = { dryRun, runId: null, scanned: 0, items: [], venue: emptyCounts(), artist: emptyCounts(), tierChanges: { venue: 0, artist: 0 } };
  let runId: string | null = null;
  const venueTierBefore = dryRun ? null : await tierSnapshot(db, "venues");
  const artistTierBefore = dryRun ? null : await tierSnapshot(db, "artists");
  if (!dryRun) { const { data: source } = await db.from("data_sources").select("id").eq("key", "art_commons_jpsearch").single(); const { data, error } = await db.from("import_runs").insert({ data_source_id: source?.id, operation_type: "targeted_master_resolution", status: "running", requested_count: limit, metrics: { entityType, batchSize: limit } }).select("id").single(); if (error) throw error; runId = data.id as string; result.runId = runId; }
  const venueRows = entityType === "artist" ? [] : await pendingMentions(db, "venue", limit);
  const artistRows = entityType === "venue" ? [] : await pendingMentions(db, "artist", Math.max(0, limit - venueRows.length));
  for (const [entity, rows] of [["venue", venueRows], ["artist", artistRows]] as const) for (const mention of rows) {
    let item: ResolutionItem;
    try { item = entity === "venue" ? await resolveVenue(db, mention, dryRun) : await resolveArtist(db, mention, loaded.artists, dryRun); }
    catch (error) { item = { entityType: entity, mentionId: mention.id, sourceValue: String(entity === "venue" ? mention.source_venue_name : mention.source_artist_name), sourceExhibition: mention.exhibitions?.title || mention.exhibition_id, outcome: "failed", candidateCount: 0, reason: error instanceof Error ? error.message : "Targeted resolution failed" }; }
    result.items.push(item); result[entity][item.outcome] += 1;
    if (!dryRun && ["ambiguous", "no_candidate", "failed"].includes(item.outcome)) await updateOutcome(db, entity, mention, item);
  }
  result.scanned = result.items.length;
  if (!dryRun) {
    const venueRefresh = await db.rpc("refresh_venue_priority_tiers", { p_as_of: new Date().toISOString().slice(0, 10) });
    const artistRefresh = await db.rpc("refresh_artist_priority_tiers", { p_as_of: new Date().toISOString().slice(0, 10) });
    if (venueRefresh.error) throw venueRefresh.error; if (artistRefresh.error) throw artistRefresh.error;
    result.tierChanges.venue = changedTiers(venueTierBefore!, await tierSnapshot(db, "venues"));
    result.tierChanges.artist = changedTiers(artistTierBefore!, await tierSnapshot(db, "artists"));
    const failed = result.venue.failed + result.artist.failed; const resolved = result.venue.resolved_existing + result.venue.resolved_new_master + result.artist.resolved_existing + result.artist.resolved_new_master;
    await db.from("import_runs").update({ status: failed ? "partial" : "completed", fetched_count: result.scanned, created_count: result.venue.resolved_new_master + result.artist.resolved_new_master, updated_count: resolved, skipped_count: result.venue.skipped + result.artist.skipped, error_count: failed, metrics: result, finished_at: new Date().toISOString() }).eq("id", runId);
  }
  return result;
}
