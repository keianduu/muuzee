import { describe, expect, it } from "vitest";
import { createOfficialAiEnrichmentCsv, createOfficialCrawlCsv } from "./csv";
import type { OfficialCrawlResult } from "./types";

describe("official crawl CSV", () => {
  it("exports import metadata and field source URLs", () => {
    const row = {
      venue_id: "v1", name: "Museum, A", official_url: "https://museum.example", crawl_source_url: "https://museum.example/access",
      crawl_status: "partial", crawled_at: "2026-09-05T00:00:00.000Z", address: "東京都千代田区1-1", postal_code: "100-0001",
      opening_hours_text: "10:00-18:00", closed_days_text: "月曜日", access_text: "東京駅から徒歩10分", description: "", description_source_url: "https://museum.example/about", description_source_text: "公式紹介", phone: "", address_source_url: "https://museum.example/access", postal_code_source_url: "", opening_hours_source_url: "", closed_days_source_url: "", access_source_url: "", ambiguous_fields: {}, discovered_urls: [], notes: "",
      official_source_text: "[Source URL: https://museum.example/about]\n公式本文",
    } satisfies OfficialCrawlResult;
    const csv = createOfficialCrawlCsv([row]);
    expect(csv).toContain("source_type"); expect(csv).toContain("official_website"); expect(csv).toContain("address_source_url"); expect(csv).toContain('"Museum, A"');
  });

  it("exports an AI enrichment transport with official evidence and confidence columns", () => {
    const row = {
      venue_id: "v1", name: "Museum A", official_url: "https://museum.example", crawl_source_url: "https://museum.example/access",
      crawl_status: "partial", crawled_at: "2026-09-05T00:00:00.000Z", address: "", postal_code: "", opening_hours_text: "", closed_days_text: "", access_text: "", description: "",
      description_source_url: "https://museum.example/about", description_source_text: "公式紹介", official_source_text: "[Source URL: https://museum.example/about]\n公式本文", phone: "",
      address_source_url: "", postal_code_source_url: "", opening_hours_source_url: "", closed_days_source_url: "", access_source_url: "", ambiguous_fields: {}, discovered_urls: [], notes: "",
    } satisfies OfficialCrawlResult;
    const csv = createOfficialAiEnrichmentCsv([row]);
    expect(csv).toContain("official_source_text");
    expect(csv).toContain("generated_by_ai");
    expect(csv).toContain("description_confidence");
    expect(csv).toContain("[Source URL: https://museum.example/about]");
  });
});
