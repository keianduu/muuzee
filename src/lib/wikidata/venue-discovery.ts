import { fetchJson } from "@/lib/external/fetch-json";
import { WIKIDATA_VENUE_CLASSES } from "./venue-type-mapper";

type SparqlResponse = { results?: { bindings?: Array<{ item?: { value?: string }; root?: { value?: string }; roots?: { value?: string } }> } };

export type DiscoveredWikidataVenue = { qid: string; rootIds: string[] };
export type WikidataDiscoveryRetry = { attempt: number; delayMs: number; message: string };

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;
const DISCOVERY_RETRIES = 4;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildWikidataVenueDiscoveryQuery(input: { countryQid?: string; rootQid?: string; limit: number; offset?: number; afterQid?: string | null }) {
  const country = input.countryQid || WIKIDATA_VENUE_CLASSES.countryJapan;
  const limit = Math.max(1, Math.min(250, Math.floor(input.limit)));
  const offset = Math.max(0, Math.floor(input.offset || 0));
  const afterQid = input.afterQid && /^Q\d+$/.test(input.afterQid) ? input.afterQid : null;
  const rootQid = input.rootQid && /^Q\d+$/.test(input.rootQid) ? input.rootQid : null;
  if (rootQid) return `SELECT DISTINCT ?item ?root WHERE {
  BIND(wd:${rootQid} AS ?root)
  ?item wdt:P31/wdt:P279* ?root;
        wdt:P17 wd:${country}.
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  ${afterQid ? `FILTER(STR(?item) > "http://www.wikidata.org/entity/${afterQid}")` : ""}
}
ORDER BY STR(?item)
LIMIT ${limit}
${afterQid ? "" : `OFFSET ${offset}`}`;
  return `SELECT ?item (GROUP_CONCAT(DISTINCT STR(?root); separator="|") AS ?roots) WHERE {
  VALUES ?root { wd:${WIKIDATA_VENUE_CLASSES.museum} wd:${WIKIDATA_VENUE_CLASSES.artGallery} }
  ?item wdt:P31/wdt:P279* ?root;
        wdt:P17 wd:${country}.
  FILTER NOT EXISTS { ?item wdt:P576 ?dissolved }
  ${afterQid ? `FILTER(STR(?item) > "http://www.wikidata.org/entity/${afterQid}")` : ""}
}
GROUP BY ?item
ORDER BY STR(?item)
LIMIT ${limit}
${afterQid ? "" : `OFFSET ${offset}`}`;
}

function qidFromUri(value: string | undefined) {
  const match = value?.match(/\/entity\/(Q\d+)$/);
  return match?.[1] || null;
}

export function normalizeDiscoveryResponse(payload: SparqlResponse, limit: number): DiscoveredWikidataVenue[] {
  const grouped = new Map<string, Set<string>>();
  for (const binding of payload.results?.bindings || []) {
    const qid = qidFromUri(binding.item?.value);
    const rootsInBinding = [binding.root?.value, ...(binding.roots?.value || "").split("|")].map(qidFromUri).filter((value): value is string => Boolean(value));
    if (!qid || !rootsInBinding.length) continue;
    const roots = grouped.get(qid) || new Set<string>();
    rootsInBinding.forEach((root) => roots.add(root)); grouped.set(qid, roots);
  }
  return [...grouped].slice(0, limit).map(([qid, roots]) => ({ qid, rootIds: [...roots] }));
}

export async function discoverWikidataVenuePage(input: {
  countryQid?: string;
  rootQid?: string;
  limit?: number;
  offset?: number;
  afterQid?: string | null;
  onRetry?: (retry: WikidataDiscoveryRetry) => void | Promise<void>;
}) {
  const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(input.limit || DEFAULT_PAGE_SIZE)));
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", buildWikidataVenueDiscoveryQuery({ ...input, limit, offset: input.offset || 0 }));
  url.searchParams.set("format", "json");
  let lastError: unknown;
  for (let attempt = 0; attempt <= DISCOVERY_RETRIES; attempt += 1) {
    try {
      const payload = await fetchJson<SparqlResponse>(url, { timeoutMs: 45_000, retries: 0 });
      return normalizeDiscoveryResponse(payload, limit);
    } catch (error) {
      lastError = error;
      if (attempt === DISCOVERY_RETRIES) break;
      const delayMs = Math.min(20_000, 1_500 * (2 ** attempt));
      await input.onRetry?.({
        attempt: attempt + 1,
        delayMs,
        message: error instanceof Error ? error.message : "WDQS discovery failed",
      });
      await wait(delayMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("WDQS discovery failed after retries");
}

export async function discoverWikidataVenues(input: { countryQid?: string; limit: number; offset?: number }) {
  const requested = Math.max(1, Math.min(500, Math.floor(input.limit)));
  const firstOffset = Math.max(0, Math.floor(input.offset || 0));
  const all: DiscoveredWikidataVenue[] = [];
  for (let cursor = firstOffset; all.length < requested; ) {
    const remaining = requested - all.length;
    const pageLimit = Math.min(MAX_PAGE_SIZE, remaining);
    const page = await discoverWikidataVenuePage({ countryQid: input.countryQid, limit: pageLimit, offset: cursor });
    all.push(...page);
    cursor += page.length;
    if (page.length < pageLimit) break;
    if (all.length < requested) await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return all;
}

export async function discoverAllWikidataVenues(input: { countryQid?: string; pageSize?: number } = {}) {
  const pageSize = Math.max(20, Math.min(MAX_PAGE_SIZE, input.pageSize || DEFAULT_PAGE_SIZE));
  const all: DiscoveredWikidataVenue[] = [];
  const seen = new Map<string, Set<string>>();
  for (const rootQid of [WIKIDATA_VENUE_CLASSES.museum, WIKIDATA_VENUE_CLASSES.artGallery]) {
    let afterQid: string | null = null;
    for (;;) {
      const page = await discoverWikidataVenuePage({ countryQid: input.countryQid, rootQid, limit: pageSize, afterQid });
      for (const item of page) {
        const roots = seen.get(item.qid) || new Set<string>();
        item.rootIds.forEach((root) => roots.add(root)); seen.set(item.qid, roots);
      }
      const nextQid: string | null = page.at(-1)?.qid || afterQid;
      if (page.length < pageSize) break;
      if (nextQid === afterQid) throw new Error("WDQS cursor did not advance");
      afterQid = nextQid;
      await wait(750);
    }
  }
  for (const [qid, roots] of seen) all.push({ qid, rootIds: [...roots] });
  return all;
}
