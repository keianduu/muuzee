import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Admin list action architecture", () => {
  it("owns New and CSV in the page header while excluding Works candidates", () => {
    const page = read("./master-index-page.tsx");
    const actions = read("./admin-master-list-actions.tsx");

    expect(page).toContain("<AdminMasterListActions entity={entity}/>");
    expect(page).toContain('entity !== "works" || workView === "adopted"');
    expect(actions).toContain("＋新規追加");
    expect(actions).toContain("<span>CSV</span>");
    expect(actions).not.toContain("/new\`");
  });

  it("creates through the existing editor and preserves list query state", () => {
    const actions = read("./admin-master-list-actions.tsx");
    const editor = read("./master-editor.tsx");
    const route = read("../../app/api/admin/masters/[entity]/route.ts");
    const repository = read("../../lib/admin/master-repository.ts");

    expect(actions).toContain('<MasterEditor entity={entity} mode="new" embeddedInList onCreated={onCreated}/>');
    expect(actions).toContain("selectedQuery(searchParams.toString(), id)");
    expect(actions).toContain("scroll: false");
    expect(editor).toContain("if (onCreated) onCreated(String(body.id))");
    expect(editor).toContain('method: mode === "new" ? "POST" : "PATCH"');
    expect(route).toContain('createMaster(entity, await request.json(), "manual")');
    expect(repository).toContain('values.publication_status = "draft"');
  });

  it("keeps the existing CSV endpoints and blocks invalid confirmation", () => {
    const actions = read("./admin-master-list-actions.tsx");

    expect(actions).toContain("/csv?mode=all");
    expect(actions).toContain("/csv?mode=template");
    expect(actions).toContain("/csv/preview");
    expect(actions).toContain("/csv/execute");
    expect(actions).toContain("preview.summary.invalid > 0");
    expect(actions).toContain("preview.summary.conflicts");
    expect(actions).toContain("row.status === \"new\"");
  });

  it("makes Search, CSV, and New mutually exclusive list-level drawers", () => {
    const drawer = read("./admin-list-drawer.tsx");
    const actions = read("./admin-master-list-actions.tsx");
    const search = read("./admin-list-controls.tsx");

    expect(drawer).toContain('"muuzee:list-drawer-open"');
    expect(drawer).toContain('requested !== kind');
    expect(actions).toContain('announceAdminListDrawer(kind)');
    expect(search).toContain('announceAdminListDrawer("search")');
    expect(drawer).toContain('event.key === "Escape"');
    expect(drawer).toContain('aria-modal="true"');
  });

  it("removes routine acquisition controls from the list without changing backend ownership", () => {
    const list = read("./master-list.tsx");
    const detail = read("./master-detail-drawer.tsx");

    expect(list).not.toContain("VenueCanonicalReview");
    expect(list).not.toContain("APIから取り込む");
    expect(list).not.toContain("公式サイト情報取得");
    expect(list).not.toContain("画像候補を取得");
    expect(list).not.toContain("Wikipedia住所補完");
    expect(list).toContain("<MasterDetailDrawer");
    expect(detail).toContain("secondary");
  });
});
