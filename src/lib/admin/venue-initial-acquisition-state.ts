import "server-only";

import { createSupabaseAdminClient, hasSupabaseAdminEnvironment } from "@/lib/supabase/admin";

export type VenueInitialAcquisitionState = {
  status: "not_started" | "started" | "unavailable";
  linkedVenueCount: number | null;
  latestRunStatus: string | null;
};

export function resolveVenueInitialAcquisitionState(
  linkedVenueCount: number,
  latestRunStatus: string | null,
): VenueInitialAcquisitionState {
  return {
    status: linkedVenueCount > 0 || latestRunStatus === "completed" || latestRunStatus === "partial"
      ? "started"
      : "not_started",
    linkedVenueCount,
    latestRunStatus,
  };
}

export async function getVenueInitialAcquisitionState(): Promise<VenueInitialAcquisitionState> {
  if (!hasSupabaseAdminEnvironment()) {
    return { status: "unavailable", linkedVenueCount: null, latestRunStatus: null };
  }

  try {
    const db = createSupabaseAdminClient();
    const { data: source, error: sourceError } = await db
      .from("data_sources")
      .select("id")
      .eq("key", "wikidata")
      .maybeSingle();
    if (sourceError || !source) throw sourceError || new Error("Wikidata data source is missing");

    const [linked, latestSuccessfulRun] = await Promise.all([
      db
        .from("source_records")
        .select("id", { count: "exact", head: true })
        .eq("data_source_id", source.id)
        .not("venue_id", "is", null),
      db
        .from("import_runs")
        .select("status")
        .eq("data_source_id", source.id)
        .eq("operation_type", "wikidata_venue_import")
        .in("status", ["completed", "partial"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (linked.error) throw linked.error;
    if (latestSuccessfulRun.error) throw latestSuccessfulRun.error;

    return resolveVenueInitialAcquisitionState(linked.count ?? 0, latestSuccessfulRun.data?.status ?? null);
  } catch (error) {
    console.error("[admin:data-acquisition] Venue initial acquisition state failed", {
      code: diagnosticField(error, "code"),
      message: diagnosticField(error, "message"),
      details: diagnosticField(error, "details"),
      hint: diagnosticField(error, "hint"),
      status: diagnosticField(error, "status"),
    });
    return { status: "unavailable", linkedVenueCount: null, latestRunStatus: null };
  }
}

function diagnosticField(error: unknown, field: "code" | "message" | "details" | "hint" | "status") {
  if (!error || typeof error !== "object" || !(field in error)) return null;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" || typeof value === "number" ? value : null;
}
