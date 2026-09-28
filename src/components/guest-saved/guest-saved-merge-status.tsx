"use client";

import { useCallback, useEffect, useState } from "react";
import { mergeGuestSaved, type GuestSavedMergeOutcome } from "@/lib/guest-saved/merge";
import { readGuestSaved } from "@/lib/guest-saved/store";

type Status = "checking" | "merging" | GuestSavedMergeOutcome["status"];

export function GuestSavedMergeFeedback({
  status,
  retryable,
  onRetry,
}: {
  status: Exclude<Status, "checking" | "empty">;
  retryable: boolean;
  onRetry: () => void;
}) {
  if (status === "merging") return <p className="notice" role="status">保存した内容を引き継いでいます</p>;
  if (status === "merged") return <p className="notice" role="status">保存した内容をアカウントへ引き継ぎました。</p>;

  const message = status === "partial"
    ? "一部の保存内容を引き継げませんでした。未完了の内容は端末に残っています。"
    : status === "unauthenticated"
      ? "認証状態を確認できませんでした。保存内容は端末に残っています。"
      : "保存内容の引き継ぎを完了できませんでした。内容は端末に残っています。";

  return (
    <div className="error" role="alert">
      <p>{message}</p>
      {retryable
        ? <button className="button secondary" type="button" onClick={onRetry}>もう一度試す</button>
        : null}
    </div>
  );
}

export function GuestSavedMergeStatus() {
  const [feedback, setFeedback] = useState<{ status: Status; retryable: boolean }>({
    status: "checking",
    retryable: false,
  });

  const run = useCallback(async () => {
    const pending = readGuestSaved();
    if (pending.ok && !pending.value.length) {
      setFeedback({ status: "empty", retryable: false });
      return;
    }
    if (pending.ok) setFeedback({ status: "merging", retryable: false });
    const outcome = await mergeGuestSaved();
    setFeedback({ status: outcome.status, retryable: outcome.retryable });
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  if (feedback.status === "checking" || feedback.status === "empty") return null;
  return (
    <GuestSavedMergeFeedback
      status={feedback.status}
      retryable={feedback.retryable}
      onRetry={() => void run()}
    />
  );
}
