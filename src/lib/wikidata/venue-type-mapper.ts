import type { WikidataVenueType } from "./venue-import-types";

export const WIKIDATA_VENUE_CLASSES = {
  countryJapan: "Q17",
  museum: "Q33506",
  artMuseum: "Q207694",
  artGallery: "Q1007870",
} as const;

export function mapWikidataVenueType(input: { instanceOfIds: string[]; discoveryRootIds: string[] }): WikidataVenueType {
  const ids = new Set([...input.instanceOfIds, ...input.discoveryRootIds]);
  if (ids.has(WIKIDATA_VENUE_CLASSES.artGallery)) return "gallery";
  if (ids.has(WIKIDATA_VENUE_CLASSES.artMuseum) || ids.has(WIKIDATA_VENUE_CLASSES.museum)) return "museum";
  return "other";
}
