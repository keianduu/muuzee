import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import { slugify } from "./slug";
import { calculateCompleteness } from "./master-completeness";
import { buildCsvPreview, parseCsv, summarizeCsvPreview, type CsvPreviewRow } from "./master-csv";
import { MASTER_CONFIGS, type MasterEntity, type MasterStatus } from "./master-config";
import { normalizeMasterValues, valuesEqual, type MasterValues } from "./master-validation";

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
};

const selectByEntity: Record<MasterEntity, string> = {
  venues: "*, media_assets(*), venue_field_sources(*), official_venue_crawl_results(*), venue_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_venue_id_fkey(*, data_sources(name,key), source_image_candidates(*)), venue_external_match_candidates(*), exhibition_occurrences(id,start_date,end_date,exhibition_id,exhibitions(id,title)), collection_holdings(id,work_id,works(id,title))",
  artists: "*, media_assets(*), artist_field_sources(*), artist_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_artist_id_fkey(*, data_sources(name,key), source_image_candidates(*)), exhibition_artists(id,exhibition_id,exhibitions(id,title)), work_artists(id,work_id,role,works(id,title))",
  works: "*, media_assets(*), work_field_sources(*), work_tags(tag_id,tags(id,type,name,slug)), source_records!source_records_work_id_fkey(*, data_sources(name,key), source_image_candidates(*)), work_artists(id,artist_id,role,artists(id,name)), collection_holdings(id,venue_id,holding_type,inventory_number,venues(id,name))",
};

const listSelectByEntity: Record<MasterEntity, string> = {
  venues: "*, media_assets(*), source_records!source_records_venue_id_fkey(id,external_id,data_sources(name,key)), venue_external_match_candidates(id,status,provider,external_id), exhibition_occurrences(id), collection_holdings(id)",
  artists: "*, media_assets(*), exhibition_artists(id), work_artists(id)",
  works: "*, media_assets(*), work_artists(id,artist_id,artists(id,name)), collection_holdings(id,venue_id,venues(id,name))",
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
    db.from("works").select("id").or(`title.ilike.%${term}%,title_en.ilike.%${term}%,title_original.ilike.%${term}%`),
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
    let query = db.from(entity).select(listSelectByEntity[entity], { count: "exact" });
    if (entity === "venues") query = query.is("merged_into_venue_id", null);
    if (allowed) query = query.in("id", [...allowed]);
    if (options.status) query = query.eq("publication_status", options.status);
    if (entity === "venues" && options.type) query = query.eq("venue_type", options.type);
    if (entity === "venues" && options.active) query = query.eq("is_active", options.active === "true");
    if (entity === "venues" && options.coordinates === "missing") query = query.or("latitude.is.null,longitude.is.null");
    if (entity === "venues" && options.coordinates === "present") query = query.not("latitude", "is", null).not("longitude", "is", null);
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
  source: "manual" | "csv_import" | "official_website" | "trusted_api" | "wikidata";
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
      if (row.conflicts.length && !allowConflicts) result.conflicts += row.conflicts.length;
      if (!Object.keys(safeValues).length) { result.unchanged += 1; continue; }
      const context: ProvenanceContext = { source: row.sourceType as ProvenanceContext["source"], fieldSourceUrls: row.fieldSourceUrls, generatedByAiFields: row.generatedByAiFields, aiConfidenceByField: row.aiConfidenceByField, aiNotes: row.aiNotes };
      if (row.status === "new") { await createMaster(entity, safeValues, context); result.created += 1; }
      else if (row.id) {
        const changed = await updateMaster(entity, row.id, safeValues, context);
        if (changed.length) result.updated += 1; else result.unchanged += 1;
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
    const { data, error } = await db.from(entity).select("*").order("id").range(start, start + batch - 1);
    if (error) throw error;
    rows.push(...asRecords(data));
    if ((data || []).length < batch) break;
  }
  return rows;
}

export async function setMasterPublication(entity: MasterEntity, ids: string[], action: "publish" | "unpublish") {
  const db = createSupabaseAdminClient();
  const config = MASTER_CONFIGS[entity];
  const { data, error } = await db.from(entity).select(`id,${config.titleKey}`).in("id", ids);
  if (error) throw error;
  const found = data || [];
  const invalid = found.filter((row) => !String((row as Record<string, unknown>)[config.titleKey] || "").trim());
  if (action === "publish" && invalid.length) throw new Error(`${config.label}の必須項目（${config.titleKey}）が不足しています。`);
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
