import { describe, expect, it } from "vitest";
import { chooseExternalVenueResolution, chooseVenueResolution, hasMultipleVenueLikeValues, normalizeVenueSearchKey } from "./shared";

const candidate = (id: string, keyType: "name" | "name_en" | "alias" | "official_url" = "name") => ({ id, name: id, nameEn: null, address: null, keyType });

describe("Shared Venue Resolver policy", () => {
  it("uses conservative Unicode/case/whitespace normalization without deleting punctuation", () => {
    expect(normalizeVenueSearchKey("  ＡＢＣ　Museum  ")).toBe("abc museum");
    expect(normalizeVenueSearchKey("KUNST-ARZT")).not.toBe(normalizeVenueSearchKey("KUNST ARZT"));
  });
  it("resolves one exact candidate and never selects ambiguous top-1", () => {
    expect(chooseVenueResolution({ sourceName: "山梨県立美術館" }, [candidate("yamanashi")])).toMatchObject({ status: "resolved", venueId: "yamanashi" });
    expect(chooseVenueResolution({ sourceName: "Same" }, [candidate("a"), candidate("b")])).toMatchObject({ status: "ambiguous", venueId: null, candidateIds: ["a", "b"] });
  });
  it("uses a unique external source mapping before name matching", () => {
    expect(chooseExternalVenueResolution(["mapped"])).toMatchObject({ status: "resolved", venueId: "mapped", matchMethod: "source_external_id_exact" });
    expect(chooseExternalVenueResolution(["a", "b"])).toMatchObject({ status: "ambiguous", venueId: null });
    expect(chooseExternalVenueResolution([])).toBeNull();
  });
  it("supports exact English and alias keys without substring matching", () => {
    expect(chooseVenueResolution({ sourceName: "The Museum" }, [candidate("en", "name_en")])).toMatchObject({ status: "resolved", matchMethod: "english_normalized_exact" });
    expect(chooseVenueResolution({ sourceName: "NMWA" }, [candidate("alias", "alias")])).toMatchObject({ status: "resolved", matchMethod: "alias_normalized_exact" });
    expect(chooseVenueResolution({ sourceName: "Museum" }, [])).toMatchObject({ status: "unresolved", venueId: null });
  });
  it("prefers primary Japanese name over aliases and protects an existing relation", () => {
    expect(chooseVenueResolution({ sourceName: "Museum" }, [candidate("alias", "alias"), candidate("name", "name")]).venueId).toBe("name");
    expect(chooseVenueResolution({ sourceName: "Different", existingVenueId: "kept" }, [])).toMatchObject({ status: "resolved", venueId: "kept", matchMethod: "existing_canonical_relation_protected" });
  });
  it("keeps multi-venue source strings unresolved", () => {
    expect(hasMultipleVenueLikeValues("A / B")).toBe(true);
    expect(chooseVenueResolution({ sourceName: "A / B" }, [candidate("a")])).toMatchObject({ status: "unresolved", matchMethod: "multiple_venue_values" });
  });
  it("does not depend on a 1,000-row candidate window", () => {
    const onlyDbCandidate = candidate("row-4980");
    expect(chooseVenueResolution({ sourceName: "山梨県立美術館" }, [onlyDbCandidate]).venueId).toBe("row-4980");
  });
});
