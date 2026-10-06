import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DELETE, POST } from "./route";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));

const masterId = "11111111-1111-4111-8111-111111111111";
const tagId = "22222222-2222-4222-8222-222222222222";
const tag = { id: tagId, type: "movement", name: "Impressionism", slug: "impressionism" };
const context = { params: Promise.resolve({ entity: "artists", id: masterId }) };

function fluent(result: Record<string, unknown>) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "upsert", "delete"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return query;
}

function dbWith(results: Array<Record<string, unknown>>) {
  const queries = results.map(fluent);
  const tables: string[] = [];
  const db = {
    from: vi.fn((table: string) => {
      tables.push(table);
      const query = queries.shift();
      if (!query) throw new Error("Unexpected query");
      return query;
    }),
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
  return { db, tables };
}

function request(method: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/admin/masters/artists/${masterId}/tags`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Master Tag assignment route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds an existing Tag relation and returns the canonical Tag", async () => {
    const { db, tables } = dbWith([{ data: { id: masterId }, error: null }, { data: tag, error: null }, { error: null }]);
    const response = await POST(request("POST", { tagId }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ tag, message: "Tagを付与しました。" });
    expect(tables).toEqual(["artists", "tags", "artist_tags"]);
    const relationQuery = vi.mocked(db.from).mock.results[2].value as Record<string, ReturnType<typeof vi.fn>>;
    expect(relationQuery.upsert).toHaveBeenCalledWith(
      { artist_id: masterId, tag_id: tagId },
      { onConflict: "artist_id,tag_id", ignoreDuplicates: true },
    );
  });

  it("keeps repeated assignment idempotent through the relation primary key", async () => {
    const first = dbWith([{ data: { id: masterId }, error: null }, { data: tag, error: null }, { error: null }]);
    expect((await POST(request("POST", { tagId }), context)).status).toBe(200);
    expect((vi.mocked(first.db.from).mock.results[2].value as Record<string, ReturnType<typeof vi.fn>>).upsert).toHaveBeenCalledWith(
      { artist_id: masterId, tag_id: tagId },
      { onConflict: "artist_id,tag_id", ignoreDuplicates: true },
    );

    const second = dbWith([{ data: { id: masterId }, error: null }, { data: tag, error: null }, { error: null }]);
    expect((await POST(request("POST", { tagId }), context)).status).toBe(200);
    expect((vi.mocked(second.db.from).mock.results[2].value as Record<string, ReturnType<typeof vi.fn>>).upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown tagId", async () => {
    const { tables } = dbWith([{ data: { id: masterId }, error: null }, { data: null, error: null }]);
    const response = await POST(request("POST", { tagId }), context);
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "選択したTagが見つかりません。" });
    expect(tables).toEqual(["artists", "tags"]);
  });

  it("does not accept the old name/type creation payload", async () => {
    const response = await POST(request("POST", { name: "New Tag", type: "genre" }), context);
    expect(response.status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("deletes only the relation and leaves the Tag Catalog untouched", async () => {
    const { tables } = dbWith([{ data: { id: masterId }, error: null }, { error: null }]);
    const response = await DELETE(request("DELETE", { tagId }), context);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ removedTagId: tagId });
    expect(tables).toEqual(["artists", "artist_tags"]);
    expect(tables).not.toContain("tags");
  });
});
