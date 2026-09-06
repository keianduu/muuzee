import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getArtCommonsItem, getJapanSearchRequestDelayMs, scrollArtCommons } from "@/lib/art-commons/client";
import { checksumPayload, hasMinimumImportFields, matchesImportDateRange, syncSourceImageCandidates } from "@/lib/art-commons/importer";
import { mapArtCommonsItem } from "@/lib/art-commons/mapper";
import type { ArtCommonsItem, NormalizedArtCommonsItem } from "@/lib/art-commons/types";
import { importedSlug } from "@/lib/admin/slug";
import { extractKnownArtistsFromTitle, extractStructuredArtistMentions, matchArtistMention, normalizeArtistName, type MatchableArtist } from "@/lib/artist-matching/mention";
import { dailySyncWindow, deriveEventStatus, mayApplySourceField, resolveVenueName, tokyoDate, type VenueResolutionCandidate } from "./policy";

const DATA_SOURCE_KEY = "art_commons_jpsearch";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ExistingSource = { id: string; exhibition_id: string | null; checksum: string | null; last_changed_at?: string | null };
type Scanned = { raw: ArtCommonsItem; normalized: NormalizedArtCommonsItem; checksum: string; existing: ExistingSource | null; classification: "new" | "changed" | "unchanged" };
type TierSnapshot = Map<string, string | null>;

export type DailySyncOptions = { dryRun?: boolean; keyword?: string; dateFrom?: string; dateTo?: string; sampleLimit?: number; backfillExisting?: boolean };
export type DailySyncResult = {
  dryRun: boolean; runId: string | null; dateFrom: string; dateTo: string; sourceHitCount: number; scanned: number; discovered: number;
  newExhibitions: number; changedExhibitions: number; unchangedExhibitions: number; ended: number; stale: number; errors: Array<{ externalId?: string; message: string }>;
  venueResolved: number; venueUnresolved: number; venueAmbiguous: number; venueTargetedHandoffs: number; newVenues: number;
  artistMentions: number; artistResolved: number; artistUnresolved: number; artistAmbiguous: number; artistTargetedHandoffs: number; newArtists: number;
  occurrenceCreated: number; artistRelationsCreated: number; relationDuplicates: number; backfilled: number; venueTierChanges: number; artistTierChanges: number;
};

async function dataSourceId(db: SupabaseClient) {
  const { data, error } = await db.from("data_sources").select("id").eq("key", DATA_SOURCE_KEY).single();
  if (error || !data) throw error || new Error("Art Commons data source is unavailable");
  return data.id as string;
}

async function loadVenues(db: SupabaseClient): Promise<VenueResolutionCandidate[]> {
  const { data, error } = await db.from("venues").select("id,name,name_en,aliases,is_active,merged_into_venue_id");
  if (error) throw error;
  return (data || []) as VenueResolutionCandidate[];
}

async function loadArtists(db: SupabaseClient): Promise<MatchableArtist[]> {
  const { data, error } = await db.from("artists").select("id,name,name_en,aliases,birth_year");
  if (error) throw error;
  return (data || []) as MatchableArtist[];
}

async function tierSnapshot(db: SupabaseClient, table: "venues" | "artists"): Promise<TierSnapshot> {
  const snapshot: TierSnapshot = new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("id,effective_priority_tier").order("id").range(from, from + 999);
    if (error) throw error;
    for (const row of data || []) snapshot.set(row.id as string, row.effective_priority_tier as string | null);
    if ((data || []).length < 1000) break;
  }
  return snapshot;
}

function countTierChanges(before: TierSnapshot, after: TierSnapshot) {
  let changed = 0;
  for (const [id, tier] of after) if (before.get(id) !== tier) changed += 1;
  return changed;
}

