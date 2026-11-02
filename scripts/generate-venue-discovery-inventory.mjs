import { createClient } from "@supabase/supabase-js";
import {
  buildVenueDiscoveryInventoryQuery,
  createInitialCheckpoint,
  normalizeVenueDiscoveryBindings,
  prepareGeneratorExecution,
  resumeVenueDiscoveryGeneration,
  runVenueDiscoveryInventoryGeneration,
  VENUE_DISCOVERY_OPERATION,
} from "./lib/venue-discovery-inventory-generator.mjs";

const { args, db } = prepareGeneratorExecution({
  argv: process.argv.slice(2),
  environment: process.env,
  createDatabaseClient: (supabaseUrl, serviceRoleKey) => createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
});

async function must(promise, context) {
  const result = await promise;
  if (result.error) throw new Error(`${context}: ${result.error.message}`);
  return result.data;
}

async function findDataSource() {
  const source = await must(
    db.from("data_sources").select("id").eq("key", "wikidata").single(),
    "Load Wikidata source",
  );
  return source.id;
}

async function loadOrCreateGeneration(dataSourceId) {
  let existing = null;
  if (args.resumeId) {
    existing = await must(
      db.from("import_runs")
        .select("id,data_source_id,status,operation_type,metrics")
        .eq("id", args.resumeId)
        .single(),
      "Load requested discovery generation",
    );
  } else {
    existing = await must(
      db.from("import_runs")
        .select("id,data_source_id,status,operation_type,metrics")
        .eq("data_source_id", dataSourceId)
        .eq("operation_type", VENUE_DISCOVERY_OPERATION)
        .in("status", ["running", "partial"])
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      "Find resumable discovery generation",
    );
  }

  if (existing) {
    return resumeVenueDiscoveryGeneration({
      generation: existing,
      dataSourceId,
      startedAt: new Date().toISOString(),
      updateGeneration: async (updates) => {
        await must(
          db.from("import_runs").update(updates).eq("id", existing.id),
          "Resume discovery generation",
        );
      },
    });
  }

  const checkpoint = createInitialCheckpoint();
  checkpoint.attempts.push({
    startedAt: new Date().toISOString(),
    startRootIndex: 0,
    startAfterQid: null,
    status: "running",
  });
  const created = await must(
    db.from("import_runs").insert({
      data_source_id: dataSourceId,
      operation_type: VENUE_DISCOVERY_OPERATION,
      status: "running",
      metrics: checkpoint,
    }).select("id").single(),
    "Create discovery generation",
  );
  return { id: created.id, checkpoint };
}

async function fetchProviderPage({ rootQid, afterQid, limit }) {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", buildVenueDiscoveryInventoryQuery({ rootQid, afterQid, limit }));
  url.searchParams.set("format", "json");
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": "MuuzeeLocalVenueDiscoveryInventory/0.1 (https://github.com/keianduu/muuzee)" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`WDQS HTTP ${response.status}`);
      return normalizeVenueDiscoveryBindings(await response.json());
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, Math.min(20_000, 1_500 * (2 ** attempt))));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("WDQS discovery failed.");
}

const dataSourceId = await findDataSource();
const generation = await loadOrCreateGeneration(dataSourceId);
let currentCheckpoint = generation.checkpoint;

function finishCurrentAttempt(checkpoint, status) {
  const attempts = [...checkpoint.attempts];
  const current = attempts.at(-1);
  if (current) attempts[attempts.length - 1] = { ...current, status, finishedAt: new Date().toISOString() };
  return { ...checkpoint, attempts };
}

try {
  const result = await runVenueDiscoveryInventoryGeneration({
    checkpoint: generation.checkpoint,
    pageSize: args.pageSize,
    maxPages: args.maxPages,
    fetchPage: fetchProviderPage,
    recordPage: async ({ rootQid, externalIds }) => {
      await must(db.rpc("record_venue_discovery_inventory_page", {
        p_data_source_id: dataSourceId,
        p_generation_id: generation.id,
        p_root_id: rootQid,
        p_external_ids: externalIds,
      }), "Persist discovery page");
    },
    saveCheckpoint: async (checkpoint) => {
      currentCheckpoint = checkpoint;
      await must(db.from("import_runs").update({ metrics: checkpoint }).eq("id", generation.id), "Save discovery checkpoint");
    },
    completeGeneration: async (checkpoint) => {
      currentCheckpoint = finishCurrentAttempt(checkpoint, "completed");
      await must(db.rpc("complete_venue_discovery_inventory_generation", {
        p_generation_id: generation.id,
        p_metrics: currentCheckpoint,
      }), "Complete discovery generation");
    },
  });

  if (!result.complete) {
    currentCheckpoint = finishCurrentAttempt(result.checkpoint, "partial");
    await must(db.from("import_runs").update({
      status: "partial",
      metrics: currentCheckpoint,
      finished_at: new Date().toISOString(),
    }).eq("id", generation.id), "Pause discovery generation");
  }
  console.log(JSON.stringify({
    generationId: generation.id,
    status: result.complete ? "completed" : "partial",
    pagesThisAttempt: result.pagesThisAttempt,
    checkpoint: currentCheckpoint,
  }, null, 2));
} catch (error) {
  currentCheckpoint = finishCurrentAttempt(currentCheckpoint, "failed");
  await db.from("import_runs").update({
    status: "partial",
    errors: [{ message: error instanceof Error ? error.message : "Discovery generation failed" }],
    metrics: currentCheckpoint,
    finished_at: new Date().toISOString(),
  }).eq("id", generation.id);
  throw error;
}
