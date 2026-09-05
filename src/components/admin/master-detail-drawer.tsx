"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MasterDetailContent, type DetailRecord } from "./master-detail-content";
import { displayStatus } from "@/lib/admin/master-labels";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { selectedQuery } from "@/lib/admin/master-list-state";

export function MasterDetailDrawer({ entity, selectedId }: { entity: MasterEntity; selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const config = MASTER_CONFIGS[entity];

  const close = useCallback(() => {
    const query = selectedQuery(searchParams.toString(), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!selectedId) { setRecord(null); setError(""); return; }
    previouslyFocused.current = document.activeElement as HTMLElement;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/admin/masters/${entity}/${selectedId}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Detail fetch failed");
        setRecord(body);
      } catch (fetchError) {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : "Detail fetch failed");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    const reload = () => load();
    window.addEventListener("muuzee:master-updated", reload);
    document.body.classList.add("is-master-drawer-open");
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      controller.abort(); window.removeEventListener("muuzee:master-updated", reload);
      document.body.classList.remove("is-master-drawer-open");
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [entity, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const drawer = closeButton.current?.closest("aside");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, selectedId]);

  if (!selectedId) return null;
  const title = record ? String(record[config.titleKey] || config.label) : config.label;
  return <div className="master-drawer-layer">
    <button type="button" className="master-drawer-scrim" aria-label="詳細を閉じる" onClick={close}/>
    <aside className="master-drawer" role="dialog" aria-modal="true" aria-labelledby="master-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{config.label} Master</p><h1 id="master-drawer-title">{title}</h1>{record && <span className={`status ${record.publication_status}`}>{displayStatus(record.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && <p className="drawer-loading">Loading...（読み込み中）</p>}{error && <div className="error">{error}</div>}{record && !loading && <MasterDetailContent entity={entity} record={record}/>}</div>
    </aside>
  </div>;
}
