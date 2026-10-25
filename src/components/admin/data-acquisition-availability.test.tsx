import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ExhibitionDataOperationCard } from "./exhibition-data-operation-card";
import { MasterDataOperationCard } from "./master-data-operation-card";
import { buildMasterOperatorOverview, buildUnavailableMasterOperatorOverview } from "@/lib/admin/data-acquisition-operator-overview";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

const entities = ["venues", "artists", "works"] as const;
const automaticOverview = {
  counts: { venuePending: 1, artistPending: 0, venueFailed: 0, artistFailed: 0 },
  items: [],
};

describe("Data Acquisition availability", () => {
  it("renders configured real zero counts as numeric zero", () => {
    const html = renderToStaticMarkup(<MasterDataOperationCard
      overviews={entities.map((entity) => buildMasterOperatorOverview(entity, 0, 0))}
      actionsEnabled
    />);
    expect(html.match(/<dd>0<\/dd>/g)).toHaveLength(9);
    expect(html).not.toContain("件数を取得できません。");
  });

  it("renders unavailable Master counts as dashes and disables Venue actions", () => {
    const html = renderToStaticMarkup(<MasterDataOperationCard
      overviews={entities.map(buildUnavailableMasterOperatorOverview)}
      actionsEnabled={false}
    />);
    expect(html.match(/<dd>—<\/dd>/g)).toHaveLength(9);
    expect(html.match(/件数を取得できません。/g)).toHaveLength(3);
    expect(html).not.toContain("<dd>0</dd>");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toContain("現在は更新操作を利用できません。");
  });

  it("keeps environment-dependent actions enabled when only count metrics are unavailable", () => {
    const html = renderToStaticMarkup(<MasterDataOperationCard
      overviews={entities.map(buildUnavailableMasterOperatorOverview)}
      actionsEnabled
    />);
    expect(html).toContain("件数を取得できません。");
    expect(html).not.toContain("disabled=\"");
  });

  it("renders only the failed Entity as unavailable while preserving the other counts", () => {
    const html = renderToStaticMarkup(<MasterDataOperationCard
      overviews={[
        buildMasterOperatorOverview("venues", 58, 4),
        buildUnavailableMasterOperatorOverview("artists"),
        buildMasterOperatorOverview("works", 57, 3),
      ]}
      actionsEnabled
    />);
    expect(html.match(/件数を取得できません。/g)).toHaveLength(1);
    expect(html.match(/<dd>—<\/dd>/g)).toHaveLength(3);
    expect(html).toContain("<dd>58</dd>");
    expect(html).toContain("<dd>57</dd>");
    expect(html).not.toContain("disabled=\"");
  });

  it("disables Exhibition update and automatic resolution actions when the environment is unavailable", () => {
    const html = renderToStaticMarkup(<ExhibitionDataOperationCard overview={automaticOverview} actionsEnabled={false}/>);
    expect(html).toContain("展示会データを更新する");
    expect(html).toContain("自動で解決する");
    expect(html.match(/disabled=""/g)).toHaveLength(4);
  });

  it("does not invent an empty resolution state when the overview is unavailable", () => {
    const html = renderToStaticMarkup(<ExhibitionDataOperationCard overview={null} actionsEnabled={false}/>);
    expect(html).toContain("紐づけ状況を取得できません。");
    expect(html).not.toContain("Venue / Artistの要確認項目はありません。");
    expect(html).not.toContain("自動処理待ち <strong>0</strong>件");
    expect(html).not.toContain("自動で解決する");
  });

  it("preserves normal configured nonzero counts", () => {
    const html = renderToStaticMarkup(<MasterDataOperationCard
      overviews={[
        buildMasterOperatorOverview("venues", 58, 12),
        buildMasterOperatorOverview("artists", 60, 3),
        buildMasterOperatorOverview("works", 64, 4),
      ]}
      actionsEnabled
    />);
    for (const value of ["58", "12", "46", "60", "3", "57", "64", "4"]) {
      expect(html).toContain(`<dd>${value}</dd>`);
    }
  });
});
