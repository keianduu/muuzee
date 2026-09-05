#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { rankCanonicalCandidates } from "../src/lib/venue-canonicalization/matcher.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DATABASE_CONTAINER = process.env.MUUZEE_DB_CONTAINER || "supabase_db_muuzee";
const CSV_PATH = resolve(ROOT, "tmp/exhibition-venue-canonical-merge-dry-run.csv");
const PERSIST = process.argv.includes("--persist");

const SQL = String.raw`
select row_to_json(result)::text
from (
  select v.id, v.name, v.name_en, v.aliases, v.address, v.prefecture, v.city,
    v.latitude, v.longitude, v.official_url, v.venue_type,
    exists(select 1 from public.exhibition_occurrences eo where eo.venue_id = v.id) as exhibition_derived,
    (select count(*)::int from public.exhibition_occurrences eo where eo.venue_id = v.id)
      + (select count(*)::int from public.collection_holdings ch where ch.venue_id = v.id) as relation_count,
    (select count(*)::int from public.exhibition_occurrences eo where eo.venue_id = v.id) as exhibition_count,
    (select count(*)::int from public.media_assets ma where ma.venue_id = v.id) as media_count,
    (select count(*)::int from public.media_assets ma where ma.venue_id = v.id and ma.is_primary) as primary_media_count,
    (select count(*)::int from public.venue_field_sources vfs where vfs.venue_id = v.id and vfs.is_current and vfs.source = 'manual') as manual_field_count,
    (select count(*)::int from public.venue_field_sources vfs where vfs.venue_id = v.id and vfs.is_current and vfs.source = 'official_website') as official_field_count,
    (select count(*)::int from public.venue_field_sources vfs where vfs.venue_id = v.id and vfs.is_current and vfs.review_status = 'approved') as approved_field_count,
    (select count(*)::int from public.media_assets ma where ma.venue_id = v.id and ma.rights_status = 'approved') as approved_media_count,
    coalesce((select array_agg(distinct ds.key order by ds.key) from public.source_records sr join public.data_sources ds on ds.id = sr.data_source_id where sr.venue_id = v.id), '{}'::text[]) as source_keys,
    coalesce((select array_agg(distinct qid order by qid) from (
      select sr.external_id as qid
      from public.source_records sr join public.data_sources ds on ds.id = sr.data_source_id
      where sr.venue_id = v.id and ds.key = 'wikidata'
      union all select v.best_wikidata_candidate_qid where v.best_wikidata_candidate_qid is not null
      union all select vem.external_id from public.venue_external_match_candidates vem
        where vem.venue_id = v.id and vem.provider = 'wikidata' and vem.status = 'matched'
    ) identifiers), '{}'::text[]) as qids
  from public.venues v
  where coalesce(v.is_active, true)
  order by v.id
) result;
`;

function readRows() {
  const output = execFileSync("docker", ["exec", DATABASE_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-A", "-t", "-P", "pager=off", "-v", "ON_ERROR_STOP=1", "-c", SQL], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return output.split("\n").filter(Boolean).map((line) => JSON.parse(line)).map((row) => ({
    id: row.id, name: row.name, nameEn: row.name_en, aliases: row.aliases || [], address: row.address,
    prefecture: row.prefecture, city: row.city, latitude: row.latitude, longitude: row.longitude,
    officialUrl: row.official_url, venueType: row.venue_type, qids: row.qids || [],
    relationCount: row.relation_count, exhibitionCount: row.exhibition_count,
    mediaCount: row.media_count, primaryMediaCount: row.primary_media_count, approvedMediaCount: row.approved_media_count,
    manualFieldCount: row.manual_field_count, officialFieldCount: row.official_field_count, approvedFieldCount: row.approved_field_count,
    sourceKeys: row.source_keys || [],
    exhibitionDerived: row.exhibition_derived,
  }));
}

