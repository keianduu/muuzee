"use client";

import { useEffect, useMemo, useState } from "react";
import type { MasterEntity } from "@/lib/admin/master-config";
import {
  ADMIN_TAG_TYPES,
  attachAdminTag,
  attachedAdminTags,
  availableAdminTags,
  detachAdminTag,
  type AdminTag,
  type AdminTagType,
} from "@/lib/admin/tags";

type TagFilter = AdminTagType | "all";

export function MasterTags({ entity, masterId, rows, title = "分類・タグ" }: { entity: MasterEntity; masterId: string; rows: Array<Record<string, unknown>>; title?: string }) {
  const [attached, setAttached] = useState(() => attachedAdminTags(rows));
  const [catalog, setCatalog] = useState<AdminTag[]>([]);
  const [typeFilter, setTypeFilter] = useState<TagFilter>("all");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setAttached(attachedAdminTags(rows));
  }, [masterId, rows]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    setLoading(true);
    setMessage("");
    fetch(`/api/admin/tags${params.toString() ? `?${params}` : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Tagを取得できませんでした。");
        setCatalog(result.tags as AdminTag[]);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setCatalog([]);
        setMessage(error instanceof Error ? error.message : "Tagを取得できませんでした。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [typeFilter]);

  const available = useMemo(() => availableAdminTags(catalog, attached), [catalog, attached]);

  useEffect(() => {
    if (!available.some((tag) => tag.id === selectedTagId)) setSelectedTagId(available[0]?.id || "");
  }, [available, selectedTagId]);

  async function attach(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTagId) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/masters/${entity}/${masterId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: selectedTagId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Tagを付与できませんでした。");
      setAttached((current) => attachAdminTag(current, result.tag as AdminTag));
      setSelectedTagId("");
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tagを付与できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  async function detach(tag: AdminTag) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/masters/${entity}/${masterId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Tagを解除できませんでした。");
      setAttached((current) => detachAdminTag(current, tag.id));
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Tagを解除できませんでした。");
    } finally {
      setBusy(false);
    }
  }

  return <section>
    <h2>{title}</h2>
    <div className="card">
      <div className="tag-list">
        {attached.map((tag) => <span className="tag" key={tag.id}>{tag.type} / {tag.name} <button type="button" aria-label={`${tag.name}を解除`} disabled={busy} onClick={() => detach(tag)}>×</button></span>)}
        {!attached.length && <span className="muted">タグはありません。</span>}
      </div>
      <form className="tag-form" onSubmit={attach}>
        <div className="field">
          <label htmlFor={`${entity}-${masterId}-tag-type`}>種別</label>
          <select id={`${entity}-${masterId}-tag-type`} value={typeFilter} disabled={busy} onChange={(event) => setTypeFilter(event.target.value as TagFilter)}>
            <option value="all">すべて</option>
            {ADMIN_TAG_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${entity}-${masterId}-tag-candidate`}>既存タグ</label>
          <select id={`${entity}-${masterId}-tag-candidate`} value={selectedTagId} disabled={busy || loading || !available.length} onChange={(event) => setSelectedTagId(event.target.value)}>
            {!available.length && <option value="">{loading ? "読み込み中…" : "利用可能なタグはありません。"}</option>}
            {available.map((tag) => <option key={tag.id} value={tag.id}>{tag.type} / {tag.name}</option>)}
          </select>
        </div>
        <button className="button secondary" disabled={busy || loading || !selectedTagId}>タグを付与</button>
      </form>
      {!loading && !available.length && <p className="muted tag-empty-state">利用可能なタグはありません。</p>}
      {message && <p className="muted" aria-live="polite">{message}</p>}
    </div>
  </section>;
}
