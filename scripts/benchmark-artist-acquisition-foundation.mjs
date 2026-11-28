import { performance } from "node:perf_hooks";

const batchSizes = [5, 20, 50, 100];
const existingCount = Number(process.argv[2] || 5_000);
const incomingCount = Number(process.argv[3] || 1_000);

function normalize(value) {
  return value.normalize("NFKC").toLowerCase().replace(/[\s・._-]+/g, "");
}

function percentile(values, value) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))] || 0;
}

function syntheticData() {
  const existing = Array.from({ length: existingCount }, (_, index) => ({
    id: `artist-${index}`,
    qid: `Q${index + 1}`,
    name: `Artist ${index}`,
    aliases: [`Alias ${index}`],
    birthYear: 1800 + (index % 220),
  }));
  const incoming = Array.from({ length: incomingCount }, (_, index) => {
    const exact = index % 10 === 0;
    const nameCollision = !exact && index % 21 === 0;
    const aliasCollision = !exact && !nameCollision && index % 37 === 0;
    const target = index % existingCount;
    return {
      qid: exact ? existing[target].qid : `Q${1_000_000 + index}`,
      name: nameCollision ? existing[target].name : `New Artist ${index}`,
      aliases: aliasCollision ? [existing[target].aliases[0]] : [],
      birthYear: nameCollision && index % 42 === 0 ? existing[target].birthYear + 1 : 1900 + (index % 120),
    };
  });
  return { existing, incoming };
}

function legacyResolve(existing, artist) {
  for (const candidate of existing) {
    const values = [candidate.name, ...candidate.aliases].map(normalize);
    const incoming = [artist.name, ...artist.aliases].map(normalize);
    if (incoming.some((value) => values.includes(value))) return "name-auto-link";
  }
  return "create";
}

function indexedResolver(existing) {
  const sourceByQid = new Map(existing.map((artist) => [artist.qid, artist.id]));
  const identityKeys = new Map();
  for (const artist of existing) {
    for (const value of [artist.name, ...artist.aliases]) {
      const key = normalize(value);
      const ids = identityKeys.get(key) || [];
      ids.push(artist.id);
      identityKeys.set(key, ids);
    }
  }
  return (artist) => {
    if (sourceByQid.has(artist.qid)) return "exact-source";
    const candidates = new Set([artist.name, ...artist.aliases].flatMap((value) => identityKeys.get(normalize(value)) || []));
    return candidates.size ? "review" : "create";
  };
}

function runBatches(records, batchSize, resolve) {
  const durations = [];
  const outcomes = { exactSource: 0, review: 0, create: 0, nameAutoLink: 0 };
  const started = performance.now();
  for (let start = 0; start < records.length; start += batchSize) {
    const batchStarted = performance.now();
    for (const artist of records.slice(start, start + batchSize)) {
      const outcome = resolve(artist);
      if (outcome === "exact-source") outcomes.exactSource += 1;
      else if (outcome === "review") outcomes.review += 1;
      else if (outcome === "name-auto-link") outcomes.nameAutoLink += 1;
      else outcomes.create += 1;
    }
    durations.push(performance.now() - batchStarted);
  }
  const totalMs = performance.now() - started;
  return {
    totalMs: Number(totalMs.toFixed(3)),
    recordsPerSecond: Number((records.length / (totalMs / 1000)).toFixed(1)),
    batchP50Ms: Number(percentile(durations, 0.5).toFixed(3)),
    batchP95Ms: Number(percentile(durations, 0.95).toFixed(3)),
    outcomes,
  };
}

const memoryBefore = process.memoryUsage().rss;
const { existing, incoming } = syntheticData();
const initializationStarted = performance.now();
const optimizedResolve = indexedResolver(existing);
const initializationMs = performance.now() - initializationStarted;
const results = batchSizes.map((batchSize) => {
  const optimized = runBatches(incoming, batchSize, optimizedResolve);
  return {
    batchSize,
    ...optimized,
    dbRoundTripsPerBatch: 2,
    dbRoundTripsPerRecord: Number((2 / batchSize).toFixed(4)),
    modeledProviderRequestsPerBatch: Math.ceil(batchSize / 50) + Math.ceil((batchSize * 2 + 4) / 50) + 1,
    modeledProviderRequestsPerRecord: Number(((Math.ceil(batchSize / 50) + Math.ceil((batchSize * 2 + 4) / 50) + 1) / batchSize).toFixed(4)),
    retryFailureRate: 0,
    identityReviewRate: Number((optimized.outcomes.review / incoming.length).toFixed(4)),
  };
});
const legacy = runBatches(incoming, 20, (artist) => legacyResolve(existing, artist));
const memoryAfter = process.memoryUsage().rss;

console.log(JSON.stringify({
  benchmark: "LOCAL deterministic synthetic identity pipeline",
  generatedAt: new Date().toISOString(),
  dataset: { existingArtists: existingCount, incomingArtists: incomingCount },
  initializationMs: Number(initializationMs.toFixed(3)),
  rssDeltaMiB: Number(((memoryAfter - memoryBefore) / 1024 / 1024).toFixed(2)),
  legacy: {
    ...legacy,
    behavior: "full Artist scan per incoming record; name/alias auto-link",
  },
  optimized: results,
  notes: {
    measured: "CPU identity resolution, batch p50/p95, throughput, RSS delta",
    modeled: "DB/provider requests derived from implemented claim+batch-settlement and 50-ID provider chunks",
    imageDiscovery: "excluded from canonical construction",
  },
}, null, 2));
