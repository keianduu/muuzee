import { describe, expect, it } from "vitest";
import { mediaAssetMetadataFromCandidate, chooseAutoPrimaryCandidate } from "./primary-image-policy";

describe("shared Venue / Artist primary image policy", () => {
  const candidate = (id: string, source: string, extra = {}) => ({ id, discovery_source: source, is_active: true, rights_status: "needs_review", ...extra });

  it("protects an existing primary", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 1, candidates: [candidate("p18", "wikidata_p18")] }).reason).toBe("primary_exists");
  });

  it("prefers P18 with one or multiple candidates", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18")] })).toMatchObject({ candidateId: "p18", reason: "wikidata_p18" });
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("fallback", "wikipedia_article"), candidate("p18", "wikidata_p18"), candidate("other", "commons_category")] })).toMatchObject({ candidateId: "p18", reason: "wikidata_p18" });
  });

  it("excludes rejected or inactive P18 candidates", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { rights_status: "rejected" })] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { review_status: "rejected" })] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("p18", "wikidata_p18", { is_active: false })] }).candidateId).toBeNull();
  });

  it("uses one fallback but leaves multiple non-P18 candidates to a human", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("one", "wikipedia_article")] })).toMatchObject({ candidateId: "one", reason: "single_candidate" });
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("one", "wikipedia_article"), candidate("two", "commons_category")] })).toMatchObject({ candidateId: null, reason: "multiple_candidates_without_p18" });
  });

  it("preserves candidate rights and attribution metadata without approving rights", () => {
    const metadata = mediaAssetMetadataFromCandidate({ provider: "wikimedia_commons", source_url: "https://commons.test/file", credit: "Credit", usage_terms: "Attribution", license_short_name: "CC BY 4.0", license_url: "https://license.test", author: "Author", rights_status: "needs_review" });
    expect(metadata).toEqual({ source_type: "wikimedia", source_url: "https://commons.test/file", credit: "Credit", usage_note: "Attribution", reported_license: "CC BY 4.0", reported_license_url: "https://license.test", reported_author: "Author", reported_usage_terms: "Attribution", rights_status: "needs_review" });
  });
});
