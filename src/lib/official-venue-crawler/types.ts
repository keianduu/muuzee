export const OFFICIAL_CRAWL_FIELDS = [
  "address",
  "postal_code",
  "opening_hours_text",
  "closed_days_text",
  "access_text",
] as const;

export type OfficialCrawlField = (typeof OFFICIAL_CRAWL_FIELDS)[number];
export type OfficialCrawlStatus = "success" | "partial" | "no_official_url" | "robots_blocked" | "fetch_failed" | "parse_failed" | "no_relevant_page" | "timeout";

export type CrawlVenueInput = {
  id: string;
  name: string;
  official_url: string | null;
};

export type FieldCandidate = {
  value: string;
  sourceUrl: string;
  confidence: number;
};

export type OfficialCrawlResult = {
  venue_id: string;
  name: string;
  official_url: string;
  crawl_source_url: string | null;
  crawl_status: OfficialCrawlStatus;
  crawled_at: string;
  address: string;
  postal_code: string;
  opening_hours_text: string;
  closed_days_text: string;
  access_text: string;
  description: string;
  description_source_url: string;
  description_source_text: string;
  official_source_text: string;
  phone: string;
  address_source_url: string;
  postal_code_source_url: string;
  opening_hours_source_url: string;
  closed_days_source_url: string;
  access_source_url: string;
  ambiguous_fields: Record<string, string[]>;
  discovered_urls: string[];
  notes: string;
};

export type OfficialCrawlSummary = {
  requested: number;
  processed: number;
  success: number;
  partial: number;
  blocked: number;
  failed: number;
  coverage: Record<"address" | "postalCode" | "openingHours" | "closedDays" | "access" | "descriptionSource", number>;
};
