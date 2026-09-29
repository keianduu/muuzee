import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { importWikidataVenues } from "@/lib/wikidata/venue-importer";
import { POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/wikidata/venue-importer", () => ({ importWikidataVenues: vi.fn() }));

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
    expect(importWikidataVenues).toHaveBeenCalledWith({ mode: "full", count: 20, offset: undefined });
  });

  it("preserves hosted count imports", async () => {
    vi.stubEnv("VERCEL", "1");
    const response = await POST(request({ mode: "count", count: 25, offset: 50 }));

    expect(response.status).toBe(200);
    expect(importWikidataVenues).toHaveBeenCalledWith({ mode: "count", count: 25, offset: 50 });
  });
});
