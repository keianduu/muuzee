import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { VenueInitialAcquisitionForm, venueInitialAcquisitionResultMetrics } from "./venue-initial-acquisition-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

describe("Venue initial acquisition form", () => {
  it("renders the first bounded acquisition action", () => {
    const html = renderToStaticMarkup(<VenueInitialAcquisitionForm status="not_started"/>);
    expect(html).toContain("初回取り込み：未実施");
    expect(html).toContain(">初回取り込み</button>");
    expect(html).not.toContain("変更内容を確認");
  });

  it("renders the continuation state from persisted evidence", () => {
    const html = renderToStaticMarkup(<VenueInitialAcquisitionForm status="started"/>);
    expect(html).toContain("初回取り込み：進行中");
    expect(html).toContain(">続きを取り込む</button>");
  });

  it("fails closed when evidence cannot be loaded", () => {
    const html = renderToStaticMarkup(<VenueInitialAcquisitionForm status="unavailable"/>);
    expect(html).toContain("初回取り込み：確認できません");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("初回取り込み状況を取得できません。");
  });

  it("maps importer results to operator-facing metrics", () => {
    expect(venueInitialAcquisitionResultMetrics({
      fetched: 5,
      newVenues: 2,
      linkedExisting: 1,
      updated: 1,
      unchanged: 1,
      sourceSelectionRequired: 1,
      errors: [{ message: "sanitized" }],
    })).toEqual([
      ["取得", 5],
      ["新規", 2],
      ["既存接続", 1],
      ["更新", 1],
      ["変更なし", 1],
      ["要確認", 1],
      ["エラー", 1],
    ]);
  });
});
