import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import { slugify } from "./slug";
import { calculateCompleteness } from "./master-completeness";
import { buildCsvPreview, parseCsv, summarizeCsvPreview, type CsvPreviewRow } from "./master-csv";
import { MASTER_CONFIGS, type MasterEntity, type MasterStatus } from "./master-config";
import { normalizeMasterValues, valuesEqual, type MasterValues } from "./master-validation";
import { compareVenueQuality, effectiveVenueTier, tiersForFilter, VENUE_PRIORITY_TIERS, VENUE_TIER_TARGETS, venueQuality, type VenuePriorityTier } from "./venue-priority";
import { ARTIST_PRIORITY_TIERS, artistQuality, compareArtistQuality, effectiveArtistTier, tiersForArtistFilter, type ArtistPriorityTier } from "./artist-priority";
import { normalizeIdentity } from "@/lib/work-collection/mapping";
import { hasWorkTitle } from "@/lib/work-title";

export type MasterRecord = Record<string, unknown> & {
  id: string;
  slug: string;
  publication_status: MasterStatus;
  updated_at: string;
};

export type MasterListOptions = {
  q?: string;
  status?: string;
  type?: string;
  active?: string;
  image?: string;
  coordinates?: string;
  source?: string;
  match?: string;
  completeness?: string;
  tier?: string;
  nationality?: string;
  artistRelation?: string;
  holdingRelation?: string;
  presentation?: string;
  page?: number;
  pageSize?: number;
};

export type MasterListResult = {
  rows: Array<MasterRecord & { completeness: ReturnType<typeof calculateCompleteness>; signedImageUrl?: string | null }>;
  total: number;
  allTotal: number;
  page: number;
  pageSize: number;
  totalPages: number;
  configured: boolean;
  error: string | null;
  qualityDashboard?: VenueQualityDashboard | ArtistQualityDashboard;
};

export type VenueQualityDashboard = {
  kind: "venue";
  tiers: Array<{ tier: VenuePriorityTier; count: number; averageCompleteness: number; target: number; met: number; unmet: number }>;
  selected: { label: string; count: number; averageCompleteness: number };
  priorityTotal: number;
  priorityTargetUnmet: number;
  multipleQidCandidates: number;
  missing: Record<"address" | "postalCode" | "coordinates" | "officialUrl" | "openingHours" | "closedDays" | "access" | "description" | "imageCandidate" | "primaryImage" | "approvedImage", number>;
  images: { candidatePresent: number; primary: number; rightsUnknown: number; approved: number; none: number; multipleCandidates: number };
  queue: Array<{ id: string; name: string; tier: VenuePriorityTier; completeness: number; missing: string[] }>;
};

export type ArtistQualityDashboard = {
  kind: "artist";
  tiers: Array<{ tier: ArtistPriorityTier; count: number; averageCompleteness: number; complete: number; incomplete: number }>;
  selected: { label: string; count: number; averageCompleteness: number };
  missing: Record<"name" | "nameEn" | "nationality" | "primaryImage", number>;
};

const selectByEntity: Record<MasterEntity, string> = {
  venues: "*, media_assets(*), venue_field_sources(*), official_venue_crawl_results(*), venue_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_venue_id_fkey(*, data_sources(name,key), source_image_candidates(*)), venue_external_match_candidates(*), exhibition_occurrences(id,start_date,end_date,exhibition_id,exhibitions(id,title)), collection_holdings(id,work_id,works(id,title,title_ja,title_en,title_original,original_language))",
  artists: "*, media_assets(*), artist_field_sources(*), artist_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_artist_id_fkey(*, data_sources(name,key), source_image_candidates(*)), exhibition_artists(id,exhibition_id,exhibitions(id,title)), work_artists(id,work_id,role,works(id,title,title_ja,title_en,title_original,original_language))",
  works: "*, media_assets(*), work_field_sources(*), work_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_work_id_fkey(*, data_sources(name,key), source_image_candidates(*)), work_artists(id,artist_id,role,source,source_url,artists(id,name)), collection_holdings(id,venue_id,holding_type,inventory_number,source,source_url,venues(id,name)), work_presentations(id,venue_id,presentation_type,status,start_date,end_date,source,source_url,venues(id,name))",
};

const listSelectByEntity: Record<MasterEntity, string> = {
  venues: "*, media_assets(*), source_records!source_records_venue_id_fkey(id,external_id,data_sources(name,key),source_image_candidates(*)), venue_external_match_candidates(id,status,provider,external_id), exhibition_occurrences(id), collection_holdings(id)",
  artists: "*, media_assets(*), source_records!source_records_artist_id_fkey(id,external_id,raw_payload,data_sources(name,key),source_image_candidates(*)), artist_external_match_candidates(id,status,provider,external_id), exhibition_artists(id), work_artists(id)",
  works: "*, media_assets(*), work_artists(id,artist_id,artists(id,name)), collection_holdings(id,venue_id,venues(id,name)), work_presentations(id,venue_id,presentation_type,status,venues(id,name))",
};

function asRecords(value: unknown) { return (value || []) as MasterRecord[]; }
function asRecord(value: unknown) { return value as MasterRecord; }

