import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changedVenueValues, recordVenueEditProvenance, venueFieldSource } from "./venue-manual-provenance";

describe("Venue manual provenance", () => {
  it("records only fields whose normalized values changed", () => {
    expect(changedVenueValues(
      { name: "Museum", city: "Tokyo", latitude: 35, description: null },
      { name: "Museum", city: "Minato", latitude: 35, description: "New" },
    )).toEqual({ city: "Minato", description: "New" });
  });

  it("retains supported provider hints and rejects unrelated hints", () => {
    expect(venueFieldSource("latitude", { latitude: "geolonia" })).toBe("geolonia");
    expect(venueFieldSource("postal_code", { postal_code: "japan_post" })).toBe("japan_post");
    expect(venueFieldSource("name", { name: "geolonia" })).toBe("manual");
    expect(venueFieldSource("address", {})).toBe("manual");
  });

  it("replaces provenance only for the changed fields", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const inserts: Array<Record<string, unknown>> = [];
    const db = { from: () => {
      let operation = ""; let payload: Record<string, unknown> = {};
      const query: Record<string, unknown> = {};
      query.update = (value: Record<string, unknown>) => { operation = "update"; payload = value; return query; };
      query.insert = (value: Record<string, unknown>) => { operation = "insert"; payload = value; return query; };
      query.eq = () => query;
      query.then = (resolve: (value: { error: null }) => unknown) => {
        if (operation === "update") updates.push(payload);
        if (operation === "insert") inserts.push(payload);
        return Promise.resolve({ error: null }).then(resolve);
      };
      return query;
    } } as unknown as SupabaseClient;
    await recordVenueEditProvenance(db, "venue-1", { city: "港区", latitude: 35.6 }, { latitude: "geolonia" });
    expect(updates).toHaveLength(2);
    expect(inserts).toEqual([
      expect.objectContaining({ field_name: "city", source: "manual", value_snapshot: "港区" }),
      expect.objectContaining({ field_name: "latitude", source: "geolonia", value_snapshot: 35.6 }),
    ]);
  });
});
