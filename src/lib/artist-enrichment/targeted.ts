import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { autoSetPreferredMasterCandidatePrimary } from "@/lib/admin/master-primary-image";
import { artistQuality } from "@/lib/admin/artist-priority";
import { fetchApjArtist, matchApjArtistCandidates, type ArtistIdentity } from "./apj-client";
import { explicitGettyNationalityCode, fetchGettyUlan, matchGettyCandidates, searchGettyUlan, type GettyUlanRecord } from "./getty-client";
import { TIER_A_OFFICIAL_IMAGE_CANDIDATES } from "./official-images";
import { fetchJson } from "@/lib/external/fetch-json";

const NATIONALITY_TARGET_QIDS = ["Q5097289", "Q78885", "Q909809", "Q2496707", "Q11352469", "Q11415898", "Q3124280", "Q11483145"];
const IMAGE_TARGET_QIDS = ["Q27917904", "Q11352469", "Q6352389", "Q11422730", "Q11464231", "Q11519304", "Q30924607", "Q94533385"];

// Confirmed from the official APJ artist pages. This is intentionally a small
// targeted registry, not an APJ dataset mirror or global import.
const APJ_BY_QID: Record<string, string> = {
  Q5097289: "A1123", Q2496707: "A2798", Q11415898: "A1956", Q3124280: "A1822", Q11483145: "A1815",
};

type ArtistRow = Record<string, unknown> & { id: string; name: string; name_en?: string | null; aliases?: string[]; birth_year?: number | null; death_year?: number | null };

function qid(row: ArtistRow) {
  return ((row.source_records || []) as Array<{ external_id?: string }>).find((record) => /^Q\d+$/.test(record.external_id || ""))?.external_id || null;
}

function identity(row: ArtistRow): ArtistIdentity {
  return { name: row.name, nameEn: row.name_en, aliases: row.aliases || [], birthYear: row.birth_year, deathYear: row.death_year, birthPlace: String(row.birth_place || "") || null };
}

function coreSnapshot(rows: ArtistRow[]) {
  const quality = rows.map((row) => artistQuality(row));
  return {
    total: rows.length,
    name: rows.filter((row) => Boolean(row.name)).length,
    nameEn: rows.filter((row) => Boolean(row.name_en)).length,
    nationality: rows.filter((row) => Boolean(row.nationality_country_code)).length,
    primaryImage: quality.filter((item) => item.primary).length,
    complete: quality.filter((item) => item.completeness.met === 4).length,
    average: rows.length ? Math.round(quality.reduce((sum, item) => sum + item.completeness.percent, 0) / rows.length) : 0,
  };
}

async function tierARows(db: SupabaseClient) {
  const { data, error } = await db.from("artists").select("*,media_assets(id,is_primary,rights_status),source_records!source_records_artist_id_fkey(id,external_id,data_sources(key),source_image_candidates(id,is_active,review_status,rights_status))").eq("effective_priority_tier", "A").order("name");
  if (error) throw error;
  return (data || []) as ArtistRow[];
}

async function sourceId(db: SupabaseClient, key: string) {
  const { data, error } = await db.from("data_sources").select("id").eq("key", key).single();
  if (error || !data) throw error || new Error(`Data source ${key} missing; apply latest migration`);
  return data.id as string;
}

async function saveSourceRecord(db: SupabaseClient, input: { sourceKey: string; artistId: string; externalId: string; sourceUrl: string; payload: unknown }) {
  const dataSourceId = await sourceId(db, input.sourceKey);
  const checksum = createHash("sha256").update(JSON.stringify(input.payload)).digest("hex");
  const { data, error } = await db.from("source_records").upsert({ data_source_id: dataSourceId, external_id: input.externalId, artist_id: input.artistId, source_url: input.sourceUrl, raw_payload: input.payload, checksum, fetched_at: new Date().toISOString() }, { onConflict: "data_source_id,external_id" }).select("id").single();
  if (error || !data) throw error || new Error("Source record save failed");
  return data.id as string;
}

export const ARTIST_NATIONALITY_SOURCE_PRIORITY: Record<string, number> = {
  wikidata: 1, wikipedia: 2, getty_ulan: 3, apj_daj: 4, official_website: 5, manual: 6,
};

export function shouldApplyArtistNationality(currentValue: unknown, currentSource: string | null | undefined, incomingSource: "apj_daj" | "getty_ulan") {
  if (currentValue) return false;
  return (ARTIST_NATIONALITY_SOURCE_PRIORITY[currentSource || ""] || 0) <= ARTIST_NATIONALITY_SOURCE_PRIORITY[incomingSource];
}