function escapePostgrest(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_").replaceAll(",", "\\,");
}

type SignedMasterRecord = MasterRecord & { media_assets: Array<Record<string, unknown>>; signedImageUrl: string | null };

async function signPrimaryImages(rows: MasterRecord[]): Promise<SignedMasterRecord[]> {
  const db = createSupabaseAdminClient();
  return Promise.all(rows.map(async (row) => {
    const assets = (row.media_assets || []) as Array<Record<string, unknown>>;
    const signedAssets = await Promise.all(assets.map(async (asset) => {
      if (typeof asset.storage_path !== "string") return asset;
      const { data } = await db.storage.from("exhibition-images").createSignedUrl(asset.storage_path, 3600);
      return { ...asset, signedUrl: typeof data?.signedUrl === "string" ? data.signedUrl : null };
    }));
    const primary = signedAssets.find((asset) => asset.is_primary);
    return { ...row, media_assets: signedAssets, signedImageUrl: typeof primary?.signedUrl === "string" ? primary.signedUrl : null };
  }));
}

async function findSearchIds(entity: MasterEntity, q: string) {
  const db = createSupabaseAdminClient();
  const term = escapePostgrest(q.trim());
  if (!term) return null;
  if (entity === "venues") {
    const { data, error } = await db.from("venues").select("id").or(`name.ilike.%${term}%,name_en.ilike.%${term}%,address.ilike.%${term}%,city.ilike.%${term}%`);
    if (error) throw error;
    const direct = (data || []).map((row) => row.id);
    const { data: aliasRows, error: aliasError } = await db.from("venues").select("id,aliases");
    if (aliasError) throw aliasError;
    return [...new Set([...direct, ...(aliasRows || []).filter((row) => (row.aliases || []).some((alias: string) => alias.toLowerCase().includes(q.toLowerCase()))).map((row) => row.id)])];
  }
  if (entity === "artists") {
    const { data, error } = await db.from("artists").select("id,name,name_en,name_native,name_kana,aliases");
    if (error) throw error;
    const lower = q.toLowerCase();
    return (data || []).filter((row) => [row.name, row.name_en, row.name_native, row.name_kana, ...(row.aliases || [])].some((value) => String(value || "").toLowerCase().includes(lower))).map((row) => row.id);
  }
  const [workResult, artistResult] = await Promise.all([
    db.from("works").select("id").or(`title.ilike.%${term}%,title_ja.ilike.%${term}%,title_en.ilike.%${term}%,title_original.ilike.%${term}%`),
    db.from("artists").select("id,name,name_en,aliases"),
  ]);
  if (workResult.error) throw workResult.error;
  if (artistResult.error) throw artistResult.error;
  const lower = q.toLowerCase();
  const artistIds = (artistResult.data || []).filter((row) => [row.name, row.name_en, ...(row.aliases || [])].some((value) => String(value || "").toLowerCase().includes(lower))).map((row) => row.id);
  let relationIds: string[] = [];
  if (artistIds.length) {
    const { data, error } = await db.from("work_artists").select("work_id").in("artist_id", artistIds);
    if (error) throw error;
    relationIds = (data || []).map((row) => row.work_id);
  }
  return [...new Set([...(workResult.data || []).map((row) => row.id), ...relationIds])];
}

