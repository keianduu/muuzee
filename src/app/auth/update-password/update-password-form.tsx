"use client";

import { useState, type FormEvent } from "react";
import type { AuthOperationResult } from "@/lib/auth/types";
import { MINIMUM_PASSWORD_LENGTH } from "@/lib/auth/validation";

const ERROR_MESSAGE: Record<string, string> = {
  invalid_input: "8文字以上の新しいパスワードを入力してください。",
  unauthenticated: "再設定リンクの有効期限が切れています。もう一度メールを送信してください。",
  rate_limited: "しばらく待ってから、もう一度お試しください。",
  temporary: "現在更新できません。時間をおいて、もう一度お試しください。",
};

export function UpdatePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const formElement = event.currentTarget;
    try {
      const form = new FormData(formElement);
      const response = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password") }),
      });
      const result = await response.json() as AuthOperationResult;
      if (result.ok) {
        setIsError(false);
        setMessage("パスワードを更新しました。");
        formElement.reset();
        return;
      }
      setIsError(true);
      setMessage(ERROR_MESSAGE[result.error.code] ?? "パスワードを更新できませんでした。");
    } catch {
      setIsError(true);
      setMessage(ERROR_MESSAGE.temporary);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <div className="field full">
        <label htmlFor="new-password">新しいパスワード</label>
        <input
          id="new-password"
          name="password"
          type="password"
          minLength={MINIMUM_PASSWORD_LENGTH}
          autoComplete="new-password"
          required
        />
      </div>
      <div className="actions">
        <button className="button" type="submit" disabled={submitting}>
          {submitting ? "更新中…" : "パスワードを更新"}
        </button>
      </div>
      {message ? <p className={isError ? "error" : "notice"} role="status">{message}</p> : null}
    </form>
  );
}
