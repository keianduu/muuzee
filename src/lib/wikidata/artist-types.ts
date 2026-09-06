export type DiscoveredWikidataArtist = { qid: string };

export type WikidataArtist = {
  qid: string;
  name: string;
  nameEn: string | null;
  nameNative: string | null;
  aliases: string[];
  birthDate: string | null;
  birthYear: number | null;
  deathDate: string | null;
  deathYear: number | null;
  nationalityCountryCode: string | null;
  nationalityQids: string[];
  birthCountryCode: string | null;
  birthPlace: string | null;
  occupation: Array<{ qid: string; label: string | null }>;
  fieldOfWork: Array<{ qid: string; label: string | null }>;
  movement: Array<{ qid: string; label: string | null }>;
  imageFileTitle: string | null;
  commonsCategory: string | null;
  wikipediaArticleTitle: string | null;
  wikipediaLanguage: "ja" | "en" | null;
  officialUrl: string | null;
  raw: unknown;
};

export type ArtistImportCoverage = Record<string, { filled: number; missing: number; percent: number }>;

export type WikidataArtistImportSummary = {
  runId: string; mode: "count" | "full"; requested: number | null; discovered: number; fetched: number; processed: number;
  newArtists: number; linkedExisting: number; updated: number; unchanged: number; sourceSelectionRequired: number;
  imageCandidatesAdded: number; errors: Array<{ qid?: string; message: string }>;
  coverage: ArtistImportCoverage;
  imageCoverage: Record<"wikidataP18" | "commonsCategory" | "wikipediaArticle" | "candidate" | "primary" | "rightsNeedsReview" | "rightsApproved", number>;
  averageCompleteness: number; coreComplete: number;
};
