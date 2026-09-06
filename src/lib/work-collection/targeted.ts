import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeIdentity, workDuplicateKey } from "./mapping";
import { searchApjShuzo } from "./apj-shuzo-client";
import { searchTomuco } from "./tomuco-client";
import type { WorkCoverageRow, WorkSourceCandidate } from "./types";

type Artist = { id: string; name: string; name_en: string | null; aliases: string[] };

export function preservedCandidateState(existing: { match_status?: string; matched_work_id?: string | null } | null, computedStatus: string, duplicateId?: string) {
  return existing?.match_status === "imported"
    ? { matchStatus: "imported", matchedWorkId: existing.matched_work_id || null }
    : { matchStatus: computedStatus, matchedWorkId: duplicateId || null };
}

async function sourceId(db: SupabaseClient, key: string) {
  const { data, error } = await db.from("data_sources").select("id").eq("key", key).single();
  if (error || !data) throw error || new Error(`Data source ${key} is missing; apply migrations`);
  return data.id as string;
}

async function matchVenue(db: SupabaseClient, sourceName: string | null) {
  if (!sourceName) return { id: null, status: "missing" };
  const { data, error } = await db.from("venues").select("id,name,name_en,aliases").is("merged_into_venue_id", null);
  if (error) throw error;
  const source = normalizeIdentity(sourceName);
  const matches = (data || []).filter((row) => [row.name, row.name_en, ...(row.aliases || [])].filter(Boolean).some((value) => normalizeIdentity(String(value)) === source));
  return matches.length === 1 ? { id: matches[0].id as string, status: "matched" } : { id: null, status: matches.length > 1 ? "ambiguous" : "not_found" };
}

async function duplicateWork(db: SupabaseClient, candidate: WorkSourceCandidate, artistId: string, venueId: string | null) {
  const { data, error } = await db.from("works").select("id,title,work_artists(artist_id),collection_holdings(venue_id)").eq("title", candidate.title);
  if (error) throw error;
  return (data || []).find((work) => {
    const key = workDuplicateKey({ title: work.title, artistName: String((work.work_artists || [])[0]?.artist_id || ""), venueName: String((work.collection_holdings || [])[0]?.venue_id || "") });
    return key === workDuplicateKey({ title: candidate.title, artistName: artistId, venueName: venueId || "" });
  })?.id as string | undefined;
}

async function saveCandidate(db: SupabaseClient, artist: Artist, candidate: WorkSourceCandidate) {
  const dataSourceId = await sourceId(db, candidate.sourceKey);
  const venue = await matchVenue(db, candidate.venueName);
  const duplicateId = await duplicateWork(db, candidate, artist.id, venue.id);
  const computedStatus = duplicateId ? "duplicate" : venue.status === "ambiguous" ? "ambiguous" : "candidate";
  const { data: existing } = await db.from("work_import_candidates").select("match_status,matched_work_id").eq("artist_id", artist.id).eq("data_source_id", dataSourceId).eq("external_id", candidate.externalId).maybeSingle();
  const preserved = preservedCandidateState(existing, computedStatus, duplicateId);
  const status = preserved.matchStatus;
  const checksum = createHash("sha256").update(JSON.stringify(candidate.raw)).digest("hex");
  const { error: sourceError } = await db.from("source_records").upsert({ data_source_id: dataSourceId, external_id: candidate.externalId, source_url: candidate.sourceUrl, raw_payload: candidate.raw, checksum, fetched_at: new Date().toISOString() }, { onConflict: "data_source_id,external_id" });
  if (sourceError) throw sourceError;
  const { error } = await db.from("work_import_candidates").upsert({
    artist_id: artist.id, data_source_id: dataSourceId, external_id: candidate.externalId, source_url: candidate.sourceUrl,
    title: candidate.title, title_ja: candidate.titleJa, title_en: candidate.titleEn, title_original: candidate.titleOriginal,
    original_language: candidate.originalLanguage, year_text: candidate.yearText,
    created_year_from: candidate.createdYearFrom, created_year_to: candidate.createdYearTo, source_artist_name: candidate.artistName,
    source_venue_name: candidate.venueName, matched_venue_id: venue.id, holding_type: candidate.holdingType,
    presentation_type: candidate.presentationType, presentation_status: candidate.presentationStatus,
    representative_score: candidate.representativeScore, representative_reason: candidate.representativeReason,
    match_status: status, matched_work_id: preserved.matchedWorkId, raw_payload: candidate.raw,
  }, { onConflict: "data_source_id,external_id,artist_id" });
  if (error) throw error;
  return { venueMatched: Boolean(venue.id), duplicate: Boolean(duplicateId), ambiguous: status === "ambiguous" };
}

export async function targetedWorkCoverage(options: { limit?: number; saveCandidates?: boolean; fetchApj?: typeof searchApjShuzo; fetchTomuco?: typeof searchTomuco } = {}, db: SupabaseClient = createSupabaseAdminClient()) {
  const limit = Math.min(20, Math.max(1, options.limit || 20));
  const { data, error } = await db.from("artists").select("id,name,name_en,aliases").eq("effective_priority_tier", "A").order("name").limit(limit);
  if (error) throw error;
  const rows = (data || []) as Artist[]; const coverage: WorkCoverageRow[] = []; let saved = 0; let duplicates = 0; let ambiguous = 0;
  for (const artist of rows) {
    const errors: string[] = []; let candidates: WorkSourceCandidate[] = [];
    try { candidates.push(...await (options.fetchApj || searchApjShuzo)(artist, 5)); } catch (error) { errors.push(`SHŪZŌ: ${error instanceof Error ? error.message : "failed"}`); }
    try { candidates.push(...await (options.fetchTomuco || searchTomuco)(artist.name, 5)); } catch (error) { errors.push(`ToMuCo: ${error instanceof Error ? error.message : "failed"}`); }
    candidates = [...new Map(candidates.map((item) => [`${item.sourceKey}:${item.externalId}`, item])).values()].slice(0, 5);
    let venueMatches = 0;
    if (options.saveCandidates) for (const candidate of candidates) { const result = await saveCandidate(db, artist, candidate); saved += 1; venueMatches += Number(result.venueMatched); duplicates += Number(result.duplicate); ambiguous += Number(result.ambiguous); }
    else for (const candidate of candidates) venueMatches += Number(Boolean((await matchVenue(db, candidate.venueName)).id));
    coverage.push({ artistId: artist.id, artistName: artist.name, artistFound: candidates.length > 0, workFound: candidates.length > 0, candidateCount: candidates.length, holdingVenueCount: candidates.filter((item) => item.holdingType).length, venueMatchCount: venueMatches, yearCount: candidates.filter((item) => item.yearText).length, permanentCount: candidates.filter((item) => item.presentationType === "permanent").length, currentDisplayCount: candidates.filter((item) => item.presentationStatus === "currently_displayed").length, sourceErrors: errors });
  }
  return { dryRun: !options.saveCandidates, artists: rows.length, artistFound: coverage.filter((row) => row.artistFound).length, candidates: coverage.reduce((sum, row) => sum + row.candidateCount, 0), saved, duplicates, ambiguous, coverage };
}

export async function listWorkImportCandidates(db: SupabaseClient = createSupabaseAdminClient()) {
  const { data, error } = await db.from("work_import_candidates").select("id,artist_id,matched_work_id,title,title_ja,title_en,title_original,original_language,year_text,source_artist_name,source_venue_name,matched_venue_id,holding_type,presentation_type,presentation_status,match_status,representative_score,representative_reason,source_url,artists(name),venues(name),data_sources(name,key)").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}
