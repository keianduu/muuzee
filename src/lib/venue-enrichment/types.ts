export type VenueEnrichmentResult = {
  venueId: string;
  venueName: string;
  matchStatus: "matched" | "candidate" | "unmatched" | "rejected";
  wikidataId: string | null;
  confidence: number | null;
  coordinateAdded: boolean;
  coordinateSource: "wikidata" | "geolonia" | null;
  coordinateCandidateFound: boolean;
  imageCandidateAdded: boolean;
  imageCandidateFound: boolean;
  imageFoundAtRelaxedThreshold: boolean;
  entityCandidateFound: boolean;
  error?: string;
};

export type VenueEnrichmentBatchResult = {
  runId: string;
  processed: number;
  matched: number;
  sourceSelectionRequired: number;
  coordinateAdded: number;
  coordinateCandidateFound: number;
  imageCandidateAdded: number;
  imageCandidateFound: number;
  imageFoundAtRelaxedThreshold: number;
  entityCandidateFound: number;
  noMatch: number;
  errors: Array<{ venueId: string; venueName: string; message: string }>;
  results: VenueEnrichmentResult[];
};
