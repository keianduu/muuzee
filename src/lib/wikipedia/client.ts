import { extractWikipediaAddress, wikipediaSiteFromEntity, type WikipediaSite } from "./venue-address";

const USER_AGENT = "MuuzeeVenueWikipediaEnrichment/1.0 (local development; https://github.com/keianduu/muuzee)";

async function sleep(ms: number) { await new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchJson(url: URL, fetcher: typeof fetch = fetch) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(350 * attempt);
    }
  }
  throw lastError;
}

export async function resolveWikipediaSite(qid: string, fetcher: typeof fetch = fetch): Promise<WikipediaSite | null> {
  if (!/^Q\d+$/.test(qid)) return null;
  const url = new URL("https://www.wikidata.org/w/api.php");
  Object.entries({ action: "wbgetentities", ids: qid, props: "sitelinks", sitefilter: "jawiki|enwiki", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson(url, fetcher) as { entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }> };
  return wikipediaSiteFromEntity(payload.entities?.[qid]);
}

export async function fetchWikipediaAddress(site: WikipediaSite, fetcher: typeof fetch = fetch) {
  const url = new URL(`https://${site.language}.wikipedia.org/w/api.php`);
  Object.entries({ action: "query", prop: "revisions|info", titles: site.title, redirects: "1", rvprop: "content", rvslots: "main", inprop: "url", formatversion: "2", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson(url, fetcher) as { query?: { pages?: Array<{ pageid?: number; title?: string; fullurl?: string; missing?: boolean; revisions?: Array<{ slots?: { main?: { content?: string } } }> }> } };
  const page = payload.query?.pages?.[0];
  const wikitext = page?.revisions?.[0]?.slots?.main?.content;
  if (!page || page.missing || typeof wikitext !== "string") return null;
  return {
    language: site.language,
    title: page.title || site.title,
    pageId: page.pageid ?? null,
    url: page.fullurl || `https://${site.language}.wikipedia.org/wiki/${encodeURIComponent(site.title.replaceAll(" ", "_"))}`,
    ...extractWikipediaAddress(wikitext),
  };
}
