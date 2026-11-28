import { describe, expect, it } from "vitest";
import { isArtistInitialAcquisitionEnabled, supabaseProjectRef } from "./artist-initial-acquisition-capability";

describe("Artist initial acquisition capability", () => {
  it("defaults to LOCAL only", () => {
    expect(isArtistInitialAcquisitionEnabled({ hosted: false })).toBe(true);
    expect(isArtistInitialAcquisitionEnabled({ hosted: true })).toBe(false);
  });
  it("requires an explicit hosted flag and exact project ref", () => {
    const base = { hosted: true, configuredValue: "true", configuredProjectRef: "steibqgeoqcsfsafaqcv" };
    expect(isArtistInitialAcquisitionEnabled({ ...base, supabaseUrl: "https://steibqgeoqcsfsafaqcv.supabase.co" })).toBe(true);
    expect(isArtistInitialAcquisitionEnabled({ ...base, supabaseUrl: "https://lqinmolonctddovltujy.supabase.co" })).toBe(false);
    expect(isArtistInitialAcquisitionEnabled({ ...base, configuredValue: "false", supabaseUrl: "https://steibqgeoqcsfsafaqcv.supabase.co" })).toBe(false);
  });
  it("parses only canonical Supabase project hosts", () => {
    expect(supabaseProjectRef("https://steibqgeoqcsfsafaqcv.supabase.co")).toBe("steibqgeoqcsfsafaqcv");
    expect(supabaseProjectRef("https://example.com")).toBeNull();
  });
});
