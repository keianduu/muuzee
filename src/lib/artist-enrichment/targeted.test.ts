import { describe, expect, it } from "vitest";
import { ARTIST_NATIONALITY_SOURCE_PRIORITY, shouldApplyArtistNationality } from "./targeted";

describe("targeted artist enrichment policy", () => {
  it("preserves the documented source priority", () => {
    expect(ARTIST_NATIONALITY_SOURCE_PRIORITY.manual).toBeGreaterThan(ARTIST_NATIONALITY_SOURCE_PRIORITY.official_website);
    expect(ARTIST_NATIONALITY_SOURCE_PRIORITY.apj_daj).toBeGreaterThan(ARTIST_NATIONALITY_SOURCE_PRIORITY.getty_ulan);
    expect(ARTIST_NATIONALITY_SOURCE_PRIORITY.getty_ulan).toBeGreaterThan(ARTIST_NATIONALITY_SOURCE_PRIORITY.wikidata);
  });

  it("never overwrites an existing nationality", () => {
    expect(shouldApplyArtistNationality("JP", "wikidata", "getty_ulan")).toBe(false);
  });

  it("allows an explicit Getty value only into an empty field", () => {
    expect(shouldApplyArtistNationality(null, null, "getty_ulan")).toBe(true);
  });
});
