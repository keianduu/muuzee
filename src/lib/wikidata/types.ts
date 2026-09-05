export type WikidataVenueCandidate = {
  id: string;
  labelJa: string | null;
  labelEn: string | null;
  aliases: string[];
  description: string | null;
  officialUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  imageFileTitle: string | null;
  countryId: string | null;
  raw: unknown;
};

export type ScoredWikidataCandidate = WikidataVenueCandidate & {
  confidence: number;
  reasons: string[];
  suggestedStatus: "matched" | "candidate";
};
