"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MasterDetailContent, type DetailRecord } from "./master-detail-content";
import { MasterImageCandidatePicker } from "./master-image-candidate";
import { VenueFieldReviewPanel } from "./venue-field-review-panel";
import { VenueWikidataReviewPanel } from "./venue-wikidata-review-panel";
import { AdminFeedback } from "./admin-feedback";
import { VenueCoordinateReviewPanel } from "./venue-coordinate-review-panel";
import { displayStatus } from "@/lib/admin/master-labels";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { detailPanelQuery, selectedQuery, type DetailPanel } from "@/lib/admin/master-list-state";
import type { SourceImageCandidateRow, VenueCoordinateCandidateRow } from "@/lib/admin/types";
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
  const secondaryReturnTarget = useRef<string | null>(null);
  const [record, setRecord] = useState<DetailRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const config = MASTER_CONFIGS[entity];
  const requestedPanel = searchParams.get("panel") as DetailPanel | null;
  const secondaryRequested = requestedPanel === "image"
    ? ["venues", "artists"].includes(entity)
    : entity === "venues" && ["wikidata-fields", "official-fields", "coordinates"].includes(requestedPanel || "");

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
    secondaryReturnTarget.current = "image";
    const query = detailPanelQuery(searchParams.toString(), "image", { candidateId });
    router.push(`${pathname}?${query}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openReviewPanel = useCallback((panel: DetailPanel, options: { candidateId?: string | null; runId?: string | null; targetUrl?: string | null } = {}) => {
    openedSecondary.current = true;
    secondaryReturnTarget.current = panel;
    const query = detailPanelQuery(searchParams.toString(), panel, options);
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
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        const target = secondaryReturnTarget.current
          ? document.querySelector<HTMLElement>(`[data-secondary-return-anchor="${secondaryReturnTarget.current}"]`) || document.querySelector<HTMLElement>(`[data-secondary-trigger="${secondaryReturnTarget.current}"]`)
          : null;
        (target || closeButton.current)?.focus({ preventScroll: true });
        secondaryReturnTarget.current = null;
      }));
    }
  }, [secondaryRequested]);

  if (!selectedId) return null;
  const currentRecord = record?.id === selectedId ? record : null;
  const title = currentRecord ? entity === "works" ? workDisplayTitleJa(currentRecord) || config.label : String(currentRecord[config.titleKey] || config.label) : config.label;
  const sourceRecords = currentRecord ? (currentRecord.source_records || []) as Array<{ source_image_candidates?: SourceImageCandidateRow[] }> : [];
  const imageCandidates = sourceRecords.flatMap((source) => source.source_image_candidates || []);
  const selectableImageCandidates = imageCandidates.filter((candidate) => candidate.is_active && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected");
  const coordinateCandidates = currentRecord ? (currentRecord.venue_coordinate_candidates || []) as VenueCoordinateCandidateRow[] : [];
  const secondaryTitle = requestedPanel === "wikidata-fields" ? "Wikidataから取得した情報" : requestedPanel === "official-fields" ? "公式サイトから取得した情報" : requestedPanel === "coordinates" ? "位置情報候補を確認" : "画像候補を確認";
  const secondaryEyebrow = requestedPanel === "image" ? "Image Candidate" : "Data Review";
  return <div className={`master-drawer-layer${secondaryRequested ? " has-secondary" : ""}`}>
    <button type="button" className="master-drawer-scrim" aria-label="一覧へ戻る" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal={secondaryRequested ? undefined : "true"} aria-hidden={secondaryRequested || undefined} aria-labelledby="master-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{config.label} Master</p><h1 id="master-drawer-title">{title}</h1>{currentRecord && <span className={`status ${currentRecord.publication_status}`}>{displayStatus(currentRecord.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && !currentRecord && <p className="drawer-loading">Loading...（読み込み中）</p>}<AdminFeedback variant="error" message={error}/>{currentRecord && <MasterDetailContent entity={entity} record={currentRecord} onOpenImageCandidate={["venues", "artists"].includes(entity) ? openImageCandidate : undefined} onOpenReviewPanel={entity === "venues" ? openReviewPanel : undefined}/>}</div>
    </aside>
    {secondaryRequested && <aside className="master-drawer master-drawer--secondary" role="dialog" aria-modal="true" aria-labelledby="master-secondary-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{secondaryEyebrow}</p><h1 id="master-secondary-drawer-title">{secondaryTitle}</h1><p className="muted">{title}</p></div><button ref={secondaryCloseButton} className="drawer-close" type="button" aria-label={`${secondaryTitle}を閉じる`} onClick={closeSecondary}>×</button></header>
      <div className="master-drawer-body master-drawer-body--secondary">{requestedPanel === "image" && currentRecord ? selectableImageCandidates.length ? <MasterImageCandidatePicker entity={entity} ownerId={currentRecord.id} candidates={selectableImageCandidates} subjectLabel={title} onSelected={closeSecondary}/> : <p className="empty-state">画像候補はありません。</p> : requestedPanel === "wikidata-fields" && currentRecord ? <VenueWikidataReviewPanel venueId={currentRecord.id} matched={currentRecord.wikidata_match_status === "matched"}/> : requestedPanel === "official-fields" && currentRecord ? <VenueFieldReviewPanel venueId={currentRecord.id} source="official" runId={searchParams.get("run")} targetUrl={searchParams.get("targetUrl")}/> : requestedPanel === "coordinates" && currentRecord ? <VenueCoordinateReviewPanel venueId={currentRecord.id} candidates={coordinateCandidates} onSelected={closeSecondary}/> : <p className="drawer-loading">読み込み中…</p>}</div>
    </aside>}
  </div>;
}