async function applyNationality(db: SupabaseClient, artist: ArtistRow, sourceRecordId: string, record: GettyUlanRecord) {
  const code = explicitGettyNationalityCode(record.nationalities);
  if (!code) return { applied: false, reason: record.nationalities.length > 1 ? "multiple_or_unmapped_nationalities" : "nationality_not_explicit", code: null };
  const { data: current } = await db.from("artist_field_sources").select("source").eq("artist_id", artist.id).eq("field_name", "nationality_country_code").eq("is_current", true).maybeSingle();
  if (!shouldApplyArtistNationality(artist.nationality_country_code, current?.source, "getty_ulan")) return { applied: false, reason: "higher_priority_or_existing_value", code };
  await db.from("artist_field_sources").update({ is_current: false }).eq("artist_id", artist.id).eq("field_name", "nationality_country_code").eq("is_current", true);
  const { data: same, error: sameError } = await db.from("artist_field_sources").select("id").eq("artist_id", artist.id).eq("field_name", "nationality_country_code").eq("source_record_id", sourceRecordId).maybeSingle();
  if (sameError) throw sameError;
  if (same) {
    const { error } = await db.from("artist_field_sources").update({ is_current: true, review_status: "applied", updated_at: new Date().toISOString() }).eq("id", same.id);
    if (error) throw error;
  } else {
    const { error } = await db.from("artist_field_sources").insert({ artist_id: artist.id, field_name: "nationality_country_code", source: "getty_ulan", source_url: record.url, source_record_id: sourceRecordId, value_snapshot: code, generated_by_ai: false, review_status: "applied", is_current: true });
    if (error) throw error;
  }
  const { error } = await db.from("artists").update({ nationality_country_code: code }).eq("id", artist.id).is("nationality_country_code", null);
  if (error) throw error;
  return { applied: true, reason: "explicit_single_nationality", code };
}

async function wikidataAuthorityIds(qids: string[], fetcher: typeof fetch) {
  if (!qids.length) return new Map<string, { ulanId: string | null }>();
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbgetentities", ids: qids.join("|"), props: "claims", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  if (fetcher === fetch) {
    const payload = await fetchJson<{ entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> }>(url, { timeoutMs: 30_000 });
    return new Map(qids.map((item) => [item, { ulanId: String(payload.entities?.[item]?.claims?.P245?.[0]?.mainsnak?.datavalue?.value || "") || null }]));
  }
  const response = await fetcher(url, { headers: { "User-Agent": "MuuzeeTargetedArtistEnrichment/1.0" } });
  if (!response.ok) throw new Error(`Wikidata authority lookup ${response.status}`);
  const payload = await response.json() as { entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> };
  return new Map(qids.map((item) => [item, { ulanId: String(payload.entities?.[item]?.claims?.P245?.[0]?.mainsnak?.datavalue?.value || "") || null }]));
}

async function nationalityEnrichment(db: SupabaseClient, rows: ArtistRow[], dryRun: boolean, fetcher: typeof fetch) {
  const targets = rows.filter((row) => !row.nationality_country_code && NATIONALITY_TARGET_QIDS.includes(qid(row) || ""));
  const authorities = await wikidataAuthorityIds(targets.map((row) => qid(row)!), fetcher);
  const results: Array<Record<string, unknown>> = [];
  for (const artist of targets) {
    const artistQid = qid(artist)!;
    let apjStatus = "not_found"; const apjId: string | null = APJ_BY_QID[artistQid] || null; let apjUlan: string | null = null;
    if (apjId) {
      const apj = await fetchApjArtist(apjId, fetcher);
      const match = apj ? matchApjArtistCandidates(identity(artist), [apj]) : { status: "not_found", candidate: null };
      apjStatus = match.status;
      if (match.status === "exact" && match.candidate) {
        apjUlan = match.candidate.ulanId;
        if (!dryRun) await saveSourceRecord(db, { sourceKey: "apj_daj", artistId: artist.id, externalId: apjId, sourceUrl: match.candidate.url, payload: match.candidate });
      }
    }
    let gettyCandidates: GettyUlanRecord[] = [];
    const ulanId = apjUlan || authorities.get(artistQid)?.ulanId;
    if (ulanId) gettyCandidates = [await fetchGettyUlan(ulanId, fetcher)];
    else gettyCandidates = await searchGettyUlan(artist.name_en || artist.name, fetcher);
    const getty = matchGettyCandidates(identity(artist), gettyCandidates);
    let application: Record<string, unknown> = { applied: false, reason: getty.status };
    if (getty.status === "exact" && getty.candidate) {
      const code = explicitGettyNationalityCode(getty.candidate.nationalities);
      application = { applied: Boolean(code), reason: code ? "explicit_single_nationality" : "multiple_or_unmapped_nationalities", code };
      if (!dryRun) {
        const sourceRecordId = await saveSourceRecord(db, { sourceKey: "getty_ulan", artistId: artist.id, externalId: getty.candidate.id, sourceUrl: getty.candidate.url, payload: getty.candidate });
        application = await applyNationality(db, artist, sourceRecordId, getty.candidate);
      }
    }
    results.push({ artistId: artist.id, name: artist.name, qid: artistQid, apjId, apjStatus, gettyStatus: getty.status, gettyId: getty.candidate?.id || null, gettyCandidates: getty.candidates.map((item) => item.id), nationalities: getty.candidate?.nationalities || [], ...application });
  }
  return results;
}

