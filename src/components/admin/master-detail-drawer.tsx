"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MasterDetailContent, type DetailRecord } from "./master-detail-content";
import { MasterImageCandidatePanel } from "./master-image-candidate";
import { displayStatus } from "@/lib/admin/master-labels";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { detailPanelQuery, selectedQuery } from "@/lib/admin/master-list-state";
import type { SourceImageCandidateRow } from "@/lib/admin/types";
import { workDisplayTitleJa } from "@/lib/work-title";

export function MasterDetailDrawer({ entity, selectedId }: { entity: MasterEntity; selectedId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closeButton = useRef<HTMLButtonElement>(null);
  const secondaryCloseButton = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const openedSecondary = useRef(false);
  const secondaryWasOpen = useRef(false);
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const config = MASTER_CONFIGS[entity];
  const secondaryRequested = entity === "venues" && searchParams.get("panel") === "image";

  const close = useCallback(() => {
    const query = selectedQuery(searchParams.toString(), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeSecondary = useCallback(() => {
    if (openedSecondary.current) {
      openedSecondary.current = false;
      router.back();
      return;
    }
    const query = detailPanelQuery(searchParams.toString(), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openImageCandidate = useCallback((candidateId: string | null) => {
    openedSecondary.current = true;
    const query = detailPanelQuery(searchParams.toString(), "image", candidateId);
    router.push(`${pathname}?${query}`, { scroll: false });
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
      if (event.key === "Escape") {
        if (secondaryRequested) closeSecondary();
        else close();
      }
      if (event.key !== "Tab") return;
      const drawer = (secondaryRequested ? secondaryCloseButton.current : closeButton.current)?.closest("aside");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
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
    } else if (secondaryWasOpen.current) {
      secondaryWasOpen.current = false;
      window.requestAnimationFrame(() => closeButton.current?.focus());
    }
  }, [secondaryRequested]);

  if (!selectedId) return null;
  const currentRecord = record?.id === selectedId ? record : null;
  const title = currentRecord ? entity === "works" ? workDisplayTitleJa(currentRecord) || config.label : String(currentRecord[config.titleKey] || config.label) : config.label;
  const sourceRecords = currentRecord ? (currentRecord.source_records || []) as Array<{ source_image_candidates?: SourceImageCandidateRow[] }> : [];
  const imageCandidates = sourceRecords.flatMap((source) => source.source_image_candidates || []);
  const selectedCandidate = imageCandidates.find((candidate) => candidate.id === searchParams.get("candidate"));
  return <div className={`master-drawer-layer${secondaryRequested ? " has-secondary" : ""}`}>
    <button type="button" className="master-drawer-scrim" aria-label="一覧へ戻る" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal={secondaryRequested ? undefined : "true"} aria-hidden={secondaryRequested || undefined} aria-labelledby="master-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{config.label} Master</p><h1 id="master-drawer-title">{title}</h1>{currentRecord && <span className={`status ${currentRecord.publication_status}`}>{displayStatus(currentRecord.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && !currentRecord && <p className="drawer-loading">Loading...（読み込み中）</p>}{error && <div className="error">{error}</div>}{currentRecord && <MasterDetailContent entity={entity} record={currentRecord} onOpenImageCandidate={entity === "venues" ? openImageCandidate : undefined}/>}</div>
    </aside>
    {secondaryRequested && <aside className="master-drawer master-drawer--secondary" role="dialog" aria-modal="true" aria-labelledby="image-candidate-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">Image Candidate</p><h1 id="image-candidate-drawer-title">画像候補を確認</h1><p className="muted">{title}</p></div><button ref={secondaryCloseButton} className="drawer-close" type="button" aria-label="画像候補を閉じる" onClick={closeSecondary}>×</button></header>
      <div className="master-drawer-body master-drawer-body--secondary">{searchParams.get("candidate") ? selectedCandidate ? <MasterImageCandidatePanel candidate={selectedCandidate} subjectLabel={title}/> : <div className="error">画像候補が見つかりません。</div> : <><p className="muted">現在のVenueに紐づく画像候補を確認します。</p>{imageCandidates.length ? <div className="image-candidate-list">{imageCandidates.map((candidate) => <button type="button" className="image-candidate-index-row" key={candidate.id} onClick={() => openImageCandidate(candidate.id)}><span>{candidate.license_short_name || "ライセンス記載なし"}</span><strong>{candidate.review_status} / {candidate.rights_status}</strong></button>)}</div> : <p className="empty-state">画像候補はありません。</p>}</>}</div>
    </aside>}
  </div>;
}
