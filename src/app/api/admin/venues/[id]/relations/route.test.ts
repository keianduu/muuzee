import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DELETE, PATCH, POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const venueId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
const relationId = "33333333-3333-4333-8333-333333333333";

function fluent(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "is", "insert", "update", "delete"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function dbWith(results: Array<Record<string, unknown>>) {
  const queries = results.map(fluent);
  const db = {
    from: vi.fn(() => {
      const query = queries.shift();
      if (!query) throw new Error("Unexpected query");
      return query;
    }),
    rpc: vi.fn(async () => ({ data: "public", error: null })),
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
  return db;
}

function request(method: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/admin/venues/${venueId}/relations`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = { params: Promise.resolve({ id: venueId }) };

describe("Venue relation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a manual public holding without duplicating Work-side rules", async () => {
    const db = dbWith([{ data: null, error: null }, { data: { id: relationId }, error: null }]);
    const response = await POST(request("POST", { kind: "holding", targetId }), context);
    expect(response.status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith("relation_default_visibility", { p_source: "manual", p_assertion_type: "collection_holding" });
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("returns the existing holding instead of creating a duplicate", async () => {
    const db = dbWith([{ data: { id: relationId }, error: null }]);
    const response = await POST(request("POST", { kind: "holding", targetId }), context);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, id: relationId });
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("returns the existing pure Exhibition occurrence instead of duplicating it", async () => {
    const db = dbWith([{ data: { id: relationId }, error: null }]);
    const response = await POST(request("POST", { kind: "exhibition", targetId }), context);
    await expect(response.json()).resolves.toMatchObject({ duplicate: true, id: relationId });
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("updates holding visibility without deleting the relation", async () => {
    const db = dbWith([{ data: { id: relationId, visibility_status: "public" }, error: null }, { error: null }]);
    const response = await PATCH(request("PATCH", { kind: "holding", relationId, visibility: "hidden" }), context);
    expect(response.status).toBe(200);
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("updates Exhibition occurrence visibility independently of relation_status", async () => {
    const db = dbWith([{ data: { id: relationId, visibility_status: "hidden" }, error: null }, { error: null }]);
    const response = await PATCH(request("PATCH", { kind: "exhibition", relationId, visibility: "public" }), context);
    expect(response.status).toBe(200);
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("blocks hiding the only visible occurrence of a published Exhibition", async () => {
    const db = dbWith([
      { data: { id: relationId, exhibition_id: targetId, relation_status: "active", visibility_status: "public", exhibitions: { publication_status: "published" } }, error: null },
      { count: 1, error: null },
    ]);
    const response = await PATCH(request("PATCH", { kind: "exhibition", relationId, visibility: "hidden" }), context);
    expect(response.status).toBe(400);
    expect(db.from).toHaveBeenCalledTimes(2);
  });

  it("deletes a holding relation after the UI confirmation boundary", async () => {
    const db = dbWith([{ error: null }]);
    const response = await DELETE(request("DELETE", { kind: "holding", relationId }), context);
    expect(response.status).toBe(200);
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it("blocks deleting the only visible occurrence of a published Exhibition", async () => {
    const db = dbWith([
      { data: { id: relationId, exhibition_id: targetId, relation_status: "active", visibility_status: "public", exhibitions: { publication_status: "published" } }, error: null },
      { count: 1, error: null },
    ]);
    const response = await DELETE(request("DELETE", { kind: "exhibition", relationId }), context);
    expect(response.status).toBe(400);
    expect(db.from).toHaveBeenCalledTimes(2);
  });
});
