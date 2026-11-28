import { createClient } from "@supabase/supabase-js";
import {
  ARTIST_DISCOVERY_OPERATION,
  buildArtistDiscoveryInventoryQuery,
  createArtistInitialCheckpoint,
  normalizeArtistCheckpoint,
  normalizeArtistDiscoveryBindings,
  parseArtistGeneratorArgs,
  runArtistDiscoveryInventoryGeneration,
  validateArtistLocalConfiguration,
} from "./lib/artist-discovery-inventory-generator.mjs";

async function must(promise, context) {
  const result = await promise;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function fetchPage({ afterQid, limit }) {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", buildArtistDiscoveryInventoryQuery({ afterQid, limit }));
  url.searchParams.set("format", "json");
  const response = await fetch(url, {
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "MuuzeeLocalArtistDiscoveryInventory/0.1 (https://github.com/keianduu/muuzee)",
    },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`WDQS HTTP ${response.status}`);
  return normalizeArtistDiscoveryBindings(await response.json());
}

async function main() {
  const args = parseArtistGeneratorArgs(process.argv.slice(2));
  const parsedUrl = validateArtistLocalConfiguration({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    vercel: process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV,
  });
  const db = createClient(parsedUrl.href, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const source = await must(db.from("data_sources").select("id").eq("key", "wikidata").single(), "Load Wikidata source");
  let generation = args.resumeId
    ? await must(db.from("import_runs").select("id,data_source_id,status,operation_type,metrics").eq("id", args.resumeId).single(), "Load Artist generation")
    : await must(db.from("import_runs").select("id,data_source_id,status,operation_type,metrics").eq("data_source_id", source.id).eq("operation_type", ARTIST_DISCOVERY_OPERATION).in("status", ["running", "partial"]).order("started_at", { ascending: false }).limit(1).maybeSingle(), "Find Artist generation");

  if (generation) {
    if (generation.data_source_id !== source.id || generation.operation_type !== ARTIST_DISCOVERY_OPERATION || !["running", "partial"].includes(generation.status)) {
      throw new Error("Requested run is not a resumable Artist Discovery generation.");
    }
    generation.metrics = normalizeArtistCheckpoint(generation.metrics);
    await must(db.from("import_runs").update({ status: "running", errors: null, finished_at: null }).eq("id", generation.id), "Resume Artist generation");
  } else {
    const created = await must(db.from("import_runs").insert({
      data_source_id: source.id,
      operation_type: ARTIST_DISCOVERY_OPERATION,
      status: "running",
      metrics: createArtistInitialCheckpoint(),
    }).select("id,metrics").single(), "Create Artist generation");
    generation = { ...created, data_source_id: source.id, operation_type: ARTIST_DISCOVERY_OPERATION, status: "running" };
  }

  try {
    const result = await runArtistDiscoveryInventoryGeneration({
      checkpoint: generation.metrics,
      pageSize: args.pageSize,
      maxPages: args.maxPages,
      fetchPage,
      recordPage: async ({ externalIds }) => {
        await must(db.rpc("record_artist_discovery_inventory_page", {
          p_data_source_id: source.id,
          p_generation_id: generation.id,
          p_external_ids: externalIds,
        }), "Persist Artist discovery page");
      },
      saveCheckpoint: async (checkpoint) => {
        await must(db.from("import_runs").update({ metrics: checkpoint }).eq("id", generation.id), "Save Artist checkpoint");
      },
      completeGeneration: async (checkpoint) => {
        await must(db.rpc("complete_artist_discovery_inventory_generation", {
          p_generation_id: generation.id,
          p_metrics: checkpoint,
        }), "Complete Artist generation");
      },
    });
    if (!result.complete) {
      await must(db.from("import_runs").update({
        status: "partial",
        metrics: result.checkpoint,
        finished_at: new Date().toISOString(),
      }).eq("id", generation.id), "Pause Artist generation");
    }
    console.log(JSON.stringify({
      generationId: generation.id,
      status: result.complete ? "completed" : "partial",
      pagesThisAttempt: result.pagesThisAttempt,
      checkpoint: result.checkpoint,
    }, null, 2));
  } catch (error) {
    await db.from("import_runs").update({
      status: "partial",
      errors: [{ message: error instanceof Error ? error.message : "Artist discovery failed" }],
      finished_at: new Date().toISOString(),
    }).eq("id", generation.id);
    throw error;
  }
}

await main();
