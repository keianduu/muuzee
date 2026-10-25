import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

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
