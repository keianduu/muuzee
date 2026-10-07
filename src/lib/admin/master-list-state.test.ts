import { describe, expect, it } from "vitest";
import { binaryListValue, detailPanelQuery, legacyDetailDestination, listFilterQuery, mergeUniqueRows, normalizePublicationStatus, pageQuery, publicationMatches, publicationTabQuery, replaceRowInPlace, selectedQuery, splitListValue, workListViewQuery } from "./master-list-state";

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

  it.each(["manual upload", "manual delete", "candidate selection"])("preserves A/B/C order after %s updates B", () => {
    const current = [{ id: "a", revision: 0 }, { id: "b", revision: 0 }, { id: "c", revision: 0 }];
    expect(replaceRowInPlace(current, { id: "b", revision: 1 }).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("adds and removes selected without losing filters", () => {
    const opened = selectedQuery("q=tokyo&status=draft&tier=A-C", "venue-1");
    expect(opened).toContain("q=tokyo");
    expect(opened).toContain("tier=A-C");
    expect(opened).toContain("selected=venue-1");
    expect(selectedQuery(opened, null)).toBe("q=tokyo&status=draft&tier=A-C");
  });

  it("redirects a legacy exhibition detail URL into the filtered list drawer", () => {
    expect(legacyDetailDestination("/admin/exhibitions", "exhibition-1", "/admin/exhibitions?q=tokyo&status=draft"))
      .toBe("/admin/exhibitions?q=tokyo&status=draft&selected=exhibition-1");
  });

  it("adds and removes the child panel without losing the selected master", () => {
    const opened = detailPanelQuery("q=tokyo&selected=venue-1", "image", { candidateId: "candidate-1" });
    expect(opened).toBe("q=tokyo&selected=venue-1&panel=image&candidate=candidate-1");
    expect(detailPanelQuery("q=tokyo&selected=venue-1", "image")).toBe("q=tokyo&selected=venue-1&panel=image");
    expect(detailPanelQuery(opened, null)).toBe("q=tokyo&selected=venue-1");
    expect(selectedQuery(opened, null)).toBe("q=tokyo");
  });

  it("supports Venue review child panels and clears panel-specific state", () => {
    const opened = detailPanelQuery("q=tokyo&selected=venue-1", "official-fields", { runId: "run-1", targetUrl: "https://museum.example" });
    expect(opened).toBe("q=tokyo&selected=venue-1&panel=official-fields&run=run-1&targetUrl=https%3A%2F%2Fmuseum.example");
    expect(detailPanelQuery(opened, "coordinates")).toBe("q=tokyo&selected=venue-1&panel=coordinates");
    expect(detailPanelQuery(opened, null)).toBe("q=tokyo&selected=venue-1");
  });

  it("clears Venue edit sub-state when the Venue drawer closes", () => {
    expect(selectedQuery("q=tokyo&selected=venue-1&venueEdit=relations", null)).toBe("q=tokyo");
  });

  it("keeps server pagination internal to the API request", () => {
    expect(pageQuery("q=tokyo&tier=A-C&selected=venue-1&panel=image&candidate=candidate-1", 2)).toBe("q=tokyo&tier=A-C&page=2&pageSize=50");
  });

  it("maps legacy and absent publication states to the unpublished operations queue", () => {
    expect(normalizePublicationStatus()).toBe("unpublished");
    expect(normalizePublicationStatus("draft")).toBe("unpublished");
    expect(normalizePublicationStatus("ready")).toBe("unpublished");
    expect(publicationMatches("draft", "unpublished")).toBe(true);
    expect(publicationMatches("ready", "unpublished")).toBe(true);
    expect(publicationMatches("published", "unpublished")).toBe(false);
    expect(publicationMatches("archived", "unpublished")).toBe(false);
  });

  it("switches publication tabs while preserving filters and clearing detail state", () => {
    expect(publicationTabQuery("q=tokyo&type=museum&status=draft&selected=venue-1&panel=image&page=3", "published"))
      .toBe("q=tokyo&type=museum&status=published");
  });

  it("serializes multi-value Venue filters and removes obsolete hidden parameters", () => {
    const query = listFilterQuery("status=unpublished&tier=A-C&source=wikidata&active=true&selected=venue-1", "venues", {
      q: " Tokyo ", type: ["museum", "gallery", "museum"], image: "missing", coordinates: "present",
    });
    expect(query).toBe("status=unpublished&q=Tokyo&image=missing&type=museum%2Cgallery&coordinates=present");
    expect(splitListValue("museum,gallery,museum")).toEqual(["museum", "gallery"]);
  });

  it("treats both or neither binary choices as an unfiltered value", () => {
    expect(binaryListValue(true, true)).toBeUndefined();
    expect(binaryListValue(false, false)).toBeUndefined();
    expect(binaryListValue(true, false)).toBe("present");
    expect(binaryListValue(false, true)).toBe("missing");
  });

  it("resets Exhibition filters to current/upcoming while preserving publication status", () => {
    expect(listFilterQuery("status=archived&q=art&schedule=past&image=missing&tier=A", "exhibitions"))
      .toBe("status=archived");
  });

  it("keeps the Works data-kind view in URL state", () => {
    expect(workListViewQuery("status=unpublished&q=monet&selected=work-1", "candidates"))
      .toBe("status=unpublished&q=monet&view=candidates");
    expect(workListViewQuery("status=unpublished&q=monet&view=candidates", "adopted"))
      .toBe("status=unpublished&q=monet");
  });
});