function csv(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const venues = readRows();
const sources = venues.filter((venue) => venue.exhibitionDerived);
const columns = [
  "source_venue_id", "source_venue_name", "exhibition_count", "source_sources", "source_wikidata_qid",
  "candidate_venue_id", "candidate_venue_name", "candidate_wikidata_qid", "canonical_venue_id", "canonical_venue_name",
  "match_status", "match_confidence", "match_reasons",
  "source_official_url", "candidate_official_url", "source_address", "candidate_address",
  "source_lat", "source_lng", "candidate_lat", "candidate_lng", "distance_m",
  "source_completeness", "candidate_completeness", "source_manual_fields_count", "candidate_manual_fields_count",
  "source_approved_fields_count", "candidate_approved_fields_count", "source_approved_media_count", "candidate_approved_media_count",
  "source_relation_count", "candidate_relation_count", "canonical_priority_reason", "recommended_action", "notes",
];
const outputRows = [];
const persistRows = [];

function completeness(venue) {
  const checks = [
    venue.nameEn,
    venue.address,
    venue.officialUrl,
    venue.latitude != null && venue.longitude != null,
    venue.mediaCount > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function reportRow(source, candidate, match) {
  const canonical = venues.find((venue) => venue.id === match?.canonicalVenueId) || source;
  return {
    source_venue_id: source.id,
    source_venue_name: source.name,
    exhibition_count: source.exhibitionCount,
    source_sources: source.sourceKeys.join("|"),
    source_wikidata_qid: source.qids.join("|"),
    candidate_venue_id: candidate?.id || "",
    candidate_venue_name: candidate?.name || "",
    candidate_wikidata_qid: candidate?.qids?.join("|") || "",
    canonical_venue_id: canonical.id,
    canonical_venue_name: canonical.name,
    match_status: match?.category || "NONE",
    match_confidence: match?.confidence?.toFixed(2) || "0.00",
    match_reasons: match?.reasons?.join("; ") || "no plausible candidate",
    source_official_url: source.officialUrl || "",
    candidate_official_url: candidate?.officialUrl || "",
    source_address: source.address || "",
    candidate_address: candidate?.address || "",
    source_lat: source.latitude ?? "",
    source_lng: source.longitude ?? "",
    candidate_lat: candidate?.latitude ?? "",
    candidate_lng: candidate?.longitude ?? "",
    distance_m: match?.distanceMeters ?? "",
    source_completeness: completeness(source),
    candidate_completeness: candidate ? completeness(candidate) : "",
    source_manual_fields_count: source.manualFieldCount,
    candidate_manual_fields_count: candidate?.manualFieldCount ?? "",
    source_approved_fields_count: source.approvedFieldCount,
    candidate_approved_fields_count: candidate?.approvedFieldCount ?? "",
    source_approved_media_count: source.approvedMediaCount,
    candidate_approved_media_count: candidate?.approvedMediaCount ?? "",
    source_relation_count: source.relationCount,
    candidate_relation_count: candidate?.relationCount ?? "",
    canonical_priority_reason: match?.canonicalPriorityReason || "source retained because no canonical candidate was found",
    recommended_action: match?.recommendedAction || "keep_separate",
    notes: match ? "" : "No candidate reached the reporting threshold.",
  };
}

for (const source of sources) {
  const ranked = rankCanonicalCandidates(source, venues, 3);
  const meaningful = ranked.filter((match) => match.category !== "NONE" || match.confidence >= 0.15);
  if (!meaningful.length) {
    outputRows.push(reportRow(source, null, null));
    continue;
  }
  for (const match of meaningful) {
    const candidate = venues.find((venue) => venue.id === match.candidateVenueId);
    outputRows.push(reportRow(source, candidate, match));
    if (match.category !== "NONE") persistRows.push({
      source_venue_id: source.id, candidate_venue_id: candidate.id, canonical_venue_id: match.canonicalVenueId,
      rank: meaningful.indexOf(match) + 1, confidence: match.confidence, match_category: match.category,
      match_reasons: match.reasons, distance_meters: match.distanceMeters,
      canonical_priority_reason: match.canonicalPriorityReason, recommended_action: match.recommendedAction,
      auto_merge_eligible: match.autoMergeEligible, source_snapshot: source, candidate_snapshot: candidate,
    });
  }
}

mkdirSync(dirname(CSV_PATH), { recursive: true });
writeFileSync(CSV_PATH, [columns.join(","), ...outputRows.map((row) => columns.map((column) => csv(row[column])).join(","))].join("\n") + "\n");
if (PERSIST) {
  const json = JSON.stringify(persistRows).replaceAll("'", "''");
  const persistSql = `begin;
    delete from public.venue_canonical_merge_candidates where review_status = 'pending';
    insert into public.venue_canonical_merge_candidates
      (source_venue_id,candidate_venue_id,canonical_venue_id,rank,confidence,match_category,match_reasons,distance_meters,canonical_priority_reason,recommended_action,auto_merge_eligible,source_snapshot,candidate_snapshot)
    select source_venue_id::uuid,candidate_venue_id::uuid,canonical_venue_id::uuid,rank,confidence,match_category,match_reasons,distance_meters,canonical_priority_reason,recommended_action,auto_merge_eligible,source_snapshot,candidate_snapshot
    from jsonb_to_recordset('${json}'::jsonb) as x(source_venue_id text,candidate_venue_id text,canonical_venue_id text,rank int,confidence numeric,match_category text,match_reasons text[],distance_meters numeric,canonical_priority_reason text,recommended_action text,auto_merge_eligible boolean,source_snapshot jsonb,candidate_snapshot jsonb)
    on conflict (source_venue_id,candidate_venue_id) do update set canonical_venue_id=excluded.canonical_venue_id,rank=excluded.rank,confidence=excluded.confidence,match_category=excluded.match_category,match_reasons=excluded.match_reasons,distance_meters=excluded.distance_meters,canonical_priority_reason=excluded.canonical_priority_reason,recommended_action=excluded.recommended_action,auto_merge_eligible=excluded.auto_merge_eligible,source_snapshot=excluded.source_snapshot,candidate_snapshot=excluded.candidate_snapshot,updated_at=now();
    commit;`;
  execFileSync("docker", ["exec", DATABASE_CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-X", "-v", "ON_ERROR_STOP=1", "-c", persistSql], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
}
const counts = outputRows.reduce((acc, row) => { acc[row.match_status] = (acc[row.match_status] || 0) + 1; return acc; }, {});
const sourceCounts = Object.fromEntries(["HIGH", "POSSIBLE", "NONE"].map((category) => [category, new Set(outputRows.filter((row) => row.match_status === category).map((row) => row.source_venue_id)).size]));
console.log(JSON.stringify({ csvPath: CSV_PATH, persisted: PERSIST ? persistRows.length : 0, totalVenues: venues.length, sourceVenues: sources.length, candidateRows: outputRows.length, candidateRowCategories: counts, sourceVenueCategories: sourceCounts }, null, 2));
