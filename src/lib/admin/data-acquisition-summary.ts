import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import { getMasterQualityDashboard, type ArtistQualityDashboard, type VenueQualityDashboard } from "./master-repository";

export const DATA_ACQUISITION_ENTITIES = ["exhibitions", "venues", "artists", "works"] as const;
export type DataAcquisitionEntity = (typeof DATA_ACQUISITION_ENTITIES)[number];

export type SummaryMetric = {
  key: string;
  label: string;
  value: number;
  href?: string;
  note?: string;
};

export type AcquisitionRun = {
  id: string;
  operationType: string;
  sourceName: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  requestedCount: number;
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  errorCount: number;
};

export type DataAcquisitionSummary = {
  entity: DataAcquisitionEntity;
  configured: boolean;
  error: string | null;
  overview: SummaryMetric[];
  quality: SummaryMetric[];
  qualityDashboard: VenueQualityDashboard | ArtistQualityDashboard | null;
  runs: AcquisitionRun[];
  runAttributionSupported: boolean;
};

type MasterSummaryRow = {
  id: string;
  publication_status: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type OwnerRow = Record<string, unknown>;

const ENTITY_CONFIG: Record<DataAcquisitionEntity, { ownerKey: string }> = {
  exhibitions: { ownerKey: "exhibition_id" },
  venues: { ownerKey: "venue_id" },
  artists: { ownerKey: "artist_id" },
  works: { ownerKey: "work_id" },
};

const RUN_OPERATIONS: Record<DataAcquisitionEntity, readonly string[]> = {
  exhibitions: ["exhibition_import", "exhibition_daily_sync"],
  venues: ["wikidata_venue_import", "wikidata_venue_targeted_import", "venue_enrichment", "official_venue_crawl"],
  artists: ["wikidata_artist_import", "wikidata_artist_targeted_import"],
  works: [],
};

export function normalizeDataAcquisitionEntity(value?: string): DataAcquisitionEntity {
  return (DATA_ACQUISITION_ENTITIES as readonly string[]).includes(value || "")
    ? value as DataAcquisitionEntity
    : "exhibitions";
}

export function operationBelongsToEntity(entity: DataAcquisitionEntity, operationType: string) {
  return RUN_OPERATIONS[entity].includes(operationType);
}

export function countDistinctOwners(rows: OwnerRow[], ownerKey: string, allowedIds: Set<string>) {
  return new Set(rows.flatMap((row) => {
    const id = row[ownerKey];
    return typeof id === "string" && allowedIds.has(id) ? [id] : [];
  })).size;
}

export function countUnresolvedMentions(rows: Array<{ resolution_status?: string | null }>) {
  return rows.filter((row) => !["resolved", "rejected"].includes(row.resolution_status || "pending")).length;
}

async function readAll<T>(loader: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await loader(offset, offset + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if ((data || []).length < 1000) return rows;
  }
}

async function loadMasterRows(entity: DataAcquisitionEntity) {
  const db = createSupabaseAdminClient();
  return readAll<MasterSummaryRow>(async (from, to) => {
    let query = db.from(entity).select(entity === "venues" ? "id,publication_status,latitude,longitude" : "id,publication_status");
    if (entity === "venues") query = query.is("merged_into_venue_id", null);
    const result = await query.range(from, to);
    return { data: result.data as MasterSummaryRow[] | null, error: result.error };
  });
}

async function loadOwnerRows(table: "source_records" | "media_assets", ownerKey: string, primaryOnly = false) {
  const db = createSupabaseAdminClient();
  return readAll<OwnerRow>(async (from, to) => {
    let query = db.from(table).select(primaryOnly ? `${ownerKey},rights_status` : ownerKey).not(ownerKey, "is", null);
    if (primaryOnly) query = query.eq("is_primary", true);
    const result = await query.range(from, to);
    return { data: result.data as unknown as OwnerRow[] | null, error: result.error };
  });
}

async function relationOwnerIds(table: "work_artists" | "collection_holdings") {
  const rows = await readAll<{ work_id: string }>(async (from, to) => {
    const result = await createSupabaseAdminClient().from(table).select("work_id").range(from, to);
    return { data: result.data, error: result.error };
  });
  return new Set(rows.map((row) => row.work_id));
}

function listHref(entity: DataAcquisitionEntity, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `/admin/${entity}?${query.toString()}`;
}

export function buildOverviewMetrics(entity: DataAcquisitionEntity, masters: MasterSummaryRow[], sourceRows: OwnerRow[], primaryRows: OwnerRow[]) {
  const ownerKey = ENTITY_CONFIG[entity].ownerKey;
  const ids = new Set(masters.map((row) => row.id));
  const published = masters.filter((row) => row.publication_status === "published").length;
  const archived = masters.filter((row) => row.publication_status === "archived").length;
  const unpublishedRows = masters.filter((row) => row.publication_status !== "published" && row.publication_status !== "archived");
  const unpublished = unpublishedRows.length;
  const unpublishedIds = new Set(unpublishedRows.map((row) => row.id));
  const primaryIds = new Set(primaryRows.flatMap((row) => typeof row[ownerKey] === "string" ? [row[ownerKey] as string] : []));
  return [
    { key: "total", label: "Master total", value: masters.length },
    { key: "published", label: "公開", value: published, href: listHref(entity, { status: "published" }) },
    { key: "unpublished", label: "非公開", value: unpublished, href: listHref(entity, { status: "unpublished" }), note: "Draft / legacy Readyを含む" },
    { key: "archived", label: "アーカイブ", value: archived, href: listHref(entity, { status: "archived" }) },
    { key: "source-linked", label: "External Source接続済み", value: countDistinctOwners(sourceRows, ownerKey, ids) },
    { key: "image-missing", label: "Primary画像なし（非公開）", value: [...unpublishedIds].filter((id) => !primaryIds.has(id)).length, href: listHref(entity, { status: "unpublished", image: "missing" }) },
  ] satisfies SummaryMetric[];
}

async function entityQualityMetrics(entity: DataAcquisitionEntity, masters: MasterSummaryRow[], primaryRows: OwnerRow[]) {
  if (entity === "venues") {
    const unpublished = masters.filter((row) => row.publication_status !== "published" && row.publication_status !== "archived");
    return [{
      key: "coordinates-missing",
      label: "座標なし（非公開）",
      value: unpublished.filter((row) => row.latitude == null || row.longitude == null).length,
      href: listHref(entity, { status: "unpublished", coordinates: "missing" }),
    }] satisfies SummaryMetric[];
  }
  if (entity === "artists") return [];
  if (entity === "works") {
    const unpublishedIds = new Set(masters.filter((row) => row.publication_status !== "published" && row.publication_status !== "archived").map((row) => row.id));
    const [artistIds, holdingIds] = await Promise.all([relationOwnerIds("work_artists"), relationOwnerIds("collection_holdings")]);
    return [
      { key: "artist-missing", label: "Artist relationなし（非公開）", value: [...unpublishedIds].filter((id) => !artistIds.has(id)).length, href: listHref(entity, { status: "unpublished", artistRelation: "missing" }) },
      { key: "holding-missing", label: "Holding relationなし（非公開）", value: [...unpublishedIds].filter((id) => !holdingIds.has(id)).length, href: listHref(entity, { status: "unpublished", holdingRelation: "missing" }) },
    ] satisfies SummaryMetric[];
  }

  const db = createSupabaseAdminClient();
  const [venueMentions, artistMentions] = await Promise.all([
    readAll<{ resolution_status: string | null }>(async (from, to) => {
      const result = await db.from("exhibition_venue_mentions").select("resolution_status").eq("is_active", true).range(from, to);
      return { data: result.data, error: result.error };
    }),
    readAll<{ resolution_status: string | null }>(async (from, to) => {
      const result = await db.from("exhibition_artist_mentions").select("resolution_status").range(from, to);
      return { data: result.data, error: result.error };
    }),
  ]);
  const rightsReview = primaryRows.filter((row) => !["approved", "rejected"].includes(String(row.rights_status || "pending"))).length;
  return [
    { key: "venue-mentions", label: "Venue未解決mention", value: countUnresolvedMentions(venueMentions) },
    { key: "artist-mentions", label: "Artist未解決mention", value: countUnresolvedMentions(artistMentions) },
    { key: "rights-review", label: "Primary画像 Rights要確認", value: rightsReview },
  ] satisfies SummaryMetric[];
}

async function loadRuns(entity: DataAcquisitionEntity) {
  const operations = RUN_OPERATIONS[entity];
  if (!operations.length) return [];
  const { data, error } = await createSupabaseAdminClient()
    .from("import_runs")
    .select("id,operation_type,status,started_at,finished_at,requested_count,fetched_count,created_count,updated_count,error_count,data_sources(name)")
    .in("operation_type", [...operations])
    .order("started_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data || []).map((row): AcquisitionRun => {
    const source = Array.isArray(row.data_sources) ? row.data_sources[0] : row.data_sources;
    return {
      id: row.id,
      operationType: row.operation_type,
      sourceName: source?.name || "—",
      status: row.status,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      requestedCount: row.requested_count,
      fetchedCount: row.fetched_count,
      createdCount: row.created_count,
      updatedCount: row.updated_count,
      errorCount: row.error_count,
    };
  });
}

