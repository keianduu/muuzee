"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return <button className="button secondary" type="button" onClick={logout} disabled={submitting}>
    {submitting ? "ログアウト中…" : "ログアウト"}
  </button>;
}
