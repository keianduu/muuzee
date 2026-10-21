import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Exhibition publication client switch contract", () => {
  it("keeps initial SSR and delegates subsequent publication switches to one client shell", () => {
    const page = read("../../app/admin/exhibitions/page.tsx");
    const shell = read("./exhibition-list-shell.tsx");
    expect(page).toContain("const result = await listExhibitions(");
    expect(page).toContain("<ExhibitionListShell");
    expect(shell).toContain('<AdminListControls\n      entity="exhibitions"');
    expect(shell).toContain("onPublicationStatusChange={switchPublicationStatus}");
  });

  it("uses bounded client GETs, native history, cache revalidation, race protection, and popstate", () => {
    const shell = read("./exhibition-list-shell.tsx");
    expect(shell).toContain("window.history.pushState");
    expect(shell).toContain('fetch(`/api/admin/exhibitions?${exhibitionFirstPageRequestQuery(requestedQuery)}`');
    expect(shell).toContain("new Map(");
    expect(shell).toContain("new AbortController()");
    expect(shell).toContain("isCurrentExhibitionListRequest");
    expect(shell).toContain('window.addEventListener("popstate"');
    expect(shell).toContain("EXHIBITION_LIST_UPDATED_EVENT");
    expect(shell).not.toContain("router.push");
    expect(shell).not.toContain("router.refresh");
    expect(shell).not.toContain("location.reload");
  });

  it("separates requested navigation from the last valid committed list", () => {
    const shell = read("./exhibition-list-shell.tsx");
    expect(shell).toContain("clientState.requestedQuery");
    expect(shell).toContain("result={clientState.committed.result}");
    expect(shell).toContain("queryString={clientState.committed.query}");
    expect(shell).toContain("selectionQueryString={clientState.requestedQuery}");
    expect(shell).toContain("requestExhibitionPublicationState");
    expect(shell).toContain("commitExhibitionPublicationState");
    expect(shell).toContain("failExhibitionPublicationState");
  });

  it("aborts and rejects stale infinite-scroll responses after a committed query change", () => {
    const list = read("./exhibition-list.tsx");
    expect(list).toContain("loadMoreController.current?.abort()");
    expect(list).toContain("signal: controller.signal");
    expect(list).toContain("isCurrentExhibitionListRequest(requestedQuery, committedQueryRef.current, generation, loadMoreGeneration.current)");
  });

  it("leaves shared router navigation as the default for the other master lists", () => {
    const controls = read("./admin-list-controls.tsx");
    const masterIndex = read("./master-index-page.tsx");
    expect(controls).toContain("if (onStatusChange)");
    expect(controls).toContain("navigate(router, pathname, publicationTabQuery(currentQuery, tab.value))");
    expect(masterIndex).toContain("<AdminListControls entity={entity}");
  });

  it("replaces the list when a same-query background revalidation completes", () => {
    const list = read("./exhibition-list.tsx");
    expect(list).toContain("}, [queryString, result]);");
  });
});
