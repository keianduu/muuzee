"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { displayStatus } from "@/lib/admin/master-labels";
import { selectedQuery } from "@/lib/admin/master-list-state";
import { ExhibitionEditor, type ExhibitionEditorProps } from "./exhibition-editor";

export function ExhibitionDetailDrawer({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closeButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [detail, setDetail] = useState<ExhibitionEditorProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const close = useCallback(() => {
    const query = selectedQuery(searchParams.toString(), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setError(""); return; }
    previouslyFocused.current = document.activeElement as HTMLElement;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch(`/api/admin/exhibitions/${selectedId}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "詳細を読み込めませんでした。");
        setDetail(body);
      } catch (fetchError) {
        if (!controller.signal.aborted) setError(fetchError instanceof Error ? fetchError.message : "詳細を読み込めませんでした。");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    load();
    const reload = (event: Event) => {
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (!id || id === selectedId) {
        router.refresh();
        load();
      }
    };
    window.addEventListener("muuzee:exhibition-updated", reload);
    document.body.classList.add("is-master-drawer-open");
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      controller.abort(); window.removeEventListener("muuzee:exhibition-updated", reload);
      document.body.classList.remove("is-master-drawer-open");
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [router, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      const drawer = closeButton.current?.closest("aside");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, selectedId]);

  if (!selectedId) return null;
  return <div className="master-drawer-layer">
    <button type="button" className="master-drawer-scrim" aria-label="一覧へ戻る" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal="true" aria-labelledby="exhibition-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">Exhibition</p><h1 id="exhibition-drawer-title">{detail?.exhibition.title || "展覧会詳細"}</h1>{detail && <span className={`status ${detail.exhibition.publication_status}`}>{displayStatus(detail.exhibition.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && <p className="drawer-loading">読み込み中...</p>}{error && <div className="error">{error}</div>}{detail && !loading && <ExhibitionEditor {...detail} embeddedInList/>}</div>
    </aside>
  </div>;
}
