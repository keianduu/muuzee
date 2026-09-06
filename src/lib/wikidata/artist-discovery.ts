import { fetchJson } from "@/lib/external/fetch-json";
import { getWikidataRawEntities } from "./client";
import type { DiscoveredWikidataArtist } from "./artist-types";

export const VISUAL_ARTIST_OCCUPATION_QID = "Q3391743";
type Response = { results?: { bindings?: Array<{ item?: { value?: string } }> } };
type SearchResponse = { search?: Array<{ id: string }> };

function normalized(value: string) { return value.normalize("NFKC").toLowerCase().replace(/[\s・._-]+/g, ""); }

export function buildArtistDiscoveryQuery(input: { limit: number; offset?: number; afterQid?: string | null }) {
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));
  const offset = Math.max(0, Math.floor(input.offset || 0));
  const after = input.afterQid && /^Q\d+$/.test(input.afterQid) ? input.afterQid : null;
  return `SELECT DISTINCT ?item WHERE {
  ?item wdt:P106/wdt:P279* wd:${VISUAL_ARTIST_OCCUPATION_QID}.
  ${after ? `FILTER(STR(?item) > "http://www.wikidata.org/entity/${after}")` : ""}
}
ORDER BY STR(?item)
LIMIT ${limit}
${after ? "" : `OFFSET ${offset}`}`;
}

export function normalizeArtistDiscovery(payload: Response) {
  return [...new Set((payload.results?.bindings || []).flatMap((row) => row.item?.value?.match(/\/entity\/(Q\d+)$/)?.[1] || []))].map((qid) => ({ qid }));
}

export async function discoverWikidataArtists(input: { limit: number; offset?: number; afterQid?: string | null }) {
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", buildArtistDiscoveryQuery(input)); url.searchParams.set("format", "json");
  return normalizeArtistDiscovery(await fetchJson<Response>(url, { timeoutMs: 45_000, retries: 4 }));
}

export async function discoverArtistSample(count: number, offset = 0) {
  const requested = Math.max(1, Math.min(500, Math.floor(count)));
  const rows: DiscoveredWikidataArtist[] = [];
  for (let cursor = offset; rows.length < requested;) {
    const page = await discoverWikidataArtists({ limit: Math.min(100, requested - rows.length), offset: cursor });
    rows.push(...page); cursor += page.length;
    if (page.length === 0 || page.length < Math.min(100, requested - rows.length + page.length)) break;
  }
  return rows;
}

async function searchArtistIds(name: string, language: "ja" | "en") {
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbsearchentities", search: name, language, uselang: language, type: "item", limit: "10", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<SearchResponse>(url);
  return (payload.search || []).map((item) => item.id).filter((id) => /^Q\d+$/.test(id));
}

export type ArtistNameResolution = { name: string; status: "matched" | "not_found" | "ambiguous"; qid: string | null; candidateQids: string[] };

export async function resolveWikidataArtistNames(names: string[]): Promise<ArtistNameResolution[]> {
  const results: ArtistNameResolution[] = [];
  for (const name of [...new Set(names.map((value) => value.trim()).filter(Boolean))]) {
    const candidateIds = [...new Set([...(await searchArtistIds(name, "ja")), ...(await searchArtistIds(name, "en"))])];
    const entities = await getWikidataRawEntities(candidateIds);
    const needle = normalized(name);
    const exact = candidateIds.filter((id) => {
      const entity = entities[id];
      const labels = Object.values(entity?.labels || {}).map((item) => item.value);
      const aliases = Object.values(entity?.aliases || {}).flatMap((items) => items.map((item) => item.value));
      return [...labels, ...aliases].some((value) => normalized(value) === needle);
    });
    results.push({ name, status: exact.length === 1 ? "matched" : exact.length ? "ambiguous" : "not_found", qid: exact.length === 1 ? exact[0] : null, candidateQids: exact });
  }
  return results;
}
