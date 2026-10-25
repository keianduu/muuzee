import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

export const MASTER_OPERATOR_ENTITIES = ["venues", "artists", "works"] as const;
export type MasterOperatorEntity = (typeof MASTER_OPERATOR_ENTITIES)[number];

export type MasterOperatorOverview = {
  entity: MasterOperatorEntity;
  total: number;
  published: number;
  unpublished: number;
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

async function countMasters(entity: MasterOperatorEntity, publishedOnly: boolean) {
  const db = createSupabaseAdminClient();
  let query = db.from(entity).select("id", { count: "exact", head: true });
  if (entity === "venues") query = query.is("merged_into_venue_id", null);
  if (publishedOnly) query = query.eq("publication_status", "published");
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function getMasterOperatorOverviews(): Promise<MasterOperatorOverviewResult> {
  const fallback = MASTER_OPERATOR_ENTITIES.map((entity) => buildMasterOperatorOverview(entity, 0, 0));
  if (!hasSupabaseAdminEnvironment()) {
    return { data: fallback, configured: false, error: "Supabase環境が未設定のため、Master件数を取得できません。" };
  }

  try {
    const data = await Promise.all(MASTER_OPERATOR_ENTITIES.map(async (entity) => {
      const [total, published] = await Promise.all([
        countMasters(entity, false),
        countMasters(entity, true),
      ]);
      return buildMasterOperatorOverview(entity, total, published);
    }));
    return { data, configured: true, error: null };
  } catch {
    return { data: fallback, configured: true, error: "Master件数を取得できませんでした。時間をおいて再度お試しください。" };
  }
}