async function filteredIdsByRelation(entity: MasterEntity, options: MasterListOptions) {
  const db = createSupabaseAdminClient();
  let allowed: string[] | undefined;
  const intersect = (current: string[] | undefined, ids: string[]) => { const next = new Set(ids); return current ? current.filter((id) => next.has(id)) : [...next]; };
  if (options.q) allowed = intersect(allowed, (await findSearchIds(entity, options.q)) || []);
  if (options.image === "present" || options.image === "missing") {
    const ownerKey = MASTER_CONFIGS[entity].ownerKey;
    const { data, error } = await db.from("media_assets").select(ownerKey).eq("is_primary", true).not(ownerKey, "is", null);
    if (error) throw error;
    const present = new Set(((data || []) as unknown as Array<Record<string, unknown>>).map((row) => String(row[ownerKey])));
    const { data: masters, error: masterError } = await db.from(entity).select("id");
    if (masterError) throw masterError;
    allowed = intersect(allowed, (masters || []).map((row) => row.id).filter((id) => options.image === "present" ? present.has(id) : !present.has(id)));
  }
  if (options.source) {
    const config = MASTER_CONFIGS[entity];
    const { data, error } = await db.from(config.provenanceTable).select(config.ownerKey).eq("source", options.source).eq("is_current", true);
    if (error) throw error;
    allowed = intersect(allowed, ((data || []) as unknown as Array<Record<string, unknown>>).map((row) => String(row[config.ownerKey])));
  }
  if (entity === "artists" && options.nationality === "missing") {
    const { data, error } = await db.from("artists").select("id").is("nationality_country_code", null);
    if (error) throw error; allowed = intersect(allowed, (data || []).map((row) => row.id));
  }
  if (entity === "works") {
    for (const [filter, table] of [[options.artistRelation, "work_artists"], [options.holdingRelation, "collection_holdings"]] as const) {
      if (filter !== "present" && filter !== "missing") continue;
      const { data: relations, error } = await db.from(table).select("work_id");
      if (error) throw error;
      const present = new Set((relations || []).map((row) => row.work_id));
      const { data: masters, error: masterError } = await db.from("works").select("id");
      if (masterError) throw masterError;
      allowed = intersect(allowed, (masters || []).map((row) => row.id).filter((id) => filter === "present" ? present.has(id) : !present.has(id)));
    }
    if (options.presentation) {
      let query = db.from("work_presentations").select("work_id");
      if (options.presentation === "currently_displayed") query = query.eq("status", "currently_displayed");
      else if (options.presentation === "permanent") query = query.eq("presentation_type", "permanent");
      const { data, error } = await query;
      if (error) throw error;
      allowed = intersect(allowed, [...new Set((data || []).map((row) => row.work_id))]);
    }
  }
  if (entity === "venues" && options.match) {
    const { data: wikidataSource, error: wikidataSourceError } = await db.from("data_sources").select("id").eq("key", "wikidata").maybeSingle();
    if (wikidataSourceError) throw wikidataSourceError;
    const linkedVenueIds = new Set<string>();
    if (wikidataSource?.id) {
      for (let offset = 0; ; offset += 1000) {
        const { data: sourceLinks, error: sourceLinksError } = await db.from("source_records").select("venue_id").eq("data_source_id", wikidataSource.id).not("venue_id", "is", null).range(offset, offset + 999);
        if (sourceLinksError) throw sourceLinksError;
        for (const row of sourceLinks || []) if (row.venue_id) linkedVenueIds.add(row.venue_id);
        if ((sourceLinks || []).length < 1000) break;
      }
    }
    if (options.match === "unmatched") {
      const masters: Array<{ id: string }> = [];
      for (let offset = 0; ; offset += 1000) {
        const { data: masterRows, error: masterError } = await db.from("venues").select("id").is("merged_into_venue_id", null).range(offset, offset + 999);
        if (masterError) throw masterError;
        masters.push(...(masterRows || []));
        if ((masterRows || []).length < 1000) break;
      }
      const withCandidate = new Set<string>();
      for (let offset = 0; ; offset += 1000) {
        const { data: candidateRows, error: candidateError } = await db.from("venue_external_match_candidates").select("venue_id").eq("provider", "wikidata").neq("status", "rejected").range(offset, offset + 999);
        if (candidateError) throw candidateError;
        for (const row of candidateRows || []) withCandidate.add(row.venue_id);
        if ((candidateRows || []).length < 1000) break;
      }
      allowed = intersect(allowed, masters.map((row) => row.id).filter((id) => !linkedVenueIds.has(id) && !withCandidate.has(id)));
      return allowed;
    }
    const statuses = options.match === "selection" ? ["candidate"] : [options.match];
    const data: Array<{ venue_id: string; status: string }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: candidateRows, error } = await db.from("venue_external_match_candidates").select("venue_id,status").eq("provider", "wikidata").in("status", statuses).range(offset, offset + 999);
      if (error) throw error;
      data.push(...(candidateRows || []));
      if ((candidateRows || []).length < 1000) break;
    }
    const counts = new Map<string, number>();
    for (const row of data) counts.set(row.venue_id, (counts.get(row.venue_id) || 0) + 1);
    const ids = options.match === "selection"
      ? [...counts].filter(([id, count]) => count > 1 && !linkedVenueIds.has(id)).map(([id]) => id)
      : data.map((row) => row.venue_id);
    allowed = intersect(allowed, ids);
  }
  return allowed;
}

async function allVenueQualityRows() {
  const db = createSupabaseAdminClient();
  const rows: MasterRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("venues").select("id,slug,name,venue_type,is_active,publication_status,updated_at,auto_priority_tier,manual_priority_tier,effective_priority_tier,address,postal_code,latitude,longitude,official_url,description,opening_hours_text,closed_days_text,access_text,media_assets(id,is_primary,rights_status),source_records!source_records_venue_id_fkey(id,data_sources(key),source_image_candidates(id,is_active)),venue_external_match_candidates(id,status)").is("merged_into_venue_id", null).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...asRecords(data));
    if ((data || []).length < 1000) break;
  }
  return rows;
}

