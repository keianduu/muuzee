import type { SupabaseClient } from "@supabase/supabase-js";
import { consumeArtistDiscoveryInventoryBatch } from "./artist-discovery-inventory";

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export async function runArtistInitialAcquisition(
  db: SupabaseClient,
  input: { limit?: number },
) {
  const limit = Math.max(1, Math.min(50, Math.floor(input.limit ?? 50)));
  const { data: source, error: sourceError } = await db
    .from("data_sources")
    .select("id")
    .eq("key", "wikidata")
    .single();
  if (sourceError || !source) throw sourceError || new Error("Wikidata data source is missing");

  const { data: run, error: runError } = await db
    .from("import_runs")
    .insert({
      data_source_id: source.id,
      operation_type: "wikidata_artist_initial_acquisition",
      status: "running",
      requested_count: limit,
      metrics: { mode: "manifest_inventory", imageDiscoveryExecuted: false },
    })
    .select("id")
    .single();
  if (runError || !run) throw runError || new Error("Artist acquisition run creation failed");

  try {
    const result = await consumeArtistDiscoveryInventoryBatch(db, {
      dataSourceId: source.id,
      runId: run.id,
      limit,
    });
    const metrics = {
      claimed: result.claimed,
      created: result.settled?.created ?? 0,
      exactSource: result.settled?.exactSource ?? 0,
      review: result.settled?.review ?? 0,
      invalid: result.settled?.invalid ?? 0,
      imageDiscoveryExecuted: false,
    };
    const { error } = await db.from("import_runs").update({
      status: "completed",
      fetched_count: result.claimed,
      created_count: metrics.created,
      skipped_count: metrics.exactSource + metrics.review,
      error_count: metrics.invalid,
      metrics,
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (error) throw error;
    return { runId: run.id, ...metrics };
  } catch (error) {
    const failureMessage = errorMessage(error, "Artist acquisition failed").slice(0, 500);
    const { error: finalizationError } = await db.from("import_runs").update({
      status: "failed",
      error_count: 1,
      errors: [{ message: failureMessage }],
      finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    if (finalizationError) {
      const finalizationMessage = errorMessage(finalizationError, "unknown finalization error");
      throw new Error(`${failureMessage}; import run finalization failed: ${finalizationMessage.slice(0, 500)}`);
    }
    throw error;
  }
}
