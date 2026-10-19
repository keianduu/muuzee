import { describe, expect, it } from "vitest";
import { applyExhibitionPublicationUpdate, isExhibitionListUpdate, nextFocusIdAfterRemoval, type ExhibitionListRow } from "./exhibition-list-state";
import { occurrenceMatchesSchedule } from "./exhibition-list-repository";
import { mergeUniqueRows } from "./master-list-state";

function row(id: string, publication_status = "draft"): ExhibitionListRow {
  return {
    id,
    title: `Exhibition ${id}`,
    updated_at: "2026-10-19T00:00:00Z",
    publication_status,
    occurrence: null,
    venue_resolution_status: "pending",
    artist_count: 0,
    has_unresolved_artist: false,
    image: { kind: "missing", rights_status: null, thumbnail_url: null },
  };
}

describe("Exhibition list update state", () => {
  it("removes a newly published row from the unpublished queue immediately", () => {
    const current = [row("a"), row("b"), row("c")];
    const result = applyExhibitionPublicationUpdate(current, { id: "b", publication_status: "published" }, "unpublished");

    expect(result.rows.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.removed).toBe(true);
    expect(result.previousIndex).toBe(1);
    expect(nextFocusIdAfterRemoval(result.rows, result.previousIndex)).toBe("c");
  });

  it("removes an unpublished row from the published queue immediately", () => {
    const current = [row("a", "published"), row("b", "published"), row("c", "published")];
    const result = applyExhibitionPublicationUpdate(current, { id: "b", publication_status: "draft" }, "published");

    expect(result.rows.map((item) => item.id)).toEqual(["a", "c"]);
    expect(result.removed).toBe(true);
  });

  it("updates a row in place when it still belongs to the active tab", () => {
    const current = [row("a", "published"), row("b", "published")];
    const updated = row("b", "published");
    updated.title = "Updated";

    const result = applyExhibitionPublicationUpdate(current, { id: "b", publication_status: "published", row: updated }, "published");
    expect(result.rows.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.rows[1].title).toBe("Updated");
    expect(result.removed).toBe(false);
  });

  it("accepts only narrow Exhibition update payloads", () => {
    expect(isExhibitionListUpdate({ id: "exhibition-1", publication_status: "published" })).toBe(true);
    expect(isExhibitionListUpdate({ id: "exhibition-1" })).toBe(true);
    expect(isExhibitionListUpdate({ publication_status: "published" })).toBe(false);
    expect(isExhibitionListUpdate({ id: "exhibition-1", publication_status: 1 })).toBe(false);
  });

  it("appends bounded pages without duplicates", () => {
    const first = Array.from({ length: 50 }, (_, index) => row(String(index + 1)));
    const next = [row("50"), ...Array.from({ length: 20 }, (_, index) => row(String(index + 51)))];
    const appended = mergeUniqueRows(first, next);

    expect(appended).toHaveLength(70);
    expect(new Set(appended.map((item) => item.id)).size).toBe(70);
  });

  it("selects an occurrence summary that matches the active schedule filter", () => {
    const today = "2026-10-19";
    expect(occurrenceMatchesSchedule({ start_date: "2026-01-01", end_date: "2026-10-18" }, "past", today)).toBe(true);
    expect(occurrenceMatchesSchedule({ start_date: "2026-10-01", end_date: "2026-12-01" }, "current_upcoming", today)).toBe(true);
    expect(occurrenceMatchesSchedule({ start_date: null, end_date: null }, "unknown", today)).toBe(true);
    expect(occurrenceMatchesSchedule({ start_date: null, end_date: null }, "current_upcoming", today)).toBe(false);
  });
});