async function allArtistQualityRows() {
  const db = createSupabaseAdminClient();
  const rows: MasterRecord[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from("artists").select("id,slug,name,name_en,nationality_country_code,publication_status,updated_at,auto_priority_tier,manual_priority_tier,effective_priority_tier,media_assets(id,is_primary,rights_status),source_records!source_records_artist_id_fkey(id,source_image_candidates(id,is_active,review_status,rights_status))").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...asRecords(data));
    if ((data || []).length < 1000) break;
  }
  return rows;
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function dashboardFor(rows: MasterRecord[], tierFilter?: string): VenueQualityDashboard {
  const priorityRows = rows.filter((row) => ["A", "B", "C"].includes(effectiveVenueTier(row) || ""));
  const selectedTiers = tiersForFilter(tierFilter);
  const selectedRows = selectedTiers ? rows.filter((row) => selectedTiers.includes(effectiveVenueTier(row)!)) : rows;
  const missingKeys = ["address", "postalCode", "coordinates", "officialUrl", "openingHours", "closedDays", "access", "description", "imageCandidate", "primaryImage", "approvedImage"] as const;
  const missing = Object.fromEntries(missingKeys.map((key) => [key, priorityRows.filter((row) => venueQuality(row).missing[key]).length])) as VenueQualityDashboard["missing"];
  const queue = priorityRows
    .filter((row) => {
      const tier = effectiveVenueTier(row)!;
      return venueQuality(row).completeness.percent < VENUE_TIER_TARGETS[tier];
    })
    .sort(compareVenueQuality)
    .slice(0, 20)
    .map((row) => {
      const quality = venueQuality(row);
      return { id: row.id, name: String(row.name), tier: effectiveVenueTier(row)!, completeness: quality.completeness.percent, missing: quality.completeness.items.filter((item) => !item.met).map((item) => item.label) };
    });
  return {
    kind: "venue",
    tiers: VENUE_PRIORITY_TIERS.map((tier) => {
      const tierRows = rows.filter((row) => effectiveVenueTier(row) === tier);
      const target = VENUE_TIER_TARGETS[tier];
      const met = tierRows.filter((row) => venueQuality(row).completeness.percent >= target).length;
      return { tier, count: tierRows.length, averageCompleteness: average(tierRows.map((row) => venueQuality(row).completeness.percent)), target, met, unmet: tierRows.length - met };
    }),
    selected: { label: tierFilter || "All", count: selectedRows.length, averageCompleteness: average(selectedRows.map((row) => venueQuality(row).completeness.percent)) },
    priorityTotal: priorityRows.length,
    priorityTargetUnmet: priorityRows.filter((row) => venueQuality(row).completeness.percent < VENUE_TIER_TARGETS[effectiveVenueTier(row)!]).length,
    multipleQidCandidates: rows.filter((row) => {
      const hasLinkedWikidata = ((row.source_records || []) as Array<{ data_sources?: { key?: string } }>).some((source) => source.data_sources?.key === "wikidata");
      const candidateCount = ((row.venue_external_match_candidates || []) as Array<{ status?: string }>).filter((candidate) => candidate.status === "candidate").length;
      return !hasLinkedWikidata && candidateCount > 1;
    }).length,
    missing,
    images: {
      candidatePresent: priorityRows.filter((row) => venueQuality(row).candidateCount > 0).length,
      primary: priorityRows.filter((row) => Boolean(venueQuality(row).primary)).length,
      rightsUnknown: priorityRows.filter((row) => venueQuality(row).rightsNeedsReview).length,
      approved: priorityRows.filter((row) => venueQuality(row).approvedPrimary).length,
      none: priorityRows.filter((row) => !venueQuality(row).primary && venueQuality(row).candidateCount === 0).length,
      multipleCandidates: priorityRows.filter((row) => !venueQuality(row).primary && venueQuality(row).candidateCount > 1).length,
    },
    queue,
  };
}

function artistDashboardFor(rows: MasterRecord[], tierFilter?: string): ArtistQualityDashboard {
  const selectedTiers = tiersForArtistFilter(tierFilter);
  const selectedRows = selectedTiers ? rows.filter((row) => selectedTiers.includes(effectiveArtistTier(row)!)) : rows;
  const missingKeys = ["name", "nameEn", "nationality", "primaryImage"] as const;
  return {
    kind: "artist",
    tiers: ARTIST_PRIORITY_TIERS.map((tier) => {
      const tierRows = rows.filter((row) => effectiveArtistTier(row) === tier);
      const complete = tierRows.filter((row) => artistQuality(row).completeness.met === 4).length;
      return { tier, count: tierRows.length, averageCompleteness: average(tierRows.map((row) => artistQuality(row).completeness.percent)), complete, incomplete: tierRows.length - complete };
    }),
    selected: { label: tierFilter || "All", count: selectedRows.length, averageCompleteness: average(selectedRows.map((row) => artistQuality(row).completeness.percent)) },
    missing: Object.fromEntries(missingKeys.map((key) => [key, selectedRows.filter((row) => artistQuality(row).missing[key]).length])) as ArtistQualityDashboard["missing"],
  };
}

