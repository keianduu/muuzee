import { describe, expect, it } from "vitest";
import { mergeUniqueRows, pageQuery, selectedQuery } from "./master-list-state";

describe("master list URL and append state", () => {
  it("appends pages without duplicate records", () => {
    expect(mergeUniqueRows([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }])).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it("adds and removes selected without losing filters", () => {
    const opened = selectedQuery("q=tokyo&status=draft", "venue-1");
    expect(opened).toContain("q=tokyo");
    expect(opened).toContain("selected=venue-1");
    expect(selectedQuery(opened, null)).toBe("q=tokyo&status=draft");
  });

  it("keeps server pagination internal to the API request", () => {
    expect(pageQuery("q=tokyo&selected=venue-1", 2)).toBe("q=tokyo&page=2&pageSize=50");
  });
});
