import { describe, expect, it } from "vitest";
import { mergeUniqueRows, pageQuery, replaceRowInPlace, selectedQuery } from "./master-list-state";

describe("master list URL and append state", () => {
  it("appends pages without duplicate records", () => {
    expect(mergeUniqueRows([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }])).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("refreshes one row without changing the visible order", () => {
    const current: Array<{ id: string; image: string | null }> = [{ id: "a", image: null }, { id: "b", image: null }, { id: "c", image: null }];
    expect(replaceRowInPlace(current, { id: "b", image: "primary.jpg" })).toEqual([
      { id: "a", image: null }, { id: "b", image: "primary.jpg" }, { id: "c", image: null },
    ]);
  });

  it("adds and removes selected without losing filters", () => {
    const opened = selectedQuery("q=tokyo&status=draft&tier=A-C", "venue-1");
    expect(opened).toContain("q=tokyo");
    expect(opened).toContain("tier=A-C");
    expect(opened).toContain("selected=venue-1");
    expect(selectedQuery(opened, null)).toBe("q=tokyo&status=draft&tier=A-C");
  });

  it("keeps server pagination internal to the API request", () => {
    expect(pageQuery("q=tokyo&tier=A-C&selected=venue-1", 2)).toBe("q=tokyo&tier=A-C&page=2&pageSize=50");
  });
});