export async function listMasters(entity: MasterEntity, options: MasterListOptions = {}): Promise<MasterListResult> {
  const pageSize = [20, 50, 100].includes(Number(options.pageSize)) ? Number(options.pageSize) : 20;
  const page = Math.max(1, Number(options.page) || 1);
  const fallback = { rows: [], total: 0, allTotal: 0, page, pageSize, totalPages: 1, configured: hasSupabaseAdminEnvironment(), error: null };
  if (!hasSupabaseAdminEnvironment()) return { ...fallback, error: "Supabase環境変数が未設定です。" };
  try {
    const db = createSupabaseAdminClient();
    const config = MASTER_CONFIGS[entity];
    let allTotalQuery = db.from(entity).select("id", { count: "exact", head: true });
    if (entity === "venues") allTotalQuery = allTotalQuery.is("merged_into_venue_id", null);
    const { count: allTotal, error: allTotalError } = await allTotalQuery;
    if (allTotalError) throw allTotalError;
    const allowed = await filteredIdsByRelation(entity, options);
    if (allowed && allowed.length === 0) return fallback;
    if (entity === "venues") {
      const qualityRows = await allVenueQualityRows();
      const allowedSet = allowed ? new Set(allowed) : null;
      const tiers = tiersForFilter(options.tier);
      const threshold = options.completeness ? Number(options.completeness) : null;
      const filtered = qualityRows.filter((row) => {
        if (allowedSet && !allowedSet.has(row.id)) return false;
        if (options.status === "unpublished" && row.publication_status === "published") return false;
        if (options.status && options.status !== "unpublished" && row.publication_status !== options.status) return false;
        if (options.type && row.venue_type !== options.type) return false;
        if (options.active && Boolean(row.is_active) !== (options.active === "true")) return false;
        if (tiers && !tiers.includes(effectiveVenueTier(row)!)) return false;
        if (options.coordinates === "missing" && row.latitude != null && row.longitude != null) return false;
        if (options.coordinates === "present" && (row.latitude == null || row.longitude == null)) return false;
        if (options.image === "present" && !venueQuality(row).primary) return false;
        if (options.image === "missing" && venueQuality(row).primary) return false;
        if (threshold != null && venueQuality(row).completeness.percent >= threshold) return false;
        return true;
      }).sort(compareVenueQuality);
      const total = filtered.length;
      const pageIds = filtered.slice((page - 1) * pageSize, page * pageSize).map((row) => row.id);
      let rows: MasterListResult["rows"] = [];
      if (pageIds.length) {
        const { data, error } = await db.from("venues").select(listSelectByEntity.venues).in("id", pageIds);
        if (error) throw error;
        const order = new Map(pageIds.map((id, index) => [id, index]));
        const signedRows = await signPrimaryImages(asRecords(data).sort((a, b) => order.get(a.id)! - order.get(b.id)!));
        rows = signedRows.map((row) => ({ ...row, completeness: calculateCompleteness("venues", row) }));
      }
      return { rows, total, allTotal: allTotal || 0, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), configured: true, error: null, qualityDashboard: dashboardFor(qualityRows, options.tier) };
    }
    if (entity === "artists") {
      const qualityRows = await allArtistQualityRows();
      const allowedSet = allowed ? new Set(allowed) : null;
      const tiers = tiersForArtistFilter(options.tier);
      const threshold = options.completeness ? Number(options.completeness) : null;
      const filtered = qualityRows.filter((row) => {
        if (allowedSet && !allowedSet.has(row.id)) return false;
        if (options.status === "unpublished" && row.publication_status === "published") return false;
        if (options.status && options.status !== "unpublished" && row.publication_status !== options.status) return false;
        if (tiers && !tiers.includes(effectiveArtistTier(row)!)) return false;
        if (threshold != null && artistQuality(row).completeness.percent >= threshold) return false;
        return true;
      }).sort(compareArtistQuality);
      const total = filtered.length;
      const pageIds = filtered.slice((page - 1) * pageSize, page * pageSize).map((row) => row.id);
      let rows: MasterListResult["rows"] = [];
      if (pageIds.length) {
        const { data, error } = await db.from("artists").select(listSelectByEntity.artists).in("id", pageIds);
        if (error) throw error;
        const order = new Map(pageIds.map((id, index) => [id, index]));
        const signedRows = await signPrimaryImages(asRecords(data).sort((a, b) => order.get(a.id)! - order.get(b.id)!));
        rows = signedRows.map((row) => ({ ...row, completeness: calculateCompleteness("artists", row) }));
      }
      return { rows, total, allTotal: allTotal || 0, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), configured: true, error: null, qualityDashboard: artistDashboardFor(qualityRows, options.tier) };
    }
    let query = db.from(entity).select(listSelectByEntity[entity], { count: "exact" });
    if (allowed) query = query.in("id", [...allowed]);
    if (options.status === "unpublished") query = query.neq("publication_status", "published");
    else if (options.status) query = query.eq("publication_status", options.status);
    query = query.order(config.titleKey, { ascending: true }).order("id", { ascending: true });
    const shouldFilterCompleteness = Boolean(options.completeness);
    if (!shouldFilterCompleteness) query = query.range((page - 1) * pageSize, page * pageSize - 1);
    const { data, error, count } = await query;
    if (error) throw error;
    const signedRows = await signPrimaryImages(asRecords(data));
    let total = count || 0;
    let rows = signedRows.map((row) => ({ ...row, completeness: calculateCompleteness(entity, row) }));
    if (shouldFilterCompleteness) {
      const threshold = Number(options.completeness);
      rows = rows.filter((row) => row.completeness.percent < threshold);
      total = rows.length;
      rows = rows.slice((page - 1) * pageSize, page * pageSize);
    }
    return { rows, total, allTotal: allTotal || 0, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), configured: true, error: null };
  } catch (error) {
    return { ...fallback, configured: true, error: error instanceof Error ? error.message : "Master listの取得に失敗しました。" };
  }
}

