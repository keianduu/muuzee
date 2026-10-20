import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Exhibition list performance contract", () => {
  it("uses the bounded Exhibition list repository on first render", () => {
    const page = read("../../app/admin/exhibitions/page.tsx");
    const repository = read("./exhibition-list-repository.ts");

    expect(page).toContain("listExhibitions({ status, image, schedule, q: queryValue, page: 1, pageSize: 50 })");
    expect(page).not.toContain("getExhibitions()");
    expect(repository).toContain('.select("id,title,updated_at,publication_status", { count: "exact" })');
    expect(repository).toContain('.range((page - 1) * pageSize, page * pageSize - 1)');
    expect(repository).not.toContain('select("*, exhibition_occurrences');
  });

  it("applies publication, schedule, image, and keyword filters before page hydration", () => {
    const repository = read("./exhibition-list-repository.ts");

    expect(repository).toContain('normalizePublicationStatus(options.status)');
    expect(repository).toContain('scheduleExhibitionIds(schedule');
    expect(repository).toContain('options.image === "present"');
    expect(repository).toContain('options.image === "missing"');
    expect(repository).toContain('query.ilike("title"');
    expect(repository).toContain('.is("exhibition_occurrences", null)');
  });

  it("signs only primary images belonging to bounded returned rows", () => {
    const repository = read("./exhibition-list-repository.ts");

    expect(repository).toContain('const ids = baseRows.map((row) => row.id)');
    expect(repository).toContain('.in("exhibition_id", ids).eq("is_primary", true)');
    expect(repository).toContain('createSignedUrl(asset.storage_path, 3600)');
    expect(repository).not.toContain('media_assets(*)');
    expect(repository).not.toContain('source_image_candidates(*)');
    expect(repository).not.toContain('raw_payload');
  });

  it("keeps filter state while updating count, drawer state, and infinite pages locally", () => {
    const component = read("../../components/admin/exhibition-list.tsx");

    expect(component).toContain('}, [queryString]);');
    expect(component).toContain('setTotal((current) => Math.max(0, current - 1))');
    expect(component).toContain('clearSelected()');
    expect(component).toContain('window.history.replaceState');
    expect(component).toContain('mergeUniqueRows(current, body.rows)');
    expect(component).toContain('rebuildLoadedRows(loadedResults.map((loaded) => loaded.rows))');
    expect(component).toContain('if (!body.matches)');
    expect(component).toContain('pageQuery(queryString, nextPage)');
    expect(component).not.toContain('router.refresh()');
    expect(component).not.toContain('window.location.reload');
  });

  it("returns the resulting publication status for the narrow update event", () => {
    const route = read("../../app/api/admin/exhibitions/[id]/publication/route.ts");
    const editor = read("../../components/admin/exhibition-editor.tsx");

    expect(route).toContain("publication_status: nextStatus");
    expect(editor).toContain('typeof body.publication_status === "string"');
    expect(editor).toContain("publication_status: body.publication_status");
  });
});
