import { describe, expect, it } from "vitest";
import { cleanWikipediaAddress, decideWikipediaAddressApplication, extractWikipediaAddress, hasMultipleLocationSignal, isSafeAutomaticWikipediaAddress, wikipediaProvenanceRow, wikipediaSiteFromEntity } from "./venue-address";
import { SOURCE_PRIORITY } from "@/lib/venue-enrichment/source-application";
import { calculateCompleteness } from "@/lib/admin/master-completeness";
import { isWikipediaAddressTarget } from "./venue-enrichment";

describe("Wikipedia Venue address fallback", () => {
  it("resolves Japanese sitelink first and falls back to English", () => {
    expect(wikipediaSiteFromEntity({ sitelinks: { jawiki: { title: "岩手県立美術館" }, enwiki: { title: "Iwate Museum of Art" } } })).toEqual({ language: "ja", title: "岩手県立美術館" });
    expect(wikipediaSiteFromEntity({ sitelinks: { enwiki: { title: "Example Museum" } } })).toEqual({ language: "en", title: "Example Museum" });
    expect(wikipediaSiteFromEntity({ sitelinks: {} })).toBeNull();
  });

  it("extracts and cleans only an explicit Infobox address", () => {
    const result = extractWikipediaAddress("{{美術館|所在地={{JPN}} [[岩手県]][[盛岡市]]本宮字松幅12-3<ref>source</ref>|郵便番号=020-0866}}\n本文では盛岡市にある。");
    expect(result.address).toBe("岩手県盛岡市本宮字松幅12-3");
    expect(result.sourceField).toBe("所在地");
    expect(result.postalCode).toBe("020-0866");
    expect(cleanWikipediaAddress(" [[東京都]]<br> 千代田区 ")).toBe("東京都 千代田区");
  });

  it("removes nested map templates and leading separators from explicit addresses", () => {
    expect(cleanWikipediaAddress("青森県八戸市番町10-4 {{Switcher |{{Maplink2|frame=yes|coord=}} |地図を表示 }}")).toBe("青森県八戸市番町10-4");
    expect(cleanWikipediaAddress("{{JPN}}・[[山梨県]][[北杜市]]長坂町小荒間2000-6")).toBe("山梨県北杜市長坂町小荒間2000-6");
    expect(isSafeAutomaticWikipediaAddress("東京都 {{broken|value", "ja")).toBe(false);
  });

  it("flags an explicitly multi-location entity for higher-confidence resolution", () => {
    expect(hasMultipleLocationSignal("茨城県取手市小文間および東京都台東区上野公園にある美術館")).toBe(true);
    expect(hasMultipleLocationSignal("東京都台東区にある美術館")).toBe(false);
  });

  it("does not infer an address from prose or an absent field", () => {
    expect(extractWikipediaAddress("盛岡市にある美術館。").address).toBeNull();
    expect(extractWikipediaAddress("{{美術館|名称=Example}}").address).toBeNull();
  });

  it("auto-applies one missing value, is idempotent, and preserves conflicts", () => {
    expect(decideWikipediaAddressApplication({ currentAddress: null, incomingAddress: "東京都千代田区1-1" })).toBe("apply");
    expect(decideWikipediaAddressApplication({ currentAddress: "東京都千代田区1-1", currentSource: "wikipedia", incomingAddress: "東京都 千代田区 1-1" })).toBe("unchanged");
    expect(decideWikipediaAddressApplication({ currentAddress: "公式住所", currentSource: "official_website", incomingAddress: "Wikipedia住所" })).toBe("conflict");
    expect(decideWikipediaAddressApplication({ currentAddress: "手動住所", currentSource: "manual", incomingAddress: "Wikipedia住所" })).toBe("conflict");
  });

  it("accepts Japanese automatic values and emits non-AI provenance", () => {
    expect(isSafeAutomaticWikipediaAddress("岩手県盛岡市", "ja")).toBe(true);
    expect(isSafeAutomaticWikipediaAddress("1 Museum Road", "en")).toBe(false);
    expect(wikipediaProvenanceRow({ venueId: "v", sourceRecordId: "s", articleUrl: "https://ja.wikipedia.org/wiki/X", address: "住所" })).toMatchObject({ source: "wikipedia", generated_by_ai: false, review_status: "applied", is_current: true, value_snapshot: "住所" });
  });

  it("places Wikipedia between Official Website and Wikidata for source application", () => {
    expect(SOURCE_PRIORITY.official_website).toBeGreaterThan(SOURCE_PRIORITY.wikipedia);
    expect(SOURCE_PRIORITY.wikipedia).toBeGreaterThan(SOURCE_PRIORITY.wikidata);
  });

  it("keeps postal code optional in Venue MVP completeness", () => {
    const result = calculateCompleteness("venues", { name: "Venue", address: "Address", latitude: 1, longitude: 1, description: "Description", opening_hours_text: "10-18", media_assets: [{ is_primary: true }] });
    expect(result.percent).toBe(100);
    expect(result.items.some((item) => item.key === "postal_code")).toBe(false);
  });

  it("skips an existing address unless an explicit recheck is requested", () => {
    const venue = { id: "v", address: "東京都千代田区", best_wikidata_candidate_qid: "Q1" };
    expect(isWikipediaAddressTarget(venue)).toBe(false);
    expect(isWikipediaAddressTarget(venue, { force: true })).toBe(true);
  });

  it("recalculates Venue completeness when Address is added", () => {
    const common = { name: "Venue", latitude: 1, longitude: 1, description: "Description", opening_hours_text: "10-18", media_assets: [{ is_primary: true }] };
    expect(calculateCompleteness("venues", common).percent).toBe(83);
    expect(calculateCompleteness("venues", { ...common, address: "東京都千代田区" }).percent).toBe(100);
  });
});
