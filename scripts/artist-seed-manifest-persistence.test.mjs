import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  APPROVED_ARTIST_STG_PROJECT_REF,
  validateArtistManifest,
  validateArtistManifestTarget,
} from "./lib/artist-seed-manifest-persistence.mjs";

describe("Artist seed manifest persistence", () => {
  it("verifies the committed manifest checksum and eligibility", () => {
    const manifest = JSON.parse(readFileSync("data/artist-acquisition/mvp-artist-seed-manifest.v1.json", "utf8"));
    expect(validateArtistManifest(manifest).artists).toHaveLength(1000);
  });
  it("fails closed for an unapproved remote target", () => {
    expect(() => validateArtistManifestTarget({ stg: false, supabaseUrl: `https://${APPROVED_ARTIST_STG_PROJECT_REF}.supabase.co` })).toThrow("explicit --stg");
    expect(() => validateArtistManifestTarget({ stg: true, projectRef: APPROVED_ARTIST_STG_PROJECT_REF, supabaseUrl: "https://lqinmolonctddovltujy.supabase.co" })).toThrow("approved Artist STG target");
    expect(validateArtistManifestTarget({ stg: true, projectRef: APPROVED_ARTIST_STG_PROJECT_REF, supabaseUrl: `https://${APPROVED_ARTIST_STG_PROJECT_REF}.supabase.co` }).hostname).toBe(`${APPROVED_ARTIST_STG_PROJECT_REF}.supabase.co`);
  });
});
