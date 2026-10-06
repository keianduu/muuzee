import * as React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminProvenanceSummary } from "./admin-data-review";
import { ArtistDataReview } from "./artist-data-review";

vi.stubGlobal("React", React);

describe("shared Admin Data Review", () => {
  it("renders current provenance, unknown provenance, empty values, and source links", () => {
    const markup = renderToStaticMarkup(<AdminProvenanceSummary
      record={{ name: "Artist", description: "Has value", birth_place: "", name_en: "Artist EN" }}
      fields={[["name", "名称"], ["description", "概要"], ["birth_place", "出生地"], ["name_en", "英語名"]]}
      sources={[
        { field_name: "name", source: "manual", is_current: true },
        { field_name: "name_en", source: "wikidata", source_url: "https://www.wikidata.org/wiki/Q1", is_current: true },
      ]}
    />);
    expect(markup).toContain("手動");
    expect(markup).toContain("不明");
    expect(markup).toContain("—");
    expect(markup).toContain('href="https://www.wikidata.org/wiki/Q1"');
  });

  it("is consumed by both Venue and Artist adapters", () => {
    const venue = readFileSync(new URL("./venue-editor.tsx", import.meta.url), "utf8");
    const artist = readFileSync(new URL("./artist-data-review.tsx", import.meta.url), "utf8");
    for (const source of [venue, artist]) {
      expect(source).toContain("<AdminDataReview");
      expect(source).toContain("<AdminDataSection");
      expect(source).toContain("<AdminProvenanceSummary");
    }
  });

  it("renders Artist candidate state without a fake confirmation action or raw payload", () => {
    const markup = renderToStaticMarkup(<ArtistDataReview artist={{
      id: "artist-1",
      name: "Artist",
      description: "Value without provenance",
      source_records: [],
      artist_field_sources: [],
      artist_external_match_candidates: [{ id: "candidate-1", provider: "wikidata", external_id: "Q231121", label_ja: "草間彌生", status: "candidate", confidence: 0.8 }],
    }}/>)
    expect(markup).toContain("確認待ちの候補が1件あります");
    expect(markup).toContain("Artist Source Review");
    expect(markup).toContain("Q231121");
    expect(markup).not.toContain("このArtistとして確定");
    expect(markup).not.toContain("raw_payload");
  });
});
