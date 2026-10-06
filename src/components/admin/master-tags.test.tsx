import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  attachAdminTag,
  availableAdminTags,
  detachAdminTag,
  type AdminTag,
} from "@/lib/admin/tags";
import { MasterTags } from "./master-tags";

vi.stubGlobal("React", React);

const catalog: AdminTag[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "genre", name: "A", slug: "a" },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", type: "movement", name: "B", slug: "b" },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", type: "theme", name: "C", slug: "c" },
];

describe("MasterTags", () => {
  it("excludes attached Tags, then converges candidates after attach and detach", () => {
    const attached = [catalog[1]];
    expect(availableAdminTags(catalog, attached).map((tag) => tag.name)).toEqual(["A", "C"]);

    const afterAttach = attachAdminTag(attached, catalog[0]);
    expect(afterAttach.map((tag) => tag.name)).toEqual(["B", "A"]);
    expect(availableAdminTags(catalog, afterAttach).map((tag) => tag.name)).toEqual(["C"]);

    const afterDetach = detachAdminTag(afterAttach, catalog[1].id);
    expect(afterDetach.map((tag) => tag.name)).toEqual(["A"]);
    expect(availableAdminTags(catalog, afterDetach).map((tag) => tag.name)).toEqual(["B", "C"]);
  });

  it("renders assigned Tags and an existing-candidate selector without creation controls", () => {
    const markup = renderToStaticMarkup(<MasterTags
      entity="artists"
      masterId="11111111-1111-4111-8111-111111111111"
      rows={[{ tags: catalog[1] }]}
    />);
    expect(markup).toContain("movement / B");
    expect(markup).toContain("既存タグ");
    expect(markup).toContain("タグを付与");
    expect(markup).toContain('aria-label="Bを解除"');
    expect(markup).not.toContain("タグ名");
    expect(markup).not.toContain('name="name"');
    expect(markup).not.toContain("新規作成");
  });
});
