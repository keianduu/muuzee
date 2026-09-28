"use client";

import { useCallback, useEffect, useState } from "react";
import { mergeGuestSaved, type GuestSavedMergeOutcome } from "@/lib/guest-saved/merge";
import { readGuestSaved } from "@/lib/guest-saved/store";

type Status = "checking" | "merging" | GuestSavedMergeOutcome["status"];

export function GuestSavedMergeFeedback({
  status,
  onRetry,
}: {
  status: Exclude<Status, "checking" | "empty">;
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
      <button className="button secondary" type="button" onClick={onRetry}>もう一度試す</button>
    </div>
  );
}

export function GuestSavedMergeStatus() {
  const [status, setStatus] = useState<Status>("checking");

  const run = useCallback(async () => {
    const pending = readGuestSaved();
    if (pending.ok && !pending.value.length) {
      setStatus("empty");
      return;
    }
    if (pending.ok) setStatus("merging");
    const outcome = await mergeGuestSaved();
    setStatus(outcome.status);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  if (status === "checking" || status === "empty") return null;
  return <GuestSavedMergeFeedback status={status} onRetry={() => void run()} />;
}
