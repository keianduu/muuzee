import * as React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminExternalSourceList, AdminExternalSourceSummary, AdminProvenanceSummary } from "./admin-data-review";
import { ArtistDataReview } from "./artist-data-review";
import { linkedAdminExternalSources, summarizedAdminExternalSources } from "@/lib/admin/data-review";

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
    expect(markup).toContain("要確認");
    expect(markup).toContain("Artist identity候補");
    expect(markup).toContain("Q231121");
    expect(markup).not.toContain("このArtistとして確定");
    expect(markup).not.toContain("raw_payload");
    expect(markup).not.toContain("Wikipediaから不足情報を補完");
    expect(markup).not.toContain("未取得");
  });

  it("renders only linked external sources and keeps the no-source state quiet", () => {
    const sourceRecords = [
      { id: "1", external_id: "Q1", source_url: "https://www.wikidata.org/wiki/Q1", data_sources: { key: "wikidata", name: "Wikidata" } },
      { id: "2", external_id: "Q1", source_url: "https://www.wikidata.org/wiki/Q1", data_sources: { key: "wikidata", name: "Wikidata" } },
      { id: "3", external_id: "500", source_url: "https://www.getty.edu/500", data_sources: { key: "getty_ulan", name: "Getty ULAN" } },
      { id: "4", external_id: "row", source_url: null, data_sources: { key: "csv_import", name: "CSV" } },
    ];
    const entries = linkedAdminExternalSources(sourceRecords);
    expect(entries.map((entry) => entry.label)).toEqual(["Wikidata", "Getty ULAN"]);
    expect(renderToStaticMarkup(<AdminExternalSourceList sourceRecords={sourceRecords}/>)).toContain("500");
    expect(renderToStaticMarkup(<AdminExternalSourceList sourceRecords={[]}/>)).toContain("外部データはありません。");
  });

  it("summarizes distinct linked and current provenance sources without Manual or CSV", () => {
    const sources = summarizedAdminExternalSources(
      [{ id: "1", external_id: "Q1", source_url: "https://www.wikidata.org/wiki/Q1", data_sources: { key: "wikidata", name: "Wikidata" } }],
      [
        { source: "wikidata", is_current: true },
        { source: "wikipedia", source_url: "https://ja.wikipedia.org/wiki/Artist", is_current: true },
        { source: "manual", is_current: true },
        { source: "csv_import", is_current: true },
      ],
    );
    expect(sources.map((source) => source.label)).toEqual(["Wikidata", "Wikipedia"]);
    const markup = renderToStaticMarkup(<AdminExternalSourceSummary sourceRecords={[]} provenance={[]}/>);
    expect(markup).toBe("なし");
  });

  it("hides the Artist review section when there is no unresolved candidate", () => {
    const markup = renderToStaticMarkup(<ArtistDataReview artist={{
      id: "artist-1",
      name: "Artist",
      source_records: [{ id: "source-1", external_id: "Q1", source_url: "https://www.wikidata.org/wiki/Q1", data_sources: { key: "wikidata", name: "Wikidata" } }],
      artist_field_sources: [],
      artist_external_match_candidates: [{ id: "candidate-1", provider: "wikidata", external_id: "Q1", status: "matched" }],
    }}/>)
    expect(markup).toContain("項目の出典");
    expect(markup).toContain("外部データ");
    expect(markup).toContain("Wikidata");
    expect(markup).not.toContain("要確認");
  });
});
