import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Artist shared detail architecture", () => {
  it("uses the shared tabs and image manager without duplicating Venue domain fields", () => {
    const detail = readFileSync(new URL("./master-detail-content.tsx", import.meta.url), "utf8");
    const editor = readFileSync(new URL("./master-editor.tsx", import.meta.url), "utf8");
    expect(detail).toContain("<AdminTabs tabs={ARTIST_EDIT_TABS}");
    expect(detail).toContain('{ id: "basic", label: "基本情報" }');
    expect(detail).toContain('{ id: "image", label: "画像登録" }');
    expect(detail).toContain('{ id: "relations", label: "関連情報" }');
    expect(editor).toContain("<AdminImageManager");
    expect(editor).toContain("record.exhibition_artists");
    expect(editor).toContain("record.work_artists");
    expect(detail).toContain("<ArtistDataReview artist={record}");
    expect(editor).not.toContain("postal_code");
    expect(editor).not.toContain("coordinate_status");
  });

  it("loads Artist identity candidates and delegates edit spacing to the parent surface", () => {
    const repository = readFileSync(new URL("../../lib/admin/master-repository.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    expect(repository).toContain("artist_external_match_candidates(*)");
    expect(css).toMatch(/\.admin-edit-tabs\s*\{[^}]*margin:\s*0;/);
    expect(css).toMatch(/\.artist-edit-surface, \.venue-edit-surface\s*\{[^}]*gap:\s*20px;/);
  });

  it("opens the shared candidate drawer for Artist while keeping Venue-only review panels scoped", () => {
    const drawer = readFileSync(new URL("./master-detail-drawer.tsx", import.meta.url), "utf8");
    expect(drawer).toContain('["venues", "artists"].includes(entity)');
    expect(drawer).toContain("entity === \"venues\" && [\"wikidata-fields\", \"official-fields\", \"coordinates\"]");
    expect(drawer).toContain("<MasterImageCandidatePicker entity={entity} ownerId={currentRecord.id}");
  });
});