async function scan(options: DailySyncOptions, db: SupabaseClient, sourceId: string) {
  const defaults = dailySyncWindow();
  const dateFrom = options.dateFrom || defaults.dateFrom;
  const dateTo = options.dateTo || defaults.dateTo;
  const max = Math.max(1, Math.min(500, options.sampleLimit || 20));
  const summaries: ArtCommonsItem[] = [];
  let sourceHitCount = 0;
  let scanned = 0;
  outer: for await (const page of scrollArtCommons({ keyword: options.keyword || "", yearFrom: Number(dateFrom.slice(0, 4)), yearTo: Number(dateTo.slice(0, 4)) })) {
    sourceHitCount = page.hit;
    for (const item of page.list) {
      scanned += 1;
      if (hasMinimumImportFields(item) && matchesImportDateRange(item, dateFrom, dateTo)) summaries.push(item);
      if (summaries.length >= max) break outer;
    }
    if (page.scrollId) await wait(getJapanSearchRequestDelayMs());
  }
  const ids = summaries.map((item) => item.id);
  const { data: existingRows, error } = ids.length ? await db.from("source_records").select("id,external_id,exhibition_id,checksum,last_changed_at").eq("data_source_id", sourceId).in("external_id", ids) : { data: [], error: null };
  if (error) throw error;
  const existing = new Map((existingRows || []).map((row) => [String(row.external_id || ""), row as ExistingSource]));
  // external_id is not selected by old generated clients in some environments;
  // fetch individually when the bulk row cannot be keyed safely.
  const records: Scanned[] = [];
  for (let index = 0; index < summaries.length; index += 1) {
    if (index) await wait(getJapanSearchRequestDelayMs());
    const raw = await getArtCommonsItem(summaries[index].id);
    const checksum = checksumPayload(raw);
    let prior = existing.get(raw.id) || null;
    if (!prior) {
      const { data, error: priorError } = await db.from("source_records").select("id,exhibition_id,checksum,last_changed_at").eq("data_source_id", sourceId).eq("external_id", raw.id).maybeSingle();
      if (priorError) throw priorError;
      prior = data as ExistingSource | null;
    }
    records.push({ raw, normalized: mapArtCommonsItem(raw), checksum, existing: prior, classification: !prior?.exhibition_id ? "new" : prior.checksum === checksum ? "unchanged" : "changed" });
  }
  return { dateFrom, dateTo, sourceHitCount, scanned, records };
}

async function writeProvenance(db: SupabaseClient, exhibitionId: string, sourceRecordId: string, sourceUrl: string | null, fields: Record<string, unknown>) {
  const { data: current, error } = await db.from("exhibition_field_sources").select("id,field_name,source,source_record_id").eq("exhibition_id", exhibitionId).eq("is_current", true);
  if (error) throw error;
  const byField = new Map((current || []).map((row) => [row.field_name as string, row]));
  const applicable: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(fields)) {
    const prior = byField.get(field);
    if (!mayApplySourceField(prior?.source as string | undefined) || value == null) continue;
    applicable[field] = value;
    if (prior?.id) {
      if (prior.source === "art_commons" && prior.source_record_id === sourceRecordId) {
        const { error: updateError } = await db.from("exhibition_field_sources").update({ value_snapshot: value, source_url: sourceUrl, updated_at: new Date().toISOString() }).eq("id", prior.id);
        if (updateError) throw updateError;
        continue;
      }
      const { error: clearError } = await db.from("exhibition_field_sources").update({ is_current: false }).eq("id", prior.id);
      if (clearError) throw clearError;
    }
    const { error: insertError } = await db.from("exhibition_field_sources").insert({ exhibition_id: exhibitionId, field_name: field, source: "art_commons", source_url: sourceUrl, source_record_id: sourceRecordId, value_snapshot: value, review_status: "unreviewed", is_current: true });
    if (insertError) throw insertError;
  }
  return applicable;
}

