import { describe, expect, it } from "vitest";
import { parseApjShuzoResults } from "./apj-shuzo-client";
import { parseTomucoWorks } from "./tomuco-client";

describe("work collection source clients", () => {
  it("parses only exact-artist SHŪZŌ rows and keeps holding separate from presentation", () => {
    const html = `<div class="item"><a href="/ja/collections/W1"><span class="work-title-ja">作品一</span></a><span class="work-title-en">Work One</span><div class="artist"><span class="ja">岡本太郎</span></div><span class="isYear">1950</span><a href="/ja/museums/M1">川崎市岡本太郎美術館</a></div><div class="item"><a href="/ja/collections/W2"><span class="work-title-ja">別作品</span></a><div class="artist"><span class="ja">別人</span></div></div>`;
    const rows = parseApjShuzoResults(html, { name: "岡本太郎" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: "W1", holdingType: "collection", presentationType: null, presentationStatus: null, createdYearFrom: 1950 });
  });

  it("maps ToMuCo JSON-LD without requiring year or image", () => {
    const rows = parseTomucoWorks({ itemListElement: [{ item: { "@id": "work:1", name: "Untitled", creator: { name: "Artist" }, contentLocation: { name: "Museum" } } }] }, "Artist");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Untitled", artistName: "Artist", venueName: "Museum", yearText: null, holdingType: "collection" });
  });
});
