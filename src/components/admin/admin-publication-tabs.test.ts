import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("shared publication filter pills", () => {
  it("keeps one shared publication control across all four master lists", () => {
    const controls = read("./admin-list-controls.tsx");
    const masterIndex = read("./master-index-page.tsx");
    const exhibitions = read("../../app/admin/exhibitions/page.tsx");
    const exhibitionShell = read("./exhibition-list-shell.tsx");
    expect(controls).toContain("<AdminPublicationTabs entity={entity}");
    expect(masterIndex).toContain("<AdminListControls entity={entity}");
    expect(exhibitions).toContain("<ExhibitionListShell");
    expect(exhibitionShell).toContain('entity="exhibitions"');
  });

  it("renders Publication tabs as canonical compact Filter Pills", () => {
    const css = read("../../app/globals.css");
    expect(css).toMatch(/\.admin-publication-tabs\s*\{[^}]*gap:\s*8px;[^}]*overflow-x:\s*auto;/);
    expect(css).toMatch(/\.admin-publication-tabs button\s*\{[^}]*min-height:\s*32px;[^}]*border-radius:\s*999px;[^}]*background:\s*var\(--surface-strong\);/);
    expect(css).toMatch(/\.admin-publication-tabs button\.is-active\s*\{[^}]*background:\s*var\(--ink-950\);[^}]*color:\s*var\(--white\);/);
  });

  it("keeps shared drawer card and form rhythm within the approved range", () => {
    const css = read("../../app/globals.css");
    expect(css).toMatch(/\.detail-tab-panel[^}]*\+[^}]*\{\s*margin-top:\s*20px;/);
  });
});