async function resolveRelations(db: SupabaseClient, exhibitionId: string, sourceRecordId: string, item: NormalizedArtCommonsItem, raw: ArtCommonsItem, venues: VenueResolutionCandidate[], artists: MatchableArtist[], result: DailySyncResult, dryRun: boolean) {
  const now = new Date().toISOString();
  const { data: occurrence, error: occurrenceError } = await db.from("exhibition_occurrences").select("id,venue_id").eq("exhibition_id", exhibitionId).limit(1).maybeSingle();
  if (occurrenceError) throw occurrenceError;
  let venueMatch = resolveVenueName(item.venue.name, venues);
  if (occurrence?.venue_id) {
    venueMatch = { status: "resolved", candidates: [{ id: occurrence.venue_id, name: item.venue.name }], method: "existing_canonical_relation_protected", confidence: 1 };
  }
  if (venueMatch.status === "resolved") result.venueResolved += 1;
  else if (venueMatch.status === "ambiguous") { result.venueAmbiguous += 1; result.venueTargetedHandoffs += 1; }
  else { result.venueUnresolved += 1; result.venueTargetedHandoffs += 1; }

  if (!dryRun) {
    const matchedVenueId = venueMatch.status === "resolved" ? venueMatch.candidates[0].id : null;
    const { error } = await db.from("exhibition_venue_mentions").upsert({ exhibition_id: exhibitionId, source_record_id: sourceRecordId, source_venue_name: item.venue.name, normalized_name: item.venue.name.normalize("NFKC").toLowerCase().replace(/[\s・･.,_\-‐‑‒–—―ー()（）「」『』【】\[\]\/]/g, ""), matched_venue_id: matchedVenueId, candidate_venue_ids: venueMatch.candidates.map((candidate) => candidate.id), match_method: venueMatch.method, match_confidence: venueMatch.confidence, match_status: venueMatch.status, resolution_status: venueMatch.status === "resolved" ? "resolved" : venueMatch.status === "ambiguous" ? "ambiguous" : "pending", match_reason: venueMatch.status === "resolved" ? "Single exact canonical candidate or protected existing relation" : venueMatch.status === "ambiguous" ? "Multiple exact canonical candidates; human selection required" : "No exact canonical candidate; targeted resolution pending", is_active: true, last_seen_at: now }, { onConflict: "exhibition_id,normalized_name" });
    if (error) throw error;
    if (matchedVenueId) {
      const values = { source_record_id: sourceRecordId, source_venue_name: item.venue.name, start_date: item.occurrence.startDate, end_date: item.occurrence.endDate, opening_hours_text: item.occurrence.openingHoursText, closed_days_text: item.occurrence.closedDaysText, ticket_url: item.occurrence.ticketUrl, match_method: venueMatch.method, match_confidence: venueMatch.confidence, relation_status: "active", last_seen_at: now };
      if (occurrence) {
        const { error: updateError } = await db.from("exhibition_occurrences").update(values).eq("id", occurrence.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await db.from("exhibition_occurrences").insert({ ...values, exhibition_id: exhibitionId, venue_id: matchedVenueId });
        if (insertError) throw insertError;
        result.occurrenceCreated += 1;
      }
    }
  }

  const structured = extractStructuredArtistMentions(raw);
  const mentions = structured.length ? structured : extractKnownArtistsFromTitle(item.title, artists);
  result.artistMentions += mentions.length;
  for (const mention of mentions) {
    const match = matchArtistMention(mention.name, artists);
    if (match.status === "matched") result.artistResolved += 1;
    else if (match.status === "ambiguous") { result.artistAmbiguous += 1; result.artistTargetedHandoffs += 1; }
    else { result.artistUnresolved += 1; result.artistTargetedHandoffs += 1; }
    if (dryRun) continue;
    const matched = match.status === "matched" ? match.candidates[0] : null;
    const normalizedName = normalizeArtistName(mention.name);
    const { error: mentionError } = await db.from("exhibition_artist_mentions").upsert({ exhibition_id: exhibitionId, source_record_id: structured.length ? sourceRecordId : null, source_artist_name: mention.name, normalized_name: normalizedName, role: mention.role, extraction_method: mention.method, match_status: matched ? "matched" : match.status === "ambiguous" ? "candidate" : "unmatched", resolution_status: matched ? "resolved" : match.status === "ambiguous" ? "ambiguous" : "pending", matched_artist_id: matched?.id || null, candidate_artist_ids: match.candidates.map((candidate) => candidate.id), match_reason: matched ? "Exact canonical name/name_en/alias" : match.status === "ambiguous" ? "Multiple exact canonical candidates" : "No exact canonical candidate; targeted import pending", is_active: true, last_seen_at: now }, { onConflict: "exhibition_id,normalized_name" });
    if (mentionError) throw mentionError;
    if (!matched) continue;
    const { data: prior, error: priorError } = await db.from("exhibition_artists").select("id").eq("exhibition_id", exhibitionId).eq("artist_id", matched.id).maybeSingle();
    if (priorError) throw priorError;
    if (prior) {
      result.relationDuplicates += 0;
      const { error: updateError } = await db.from("exhibition_artists").update({ source_record_id: sourceRecordId, source_artist_name: mention.name, role: mention.role, relation_status: "active", last_seen_at: now }).eq("id", prior.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await db.from("exhibition_artists").insert({ exhibition_id: exhibitionId, artist_id: matched.id, source_record_id: sourceRecordId, source_artist_name: mention.name, role: mention.role, match_status: "matched", relation_status: "active", last_seen_at: now });
      if (insertError) throw insertError;
      result.artistRelationsCreated += 1;
    }
  }
}

async function applyRecord(db: SupabaseClient, sourceId: string, scanned: Scanned, venues: VenueResolutionCandidate[], artists: MatchableArtist[], result: DailySyncResult) {
  const now = new Date().toISOString();
  const sourceUrl = scanned.normalized.sourceUrl;
  const values = { data_source_id: sourceId, external_id: scanned.raw.id, source_url: sourceUrl, raw_payload: scanned.raw, checksum: scanned.checksum, source_updated_at: scanned.normalized.sourceUpdatedAt, fetched_at: now, last_seen_at: now, last_changed_at: scanned.classification === "unchanged" ? scanned.existing?.last_changed_at || now : now };
  const { data: stored, error: storeError } = await db.from("source_records").upsert(values, { onConflict: "data_source_id,external_id" }).select("id,exhibition_id").single();
  if (storeError || !stored) throw storeError || new Error("Source record could not be stored");
  await syncSourceImageCandidates(db, stored.id as string, scanned.raw);
  let exhibitionId = (stored.exhibition_id || scanned.existing?.exhibition_id) as string | null;
  if (!exhibitionId) {
    const slug = importedSlug(scanned.normalized.title, scanned.normalized.externalId);
    const { data: existingBySlug, error: lookupError } = await db.from("exhibitions").select("id").eq("slug", slug).maybeSingle();
    if (lookupError) throw lookupError;
    if (existingBySlug) exhibitionId = existingBySlug.id as string;
    else {
      const { data, error } = await db.from("exhibitions").insert({ slug, title: scanned.normalized.title, title_en: scanned.normalized.titleEn, description: scanned.normalized.description, exhibition_type: scanned.normalized.exhibitionType, official_url: scanned.normalized.officialUrl, publication_status: "draft" }).select("id").single();
      if (error || !data) throw error || new Error("Exhibition could not be created");
      exhibitionId = data.id as string;
    }
  } else if (scanned.classification === "changed") {
    const applicable = await writeProvenance(db, exhibitionId, stored.id as string, sourceUrl, { title: scanned.normalized.title, title_en: scanned.normalized.titleEn, description: scanned.normalized.description, exhibition_type: scanned.normalized.exhibitionType, official_url: scanned.normalized.officialUrl });
    if (Object.keys(applicable).length) {
      const { error } = await db.from("exhibitions").update(applicable).eq("id", exhibitionId);
      if (error) throw error;
    }
  }
  if (scanned.classification === "new") await writeProvenance(db, exhibitionId, stored.id as string, sourceUrl, { title: scanned.normalized.title, title_en: scanned.normalized.titleEn, description: scanned.normalized.description, exhibition_type: scanned.normalized.exhibitionType, official_url: scanned.normalized.officialUrl });
  const { error: linkError } = await db.from("source_records").update({ exhibition_id: exhibitionId }).eq("id", stored.id);
  if (linkError) throw linkError;
  await resolveRelations(db, exhibitionId, stored.id as string, scanned.normalized, scanned.raw, venues, artists, result, false);
}

export async function runExhibitionDailySync(options: DailySyncOptions = {}, db: SupabaseClient = createSupabaseAdminClient()): Promise<DailySyncResult> {
  const sourceId = await dataSourceId(db);
  const scanned = await scan(options, db, sourceId);
  const result: DailySyncResult = { dryRun: Boolean(options.dryRun), runId: null, dateFrom: scanned.dateFrom, dateTo: scanned.dateTo, sourceHitCount: scanned.sourceHitCount, scanned: scanned.scanned, discovered: scanned.records.length, newExhibitions: 0, changedExhibitions: 0, unchangedExhibitions: 0, ended: 0, stale: 0, errors: [], venueResolved: 0, venueUnresolved: 0, venueAmbiguous: 0, venueTargetedHandoffs: 0, newVenues: 0, artistMentions: 0, artistResolved: 0, artistUnresolved: 0, artistAmbiguous: 0, artistTargetedHandoffs: 0, newArtists: 0, occurrenceCreated: 0, artistRelationsCreated: 0, relationDuplicates: 0, backfilled: 0, venueTierChanges: 0, artistTierChanges: 0 };
  for (const record of scanned.records) {
    if (record.classification === "new") result.newExhibitions += 1;
    else if (record.classification === "changed") result.changedExhibitions += 1;
    else result.unchangedExhibitions += 1;
    if (deriveEventStatus(record.normalized.occurrence.startDate, record.normalized.occurrence.endDate, tokyoDate()) === "ended") result.ended += 1;
  }
  const venues = await loadVenues(db);
  const artists = await loadArtists(db);
  if (options.dryRun) {
    for (const record of scanned.records) {
      const exhibitionId = record.existing?.exhibition_id;
      if (!exhibitionId) {
        const match = resolveVenueName(record.normalized.venue.name, venues);
        if (match.status === "resolved") { result.venueResolved += 1; result.venueTierChanges += 1; } else if (match.status === "ambiguous") { result.venueAmbiguous += 1; result.venueTargetedHandoffs += 1; } else { result.venueUnresolved += 1; result.venueTargetedHandoffs += 1; }
        const structured = extractStructuredArtistMentions(record.raw);
        const mentions = structured.length ? structured : extractKnownArtistsFromTitle(record.normalized.title, artists);
        result.artistMentions += mentions.length;
        for (const mention of mentions) { const matchArtist = matchArtistMention(mention.name, artists); if (matchArtist.status === "matched") { result.artistResolved += 1; result.artistTierChanges += 1; } else if (matchArtist.status === "ambiguous") { result.artistAmbiguous += 1; result.artistTargetedHandoffs += 1; } else { result.artistUnresolved += 1; result.artistTargetedHandoffs += 1; } }
      } else await resolveRelations(db, exhibitionId, record.existing!.id, record.normalized, record.raw, venues, artists, result, true);
    }
    return result;
  }
  const { data: run, error: runError } = await db.from("import_runs").insert({ data_source_id: sourceId, operation_type: "exhibition_daily_sync", status: "running", requested_count: scanned.records.length, date_from: scanned.dateFrom, date_to: scanned.dateTo, include_past: false }).select("id").single();
  if (runError || !run) throw runError || new Error("Daily Sync run could not be created");
  result.runId = run.id as string;
  const venueBefore = await tierSnapshot(db, "venues");
  const artistBefore = await tierSnapshot(db, "artists");
  for (const record of scanned.records) {
    try { await applyRecord(db, sourceId, record, venues, artists, result); }
    catch (error) { result.errors.push({ externalId: record.raw.id, message: error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "Record apply failed" }); }
  }
  if (options.backfillExisting) {
    const selectedIds = new Set(scanned.records.map((record) => record.raw.id));
    const { data: rows, error } = await db.from("source_records").select("id,exhibition_id,raw_payload,checksum,last_changed_at").eq("data_source_id", sourceId);
    if (error) result.errors.push({ message: error.message });
    for (const row of rows || []) {
      const raw = row.raw_payload as ArtCommonsItem;
      if (!raw?.id || selectedIds.has(raw.id)) continue;
      if (!hasMinimumImportFields(raw)) continue;
      try {
        if (row.exhibition_id) await resolveRelations(db, row.exhibition_id as string, row.id as string, mapArtCommonsItem(raw), raw, venues, artists, result, false);
        else await applyRecord(db, sourceId, { raw, normalized: mapArtCommonsItem(raw), checksum: row.checksum || checksumPayload(raw), existing: row as ExistingSource, classification: "new" }, venues, artists, result);
        result.backfilled += 1;
      }
      catch (error) { result.errors.push({ externalId: raw.id, message: error instanceof Error ? error.message : "Backfill failed" }); }
    }
  }
  const today = tokyoDate();
  const [venueRefresh, artistRefresh] = await Promise.all([db.rpc("refresh_venue_priority_tiers", { p_as_of: today }), db.rpc("refresh_artist_priority_tiers", { p_as_of: today })]);
  if (venueRefresh.error) result.errors.push({ message: venueRefresh.error.message });
  if (artistRefresh.error) result.errors.push({ message: artistRefresh.error.message });
  result.venueTierChanges = countTierChanges(venueBefore, await tierSnapshot(db, "venues"));
  result.artistTierChanges = countTierChanges(artistBefore, await tierSnapshot(db, "artists"));
  const status = result.errors.length ? "partial" : "completed";
  await db.from("import_runs").update({ status, fetched_count: result.discovered, created_count: result.newExhibitions, updated_count: result.changedExhibitions, skipped_count: result.unchangedExhibitions, error_count: result.errors.length, errors: result.errors.length ? result.errors : null, source_hit_count: result.sourceHitCount, scanned_count: result.scanned, metrics: result, finished_at: new Date().toISOString() }).eq("id", result.runId);
  return result;
}
