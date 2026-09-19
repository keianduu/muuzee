import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

export const SOURCE_ASSERTION_TYPES = ["work_artist", "collection_holding", "work_presentation", "media"] as const;
export type SourceAssertionType = (typeof SOURCE_ASSERTION_TYPES)[number];
export type RelationVisibility = "public" | "hidden";

export type SourceAssertionPolicy = {
  id: string | null;
  data_source_id: string;
  assertion_type: SourceAssertionType;
  enabled: boolean;
  auto_apply: boolean;
  default_visibility: RelationVisibility;
  review_required: boolean;
};

export type AdminSourcePolicy = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  entityScope: string[];
  policies: SourceAssertionPolicy[];
  lastSyncAt: string | null;
  lastResult: string | null;
  lastError: string | null;
};

const REVIEW_ONLY = new Set<SourceAssertionType>(["work_presentation", "media"]);

export function normalizeSourcePolicyInput(input: {
  assertionType: unknown;
  enabled: unknown;
  autoApply: unknown;
  defaultVisibility: unknown;
  reviewRequired: unknown;
}) {
  if (!SOURCE_ASSERTION_TYPES.includes(input.assertionType as SourceAssertionType)) throw new Error("Invalid assertion type");
  if (typeof input.enabled !== "boolean" || typeof input.autoApply !== "boolean" || typeof input.reviewRequired !== "boolean") throw new Error("Invalid policy flags");
  if (input.defaultVisibility !== "public" && input.defaultVisibility !== "hidden") throw new Error("Invalid default visibility");
  const assertionType = input.assertionType as SourceAssertionType;
  if (REVIEW_ONLY.has(assertionType)) {
    return { assertionType, enabled: input.enabled, autoApply: false, defaultVisibility: "hidden" as const, reviewRequired: true };
  }
  if (input.autoApply && input.reviewRequired) throw new Error("Auto Apply and Review Required cannot both be enabled");
  return {
    assertionType,
    enabled: input.enabled,
    autoApply: input.autoApply,
    defaultVisibility: input.defaultVisibility as RelationVisibility,
    reviewRequired: input.reviewRequired,
  };
}

function emptyPolicy(dataSourceId: string, assertionType: SourceAssertionType): SourceAssertionPolicy {
  return {
    id: null,
    data_source_id: dataSourceId,
    assertion_type: assertionType,
    enabled: false,
    auto_apply: false,
    default_visibility: "hidden",
    review_required: true,
  };
}

function safeError(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return value.map(String).join(" / ").slice(0, 300) || null;
  if (typeof value === "object") return JSON.stringify(value).slice(0, 300);
  return String(value).slice(0, 300);
}

export async function listAdminSourcePolicies(): Promise<{ data: AdminSourcePolicy[]; configured: boolean; error: string | null }> {
  if (!hasSupabaseAdminEnvironment()) return { data: [], configured: false, error: "Supabase環境変数が未設定です。" };
  try {
    const db = createSupabaseAdminClient();
    const [sourceResult, policyResult] = await Promise.all([
      db.from("data_sources").select("id,key,name,base_url").order("name"),
      db.from("data_source_assertion_policies").select("id,data_source_id,assertion_type,enabled,auto_apply,default_visibility,review_required"),
    ]);
    if (sourceResult.error) throw sourceResult.error;
    if (policyResult.error) throw policyResult.error;
    const policies = (policyResult.data || []) as SourceAssertionPolicy[];
    const data = await Promise.all((sourceResult.data || []).map(async (source) => {
      const sourcePolicies = SOURCE_ASSERTION_TYPES.map((assertionType) =>
        policies.find((policy) => policy.data_source_id === source.id && policy.assertion_type === assertionType)
        || emptyPolicy(source.id, assertionType));
      const [recordResult, runResult] = await Promise.all([
        db.from("source_records").select("fetched_at").eq("data_source_id", source.id).order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
        db.from("import_runs").select("status,finished_at,started_at,errors").eq("data_source_id", source.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (recordResult.error) throw recordResult.error;
      if (runResult.error) throw runResult.error;
      const lastRun = runResult.data;
      return {
        id: source.id,
        key: source.key,
        name: source.name,
        enabled: sourcePolicies.some((policy) => policy.enabled),
        configured: Boolean(source.base_url),
        entityScope: [...new Set(sourcePolicies.filter((policy) => policy.enabled).map((policy) => policy.assertion_type))],
        policies: sourcePolicies,
        lastSyncAt: lastRun?.finished_at || lastRun?.started_at || recordResult.data?.fetched_at || null,
        lastResult: lastRun?.status || (recordResult.data ? "source record fetched" : null),
        lastError: safeError(lastRun?.errors),
      } satisfies AdminSourcePolicy;
    }));
    return { data, configured: true, error: null };
  } catch (error) {
    return { data: [], configured: true, error: error instanceof Error ? error.message : "Source policyの取得に失敗しました。" };
  }
}
