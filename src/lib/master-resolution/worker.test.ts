import { describe, expect, it } from "vitest";
import { matchArtistMention } from "@/lib/artist-matching/mention";
import { chooseVenueResolution } from "@/lib/venue-resolution/shared";
import { buildResolutionOverview, clampResolutionBatchSize, isClearVenueCandidate } from "./worker";

describe("targeted master resolution policy", () => {
  it("uses a bounded production-friendly batch", () => {
    expect(clampResolutionBatchSize()).toBe(10);
    expect(clampResolutionBatchSize(0)).toBe(10);
    expect(clampResolutionBatchSize(500)).toBe(50);
  });

  it("requires both confidence and separation for a clear Venue candidate", () => {
    expect(isClearVenueCandidate([{ confidence: 0.9 }])).toBe(true);
    expect(isClearVenueCandidate([{ confidence: 0.9 }, { confidence: 0.72 }])).toBe(true);
    expect(isClearVenueCandidate([{ confidence: 0.9 }, { confidence: 0.8 }])).toBe(false);
    expect(isClearVenueCandidate([{ confidence: 0.84 }])).toBe(false);
  });

  it("reuses one exact Venue Master and stops on duplicate exact identities", () => {
    const one = chooseVenueResolution({ sourceName: "宇都宮美術館" }, [{ id: "v1", name: "宇都宮美術館", nameEn: null, address: null, keyType: "name" }]);
    expect(one).toMatchObject({ status: "resolved", matchMethod: "japanese_normalized_exact" });
    const many = chooseVenueResolution({ sourceName: "Museum X" }, [
      { id: "v1", name: "Museum X", nameEn: null, address: null, keyType: "name" },
      { id: "v2", name: "Museum X", nameEn: null, address: null, keyType: "name" },
    ]);
    expect(many.status).toBe("ambiguous");
  });

  it("matches Artist aliases exactly without partial inference", () => {
    const artists = [{ id: "a1", name: "草間彌生", name_en: "Yayoi Kusama", aliases: ["草間弥生"] }];
    expect(matchArtistMention("草間弥生", artists).status).toBe("matched");
    expect(matchArtistMention("草間", artists).status).toBe("unmatched");
  });

  it("counts the full active overview before bounding diagnostic items", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({ entity_type: "venue" as const, resolution_status: "failed", id: `failed-${index}` }));
    rows.push({ entity_type: "venue", resolution_status: "ambiguous", id: "human-gate" });
    const overview = buildResolutionOverview(rows);

    expect(overview.counts.venueFailed).toBe(101);
    expect(overview.counts.venueAmbiguous).toBe(1);
    expect(overview.items).toHaveLength(1);
    expect(overview.items[0].id).toBe("human-gate");
  });
});