export async function getMaster(entity: MasterEntity, id: string) {
  if (!hasSupabaseAdminEnvironment()) return { data: null, error: "Supabase環境変数が未設定です。", configured: false };
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from(entity).select(selectByEntity[entity]).eq("id", id).single();
    if (error) throw error;
    const [row] = await signPrimaryImages([asRecord(data)]);
    return { data: { ...row, completeness: calculateCompleteness(entity, row) }, error: null, configured: true };
  } catch (error) { return { data: null, error: error instanceof Error ? error.message : "Masterの取得に失敗しました。", configured: true }; }
}

async function uniqueSlug(entity: MasterEntity, label: string) {
  const db = createSupabaseAdminClient();
  const base = slugify(label).slice(0, 150);
  const { data } = await db.from(entity).select("id").eq("slug", base).maybeSingle();
  return data ? `${base}-${randomUUID().slice(0, 8)}` : base;
}

type ProvenanceContext = {
  source: "manual" | "csv_import" | "official_website" | "trusted_api" | "wikipedia" | "wikidata";
  fieldSourceUrls?: Record<string, string>;
  generatedByAiFields?: string[];
  aiConfidenceByField?: Record<string, "high" | "medium" | "low">;
  aiNotes?: string;
};

async function recordProvenance(entity: MasterEntity, id: string, values: MasterValues, context: ProvenanceContext) {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  for (const [field, value] of Object.entries(values)) {
    const { error: clearError } = await db.from(config.provenanceTable).update({ is_current: false }).eq(config.ownerKey, id).eq("field_name", field).eq("is_current", true);
    if (clearError) throw clearError;
    const { error } = await db.from(config.provenanceTable).insert({
      [config.ownerKey]: id, field_name: field, source: context.source,
      source_url: context.fieldSourceUrls?.[field] || null, value_snapshot: value,
      generated_by_ai: context.generatedByAiFields?.includes(field) || false,
      ai_confidence: context.aiConfidenceByField?.[field] || null,
      transformation_notes: context.generatedByAiFields?.includes(field) ? context.aiNotes || null : null,
      review_status: context.source === "manual" ? "approved" : "applied", is_current: true,
    });
    if (error) throw error;
  }
}

function entitySpecificValues(entity: MasterEntity, values: MasterValues) {
  const next = { ...values };
  if (entity === "venues") {
    next.normalized_name = slugify(String(values.name || "")).replaceAll("-", "");
    next.normalized_address = values.address ? slugify(String(values.address)).replaceAll("-", "") : null;
    if (values.latitude != null && values.longitude != null) {
      next.coordinate_source = "manual"; next.coordinate_precision = "exact"; next.coordinate_status = "manual";
    }
  }
  return next;
}

export async function createMaster(entity: MasterEntity, input: Record<string, unknown>, context: ProvenanceContext | "manual" | "csv_import" = "manual") {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const values = normalizeMasterValues(entity, input);
  values.publication_status = "draft";
  const slug = await uniqueSlug(entity, String(values[config.titleKey]));
  const { data, error } = await db.from(entity).insert({ ...entitySpecificValues(entity, values), slug }).select("id").single();
  if (error) throw error;
  await recordProvenance(entity, data.id, values, typeof context === "string" ? { source: context } : context);
  return data.id as string;
}

export async function updateMaster(entity: MasterEntity, id: string, input: Record<string, unknown>, context: ProvenanceContext | "manual" | "csv_import" = "manual") {
  const db = createSupabaseAdminClient();
  const { data: current, error: currentError } = await db.from(entity).select("*").eq("id", id).single();
  if (currentError || !current) throw currentError || new Error("Masterが見つかりません。");
  const resolvedContext = typeof context === "string" ? { source: context } : context;
  const values = normalizeMasterValues(entity, input, { partial: resolvedContext.source === "official_website" });
  delete values.publication_status;
  const changed = Object.fromEntries(Object.entries(values).filter(([key, value]) => !valuesEqual((current as Record<string, unknown>)[key], value))) as MasterValues;
  if (!Object.keys(changed).length) return [];
  const { error } = await db.from(entity).update(entitySpecificValues(entity, changed)).eq("id", id);
  if (error) throw error;
  await recordProvenance(entity, id, changed, resolvedContext);
  return Object.keys(changed);
}

export async function getCsvPreview(entity: MasterEntity, csv: string) {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const inputRows = parseCsv(csv);
  const ids = inputRows.map((row) => String(row.id || "").trim()).filter(Boolean);
  const existing = new Map<string, Record<string, unknown>>();
  const provenance = new Map<string, Array<{ field_name: string; source: string; review_status: string; is_current: boolean }>>();
  if (ids.length) {
    const [masterResult, sourceResult] = await Promise.all([
      db.from(entity).select("*").in("id", ids),
      db.from(config.provenanceTable).select(`${config.ownerKey},field_name,source,source_url,review_status,is_current`).in(config.ownerKey, ids).eq("is_current", true),
    ]);
    if (masterResult.error) throw masterResult.error;
    if (sourceResult.error) throw sourceResult.error;
    for (const row of masterResult.data || []) existing.set(row.id, row as Record<string, unknown>);
    for (const row of sourceResult.data || []) {
      const owner = String((row as Record<string, unknown>)[config.ownerKey]);
      const list = provenance.get(owner) || [];
      list.push(row as { field_name: string; source: string; source_url?: string | null; review_status: string; is_current: boolean });
      provenance.set(owner, list);
    }
  }
  const rows = buildCsvPreview(entity, inputRows, existing, provenance);
  return { rows, summary: summarizeCsvPreview(rows) };
}

