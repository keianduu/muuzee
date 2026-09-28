import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuestSavedMergeFeedback } from "./guest-saved-merge-status";

vi.stubGlobal("React", React);

describe("Guest Saved merge feedback", () => {
  it("renders the in-progress and success status copy", () => {
    expect(renderToStaticMarkup(<GuestSavedMergeFeedback status="merging" retryable={false} onRetry={vi.fn()} />))
      .toContain("保存した内容を引き継いでいます");
    expect(renderToStaticMarkup(<GuestSavedMergeFeedback status="merged" retryable={false} onRetry={vi.fn()} />))
      .toContain("保存した内容をアカウントへ引き継ぎました。");
  });

  it("renders Retry only for a retryable outcome", () => {
    const retryable = renderToStaticMarkup(
      <GuestSavedMergeFeedback status="partial" retryable onRetry={vi.fn()} />,
    );
    const nonRetryable = renderToStaticMarkup(
      <GuestSavedMergeFeedback status="request_error" retryable={false} onRetry={vi.fn()} />,
    );
    expect(retryable).toContain("もう一度試す");
    expect(nonRetryable).not.toContain("もう一度試す");
    expect(nonRetryable).toContain('role="alert"');
  });
});
