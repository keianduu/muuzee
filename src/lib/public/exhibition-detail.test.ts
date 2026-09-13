import { describe, expect, it } from "vitest";
import { composeExhibitionDetail, type RawPublicExhibition } from "./exhibition-detail";

const base: RawPublicExhibition = {
  id: "exhibition-1",
  slug: "sample-exhibition",
  title: "Sample Exhibition",
  title_en: null,
  description: "Description",
  exhibition_type: "企画展",
  official_url: null,
  publication_status: "published",
  media_assets: [
    { id: "hero", storage_path: "hero.jpg", credit: "Credit", rights_status: "approved", valid_until: null, is_primary: true },
  ],
  exhibition_occurrences: [
    {
      id: "occurrence-active",
      start_date: "2026-09-10",
      end_date: "2026-10-10",
      opening_hours_text: null,
      closed_days_text: null,
      ticket_url: null,
      relation_status: "active",
      venues: {
        id: "venue-1", slug: "venue-1", name: "Published Venue", name_en: null, venue_type: "museum",
        address: "Tokyo", prefecture: "東京都", city: "港区", country_code: "JP", latitude: 35, longitude: 139,
        publication_status: "published", is_active: true,
      },
    },
    {
      id: "occurrence-stale",
      start_date: "2026-08-01",
      end_date: "2026-08-31",
      opening_hours_text: null,
      closed_days_text: null,
      ticket_url: null,
      relation_status: "stale",
      venues: {
        id: "venue-2", slug: "venue-2", name: "Stale Venue", name_en: null, venue_type: "museum",
        address: null, prefecture: null, city: null, country_code: "JP", latitude: null, longitude: null,
        publication_status: "published", is_active: true,
      },
    },
  ],
  exhibition_artists: [
    {
      id: "relation-1", role: "Artist", sort_order: 2, relation_status: "active",
      artists: {
        id: "artist-1", slug: "artist-1", name: "Published Artist", name_en: null,
        nationality_country_code: "JP", publication_status: "published",
        media_assets: [{ id: "artist-image", storage_path: "artist.jpg", credit: null, rights_status: "approved", valid_until: null, is_primary: true }],
      },
    },
    {
      id: "relation-2", role: null, sort_order: 1, relation_status: "active",
      artists: {
        id: "artist-draft", slug: "artist-draft", name: "Draft Artist", name_en: null,
        nationality_country_code: null, publication_status: "draft", media_assets: [],
      },
    },
  ],
  exhibition_tags: [{ tags: { id: "tag-1", type: "theme", name: "Modern", slug: "modern" } }],
};

describe("composeExhibitionDetail", () => {
  it("keeps only active relations backed by published masters", async () => {
    const detail = await composeExhibitionDetail(base, async (path) => `https://cdn.test/${path}`, "2026-09-13");
    expect(detail.occurrences.map((item) => item.id)).toEqual(["occurrence-active"]);
    expect(detail.artists.map((item) => item.id)).toEqual(["artist-1"]);
  });

  it("maps approved primary media and relation-backed detail data", async () => {
    const detail = await composeExhibitionDetail(base, async (path) => `https://cdn.test/${path}`, "2026-09-13");
    expect(detail.hero).toEqual({ url: "https://cdn.test/hero.jpg", credit: "Credit" });
    expect(detail.artists[0].image?.url).toBe("https://cdn.test/artist.jpg");
    expect(detail.tags[0].slug).toBe("modern");
  });

  it("drops expired or unapproved media without dropping the exhibition", async () => {
    const detail = await composeExhibitionDetail({
      ...base,
      media_assets: [
        { id: "hero", storage_path: "hero.jpg", credit: null, rights_status: "approved", valid_until: "2026-09-12", is_primary: true },
      ],
    }, async (path) => `https://cdn.test/${path}`, "2026-09-13");
    expect(detail.hero).toBeNull();
    expect(detail.title).toBe("Sample Exhibition");
  });
});
