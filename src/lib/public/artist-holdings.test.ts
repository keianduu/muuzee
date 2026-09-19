import { describe, expect, it } from "vitest";
import { composePublicArtistHoldings, type RawArtistWorkRelation } from "./artist-holdings";

const venue = { id: "v1", slug: "museum", name: "Museum", publication_status: "published", is_active: true };

describe("public Artist holding projection", () => {
  it("uses resolved public Artist and Holding relations without requiring Work publication", () => {
    const rows: RawArtistWorkRelation[] = [{
      work_id: "w1", visibility_status: "public",
      works: { id: "w1", collection_holdings: [{ id: "h1", work_id: "w1", visibility_status: "public", venues: venue }] },
    }];
    expect(composePublicArtistHoldings(rows)).toEqual([{ venueId: "v1", venueSlug: "museum", venueName: "Museum", workCount: 1 }]);
  });

  it("excludes either manually hidden relation and deduplicates visible Works per Venue", () => {
    const rows: RawArtistWorkRelation[] = [
      { work_id: "w-hidden-artist", visibility_status: "hidden", works: { id: "w-hidden-artist", collection_holdings: [{ id: "h1", work_id: "w-hidden-artist", visibility_status: "public", venues: venue }] } },
      { work_id: "w-hidden-holding", visibility_status: "public", works: { id: "w-hidden-holding", collection_holdings: [{ id: "h2", work_id: "w-hidden-holding", visibility_status: "hidden", venues: venue }] } },
      { work_id: "w2", visibility_status: "public", works: { id: "w2", collection_holdings: [{ id: "h3", work_id: "w2", visibility_status: "public", venues: venue }, { id: "h4", work_id: "w2", visibility_status: "public", venues: venue }] } },
    ];
    expect(composePublicArtistHoldings(rows)).toEqual([{ venueId: "v1", venueSlug: "museum", venueName: "Museum", workCount: 1 }]);
  });

  it("does not project unpublished or inactive Venues", () => {
    const rows: RawArtistWorkRelation[] = [{ work_id: "w1", visibility_status: "public", works: { id: "w1", collection_holdings: [
      { id: "h1", work_id: "w1", visibility_status: "public", venues: { ...venue, publication_status: "draft" } },
      { id: "h2", work_id: "w1", visibility_status: "public", venues: { ...venue, id: "v2", is_active: false } },
    ] } }];
    expect(composePublicArtistHoldings(rows)).toEqual([]);
  });
});
