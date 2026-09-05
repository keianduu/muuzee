import { describe, expect, it } from "vitest";
import { buildCsvPreview, parseCsv, summarizeCsvPreview } from "./master-csv";

describe("Master CSV", () => {
  it("parses quoted cells", () => {
    expect(parseCsv('id,name,description\r\n,"Museum, A","A ""quoted"" note"')[0]).toEqual({ id: "", name: "Museum, A", description: 'A "quoted" note' });
  });

  it("classifies one new, update, unchanged and invalid row", () => {
    const existing = new Map([
      ["11111111-1111-4111-8111-111111111111", { id: "11111111-1111-4111-8111-111111111111", name: "Old", venue_type: "museum", is_active: true, publication_status: "draft" }],
      ["22222222-2222-4222-8222-222222222222", { id: "22222222-2222-4222-8222-222222222222", name: "Same", venue_type: "museum", is_active: true, publication_status: "draft" }],
    ]);
    const base = { name_en: "", name_native: "", aliases: "", venue_type: "museum", country_code: "", region: "", prefecture: "", city: "", district: "", postal_code: "", address: "", latitude: "", longitude: "", official_url: "", description: "", access_text: "", opening_hours_text: "", closed_days_text: "", opening_note: "", is_active: "true", publication_status: "draft" };
    const rows = buildCsvPreview("venues", [
      { id: "", name: "New", ...base },
      { id: "11111111-1111-4111-8111-111111111111", name: "Updated", ...base },
      { id: "22222222-2222-4222-8222-222222222222", name: "Same", ...base },
      { id: "", name: "", ...base },
    ], existing, new Map());
    expect(summarizeCsvPreview(rows)).toMatchObject({ new: 1, update: 1, unchanged: 1, invalid: 1 });
  });

  it("marks manual approved fields as conflicts", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const existing = new Map([[id, { id, name: "Human name", publication_status: "draft" }]]);
    const rows = buildCsvPreview("artists", [{ id, name: "CSV name", publication_status: "draft" }], existing, new Map([[id, [{ field_name: "name", source: "manual", review_status: "approved", is_current: true }]]]));
    expect(rows[0].conflicts).toEqual(["name"]);
  });

  it("applies official website fields partially and preserves unrelated fields", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const current = { id, name: "Museum A", address: "Old address", description: "Keep me", publication_status: "draft" };
    const rows = buildCsvPreview("venues", [{ id, name: "Museum A", source_type: "official_website", address: "New address", address_source_url: "https://museum.example/access" }], new Map([[id, current]]), new Map());
    expect(rows[0]).toMatchObject({ status: "update", changedFields: ["address"], sourceType: "official_website", fieldSourceUrls: { address: "https://museum.example/access" } });
    expect(rows[0].values).not.toHaveProperty("description");
  });

  it("protects manual values from official website overwrite and allows official recrawl diff", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const current = { id, name: "Museum A", address: "Old address", opening_hours_text: "10:00–17:00", publication_status: "draft" };
    const csv = { id, name: "Museum A", source_type: "official_website", address: "New address", opening_hours_text: "10:00–18:00" };
    const manual = buildCsvPreview("venues", [csv], new Map([[id, current]]), new Map([[id, [{ field_name: "address", source: "manual", review_status: "approved", is_current: true }]]]));
    expect(manual[0].conflicts).toEqual(["address"]);
    const recrawl = buildCsvPreview("venues", [csv], new Map([[id, current]]), new Map([[id, [{ field_name: "opening_hours_text", source: "official_website", review_status: "applied", is_current: true }]]]));
    expect(recrawl[0].conflicts).toEqual([]);
    expect(recrawl[0].changes).toEqual(expect.arrayContaining([{ field: "opening_hours_text", before: "10:00–17:00", after: "10:00–18:00" }]));
  });

  it("treats an undeclared CSV as transport without authority over sourced data", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const current = { id, name: "Museum A", address: "Wikidata address", publication_status: "draft" };
    const rows = buildCsvPreview(
      "venues",
      [{ id, name: "Museum A", venue_type: "museum", is_active: "true", publication_status: "draft", address: "Unknown CSV address" }],
      new Map([[id, current]]),
      new Map([[id, [{ field_name: "address", source: "wikidata", review_status: "applied", is_current: true }]]]),
    );
    expect(rows[0].sourceType).toBe("csv_import");
    expect(rows[0].conflicts).toContain("address");
  });

  it("marks AI structured official fields and keeps blanks out of the update", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const current = { id, name: "Museum A", address: null, description: "Existing description", publication_status: "draft" };
    const rows = buildCsvPreview("venues", [{
      id, source_type: "official_website", address: "東京都千代田区1-1", description: "",
      address_source_url: "https://museum.example/access", generated_by_ai: "address",
      address_confidence: "high", ai_notes: "公式Access記載から構造化",
    }], new Map([[id, current]]), new Map());
    expect(rows[0]).toMatchObject({
      status: "update", changedFields: ["address"], generatedByAiFields: ["address"],
      aiConfidenceByField: { address: "high" }, aiNotes: "公式Access記載から構造化",
    });
    expect(rows[0].values).not.toHaveProperty("description");
  });

  it("requires an official source URL for each AI generated field", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const rows = buildCsvPreview("venues", [{ id, source_type: "official_website", access_text: "駅から徒歩5分", generated_by_ai: "access_text", access_text_confidence: "medium" }], new Map([[id, { id, name: "Museum A", publication_status: "draft" }]]), new Map());
    expect(rows[0].status).toBe("invalid");
    expect(rows[0].errors.join(" ")).toContain("公式source URL");
  });

  it("lets official AI fill a Wikidata value but protects Manual", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const input = { id, source_type: "official_website", address: "Official address", address_source_url: "https://museum.example/access", generated_by_ai: "address", address_confidence: "high" };
    const current = new Map([[id, { id, name: "Museum A", address: "Other address", publication_status: "draft" }]]);
    const wikidata = buildCsvPreview("venues", [input], current, new Map([[id, [{ field_name: "address", source: "wikidata", review_status: "applied", is_current: true }]]]));
    expect(wikidata[0].conflicts).toEqual([]);
    const manual = buildCsvPreview("venues", [input], current, new Map([[id, [{ field_name: "address", source: "manual", review_status: "approved", is_current: true }]]]));
    expect(manual[0].conflicts).toEqual(["address"]);
  });
});
