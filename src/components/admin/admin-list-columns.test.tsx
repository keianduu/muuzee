import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MASTER_LIST_COLUMNS, formatVenueCoordinates, venueCoordinateMapUrl, venueCoordinatePresentation } from "@/lib/admin/admin-list-presentation";
import { AdminRelationCount } from "./admin-relation-count";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Admin simplified list columns", () => {
  it("keeps only the approved Venue columns", () => {
    expect(MASTER_LIST_COLUMNS.venues).toEqual(["会場", "種別", "座標", "関連", "更新"]);
    expect(MASTER_LIST_COLUMNS.venues).not.toEqual(expect.arrayContaining(["住所", "Tier", "Image Status", "Source", "Wikidata", "Completeness", "Publication"]));
  });

  it("keeps Artist identity and relation columns without diagnostics", () => {
    expect(MASTER_LIST_COLUMNS.artists).toEqual(["作家", "英語名", "国籍", "生没年", "関連", "更新"]);
    expect(MASTER_LIST_COLUMNS.artists).not.toEqual(expect.arrayContaining(["Tier", "Image Status", "Completeness", "Publication"]));
  });

  it("keeps adopted Work identity columns", () => {
    expect(MASTER_LIST_COLUMNS.works).toEqual(["作品", "作家", "制作年", "所蔵先", "更新"]);
    expect(MASTER_LIST_COLUMNS.works).not.toEqual(expect.arrayContaining(["Completeness", "Publication", "関連"]));
  });

  it("renders compact accessible relation counts", () => {
    const html = renderToStaticMarkup(<AdminRelationCount items={[{ kind: "exhibitions", count: 2 }, { kind: "works", count: 0 }]}/>);
    expect(html).toContain('aria-label="展覧会 2件"');
    expect(html).toContain('aria-label="作品 0件"');
    expect(html).toContain("is-zero");
    expect(html).not.toContain("2 exhibitions / 0 works");
  });

  it("builds Google Maps links from exact coordinates while presenting four decimals", () => {
    expect(venueCoordinateMapUrl(35.681236, 139.767125)).toBe("https://www.google.com/maps/search/?api=1&query=35.681236%2C139.767125");
    expect(formatVenueCoordinates(35.681236, 139.767125)).toBe("35.6812, 139.7671");
    expect(venueCoordinatePresentation(35.681236, 139.767125)).toEqual({
      href: "https://www.google.com/maps/search/?api=1&query=35.681236%2C139.767125",
      label: "35.6812, 139.7671",
    });
  });

  it("does not create a Maps link from partial or invalid coordinates", () => {
    expect(venueCoordinatePresentation(35.681236, null)).toBeNull();
    expect(venueCoordinatePresentation(undefined, 139.767125)).toBeNull();
    expect(venueCoordinatePresentation("invalid", 139.767125)).toBeNull();
  });

  it("removes Source and Publication columns from Exhibition without changing schedule ownership", () => {
    const page = read("../../app/admin/exhibitions/page.tsx");
    expect(page).not.toContain("<th>Source / sync</th>");
    expect(page).not.toContain("<th>Publication</th>");
    expect(page).toContain("canonicalizeExhibitionScheduleQuery");
    expect(page).toContain('<AdminRelationCount items={[{ kind: "artists"');
  });
});
