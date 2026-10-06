import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

function tagQuery(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "or"]) query[method] = vi.fn(() => query);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

describe("GET /api/admin/tags", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only the existing Tag Catalog projection", async () => {
    const query = tagQuery({ data: [{ id: "11111111-1111-4111-8111-111111111111", type: "genre", name: "Landscape", slug: "landscape" }], error: null });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({ from: vi.fn(() => query) } as never);
    const response = await GET(new Request("http://localhost/api/admin/tags?type=genre&q=land"));
    await expect(response.json()).resolves.toEqual({ tags: [{ id: "11111111-1111-4111-8111-111111111111", type: "genre", name: "Landscape", slug: "landscape" }] });
    expect(query.select).toHaveBeenCalledWith("id,type,name,slug");
    expect(query.eq).toHaveBeenCalledWith("type", "genre");
    expect(query.or).toHaveBeenCalledWith("name.ilike.%land%,slug.ilike.%land%");
  });

  it("rejects unknown Tag types", async () => {
    const response = await GET(new Request("http://localhost/api/admin/tags?type=custom"));
    expect(response.status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
