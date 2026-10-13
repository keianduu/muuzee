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

  it("opens and closes Master Detail locally while keeping canonical URL history", () => {
    const list = read("./master-list.tsx");
    const detail = read("./master-detail-drawer.tsx");

    expect(list).toContain("setActiveSelectedId(id)");
    expect(list).toContain('window.history.pushState(null, "", `${pathname}?${selectedQuery(searchParams.toString(), id)}`)');
    expect(list).toContain("selectedId={activeSelectedId}");
    expect(detail).toContain("onRequestClose?.()");
    expect(detail).toContain('window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`)');
    expect(detail).toContain("router.back()");
  });

  it("keeps navigation prefetch bounded and exposes immediate pending feedback", () => {
    const navigation = read("./admin-navigation.tsx");
    const controls = read("./admin-list-controls.tsx");

    expect(navigation).toContain("prefetch={false}");
    expect(navigation).toContain("is-pending");
    expect(navigation).toContain("aria-busy={pending || undefined}");
    expect(controls).toContain("setPendingStatus(tab.value)");
    expect(controls).toContain("aria-busy={pendingStatus === tab.value || undefined}");
  });

  it("uses bounded canonical name order for the normal Artist list", () => {
    const repository = read("../../lib/admin/master-repository.ts");

    expect(repository).toContain('entity === "artists" && !options.tier && !options.completeness');
    expect(repository).toContain('.order("name", { ascending: true }).order("id", { ascending: true }).range(');
  });

  it("keeps Venue list ordering without loading Quality Summary-only payload", () => {
    const repository = read("../../lib/admin/master-repository.ts");
    const listOrderRows = repository.slice(repository.indexOf("async function allVenueListOrderRows"), repository.indexOf("async function allArtistQualityRows"));

    expect(listOrderRows).toContain("media_assets(id,is_primary,rights_status)");
    expect(listOrderRows).not.toContain("source_records");
    expect(listOrderRows).not.toContain("venue_external_match_candidates");
    expect(repository).toContain("const qualityRows = await allVenueListOrderRows()");
    expect(repository).not.toContain("qualityDashboard: dashboardFor(qualityRows, options.tier)");
  });
});
