import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importWikidataArtists } from "@/lib/wikidata/artist-importer";
import { resolveWikidataArtistNames } from "@/lib/wikidata/artist-discovery";
import { runArtistInitialAcquisition } from "@/lib/wikidata/artist-initial-acquisition";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/wikidata/artist-importer", () => ({ importWikidataArtists: vi.fn() }));
vi.mock("@/lib/wikidata/artist-discovery", () => ({ resolveWikidataArtistNames: vi.fn() }));
vi.mock("@/lib/wikidata/artist-initial-acquisition", () => ({ runArtistInitialAcquisition: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn(() => ({ marker: "db" })) }));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/artists/import/wikidata", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/artists/import/wikidata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(importWikidataArtists).mockResolvedValue({ processed: 0 } as never);
    vi.mocked(resolveWikidataArtistNames).mockResolvedValue([]);
    vi.mocked(runArtistInitialAcquisition).mockResolvedValue({ runId: "run", claimed: 0 } as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects hosted full sync before resolving or importing", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(request({ mode: "full" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "hosted_full_sync_not_supported" });
    expect(resolveWikidataArtistNames).not.toHaveBeenCalled();
    expect(importWikidataArtists).not.toHaveBeenCalled();
  });

  it("preserves LOCAL full sync routing", async () => {
    vi.stubEnv("VERCEL", "");
    const response = await POST(request({ mode: "full" }));

    expect(response.status).toBe(200);
    expect(importWikidataArtists).toHaveBeenCalledWith({ mode: "full", count: 20, offset: undefined, qids: [] });
  });

  it("preserves hosted count and targeted QID imports", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await POST(request({ mode: "count", count: 25, offset: 50 }))).status).toBe(200);
    expect(importWikidataArtists).toHaveBeenLastCalledWith({ mode: "count", count: 25, offset: 50, qids: [] });

    expect((await POST(request({ qids: ["Q42", "invalid"] }))).status).toBe(200);
    expect(importWikidataArtists).toHaveBeenLastCalledWith({ mode: "count", count: 20, offset: undefined, qids: ["Q42"] });
  });

  it("requires both the hosted feature flag and exact Supabase project target for manifest inventory", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ARTIST_INITIAL_ACQUISITION_ENABLED", "true");
    vi.stubEnv("ARTIST_INITIAL_ACQUISITION_PROJECT_REF", "steibqgeoqcsfsafaqcv");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://different-project.supabase.co");
    expect((await POST(request({ mode: "manifest_inventory", count: 50 }))).status).toBe(403);
    expect(runArtistInitialAcquisition).not.toHaveBeenCalled();

    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://steibqgeoqcsfsafaqcv.supabase.co");
    expect((await POST(request({ mode: "manifest_inventory", count: 80 }))).status).toBe(200);
    expect(runArtistInitialAcquisition).toHaveBeenCalledWith(expect.anything(), { limit: 80 });
  });
});
