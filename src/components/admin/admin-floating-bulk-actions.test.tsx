import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminFloatingBulkActions } from "./admin-floating-bulk-actions";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const props = { busy: false, onPublish: vi.fn(), onUnpublish: vi.fn(), onClear: vi.fn() };

describe("Admin floating bulk actions", () => {
  it("renders nothing without a selection", () => {
    expect(renderToStaticMarkup(<AdminFloatingBulkActions selectedCount={0} {...props}/>)).toBe("");
  });

  it("renders count and the three approved actions for selected records", () => {
    const html = renderToStaticMarkup(<AdminFloatingBulkActions selectedCount={3} {...props}/>);
    expect(html).toContain("3件選択中");
    expect(html).toContain(">公開<");
    expect(html).toContain(">非公開<");
    expect(html).toContain(">選択解除<");
    expect(html).toContain('aria-label="選択項目の一括操作"');
    expect(html).not.toContain("削除");
    expect(html).not.toContain("アーカイブ");
  });

  it("uses the existing endpoint and clears selection when list context changes", () => {
    const list = read("./master-list.tsx");
    const css = read("../../app/globals.css");
    expect(list).toContain("/api/admin/masters/${entity}/bulk-publication");
    expect(list).toContain("setSelected([])");
    expect(list).toContain('classList.toggle("is-master-selection-active", active)');
    expect(list).not.toContain('className="master-action-bar"');
    expect(css).toContain("body.is-master-selection-active");
    expect(css).toContain("var(--admin-list-floating-reserve, 0px)");
  });
});
