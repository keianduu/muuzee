import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";
import { tokyoDate } from "@/lib/exhibition-sync/policy";

export const MASTER_OPERATOR_ENTITIES = ["venues", "artists", "works"] as const;
export type MasterOperatorEntity = (typeof MASTER_OPERATOR_ENTITIES)[number];

export type MasterOperatorOverview = {
  entity: MasterOperatorEntity;
  total: number | null;
  published: number | null;
  unpublished: number | null;
};

export type MasterOperatorOverviewResult = {
  data: MasterOperatorOverview[];
  configured: boolean;
  error: string | null;
};

export type ExhibitionOperatorOverview = {
  total: number | null;
  published: number | null;
  unpublished: number | null;
  ended: number | null;
};

export type ExhibitionOperatorOverviewResult = {
  data: ExhibitionOperatorOverview;
  configured: boolean;
  error: string | null;
};

export function buildMasterOperatorOverview(
  entity: MasterOperatorEntity,
  total: number,
  published: number,
): MasterOperatorOverview {
  return {
    entity,
    total,
    published,
    unpublished: Math.max(0, total - published),
  };
}

export function buildUnavailableMasterOperatorOverview(
  entity: MasterOperatorEntity,
): MasterOperatorOverview {
  return { entity, total: null, published: null, unpublished: null };
}

type MasterCountType = "total" | "published";

function diagnosticField(error: unknown, field: "code" | "message" | "details" | "hint" | "status") {
  if (!error || typeof error !== "object" || !(field in error)) return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

function logMasterCountFailure(entity: MasterOperatorEntity, countType: MasterCountType, error: unknown) {
  console.error("[admin:data-acquisition] Master count failed", {
    entity,
    countType,
    code: diagnosticField(error, "code"),
    message: diagnosticField(error, "message"),
    details: diagnosticField(error, "details"),
    hint: diagnosticField(error, "hint"),
    status: diagnosticField(error, "status"),
  });
}

function logExhibitionCountFailure(countType: keyof ExhibitionOperatorOverview, error: unknown) {
  console.error("[admin:data-acquisition] Exhibition count failed", {
    countType,
    code: diagnosticField(error, "code"),
    message: diagnosticField(error, "message"),
    details: diagnosticField(error, "details"),
    hint: diagnosticField(error, "hint"),
    status: diagnosticField(error, "status"),
  });
}

async function countMasters(entity: MasterOperatorEntity, countType: MasterCountType) {
  const db = createSupabaseAdminClient();
  let query = db.from(entity).select("id", { count: "exact", head: true });
  if (entity === "venues") query = query.is("merged_into_venue_id", null);
  if (countType === "published") query = query.eq("publication_status", "published");
  const { count, error } = await query;
  if (error) {
    logMasterCountFailure(entity, countType, error);
    throw error;
  }
  return count ?? 0;
}

async function getMasterOperatorOverview(entity: MasterOperatorEntity) {
  try {
    const [total, published] = await Promise.all([
      countMasters(entity, "total"),
      countMasters(entity, "published"),
    ]);
    return buildMasterOperatorOverview(entity, total, published);
  } catch {
    return buildUnavailableMasterOperatorOverview(entity);
  }
}

export async function getMasterOperatorOverviews(): Promise<MasterOperatorOverviewResult> {
  const unavailable = MASTER_OPERATOR_ENTITIES.map(buildUnavailableMasterOperatorOverview);
  if (!hasSupabaseAdminEnvironment()) {
    return { data: unavailable, configured: false, error: "データを利用できないため、Master件数を取得できません。" };
  }

  const data = await Promise.all(MASTER_OPERATOR_ENTITIES.map(getMasterOperatorOverview));
  const unavailableCount = data.filter((overview) => overview.total === null).length;
  const error = unavailableCount === 0
    ? null
    : unavailableCount === MASTER_OPERATOR_ENTITIES.length
      ? "Master件数を取得できませんでした。時間をおいて再度お試しください。"
      : "一部のMaster件数を取得できませんでした。";
  return { data, configured: true, error };
}

export function countDistinctEndedExhibitions(rows: Array<{ exhibition_id: string }>) {
  return new Set(rows.map((row) => row.exhibition_id)).size;
}

export function buildExhibitionOperatorOverview(values: ExhibitionOperatorOverview): ExhibitionOperatorOverview {
  return values;
}

async function countExhibitionPublication(kind: "total" | "published" | "unpublished") {
  const db = createSupabaseAdminClient();
  let query = db.from("exhibitions").select("id", { count: "exact", head: true });
  if (kind === "published") query = query.eq("publication_status", "published");
  if (kind === "unpublished") query = query.neq("publication_status", "published").neq("publication_status", "archived");
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

async function countEndedExhibitions(today: string) {
  const rows: Array<{ exhibition_id: string }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await createSupabaseAdminClient()
      .from("exhibition_occurrences")
      .select("exhibition_id")
      .neq("relation_status", "stale")
      .lt("end_date", today)
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < 1000) return countDistinctEndedExhibitions(rows);
  }
}

export async function getExhibitionOperatorOverview(now = new Date()): Promise<ExhibitionOperatorOverviewResult> {
  const unavailable = buildExhibitionOperatorOverview({ total: null, published: null, unpublished: null, ended: null });
  if (!hasSupabaseAdminEnvironment()) return { data: unavailable, configured: false, error: "Exhibition件数を取得できません。" };

  const tasks = {
    total: () => countExhibitionPublication("total"),
    published: () => countExhibitionPublication("published"),
    unpublished: () => countExhibitionPublication("unpublished"),
    ended: () => countEndedExhibitions(tokyoDate(now)),
  } satisfies Record<keyof ExhibitionOperatorOverview, () => Promise<number>>;
  const entries = await Promise.all(Object.entries(tasks).map(async ([key, loader]) => {
    try {
      return [key, await loader()] as const;
    } catch (error) {
      logExhibitionCountFailure(key as keyof ExhibitionOperatorOverview, error);
      return [key, null] as const;
    }
  }));
  const data = buildExhibitionOperatorOverview(Object.fromEntries(entries) as ExhibitionOperatorOverview);
  return {
    data,
    configured: true,
    error: Object.values(data).some((value) => value === null) ? "一部の件数を取得できませんでした。" : null,
  };
}
