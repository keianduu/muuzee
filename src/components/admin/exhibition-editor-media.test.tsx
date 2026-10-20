import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ExhibitionRow } from "@/lib/admin/types";
import { exhibitionArtistItems, unresolvedArtistItems, unresolvedVenueItems } from "./exhibition-relations";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Exhibition shared detail architecture", () => {
  it("uses the shared status, edit, data, image, and relation components", () => {
    const editor = read("./exhibition-editor.tsx");
    const status = read("./exhibition-status.tsx");
    const dataReview = read("./exhibition-data-review.tsx");
    expect(editor).toContain('{ id: "status", label: "状態" }');
    expect(editor).toContain('{ id: "edit", label: "編集" }');
    expect(editor).toContain('{ id: "data", label: "データ" }');
    expect(editor).toContain('{ id: "basic", label: "基本情報" }');
    expect(editor).toContain('{ id: "image", label: "画像登録" }');
    expect(editor).toContain('{ id: "relations", label: "関連情報" }');
    expect(editor).toContain("<ExhibitionStatus");
    expect(editor).toContain("<AdminImageManager");
    expect(editor).toContain("<ExhibitionRelations");
    expect(editor).toContain("<ExhibitionDataReview");
    expect(status).toContain("<PublicationToggle");
    expect(dataReview).toContain("<AdminDataReview");
    expect(`${editor}${dataReview}`).not.toContain("raw_payload");
  });

  it("uses the canonical one-column Drawer form layout for Exhibition basic fields", () => {
    const basicEditor = read("./exhibition-basic-editor.tsx");
    const styles = read("../../app/globals.css");
    expect(basicEditor).toContain('className="card exhibition-basic-form"');
    expect(styles).toContain(".artist-basic-form .form-grid, .exhibition-basic-form .form-grid { grid-template-columns: minmax(0,1fr); }");
  });

  it("opens Exhibition image candidates in the shared secondary drawer", () => {
    const drawer = read("./exhibition-detail-drawer.tsx");
    const list = read("./exhibition-list.tsx");
    expect(drawer).toContain('searchParams.get("panel") === "image"');
    expect(drawer).toContain('<MasterImageCandidatePicker entity="exhibitions"');
    expect(drawer).toContain("if (secondaryRequested) closeSecondary()");
    expect(drawer).toContain('data-secondary-return-anchor="image"');
    expect(drawer).toContain("aria-hidden={secondaryRequested || undefined}");
    expect(list).toContain("data-exhibition-detail-trigger={item.id}");
    expect(drawer).toContain("element.dataset.exhibitionDetailTrigger === selectedId");
    expect(drawer).toContain("await refreshDetail()");
    expect(drawer).toContain("onSelected={completeCandidateSelection}");
    expect(drawer).not.toContain('window.addEventListener("muuzee:exhibition-updated"');
    expect(drawer).not.toContain('window.addEventListener("muuzee:master-updated"');
  });

  it("awaits one canonical Detail refresh before notifying the Exhibition list", () => {
    const editor = read("./exhibition-editor.tsx");
    const mutation = read("../../lib/admin/exhibition-mutation.ts");
    const picker = read("./master-image-candidate.tsx");
    expect(editor).toContain("completeExhibitionMutation");
    expect(editor).toContain("refreshDetail: onMutationCommitted");
    expect(editor).toContain("notifyList: () => notifyList(body)");
    expect(editor).not.toContain("router.refresh");
    expect(mutation.indexOf("options.applyImmediate?.()")).toBeLessThan(mutation.indexOf("await options.refreshDetail()"));
    expect(mutation.indexOf("await options.refreshDetail()")).toBeLessThan(mutation.indexOf("options.notifyList()"));
    expect(picker).toContain("onSelected: () => void | Promise<void>");
    expect(picker).toContain("await completeSelection()");
  });

  it("keeps Exhibition selection in local History state without Router navigation", () => {
    const list = read("./exhibition-list.tsx");
    const drawer = read("./exhibition-detail-drawer.tsx");
    expect(list).toContain("setActiveSelectedId(id)");
    expect(list).toContain("window.history.pushState");
    expect(list).toContain('window.addEventListener("popstate", syncSelection)');
    expect(list).toContain("event.target === event.currentTarget");
    expect(drawer).toContain("window.history.replaceState");
    expect(drawer).not.toContain("router.replace(`${pathname}${query");
  });

  it("renders actionable requirement controls and local editor targeting", () => {
    const editor = read("./exhibition-editor.tsx");
    const status = read("./exhibition-status.tsx");
    expect(status).toContain("requirement-action");
    expect(status).toContain("onRequirementSelect(item.key)");
    expect(editor).toContain("exhibitionRequirementTarget(key)");
    expect(editor).toContain("setTab(target.detailTab)");
    expect(editor).toContain("setEditTab(target.editTab)");
    expect(editor).toContain("scrollIntoView");
    expect(editor).not.toContain("router.push");
    expect(editor).not.toContain("router.replace");
  });

  it("enforces the shared manual registration and legacy remediation controls", () => {
    const manager = read("./admin-image-manager.tsx");
    const route = read("../../app/api/admin/exhibitions/[id]/media/route.ts");
    expect(manager).toContain('name="rights_confirmed"');
    expect(manager).not.toContain('name="rights_status"');
    expect(manager).toContain("Rightsを確認して利用可能にする");
    expect(manager).toContain("data-admin-rights-remediation");
    expect(route).toContain('form.get("image_url")');
    expect(route).toContain("downloadCandidateImage");
    expect(route).toContain("assertManualImageRightsConfirmed");
    expect(route).toContain('rights_status: rightsStatus');
  });

  it("keeps only active canonical relations and unresolved active mentions", () => {
    const exhibition = {
      exhibition_artists: [
        { id: "relation-1", role: "featured", relation_status: "active", artists: { id: "artist-1", name: "Active Artist" } },
        { id: "relation-2", relation_status: "stale", artists: { id: "artist-2", name: "Stale Artist" } },
      ],
      exhibition_artist_mentions: [
        { id: "mention-1", source_artist_name: "Pending Artist", is_active: true, resolution_status: "pending" },
        { id: "mention-2", source_artist_name: "Historical Artist", is_active: false, resolution_status: "pending" },
        { id: "mention-3", source_artist_name: "Resolved Artist", is_active: true, resolution_status: "resolved" },
      ],
      exhibition_venue_mentions: [
        { id: "venue-1", source_venue_name: "Pending Venue", is_active: true, resolution_status: "pending" },
        { id: "venue-2", source_venue_name: "Resolved Venue", is_active: true, resolution_status: "resolved" },
      ],
    } as ExhibitionRow;
    expect(exhibitionArtistItems(exhibition)).toEqual([{ id: "relation-1", label: "Active Artist", meta: "featured" }]);
    expect(unresolvedArtistItems(exhibition).map((item) => item.label)).toEqual(["Pending Artist"]);
    expect(unresolvedVenueItems(exhibition).map((item) => item.label)).toEqual(["Pending Venue"]);
  });

  it("loads relation labels for the shared Exhibition review surfaces", () => {
    const queries = read("../../lib/admin/queries.ts");
    expect(queries).toContain("artists(id,name)");
    expect(queries).toContain("source_artist_name");
    expect(queries).toContain("source_venue_name");
  });
});
