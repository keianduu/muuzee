import { describe, expect, it } from "vitest";
import { artistImageStatus, artistQuality, compareArtistQuality, effectiveArtistTier, tiersForArtistFilter } from "./artist-priority";

const artist = (id: string, tier: string | null, fields: Record<string, unknown> = {}) => ({
  id,
  name: id,
  name_en: null,
  nationality_country_code: null,
  auto_priority_tier: tier,
  manual_priority_tier: null,
  media_assets: [],
  source_records: [],
  ...fields,
});

describe("artist priority and four-field core quality", () => {
  it("uses the shared A/B/C framework and manual override", () => {
    expect(tiersForArtistFilter("A-B")).toEqual(["A", "B"]);
    expect(effectiveArtistTier({ auto_priority_tier: "C", manual_priority_tier: "A" })).toBe("A");
  });

  it("counts only Name, Name EN, Nationality and Primary Image", () => {
    const result = artistQuality(artist("草間彌生", "A", {
      name_en: "Yayoi Kusama",
      nationality_country_code: "JP",
      description: null,
      media_assets: [{ is_primary: true, rights_status: "needs_review" }],
    }));
    expect(result.completeness).toMatchObject({ met: 4, total: 4, percent: 100 });
    expect(result.missing).toEqual({ name: false, nameEn: false, nationality: false, primaryImage: false });
  });

  it("sorts tier first and lower quality first within a tier", () => {
    const rows = [
      artist("C", "C"),
      artist("A complete", "A", { name_en: "A", nationality_country_code: "JP", media_assets: [{ is_primary: true }] }),
      artist("A incomplete", "A"),
      artist("B", "B"),
    ].sort(compareArtistQuality);
    expect(rows.map((row) => row.id)).toEqual(["A incomplete", "A complete", "B", "C"]);
  });

  it("uses the same image-status labels as Venue", () => {
    expect(artistImageStatus(artist("none", "A"))).toBe("画像なし");
    expect(artistImageStatus(artist("rejected", "A", { source_records: [{ source_image_candidates: [{ is_active: true, rights_status: "rejected" }] }] }))).toBe("画像なし");
    expect(artistImageStatus(artist("candidate", "A", { source_records: [{ source_image_candidates: [{ is_active: true }, { is_active: true }] }] }))).toBe("複数Candidate / 選択必要");
    expect(artistImageStatus(artist("pending", "A", { media_assets: [{ is_primary: true, rights_status: "needs_review" }] }))).toBe("Primaryあり / Rights未確認");
    expect(artistImageStatus(artist("approved", "A", { media_assets: [{ is_primary: true, rights_status: "approved" }] }))).toBe("Primaryあり / Rights確認済み");
  });
});
