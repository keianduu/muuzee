"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { submitAdminLogin } from "@/lib/admin/login";

export function AdminLoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    setSubmitting(true);
    setError("");
    const result = await submitAdminLogin({
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    });
    if (result.ok) {
      router.replace(result.redirectTo);
      router.refresh();
      return;
    }
    setError(result.message);
    setSubmitting(false);
  }

  return <form className="admin-auth-form" onSubmit={handleSubmit}>
    <div className="field">
      <label htmlFor="admin-email">メールアドレス</label>
      <input id="admin-email" name="email" type="email" autoComplete="username" required disabled={submitting}/>
    </div>
    <div className="field">
      <label htmlFor="admin-password">パスワード</label>
      <input id="admin-password" name="password" type="password" autoComplete="current-password" required disabled={submitting}/>
    </div>
    {error && <p className="admin-auth-error" role="alert">{error}</p>}
    <button className="button" type="submit" disabled={submitting}>
      {submitting ? "ログイン中…" : "ログイン"}
    </button>
  </form>;
}
