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
});
