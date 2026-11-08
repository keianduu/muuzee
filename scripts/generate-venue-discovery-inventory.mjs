import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import {
  buildVenueDiscoveryInventoryQuery,
  createInitialCheckpoint,
  normalizeVenueDiscoveryBindings,
  prepareGeneratorExecution,
  resumeVenueDiscoveryGeneration,
  runVenueDiscoveryInventoryGeneration,
} from "./lib/venue-discovery-inventory-generator.mjs";
import {
  createLocalVenueDiscoveryPersistence,
  createStgVenueDiscoveryPersistence,
  createSupabaseCliExecutor,
} from "./lib/venue-discovery-inventory-persistence.mjs";

export async function fetchVenueDiscoveryProviderPage({ rootQid, afterQid, limit }) {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", buildVenueDiscoveryInventoryQuery({ rootQid, afterQid, limit }));
  url.searchParams.set("format", "json");
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": "MuuzeeLocalVenueDiscoveryInventory/0.1 (https://github.com/keianduu/muuzee)",
        },
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

function finishCurrentAttempt(checkpoint, status, now) {
  const attempts = [...checkpoint.attempts];
  const current = attempts.at(-1);
  if (current) attempts[attempts.length - 1] = { ...current, status, finishedAt: now() };
  return { ...checkpoint, attempts };
}

async function loadOrCreateGeneration({ args, persistence, dataSourceId, now }) {
  const existing = args.resumeId
    ? await persistence.loadGeneration(args.resumeId)
    : await persistence.findResumableGeneration(dataSourceId);

  if (existing) {
    return resumeVenueDiscoveryGeneration({
      generation: existing,
      dataSourceId,
      startedAt: now(),
      updateGeneration: async (updates) => {
        await persistence.updateGeneration(existing.id, updates, "Resume discovery generation");
      },
    });
  }

  const checkpoint = createInitialCheckpoint();
  checkpoint.attempts.push({
    startedAt: now(),
    startRootIndex: 0,
    startAfterQid: null,
    status: "running",
  });
  const created = await persistence.createGeneration({ dataSourceId, checkpoint });
  return { id: created.id, checkpoint };
}

export async function executeVenueDiscoveryInventoryGenerator({
  argv = process.argv.slice(2),
  environment = process.env,
  createDatabaseClient = (supabaseUrl, serviceRoleKey) => createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }),
  createLocalPersistence = createLocalVenueDiscoveryPersistence,
  createStgPersistence = createStgVenueDiscoveryPersistence,
  createCliExecutor = createSupabaseCliExecutor,
  fetchPage = fetchVenueDiscoveryProviderPage,
  now = () => new Date().toISOString(),
  output = (value) => console.log(value),
} = {}) {
  const { args, db } = prepareGeneratorExecution({ argv, environment, createDatabaseClient });
  const persistence = args.target === "local"
    ? createLocalPersistence(db)
    : createStgPersistence({
        executeCli: createCliExecutor(),
        applyIntent: args.target === "stg" && args.apply,
      });

  // The approved-target/authentication check must finish before any import_run,
  // provider request, or Inventory mutation can occur.
  await persistence.preflight();

  const dataSourceId = await persistence.loadDataSource();
  const generation = await loadOrCreateGeneration({ args, persistence, dataSourceId, now });
  let currentCheckpoint = generation.checkpoint;

  try {
    const result = await runVenueDiscoveryInventoryGeneration({
      checkpoint: generation.checkpoint,
      pageSize: args.pageSize,
      maxPages: args.maxPages,
      fetchPage,
      recordPage: async ({ rootQid, externalIds }) => {
        await persistence.recordPage({
          dataSourceId,
          generationId: generation.id,
          rootQid,
          externalIds,
        });
      },
      saveCheckpoint: async (checkpoint) => {
        currentCheckpoint = checkpoint;
        await persistence.updateGeneration(
          generation.id,
          { metrics: checkpoint },
          "Save discovery checkpoint",
        );
      },
      completeGeneration: async (checkpoint) => {
        currentCheckpoint = finishCurrentAttempt(checkpoint, "completed", now);
        await persistence.completeGeneration({
          generationId: generation.id,
          checkpoint: currentCheckpoint,
        });
      },
    });

    if (!result.complete) {
      currentCheckpoint = finishCurrentAttempt(result.checkpoint, "partial", now);
      await persistence.updateGeneration(generation.id, {
        status: "partial",
        metrics: currentCheckpoint,
        finished_at: now(),
      }, "Pause discovery generation");
    }

    const summary = {
      generationId: generation.id,
      status: result.complete ? "completed" : "partial",
      pagesThisAttempt: result.pagesThisAttempt,
      checkpoint: currentCheckpoint,
    };
    output(JSON.stringify(summary, null, 2));
    return summary;
  } catch (error) {
    currentCheckpoint = finishCurrentAttempt(currentCheckpoint, "failed", now);
    await persistence.updateGeneration(generation.id, {
      status: "partial",
      errors: [{ message: error instanceof Error ? error.message : "Discovery generation failed" }],
      metrics: currentCheckpoint,
      finished_at: now(),
    }, "Record discovery generation failure");
    throw error;
  }
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  await executeVenueDiscoveryInventoryGenerator();
}
