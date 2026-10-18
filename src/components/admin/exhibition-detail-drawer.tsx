"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { displayStatus } from "@/lib/admin/master-labels";
import { canonicalizeExhibitionScheduleQuery, detailPanelQuery, selectedQuery } from "@/lib/admin/master-list-state";
import { isPrimaryCandidateUsable } from "@/lib/admin/primary-image-policy";
import { ExhibitionEditor, type ExhibitionEditorProps } from "./exhibition-editor";
import { MasterImageCandidatePicker } from "./master-image-candidate";

export function ExhibitionDetailDrawer({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closeButton = useRef<HTMLButtonElement>(null);
  const secondaryCloseButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const openedSecondary = useRef(false);
  const secondaryWasOpen = useRef(false);
  const [detail, setDetail] = useState<ExhibitionEditorProps | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const secondaryRequested = searchParams.get("panel") === "image";
  const close = useCallback(() => {
    const query = selectedQuery(canonicalizeExhibitionScheduleQuery(searchParams.toString()), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeSecondary = useCallback(() => {
    if (openedSecondary.current) {
      openedSecondary.current = false;
      router.back();
      return;
    }
    const query = detailPanelQuery(canonicalizeExhibitionScheduleQuery(searchParams.toString()), null);
    window.history.replaceState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname, router, searchParams]);

  const openImageCandidate = useCallback((candidateId: string | null) => {
    openedSecondary.current = true;
    const query = detailPanelQuery(canonicalizeExhibitionScheduleQuery(searchParams.toString()), "image", { candidateId });
    window.history.pushState(null, "", `${pathname}?${query}`);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setError(""); return; }
    previouslyFocused.current = [...document.querySelectorAll<HTMLElement>("[data-exhibition-detail-trigger]")]
      .find((element) => element.dataset.exhibitionDetailTrigger === selectedId)
      || document.activeElement as HTMLElement;
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
      const eventDetail = (event as CustomEvent<{ entity?: string; id?: string }>).detail;
      if (event.type === "muuzee:master-updated" && eventDetail?.entity !== "exhibitions") return;
      const id = eventDetail?.id;
      if (!id || id === selectedId) {
        load();
      }
    };
    window.addEventListener("muuzee:exhibition-updated", reload);
    window.addEventListener("muuzee:master-updated", reload);
    document.body.classList.add("is-master-drawer-open");
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      controller.abort(); window.removeEventListener("muuzee:exhibition-updated", reload);
      window.removeEventListener("muuzee:master-updated", reload);
      document.body.classList.remove("is-master-drawer-open");
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [router, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (secondaryRequested) closeSecondary();
        else close();
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = (secondaryRequested ? secondaryCloseButton.current : closeButton.current)?.closest("aside");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, closeSecondary, secondaryRequested, selectedId]);

  useEffect(() => {
    if (secondaryRequested) {
      secondaryWasOpen.current = true;
      window.requestAnimationFrame(() => secondaryCloseButton.current?.focus());
      return;
    }
    if (!secondaryWasOpen.current) return;
    secondaryWasOpen.current = false;
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      (document.querySelector<HTMLElement>('[data-secondary-return-anchor="image"]') || closeButton.current)?.focus({ preventScroll: true });
    }));
  }, [secondaryRequested]);

  if (!selectedId) return null;
  const candidates = detail?.exhibition.source_records
    ?.flatMap((source) => source.source_image_candidates || [])
    .filter(isPrimaryCandidateUsable) || [];
  return <div className={`master-drawer-layer${secondaryRequested ? " has-secondary" : ""}`}>
    <button type="button" className="master-drawer-scrim" aria-label="一覧へ戻る" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal={secondaryRequested ? undefined : "true"} aria-hidden={secondaryRequested || undefined} aria-labelledby="exhibition-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">Exhibition</p><h1 id="exhibition-drawer-title">{detail?.exhibition.title || "展覧会詳細"}</h1>{detail && <span className={`status ${detail.exhibition.publication_status}`}>{displayStatus(detail.exhibition.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && <p className="drawer-loading">読み込み中...</p>}{error && <div className="error">{error}</div>}{detail && !loading && <ExhibitionEditor {...detail} embeddedInList onOpenImageCandidate={openImageCandidate}/>}</div>
    </aside>
    {secondaryRequested && <aside className="master-drawer master-drawer--secondary" role="dialog" aria-modal="true" aria-labelledby="exhibition-secondary-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">Image Candidate</p><h1 id="exhibition-secondary-drawer-title">画像候補を確認</h1><p className="muted">{detail?.exhibition.title || "展覧会"}</p></div><button ref={secondaryCloseButton} className="drawer-close" type="button" aria-label="画像候補を閉じる" onClick={closeSecondary}>×</button></header>
      <div className="master-drawer-body master-drawer-body--secondary">{detail ? candidates.length ? <MasterImageCandidatePicker entity="exhibitions" ownerId={detail.exhibition.id} candidates={candidates} subjectLabel={detail.exhibition.title} onSelected={closeSecondary}/> : <p className="empty-state">画像候補はありません。</p> : <p className="drawer-loading">読み込み中…</p>}</div>
    </aside>}
  </div>;
}
