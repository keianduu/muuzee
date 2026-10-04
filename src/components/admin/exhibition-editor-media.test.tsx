import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExhibitionRow, MediaAssetRow } from "@/lib/admin/types";
import { ExhibitionEditor } from "./exhibition-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

const asset = { id: "asset-1", exhibition_id: "exhibition-1", venue_id: null, artist_id: null, work_id: null, kind: "image", storage_path: "asset.jpg", original_filename: "registered.jpg", source_type: "other", source_url: null, credit: null, usage_note: null, reported_license: null, reported_license_url: null, reported_author: null, reported_usage_terms: null, rights_status: "needs_review", rights_checked_at: null, valid_until: null, is_primary: true, created_at: "2026-10-04T00:00:00Z", signedUrl: "https://signed.example/asset.jpg" } satisfies MediaAssetRow;

function exhibition(mediaAssets: MediaAssetRow[]) {
  return { id: "exhibition-1", title: "Fixture Exhibition", publication_status: "draft", media_assets: mediaAssets, source_records: [] } as unknown as ExhibitionRow;
}

describe("Exhibition media acquisition visibility", () => {
  it("keeps the research prompt but hides candidate and registration UI after registration", () => {
    const empty = renderToStaticMarkup(<ExhibitionEditor exhibition={exhibition([])} occurrence={null} venue={null} prompt="research prompt" requirements={[]} canPublish={false} embeddedInList/>);
    expect(empty).toContain("画像・利用条件を登録");
    expect(empty).toContain("画像候補");

    const registered = renderToStaticMarkup(<ExhibitionEditor exhibition={exhibition([asset])} occurrence={null} venue={null} prompt="research prompt" requirements={[]} canPublish={false} embeddedInList/>);
    expect(registered).toContain("registered.jpg");
    expect(registered).toContain("画像を探す");
    expect(registered).not.toContain("画像・利用条件を登録");
    expect(registered).not.toContain("画像候補");
  });
});
