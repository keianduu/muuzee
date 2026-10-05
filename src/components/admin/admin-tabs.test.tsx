import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AdminTabs } from "./admin-tabs";

vi.stubGlobal("React", React);

describe("AdminTabs", () => {
  it("shares the edit-tab visual and accessible state", () => {
    const markup = renderToStaticMarkup(<AdminTabs
      tabs={[{ id: "basic", label: "基本情報" }, { id: "image", label: "画像登録" }, { id: "relations", label: "関連情報" }] as const}
      value="image"
      onChange={vi.fn()}
      label="Artist編集セクション"
      variant="edit"
      returnAnchor="image"
    />);
    expect(markup).toContain('class="admin-edit-tabs"');
    expect(markup).toContain('aria-label="Artist編集セクション"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('data-secondary-return-anchor="image"');
  });
});
