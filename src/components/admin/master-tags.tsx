"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MasterEntity } from "@/lib/admin/master-config";

function tagFrom(row: Record<string, unknown>) {
  const value = row.tags; return (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined;
}

export function MasterTags({ entity, masterId, rows, title = "分類・タグ", compactType = false }: { entity: MasterEntity; masterId: string; rows: Array<Record<string, unknown>>; title?: string; compactType?: boolean }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function mutate(method: "POST" | "DELETE", body: Record<string, unknown>) {
    setBusy(true); setMessage("");
    try { const response = await fetch(`/api/admin/masters/${entity}/${masterId}/tags`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Request failed"); setMessage(result.message); router.refresh(); window.dispatchEvent(new CustomEvent("muuzee:master-updated")); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Request failed"); } finally { setBusy(false); }
  }
  async function add(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); await mutate("POST", Object.fromEntries(form)); }
  return <section><h2>{title}</h2><div className="card"><div className="tag-list">{rows.map((row) => { const tag = tagFrom(row); return tag ? <span className="tag" key={String(tag.id)}>{compactType && String(tag.type) === "other" ? String(tag.name) : `${String(tag.type)} / ${String(tag.name)}`} <button type="button" aria-label={`${String(tag.name)}を解除`} disabled={busy} onClick={() => mutate("DELETE", { tagId: tag.id })}>×</button></span> : null; })}{!rows.length && <span className="muted">タグはありません。</span>}</div><form className={`tag-form${compactType ? " tag-form--compact" : ""}`} onSubmit={add}>{compactType ? <input type="hidden" name="type" value="other"/> : <div className="field"><label>種別</label><select name="type" defaultValue="other"><option>genre</option><option>movement</option><option>era</option><option>theme</option><option>other</option></select></div>}<div className="field"><label>タグ名</label><input name="name" required/></div><button className="button secondary" disabled={busy}>タグを追加</button></form>{message && <p className="muted">{message}</p>}</div></section>;
}