export async function getDataAcquisitionSummary(entity: DataAcquisitionEntity): Promise<DataAcquisitionSummary> {
  const fallback: DataAcquisitionSummary = {
    entity,
    configured: hasSupabaseAdminEnvironment(),
    error: null,
    overview: [],
    quality: [],
    qualityDashboard: null,
    runs: [],
    runAttributionSupported: RUN_OPERATIONS[entity].length > 0,
  };
  if (!hasSupabaseAdminEnvironment()) return { ...fallback, error: "Supabase環境変数が未設定です。" };
  try {
    const ownerKey = ENTITY_CONFIG[entity].ownerKey;
    const [masters, sourceRows, primaryRows, qualityDashboard, runs] = await Promise.all([
      loadMasterRows(entity),
      loadOwnerRows("source_records", ownerKey),
      loadOwnerRows("media_assets", ownerKey, true),
      entity === "venues" || entity === "artists" ? getMasterQualityDashboard(entity) : Promise.resolve(null),
      loadRuns(entity),
    ]);
    return {
      ...fallback,
      overview: buildOverviewMetrics(entity, masters, sourceRows, primaryRows),
      quality: await entityQualityMetrics(entity, masters, primaryRows),
      qualityDashboard,
      runs,
    };
  } catch (error) {
    return { ...fallback, error: error instanceof Error ? error.message : "データ取得サマリの取得に失敗しました。" };
  }
}
