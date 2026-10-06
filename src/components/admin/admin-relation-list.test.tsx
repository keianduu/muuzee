import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminRelationList } from "./admin-relation-list";
import { MasterEditor } from "./master-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

describe("Admin relation rows", () => {
  it("renders each long relation as an independent row", () => {
    const markup = renderToStaticMarkup(<AdminRelationList title="関連展覧会" emptyLabel="なし" items={[
      { id: "1", label: "非常に長い展覧会タイトル A" },
      { id: "2", label: "Very long exhibition title B", meta: "公開中" },
    ]}/>);
    expect(markup.match(/admin-relation-row/g)).toHaveLength(2);
    expect(markup).toContain("非常に長い展覧会タイトル A");
    expect(markup).toContain("Very long exhibition title B");
  });

  it("keeps Artist exhibitions and works in separate structured lists", () => {
    const record = {
      id: "artist-1", name: "Artist", publication_status: "draft", source_records: [], media_assets: [],
      completeness: { percent: 0, items: [] },
      exhibition_artists: [
        { id: "ea-1", role: "artist", exhibitions: { id: "e-1", title: "Exhibition One" } },
        { id: "ea-2", role: "featured", exhibitions: { id: "e-2", title: "Exhibition Two" } },
      ],
      work_artists: [
        { id: "wa-1", role: "artist", works: { id: "w-1", title_ja: "作品一" } },
        { id: "wa-2", role: "collaborator", works: { id: "w-2", title_en: "Work Two" } },
      ],
    } as never;
    const markup = renderToStaticMarkup(<MasterEditor entity="artists" record={record} view="edit" editSection="relations" embeddedInList/>);
    expect(markup).toContain("関連展覧会");
    expect(markup).toContain("関連作品");
    expect(markup.match(/admin-relation-row/g)).toHaveLength(4);
    expect(markup).not.toContain("Exhibition One / Exhibition Two");
  });
});