async function imageEnrichment(db: SupabaseClient, rows: ArtistRow[], dryRun: boolean) {
  const targets = rows.filter((row) => IMAGE_TARGET_QIDS.includes(qid(row) || "") && !((row.media_assets || []) as Array<{ is_primary?: boolean }>).some((asset) => asset.is_primary));
  const results: Array<Record<string, unknown>> = [];
  for (const artist of targets) {
    const artistQid = qid(artist)!; const curated = TIER_A_OFFICIAL_IMAGE_CANDIDATES.filter((item) => item.qid === artistQid);
    let added = 0; let primaryAdded = false;
    let primaryError: string | null = null;
    if (!dryRun) {
      for (const candidate of curated) {
        const sourceRecordId = await saveSourceRecord(db, { sourceKey: "official_artist_image", artistId: artist.id, externalId: `artist:${artist.id}:${createHash("sha1").update(candidate.sourceUrl).digest("hex")}`, sourceUrl: candidate.sourceUrl, payload: candidate });
        const { data: prior } = await db.from("source_image_candidates").select("id,review_status,rights_status").eq("source_record_id", sourceRecordId).eq("provider", new URL(candidate.sourceUrl).hostname).eq("stable_identifier", candidate.stableIdentifier).maybeSingle();
        const { error } = await db.from("source_image_candidates").upsert({
          source_record_id: sourceRecordId, image_url: candidate.imageUrl, thumbnail_url: candidate.imageUrl, provider: new URL(candidate.sourceUrl).hostname,
          stable_identifier: candidate.stableIdentifier, source_url: candidate.sourceUrl, source_type: candidate.sourceType, author: candidate.author, credit: candidate.credit,
          license_short_name: candidate.reportedLicense, license_url: candidate.licenseUrl, usage_terms: candidate.usageTerms,
          commercial_use: candidate.commercialUse, modification_crop: candidate.modificationCrop, attribution_requirement: candidate.attributionRequirement,
          valid_until: candidate.validUntil, notes: candidate.notes, candidate_entity_id: artistQid, candidate_entity_label: artist.name,
          candidate_match_confidence: 1, candidate_match_threshold: 1, candidate_kind: "probable", image_subject_type: "portrait_photo",
          discovery_source: candidate.discoverySource, contents_rights_type: candidate.reportedLicense, contents_access: candidate.usageTerms,
          review_status: prior?.review_status || "unreviewed", rights_status: prior?.rights_status || "needs_review", is_active: true, last_seen_at: new Date().toISOString(),
        }, { onConflict: "source_record_id,provider,stable_identifier" });
        if (error) throw error; if (!prior) added += 1;
      }
      if (curated.length === 1) {
        try {
          const primary = await autoSetPreferredMasterCandidatePrimary("artists", artist.id);
          primaryAdded = primary.changed;
        } catch (error) {
          primaryError = error instanceof Error ? error.message : "Primary image download failed";
        }
      }
    }
    results.push({ artistId: artist.id, name: artist.name, qid: artistQid, candidateCount: curated.length, added, primaryAdded, primaryError, rights: curated.length ? "unknown" : "no_candidate", sourceUrls: curated.map((item) => item.sourceUrl) });
  }
  return results;
}

export async function targetedTierAArtistEnrichment(options: { dryRun?: boolean; fetcher?: typeof fetch } = {}, db: SupabaseClient = createSupabaseAdminClient()) {
  const dryRun = Boolean(options.dryRun); const fetcher = options.fetcher || fetch;
  const beforeRows = await tierARows(db); const before = coreSnapshot(beforeRows);
  const nationalities = await nationalityEnrichment(db, beforeRows, dryRun, fetcher);
  const images = await imageEnrichment(db, beforeRows, dryRun);
  const afterRows = dryRun ? beforeRows : await tierARows(db); const after = coreSnapshot(afterRows);
  return {
    dryRun, before, after,
    nationalityTargets: nationalities,
    imageTargets: images,
    apjMatches: nationalities.filter((item) => item.apjStatus === "exact").length,
    gettyMatches: nationalities.filter((item) => item.gettyStatus === "exact").length,
    nationalityApplied: nationalities.filter((item) => item.applied).length,
    imageCandidatesFound: images.filter((item) => Number(item.candidateCount) > 0).length,
    primaryImagesAdded: images.filter((item) => item.primaryAdded).length,
  };
}
