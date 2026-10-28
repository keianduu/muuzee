import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWikidataEntities } from "@/lib/wikidata/client";
import { getCommonsImageMetadata, listCommonsCategoryFiles, listWikipediaArticleImages } from "@/lib/wikimedia-commons/client";
import { autoSetPreferredVenueCandidatePrimary } from "@/lib/admin/venue-primary-image";
import { saveVenueImageDiscovery } from "./image-discovery";

vi.mock("@/lib/wikidata/client", () => ({ getWikidataEntities: vi.fn() }));
vi.mock("@/lib/wikimedia-commons/client", () => ({
  getCommonsImageMetadata: vi.fn(),
  listCommonsCategoryFiles: vi.fn(),
  listWikipediaArticleImages: vi.fn(),
}));
vi.mock("@/lib/admin/venue-primary-image", () => ({ autoSetPreferredVenueCandidatePrimary: vi.fn() }));

function metadata(fileTitle: string) {
  return {
    fileTitle: fileTitle.startsWith("File:") ? fileTitle : `File:${fileTitle}`,
    imageUrl: `https://upload.example/${encodeURIComponent(fileTitle)}`,
    thumbnailUrl: null,
    sourceUrl: `https://commons.example/${encodeURIComponent(fileTitle)}`,
    author: "Author",
    credit: "Credit",
    licenseShortName: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    usageTerms: "Attribution",
    raw: { query: { pages: { image: { title: fileTitle, imageinfo: [{ url: `https://upload.example/${encodeURIComponent(fileTitle)}` }] } } } },
  };
}

function createDb() {
  let sourceSequence = 0;
  let candidateSequence = 0;
  const candidateWrites: Array<Record<string, unknown>> = [];
  const db = {
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = { operation: "select", payload: null };
      for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
      query.upsert = vi.fn((payload: Record<string, unknown>) => {
        query.operation = "upsert";
        query.payload = payload;
        return query;
      });
      query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
      query.single = vi.fn(async () => {
        if (table === "data_sources") return { data: { id: "commons-source" }, error: null };
        if (table === "source_records") return { data: { id: `source-${++sourceSequence}` }, error: null };
        if (table === "source_image_candidates" && query.operation === "upsert") {
          candidateWrites.push(query.payload as Record<string, unknown>);
          return { data: { id: `candidate-${++candidateSequence}` }, error: null };
        }
        return { data: null, error: null };
      });
      return query;
    }),
  };
  return { db: db as unknown as SupabaseClient, candidateWrites };
}

describe("Venue image discovery persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWikidataEntities).mockResolvedValue([{
      id: "Q123",
      labelJa: "Example Museum",
      labelEn: "Example Museum",
      aliases: [],
      description: null,
      officialUrl: null,
      latitude: null,
      longitude: null,
      imageFileTitle: "Example Museum.jpg",
      countryId: "Q17",
      commonsCategory: "Example Museum",
      wikipediaArticleTitle: "Example Museum",
      raw: { sitelinks: { jawiki: {} } },
    }]);
    vi.mocked(listCommonsCategoryFiles).mockResolvedValue(["File:Example Museum exterior.jpg"]);
    vi.mocked(listWikipediaArticleImages).mockResolvedValue(["File:Example Museum interior.jpg"]);
    vi.mocked(getCommonsImageMetadata).mockImplementation(async (fileTitle) => metadata(fileTitle));
    vi.mocked(autoSetPreferredVenueCandidatePrimary).mockResolvedValue({ changed: false, reason: "multiple_candidates" });
  });

  it("returns all persisted candidates without image diagnostics when discovery succeeds", async () => {
    const { db, candidateWrites } = createDb();
    const result = await saveVenueImageDiscovery(db, {
      venueId: "venue-1",
      qid: "Q123",
      venueName: "Example Museum",
    });

    expect(result).toMatchObject({ added: 3, errors: [] });
    expect(result.saved).toHaveLength(3);
    expect(candidateWrites).toHaveLength(3);
    expect(candidateWrites.every((row) => row.review_status === "unreviewed" && row.rights_status === "needs_review")).toBe(true);
  });

  it("keeps partial progress when a later Commons metadata lookup fails", async () => {
    const { db, candidateWrites } = createDb();
    vi.mocked(getCommonsImageMetadata).mockImplementation(async (fileTitle) => {
      if (vi.mocked(getCommonsImageMetadata).mock.calls.length === 3) throw new Error("Commons unavailable");
      return metadata(fileTitle);
    });

    const result = await saveVenueImageDiscovery(db, {
      venueId: "venue-1",
      qid: "Q123",
      venueName: "Example Museum",
    });

    expect(result.added).toBe(2);
    expect(result.saved).toHaveLength(2);
    expect(candidateWrites).toHaveLength(2);
    expect(result.errors).toEqual([expect.objectContaining({ stage: "metadata", message: "Commons unavailable" })]);
  });
});
