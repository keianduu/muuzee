import type { VenueEnrichmentResult } from "./types";

export type VenueBatchItem = { id: string; name: string };

export async function processVenueEnrichmentItems(
  venues: VenueBatchItem[],
  enrich: (venueId: string) => Promise<VenueEnrichmentResult>,
  wait: (ms: number) => Promise<unknown> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  const result = {
    processed: 0, matched: 0, sourceSelectionRequired: 0, coordinateAdded: 0, coordinateCandidateFound: 0, imageCandidateAdded: 0, imageCandidateFound: 0, imageFoundAtRelaxedThreshold: 0, entityCandidateFound: 0, noMatch: 0,
    errors: [] as Array<{ venueId: string; venueName: string; message: string }>, results: [] as VenueEnrichmentResult[],
  };
  for (const venue of venues) {
    try {
      if (result.processed) await wait(300);
      const item = await enrich(venue.id);
      result.results.push(item);
      result.processed += 1;
      if (item.matchStatus === "matched") result.matched += 1;
      else if (item.matchStatus === "unmatched") result.noMatch += 1;
      else result.sourceSelectionRequired += 1;
      if (item.coordinateAdded) result.coordinateAdded += 1;
      if (item.coordinateCandidateFound) result.coordinateCandidateFound += 1;
      if (item.imageCandidateAdded) result.imageCandidateAdded += 1;
      if (item.imageCandidateFound) result.imageCandidateFound += 1;
      if (item.imageFoundAtRelaxedThreshold) result.imageFoundAtRelaxedThreshold += 1;
      if (item.entityCandidateFound) result.entityCandidateFound += 1;
    } catch (error) {
      result.processed += 1;
      result.errors.push({ venueId: venue.id, venueName: venue.name, message: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return result;
}
