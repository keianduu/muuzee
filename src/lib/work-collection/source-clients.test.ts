import { describe, expect, it } from "vitest";
import { parseApjShuzoResults } from "./apj-shuzo-client";
import { parseTomucoWorks } from "./tomuco-client";

describe("work collection source clients", () => {
  it("parses only exact-artist SHŪZŌ rows and keeps holding separate from presentation", () => {
    const html = `<div class="item"><a href="/ja/collections/W1"><span class="work-title-ja">作品一</span></a><span class="work-title-en">Work One</span><div class="artist"><span class="ja">岡本太郎</span></div><span class="isYear">1950</span><a href="/ja/museums/M1">川崎市岡本太郎美術館</a></div><div class="item"><a href="/ja/collections/W2"><span class="work-title-ja">別作品</span></a><div class="artist"><span class="ja">別人</span></div></div>`;
    const rows = parseApjShuzoResults(html, { name: "岡本太郎" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ externalId: "W1", title: "作品一", titleJa: "作品一", titleEn: "Work One", titleOriginal: null, originalLanguage: null, holdingType: "collection", presentationType: null, presentationStatus: null, createdYearFrom: 1950 });
  });

  it("preserves an explicitly labelled original title", () => {
    const html = `<div class="item"><a href="/ja/collections/W3"><span class="work-title-ja">星月夜</span></a><span class="work-title-en">The Starry Night</span><span class="work-title-original" lang="nl">De sterrennacht</span><div class="artist"><span class="ja">フィンセント・ファン・ゴッホ</span></div></div>`;
    expect(parseApjShuzoResults(html, { name: "フィンセント・ファン・ゴッホ" })[0]).toMatchObject({ titleJa: "星月夜", titleEn: "The Starry Night", titleOriginal: "De sterrennacht", originalLanguage: "nl" });
  });

  it("maps ToMuCo JSON-LD without requiring year or image", () => {
    const rows = parseTomucoWorks({ itemListElement: [{ item: { "@id": "work:1", name: "Untitled", creator: { name: "Artist" }, contentLocation: { name: "Museum" } } }] }, "Artist");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Untitled", titleJa: null, titleEn: null, titleOriginal: null, originalLanguage: null, artistName: "Artist", venueName: "Museum", yearText: null, holdingType: "collection" });
  });
});
