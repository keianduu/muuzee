import { describe, expect, it } from "vitest";
import { UserRepositoryError } from "./errors";
import { createUserDataRepository, mapActionRow } from "./repository";

function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "in", "order", "insert", "update", "upsert", "delete", "single", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return {
    calls,
    client: {
      from: (table: string) => {
        calls.push(["from", table]);
        return builder;
      },
    },
  };
}

describe("user repository row mapping", () => {
  it("maps an exactly-one canonical entity reference", () => {
    expect(mapActionRow("seen", {
      id: "row-1",
      exhibition_id: null,
      artist_id: "artist-1",
      venue_id: null,
      work_id: null,
      created_at: "2026-09-26T00:00:00Z",
      seen_at: "2026-09-25T00:00:00Z",
    })).toEqual({
      id: "row-1",
      action: "seen",
      entity: { kind: "artist", id: "artist-1" },
      createdAt: "2026-09-26T00:00:00Z",
      seenAt: "2026-09-25T00:00:00Z",
    });
  });

  it.each([
    { id: "none", created_at: "now" },
    { id: "two", artist_id: "artist-1", venue_id: "venue-1", created_at: "now" },
  ])("rejects corrupt zero/multiple-target rows", (row) => {
    expect(() => mapActionRow("saved", row)).toThrow(UserRepositoryError);
  });

  it("reads ArtWall items in sort_order then id order", async () => {
    const { client, calls } = fakeClient({ data: [
      { id: "a", exhibition_id: "exhibition-1", sort_order: 0, is_visible: true },
      { id: "b", exhibition_id: "exhibition-2", sort_order: 0, is_visible: false },
    ], error: null });
    await createUserDataRepository(client as never).getArtWallItems("user-1");
    expect(calls.filter(([method]) => method === "order")).toEqual([
      ["order", "sort_order", { ascending: true }],
      ["order", "id", { ascending: true }],
    ]);
  });

  it("selects only Seen Exhibition IDs for ArtWall candidates", async () => {
    const { client, calls } = fakeClient({ data: [{ exhibition_id: "exhibition-1" }], error: null });
    await expect(createUserDataRepository(client as never).listSeenExhibitionIds("user-1")).resolves.toEqual(["exhibition-1"]);
    expect(calls).toContainEqual(["from", "user_seen_items"]);
    expect(calls).toContainEqual(["select", "exhibition_id"]);
    expect(calls).toContainEqual(["not", "exhibition_id", "is", null]);
  });

  it("keeps only the expected constraint name from duplicate provider errors", async () => {
    const { client } = fakeClient({
      data: null,
      error: { code: "23505", message: "duplicate key violates constraint user_saved_items_artist_uq" },
    });
    await expect(createUserDataRepository(client as never).addAction(
      "user-1", "saved", { kind: "artist", id: "artist-1" },
    )).rejects.toMatchObject({
      providerCode: "23505",
      constraint: "user_saved_items_artist_uq",
    });
  });
});
