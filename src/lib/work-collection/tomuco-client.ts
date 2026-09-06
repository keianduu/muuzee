import { fetchJson } from "@/lib/external/fetch-json";
import { explicitPresentation, parseExplicitYear } from "./mapping";
import type { WorkSourceCandidate } from "./types";

type JsonLd = Record<string, unknown>;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function parseTomucoWorks(payload: unknown, artistName: string, max = 5): WorkSourceCandidate[] {
  const root = payload as JsonLd;
  const list = (Array.isArray(root?.itemListElement) ? root.itemListElement : Array.isArray(root?.["@graph"]) ? root["@graph"] : Array.isArray(payload) ? payload : []) as JsonLd[];
  return list.slice(0, max).flatMap((wrapper, index) => {
    const row = (wrapper.item && typeof wrapper.item === "object" ? wrapper.item : wrapper) as JsonLd;
    const title = text(row.name || row.headline);
    const id = text(row.identifier || row["@id"]);
    if (!title || !id) return [];
    const creator = row.creator as JsonLd | string | undefined;
    const sourceArtist = text(typeof creator === "object" ? creator?.name : creator) || artistName;
    const location = row.contentLocation as JsonLd | string | undefined;
    const venueName = text(typeof location === "object" ? location?.name : location) || null;
    const yearRaw = text(row.dateCreated || row.temporalCoverage) || null;
    const year = parseExplicitYear(yearRaw);
    const presentation = explicitPresentation(text(row.exhibitionEvent || row.additionalProperty));
    return [{ externalId: id, sourceKey: "tomuco" as const, sourceUrl: text(row.url || row["@id"]) || "https://museumcollection.tokyo/works/", title, titleEn: null, titleOriginal: null, artistName: sourceArtist, venueName, yearText: year.text, createdYearFrom: year.from, createdYearTo: year.to, holdingType: venueName ? "collection" as const : null, presentationType: presentation.type, presentationStatus: presentation.status, representativeScore: Math.max(0, 1 - index * 0.05), representativeReason: "Source result order only; human selection required", raw: row }];
  });
}

export async function searchTomuco(artistName: string, max = 5) {
  const url = new URL("https://museumcollection.tokyo/works/");
  url.searchParams.set("output", "json"); url.searchParams.set("artist_name", artistName); url.searchParams.set("limit", String(Math.min(5, max))); url.searchParams.set("offset", "0");
  const payload = await fetchJson<unknown>(url, { timeoutMs: 30_000 });
  return parseTomucoWorks(payload, artistName, max);
}
