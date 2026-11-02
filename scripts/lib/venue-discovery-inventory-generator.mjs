export const VENUE_DISCOVERY_ROOTS = Object.freeze(["Q33506", "Q1007870"]);
export const VENUE_DISCOVERY_OPERATION = "wikidata_venue_discovery_inventory";

const QID_PATTERN = /^Q\d+$/;

export function validateLocalConfiguration({ supabaseUrl, vercel, nodeEnv }) {
  let parsed;
  try {
    parsed = new URL(supabaseUrl || "");
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid LOCAL URL.");
  }
  if (vercel || nodeEnv === "production" || parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Refusing to modify a non-LOCAL Supabase project.");
  }
  return parsed;
}

export function parseGeneratorArgs(argv) {
  const result = { apply: false, resumeId: null, pageSize: 50, maxPages: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") result.apply = true;
    else if (argument === "--resume") {
      result.resumeId = argv[++index] || null;
      if (!result.resumeId) throw new Error("--resume requires an import_runs UUID.");
    }
    else if (argument === "--page-size") result.pageSize = Number(argv[++index]);
    else if (argument === "--max-pages") result.maxPages = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (!result.apply) throw new Error("Explicit --apply is required.");
  if (!Number.isInteger(result.pageSize) || result.pageSize < 1 || result.pageSize > 100) {
    throw new Error("--page-size must be an integer from 1 to 100.");
  }
  if (!Number.isInteger(result.maxPages) || result.maxPages < 1 || result.maxPages > 100) {
    throw new Error("Explicit --max-pages must be an integer from 1 to 100.");
  }
  if (result.resumeId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.resumeId)) {
    throw new Error("--resume must be an import_runs UUID.");
  }
  return result;
}

export function createInitialCheckpoint() {
  return {
    version: 1,
    roots: [...VENUE_DISCOVERY_ROOTS],
    rootIndex: 0,
    afterQid: null,
    completedRoots: [],
    pages: 0,
    observations: 0,
    attempts: [],
    inventoryComplete: false,
  };
}

export function normalizeCheckpoint(value) {
  const checkpoint = value && typeof value === "object" ? value : {};
  const roots = Array.isArray(checkpoint.roots) && checkpoint.roots.length === VENUE_DISCOVERY_ROOTS.length
    && checkpoint.roots.every((root, index) => root === VENUE_DISCOVERY_ROOTS[index])
    ? [...checkpoint.roots]
    : [...VENUE_DISCOVERY_ROOTS];
  const rootIndex = Number.isInteger(checkpoint.rootIndex)
    ? Math.max(0, Math.min(roots.length, checkpoint.rootIndex))
    : 0;
  const afterQid = typeof checkpoint.afterQid === "string" && QID_PATTERN.test(checkpoint.afterQid)
    ? checkpoint.afterQid
    : null;
  return {
    version: 1,
    roots,
    rootIndex,
    afterQid,
    completedRoots: Array.isArray(checkpoint.completedRoots)
      ? checkpoint.completedRoots.filter((root) => roots.includes(root))
      : [],
    pages: Number.isInteger(checkpoint.pages) && checkpoint.pages >= 0 ? checkpoint.pages : 0,
    observations: Number.isInteger(checkpoint.observations) && checkpoint.observations >= 0 ? checkpoint.observations : 0,
    attempts: Array.isArray(checkpoint.attempts)
      ? checkpoint.attempts.filter((attempt) => attempt && typeof attempt === "object").slice(-100)
      : [],
    inventoryComplete: false,
  };
}

export async function resumeVenueDiscoveryGeneration({
  generation,
  dataSourceId,
  startedAt,
  updateGeneration,
}) {
  if (generation.data_source_id !== dataSourceId || generation.operation_type !== VENUE_DISCOVERY_OPERATION) {
    throw new Error("Requested import run is not a Wikidata Venue Discovery generation.");
  }
  if (!["running", "partial"].includes(generation.status)) {
    throw new Error(`Discovery generation is not resumable from status: ${generation.status}`);
  }

  const checkpoint = normalizeCheckpoint(generation.metrics);
  checkpoint.attempts.push({
    startedAt,
    startRootIndex: checkpoint.rootIndex,
    startAfterQid: checkpoint.afterQid,
    status: "running",
  });
  await updateGeneration({
    status: "running",
    errors: null,
    finished_at: null,
    metrics: checkpoint,
  });
  return { id: generation.id, checkpoint };
}

export function buildVenueDiscoveryInventoryQuery({ rootQid, afterQid = null, limit }) {
  if (!QID_PATTERN.test(rootQid)) throw new Error("Invalid discovery root QID.");
  if (afterQid && !QID_PATTERN.test(afterQid)) throw new Error("Invalid discovery cursor QID.");
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return `SELECT DISTINCT ?item ?root WHERE {
  BIND(wd:${rootQid} AS ?root)
  ?item wdt:P31/wdt:P279* ?root;
        wdt:P17 wd:Q17.
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  ${afterQid ? `FILTER(STR(?item) > "http://www.wikidata.org/entity/${afterQid}")` : ""}
}
ORDER BY STR(?item)
LIMIT ${boundedLimit}`;
}

export function normalizeVenueDiscoveryBindings(payload) {
  const qids = [];
  const seen = new Set();
  for (const binding of payload?.results?.bindings || []) {
    const match = binding?.item?.value?.match(/\/entity\/(Q\d+)$/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    qids.push(match[1]);
  }
  return qids;
}

export async function runVenueDiscoveryInventoryGeneration({
  checkpoint: storedCheckpoint,
  pageSize,
  maxPages,
  fetchPage,
  recordPage,
  saveCheckpoint,
  completeGeneration,
}) {
  const checkpoint = normalizeCheckpoint(storedCheckpoint);
  let pagesThisAttempt = 0;

  while (checkpoint.rootIndex < checkpoint.roots.length && pagesThisAttempt < maxPages) {
    const rootQid = checkpoint.roots[checkpoint.rootIndex];
    const previousCursor = checkpoint.afterQid;
    const externalIds = await fetchPage({ rootQid, afterQid: previousCursor, limit: pageSize });
    if (!Array.isArray(externalIds) || externalIds.some((qid) => !QID_PATTERN.test(qid))) {
      throw new Error("Discovery provider returned an invalid QID page.");
    }

    await recordPage({ rootQid, externalIds });
    checkpoint.pages += 1;
    checkpoint.observations += externalIds.length;
    pagesThisAttempt += 1;

    if (externalIds.length < pageSize) {
      if (!checkpoint.completedRoots.includes(rootQid)) checkpoint.completedRoots.push(rootQid);
      checkpoint.rootIndex += 1;
      checkpoint.afterQid = null;
    } else {
      const nextCursor = externalIds.at(-1);
      if (!nextCursor || nextCursor === previousCursor) throw new Error("WDQS cursor did not advance.");
      checkpoint.afterQid = nextCursor;
    }
    await saveCheckpoint({ ...checkpoint });
  }

  if (checkpoint.rootIndex === checkpoint.roots.length) {
    checkpoint.inventoryComplete = true;
    await completeGeneration({ ...checkpoint });
    return { complete: true, checkpoint, pagesThisAttempt };
  }

  return { complete: false, checkpoint, pagesThisAttempt };
}
