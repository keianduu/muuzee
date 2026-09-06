export type WorkSourceCandidate = {
  externalId: string;
  sourceKey: "apj_shuzo" | "tomuco";
  sourceUrl: string;
  title: string;
  titleEn: string | null;
  titleOriginal: string | null;
  artistName: string;
  venueName: string | null;
  yearText: string | null;
  createdYearFrom: number | null;
  createdYearTo: number | null;
  holdingType: "collection" | "long_term_loan" | "deposit" | "other" | null;
  presentationType: "permanent" | "temporary" | "unknown" | null;
  presentationStatus: "currently_displayed" | "not_displayed" | "unknown" | null;
  representativeScore: number | null;
  representativeReason: string;
  raw: Record<string, unknown>;
};

export type WorkCoverageRow = {
  artistId: string;
  artistName: string;
  artistFound: boolean;
  workFound: boolean;
  candidateCount: number;
  holdingVenueCount: number;
  venueMatchCount: number;
  yearCount: number;
  permanentCount: number;
  currentDisplayCount: number;
  sourceErrors: string[];
};
