import { fetchJson } from "@/lib/external/fetch-json";

type Metadata = Record<string, { value?: string }>;
type CommonsResponse = { query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url?: string; thumburl?: string; descriptionurl?: string; extmetadata?: Metadata }> }> } };
type CategoryResponse = { query?: { categorymembers?: Array<{ title?: string }> } };
type WikipediaImagesResponse = { query?: { pages?: Record<string, { images?: Array<{ title?: string }> }> } };
type WikipediaLeadImageResponse = { query?: { pages?: Record<string, { pageimage?: string }> } };

export function normalizeCommonsImageResponse(payload: CommonsResponse, fallbackTitle: string) {
  const page = Object.values(payload.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  if (!page || !info?.url) return null;
  const meta = info.extmetadata || {};
  return {
    fileTitle: page.title || fallbackTitle,
    imageUrl: info.url,
    thumbnailUrl: info.thumburl || null,
    sourceUrl: info.descriptionurl || null,
    author: plainText(meta.Artist?.value || meta.Author?.value),
    credit: plainText(meta.Credit?.value),
    licenseShortName: plainText(meta.LicenseShortName?.value),
    licenseUrl: plainText(meta.LicenseUrl?.value),
    usageTerms: plainText(meta.UsageTerms?.value),
    raw: payload,
  };
}

export function plainText(value: string | null | undefined) {
  return (value || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim() || null;
}

export async function getCommonsImageMetadata(fileTitle: string) {
  const title = fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", titles: title, prop: "imageinfo", iiprop: "url|extmetadata", iiurlwidth: "640", iiextmetadatalanguage: "ja", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<CommonsResponse>(url);
  return normalizeCommonsImageResponse(payload, title);
}

export async function listCommonsCategoryFiles(category: string, limit = 50) {
  const title = category.startsWith("Category:") ? category : `Category:${category}`;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({ action: "query", list: "categorymembers", cmtitle: title, cmtype: "file", cmnamespace: "6", cmlimit: String(Math.max(1, Math.min(100, limit))), format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<CategoryResponse>(url);
  return (payload.query?.categorymembers || []).flatMap((item) => item.title ? [item.title] : []);
}

export async function listWikipediaArticleImages(articleTitle: string, language: "ja" | "en" = "ja", limit = 100) {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  Object.entries({ action: "query", titles: articleTitle, prop: "images", imlimit: String(Math.max(1, Math.min(500, limit))), format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<WikipediaImagesResponse>(url);
  const page = Object.values(payload.query?.pages || {})[0];
  return (page?.images || []).flatMap((item) => item.title ? [item.title] : []);
}

export async function getWikipediaLeadImage(articleTitle: string, language: "ja" | "en" = "ja") {
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  Object.entries({ action: "query", titles: articleTitle, prop: "pageimages", piprop: "name", format: "json", origin: "*" }).forEach(([key, value]) => url.searchParams.set(key, value));
  const payload = await fetchJson<WikipediaLeadImageResponse>(url);
  const page = Object.values(payload.query?.pages || {})[0];
  return page?.pageimage ? `File:${page.pageimage}` : null;
}
