import { describe, expect, it } from "vitest";
import { APPROVED_ARTIST_CANARY_STG_REF, validateArtistCanaryTarget } from "./lib/artist-canary-target";

describe("Artist acquisition canary target", () => {
  it("caps hosted work at 150 and each batch at 50", () => {
    expect(validateArtistCanaryTarget({ stg: true, projectRef: APPROVED_ARTIST_CANARY_STG_REF, supabaseUrl: `https://${APPROVED_ARTIST_CANARY_STG_REF}.supabase.co`, count: 999, batch: 100 })).toEqual({ count: 150, batch: 50 });
  });
  it("rejects Production and implicit remote targets", () => {
    expect(() => validateArtistCanaryTarget({ stg: false, supabaseUrl: "https://lqinmolonctddovltujy.supabase.co", count: 1, batch: 1 })).toThrow("explicit --stg");
    expect(() => validateArtistCanaryTarget({ stg: true, projectRef: APPROVED_ARTIST_CANARY_STG_REF, supabaseUrl: "https://lqinmolonctddovltujy.supabase.co", count: 1, batch: 1 })).toThrow("approved STG");
  });
});
