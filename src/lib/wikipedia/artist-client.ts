import { fetchJson } from "@/lib/external/fetch-json";
import type { WikipediaSite } from "./venue-address";
import { extractWikipediaArtistProfile } from "./artist-profile";

type Payload = { query?: { pages?: Array<{ pageid?: number; title?: string; fullurl?: string; missing?: boolean; revisions?: Array<{ slots?: { main?: { content?: string } } }> }> } };

export async function fetchWikipediaArtistProfile(site: WikipediaSite) {
  const url = new URL(`https://${site.language}.wikipedia.org/w/api.php`);
  Object.entries({ action: "query", prop: "revisions|info", titles: site.title, redirects: "1", rvprop: "content", rvslots: "main", inprop: "url", formatversion: "2", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<Payload>(url);
  const page = payload.query?.pages?.[0]; const wikitext = page?.revisions?.[0]?.slots?.main?.content;
  if (!page || page.missing || typeof wikitext !== "string") return null;
  return { language: site.language, title: page.title || site.title, pageId: page.pageid ?? null, url: page.fullurl || `https://${site.language}.wikipedia.org/wiki/${encodeURIComponent(site.title.replaceAll(" ", "_"))}`, profile: extractWikipediaArtistProfile(wikitext, site.language) };
}
