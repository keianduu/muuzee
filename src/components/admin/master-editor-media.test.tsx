import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaAssetRow } from "@/lib/admin/types";
import { MasterEditor } from "./master-editor";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

function asset(): MediaAssetRow {
  return { id: "asset-1", exhibition_id: null, venue_id: null, artist_id: "artist-1", work_id: null, kind: "image", storage_path: "artists/asset.jpg", original_filename: "registered.jpg", source_type: "other", source_url: null, credit: null, usage_note: null, reported_license: null, reported_license_url: null, reported_author: null, reported_usage_terms: null, rights_status: "needs_review", rights_checked_at: null, valid_until: null, is_primary: true, created_at: "2026-10-04T00:00:00Z", signedUrl: "https://signed.example/asset.jpg" };
}

function record(mediaAssets: MediaAssetRow[]) {
  return { id: "master-1", slug: "master-1", name: "Fixture", title: "Fixture", publication_status: "draft", updated_at: "2026-10-04T00:00:00Z", media_assets: mediaAssets, completeness: { percent: 0, items: [] } } as never;
}

describe.each(["artists", "works"] as const)("%s media acquisition visibility", (entity) => {
  it("shows candidate and manual registration only at zero registered assets", () => {
    const empty = renderToStaticMarkup(<MasterEditor entity={entity} record={record([])} view="edit" embeddedInList/>);
    expect(empty).toContain("No Image");
    expect(empty).toContain("画像候補");
    expect(empty).toContain("画像を登録");

    const registered = renderToStaticMarkup(<MasterEditor entity={entity} record={record([asset()])} view="edit" embeddedInList/>);
    expect(registered).toContain("registered.jpg");
    expect(registered).not.toContain("画像候補");
    expect(registered).not.toContain("画像を登録");
  });
});