export async function executeCsvImport(entity: MasterEntity, rows: CsvPreviewRow[], allowConflicts = false) {
  const result = { created: 0, updated: 0, unchanged: 0, invalid: 0, conflicts: 0, errors: [] as string[] };
  for (const row of rows) {
    try {
      if (row.status === "invalid") { result.invalid += 1; continue; }
      if (row.status === "unchanged") { result.unchanged += 1; continue; }
      const safeValues = !allowConflicts && row.conflicts.length
        ? Object.fromEntries(Object.entries(row.values).filter(([field]) => !row.conflicts.includes(field)))
        : row.values;
      const hasRelationInput = entity === "works" && Boolean(
        row.relationValues?.artistId || row.relationValues?.artistName ||
        row.relationValues?.venueId || row.relationValues?.venueName
      );
      if (row.conflicts.length && !allowConflicts) result.conflicts += row.conflicts.length;
      if (!Object.keys(safeValues).length && !hasRelationInput) { result.unchanged += 1; continue; }
      const context: ProvenanceContext = { source: row.sourceType as ProvenanceContext["source"], fieldSourceUrls: row.fieldSourceUrls, generatedByAiFields: row.generatedByAiFields, aiConfidenceByField: row.aiConfidenceByField, aiNotes: row.aiNotes };
      let masterId = row.id;
      if (row.status === "new") { masterId = await createMaster(entity, safeValues, context); result.created += 1; }
      else if (row.id) {
        const changed = await updateMaster(entity, row.id, safeValues, context);
        if (changed.length || hasRelationInput) result.updated += 1; else result.unchanged += 1;
      }
      if (entity === "works" && masterId && row.relationValues) {
        const relation = row.relationValues;
        const db = createSupabaseAdminClient();
        let artistId = relation.artistId;
        let venueId = relation.venueId;
        if (!artistId && relation.artistName) {
          const { data, error } = await db.from("artists").select("id,name,name_en,aliases"); if (error) throw error;
          const needle = normalizeIdentity(relation.artistName); const matches = (data || []).filter((item) => [item.name, item.name_en, ...(item.aliases || [])].filter(Boolean).some((value) => normalizeIdentity(String(value)) === needle));
          if (matches.length !== 1) throw new Error(`Artist name must resolve uniquely: ${relation.artistName}`); artistId = matches[0].id;
        }
        if (!venueId && relation.venueName) {
          const { data, error } = await db.from("venues").select("id,name,name_en,aliases").is("merged_into_venue_id", null); if (error) throw error;
          const needle = normalizeIdentity(relation.venueName); const matches = (data || []).filter((item) => [item.name, item.name_en, ...(item.aliases || [])].filter(Boolean).some((value) => normalizeIdentity(String(value)) === needle));
          if (matches.length !== 1) throw new Error(`Venue name must resolve uniquely: ${relation.venueName}`); venueId = matches[0].id;
        }
        if (artistId) {
          const { error } = await db.from("work_artists").upsert({ work_id: masterId, artist_id: artistId, source: row.sourceType, source_url: relation.sourceUrl || null, verified_at: new Date().toISOString() }, { onConflict: "work_id,artist_id" });
          if (error) throw error;
        }
        if (venueId) {
          const { data: holding } = await db.from("collection_holdings").select("id").eq("work_id", masterId).eq("venue_id", venueId).is("inventory_number", null).maybeSingle();
          const values = { work_id: masterId, venue_id: venueId, holding_type: relation.holdingType || "collection", source: row.sourceType, source_url: relation.sourceUrl || null, verified_at: new Date().toISOString() };
          const saved = holding ? await db.from("collection_holdings").update(values).eq("id", holding.id) : await db.from("collection_holdings").insert(values);
          if (saved.error) throw saved.error;
          if (relation.presentationType || relation.presentationStatus) {
            const { error } = await db.from("work_presentations").upsert({ work_id: masterId, venue_id: venueId, presentation_type: relation.presentationType || "unknown", status: relation.presentationStatus || "unknown", start_date: relation.presentationStartDate || null, end_date: relation.presentationEndDate || null, source: row.sourceType, source_url: relation.sourceUrl || null, verified_at: new Date().toISOString() }, { onConflict: "work_id,venue_id,presentation_type,start_date" });
            if (error) throw error;
          }
        }
      }
    } catch (error) { result.errors.push(`Line ${row.line}: ${error instanceof Error ? error.message : "Import failed"}`); }
  }
  return result;
}

export async function fetchAllMasters(entity: MasterEntity) {
  const db = createSupabaseAdminClient();
  const rows: MasterRecord[] = [];
  const batch = 1000;
  for (let start = 0; ; start += batch) {
    const select = entity === "works" ? "*,work_artists(artist_id,source_url,artists(name)),collection_holdings(venue_id,holding_type,source_url,venues(name)),work_presentations(presentation_type,status,start_date,end_date,source_url)" : "*";
    const { data, error } = await db.from(entity).select(select).order("id").range(start, start + batch - 1);
    if (error) throw error;
    rows.push(...asRecords(data));
    if ((data || []).length < batch) break;
  }
  return rows;
}

