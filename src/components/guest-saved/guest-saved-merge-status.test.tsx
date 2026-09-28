import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuestSavedMergeFeedback } from "./guest-saved-merge-status";

vi.stubGlobal("React", React);

describe("Guest Saved merge feedback", () => {
  it("renders the in-progress and success status copy", () => {
    expect(renderToStaticMarkup(<GuestSavedMergeFeedback status="merging" onRetry={vi.fn()} />))
      .toContain("保存した内容を引き継いでいます");
    expect(renderToStaticMarkup(<GuestSavedMergeFeedback status="merged" onRetry={vi.fn()} />))
      .toContain("保存した内容をアカウントへ引き継ぎました。");
  });

  it.each(["partial", "unauthenticated", "storage_unavailable", "temporary"] as const)(
    "renders a retry action for %s",
    (status) => {
      const markup = renderToStaticMarkup(<GuestSavedMergeFeedback status={status} onRetry={vi.fn()} />);
      expect(markup).toContain("もう一度試す");
      expect(markup).toContain('role="alert"');
    },
  );
});
