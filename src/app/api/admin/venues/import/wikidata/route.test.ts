import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { importWikidataVenues } from "@/lib/wikidata/venue-importer";
import { GET, POST } from "./route";

const createSupabaseAdminClient = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/wikidata/venue-importer", () => ({ importWikidataVenues: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient }));

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/venues/import/wikidata", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/venues/import/wikidata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(importWikidataVenues).mockResolvedValue({ processed: 0 } as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects hosted full sync before importing", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(request({ mode: "full" }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "hosted_full_sync_not_supported" });
    expect(importWikidataVenues).not.toHaveBeenCalled();
  });

  it("preserves LOCAL full sync routing", async () => {
    vi.stubEnv("VERCEL", "");
    const response = await POST(request({ mode: "full" }));

    expect(response.status).toBe(200);
    expect(importWikidataVenues).toHaveBeenCalledWith({ mode: "full", count: 20, offset: undefined, runtime: "local" });
  });

  it("preserves hosted count imports", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(request({ mode: "count", count: 25, offset: 50 }));

    expect(response.status).toBe(200);
    expect(importWikidataVenues).toHaveBeenCalledWith({ mode: "count", count: 25, offset: 50, runtime: "hosted" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/venues");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/imports");
  });

  it("keeps progress page load read-only", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn(() => ({ maybeSingle }));
    const order = vi.fn(() => ({ limit }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const update = vi.fn();
    createSupabaseAdminClient.mockReturnValue({ from: vi.fn(() => ({ select, update })) });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(update).not.toHaveBeenCalled();
  });
});