export async function setMasterPublication(entity: MasterEntity, ids: string[], action: "publish" | "unpublish") {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const publicationFields = entity === "works" ? "id,title,title_ja,title_en,title_original" : `id,${config.titleKey}`;
  const { data, error } = await db.from(entity).select(publicationFields).in("id", ids);
  if (error) throw error;
  const found = data || [];
  const invalid = found.filter((row) => entity === "works"
    ? !hasWorkTitle(row)
    : !String((row as unknown as Record<string, unknown>)[config.titleKey] || "").trim());
  if (action === "publish" && invalid.length) throw new Error(`${config.label}の必須項目（${config.titleKey}）が不足しています。`);
  if (action === "publish" && entity === "works" && ids.length) {
    const [artists, holdings] = await Promise.all([
      db.from("work_artists").select("work_id").in("work_id", ids),
      db.from("collection_holdings").select("work_id").in("work_id", ids),
    ]);
    if (artists.error) throw artists.error;
    if (holdings.error) throw holdings.error;
    const withArtist = new Set((artists.data || []).map((row) => row.work_id));
    const withHolding = new Set((holdings.data || []).map((row) => row.work_id));
    const incomplete = ids.filter((id) => !withArtist.has(id) || !withHolding.has(id));
    if (incomplete.length) throw new Error("Workの公開にはTitle / Artist Relation / Holding Venueの3項目が必要です。");
  }
  const status = action === "publish" ? "published" : "draft";
  const { error: updateError } = await db.from(entity).update({ publication_status: status }).in("id", ids);
  if (updateError) throw updateError;
  return { count: found.length, status };
}

export async function masterDeleteBlockers(entity: MasterEntity, id: string) {
  const db = createSupabaseAdminClient();
  const checks = entity === "venues"
    ? [["Exhibition occurrences", "exhibition_occurrences", "venue_id"], ["Collection holdings", "collection_holdings", "venue_id"]]
    : entity === "artists"
      ? [["Exhibition relations", "exhibition_artists", "artist_id"], ["Work relations", "work_artists", "artist_id"]]
      : [["Collection holdings", "collection_holdings", "work_id"]];
  const blockers: Array<{ label: string; count: number }> = [];
  for (const [label, table, key] of checks) {
    const { count, error } = await db.from(table).select("id", { count: "exact", head: true }).eq(key, id);
    if (error) throw error;
    if (count) blockers.push({ label, count });
  }
  return blockers;
}

export async function deleteMaster(entity: MasterEntity, id: string) {
  const db = createSupabaseAdminClient();
  const blockers = await masterDeleteBlockers(entity, id);
  if (blockers.length) throw new Error(`関連データがあるため削除できません: ${blockers.map((item) => `${item.label} ${item.count}件`).join("、")}。Unpublish / Archiveを検討してください。`);
  const config = MASTER_CONFIGS[entity];
  const { data: assets, error: assetError } = await db.from("media_assets").select("storage_path").eq(config.ownerKey, id);
  if (assetError) throw assetError;
  const { error } = await db.from(entity).delete().eq("id", id);
  if (error) throw error;
  const paths = (assets || []).map((asset) => asset.storage_path).filter(Boolean);
  if (paths.length) await db.storage.from("exhibition-images").remove(paths);
}

export async function getAdjacentMasters(entity: MasterEntity, row: MasterRecord) {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const current = String(row[config.titleKey] || "");
  const [previous, next] = await Promise.all([
    db.from(entity).select(`id,${config.titleKey}`).lt(config.titleKey, current).order(config.titleKey, { ascending: false }).limit(1).maybeSingle(),
    db.from(entity).select(`id,${config.titleKey}`).gt(config.titleKey, current).order(config.titleKey, { ascending: true }).limit(1).maybeSingle(),
  ]);
  return { previous: previous.data, next: next.data };
}

export async function getMasterDashboardCounts() {
  const empty = { exhibitions: { total: 0, published: 0 }, venues: { total: 0, published: 0 }, artists: { total: 0, published: 0 }, works: { total: 0, published: 0 } };
  if (!hasSupabaseAdminEnvironment()) return { data: empty, error: "Supabase環境変数が未設定です。", configured: false };
  try {
    const db = createSupabaseAdminClient();
    const entities = ["exhibitions", "venues", "artists", "works"] as const;
    const pairs = await Promise.all(entities.map(async (entity) => {
      const [total, published] = await Promise.all([
        db.from(entity).select("id", { count: "exact", head: true }),
        db.from(entity).select("id", { count: "exact", head: true }).eq("publication_status", "published"),
      ]);
      if (total.error) throw total.error; if (published.error) throw published.error;
      return [entity, { total: total.count || 0, published: published.count || 0 }] as const;
    }));
    return { data: Object.fromEntries(pairs) as typeof empty, error: null, configured: true };
  } catch (error) { return { data: empty, error: error instanceof Error ? error.message : "Dashboard counts failed", configured: true }; }
}
