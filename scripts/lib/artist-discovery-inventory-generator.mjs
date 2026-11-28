export const ARTIST_DISCOVERY_ROOTS = Object.freeze(["Q3391743"]);
export const ARTIST_DISCOVERY_OPERATION = "wikidata_artist_discovery_inventory";

const QID_PATTERN = /^Q\d+$/;

export function parseArtistGeneratorArgs(argv) {
  const result = { target: null, apply: false, resumeId: null, pageSize: 50, maxPages: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--local") result.target = "local";
    else if (argument === "--apply") result.apply = true;
    else if (argument === "--resume") result.resumeId = argv[++index] || null;
    else if (argument === "--page-size") result.pageSize = Number(argv[++index]);
    else if (argument === "--max-pages") result.maxPages = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (result.target !== "local") throw new Error("Phase A Artist generation requires the explicit --local target.");
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

export function validateArtistLocalConfiguration({ supabaseUrl, serviceRoleKey, vercel, nodeEnv }) {
  let parsed;
  try {
    parsed = new URL(supabaseUrl || "");
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid LOCAL URL.");
  }
  if (vercel || nodeEnv === "production" || parsed.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(parsed.hostname)) {
    throw new Error("Refusing to modify a non-LOCAL Supabase project.");
  }
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for LOCAL generation.");
  return parsed;
}

export function createArtistInitialCheckpoint() {
  return {
    version: 1,
    roots: [...ARTIST_DISCOVERY_ROOTS],
    rootIndex: 0,
    afterQid: null,
    completedRoots: [],
    pages: 0,
    observations: 0,
    attempts: [],
    inventoryComplete: false,
  };
}

export function normalizeArtistCheckpoint(value) {
  const checkpoint = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    roots: [...ARTIST_DISCOVERY_ROOTS],
    rootIndex: Number.isInteger(checkpoint.rootIndex) ? Math.max(0, Math.min(1, checkpoint.rootIndex)) : 0,
    afterQid: typeof checkpoint.afterQid === "string" && QID_PATTERN.test(checkpoint.afterQid)
      ? checkpoint.afterQid
      : null,
    completedRoots: Array.isArray(checkpoint.completedRoots) && checkpoint.completedRoots.includes("Q3391743")
      ? ["Q3391743"]
      : [],
    pages: Number.isInteger(checkpoint.pages) && checkpoint.pages >= 0 ? checkpoint.pages : 0,
    observations: Number.isInteger(checkpoint.observations) && checkpoint.observations >= 0 ? checkpoint.observations : 0,
    attempts: Array.isArray(checkpoint.attempts)
      ? checkpoint.attempts.filter((attempt) => attempt && typeof attempt === "object").slice(-100)
      : [],
    inventoryComplete: false,
  };
}

export function buildArtistDiscoveryInventoryQuery({ afterQid = null, limit }) {
  if (afterQid && !QID_PATTERN.test(afterQid)) throw new Error("Invalid Artist discovery cursor QID.");
  const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  return `SELECT DISTINCT ?item WHERE {
  ?item wdt:P106/wdt:P279* wd:Q3391743.
  ${afterQid ? `FILTER(STR(?item) > "http://www.wikidata.org/entity/${afterQid}")` : ""}
}
ORDER BY STR(?item)
LIMIT ${boundedLimit}`;
}

export function normalizeArtistDiscoveryBindings(payload) {
  if (!payload || typeof payload !== "object" || !Array.isArray(payload.results?.bindings)) {
    throw new Error("WDQS Artist discovery response schema is invalid.");
  }
  const qids = [];
  const seen = new Set();
  for (const binding of payload.results.bindings) {
    const qid = binding?.item?.value?.match(/\/entity\/(Q\d+)$/)?.[1];
    if (!qid) throw new Error("WDQS Artist discovery response contains an invalid item.");
    if (!seen.has(qid)) {
      seen.add(qid);
      qids.push(qid);
    }
  }
  return qids;
}

export async function runArtistDiscoveryInventoryGeneration({
  checkpoint: storedCheckpoint,
  pageSize,
  maxPages,
  fetchPage,
  recordPage,
  saveCheckpoint,
  completeGeneration,
}) {
  const checkpoint = normalizeArtistCheckpoint(storedCheckpoint);
  let pagesThisAttempt = 0;

  while (checkpoint.rootIndex < checkpoint.roots.length && pagesThisAttempt < maxPages) {
    const previousCursor = checkpoint.afterQid;
    const externalIds = await fetchPage({ afterQid: previousCursor, limit: pageSize });
    if (!Array.isArray(externalIds) || externalIds.some((qid) => !QID_PATTERN.test(qid))) {
      throw new Error("Artist discovery provider returned an invalid QID page.");
    }
    await recordPage({ externalIds });
    checkpoint.pages += 1;
    checkpoint.observations += externalIds.length;
    pagesThisAttempt += 1;

    if (externalIds.length < pageSize) {
      checkpoint.completedRoots = ["Q3391743"];
      checkpoint.rootIndex = 1;
      checkpoint.afterQid = null;
    } else {
      const nextCursor = externalIds.at(-1);
      if (!nextCursor || nextCursor === previousCursor) throw new Error("WDQS Artist cursor did not advance.");
      checkpoint.afterQid = nextCursor;
    }
    await saveCheckpoint({ ...checkpoint });
  }

  if (checkpoint.rootIndex === 1) {
    checkpoint.inventoryComplete = true;
    await completeGeneration({ ...checkpoint });
    return { complete: true, checkpoint, pagesThisAttempt };
  }
  return { complete: false, checkpoint, pagesThisAttempt };
}
