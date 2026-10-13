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
import type { DeferredMasterScope } from "@/lib/admin/master-detail-loading";

type DeferredPayload = Record<string, unknown> & { id: string };
type DeferredStatus = "idle" | "loading" | "ready" | "error";

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
  const [deferred, setDeferred] = useState<Partial<Record<DeferredMasterScope, DeferredPayload>>>({});
  const [deferredStatus, setDeferredStatus] = useState<Record<DeferredMasterScope, DeferredStatus>>({ data: "idle", media: "idle" });
  const [deferredError, setDeferredError] = useState<Partial<Record<DeferredMasterScope, string>>>({});
  const deferredRef = useRef<Partial<Record<DeferredMasterScope, DeferredPayload>>>({});
  const pendingRef = useRef<Partial<Record<DeferredMasterScope, symbol>>>({});
  const selectedIdRef = useRef(selectedId);
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

  const requestDeferred = useCallback((scopes: DeferredMasterScope[]) => {
    if (!selectedId) return;
    for (const scope of scopes) {
      if (deferredRef.current[scope]?.id === selectedId || pendingRef.current[scope]) continue;
      setDeferredStatus((current) => ({ ...current, [scope]: "loading" }));
      setDeferredError((current) => ({ ...current, [scope]: "" }));
      const suffix = scope === "data" ? "data" : "media";
      const token = Symbol(scope);
      pendingRef.current[scope] = token;
      void (async () => {
        try {
          const response = await fetch(`/api/admin/masters/${entity}/${selectedId}/${suffix}`, { cache: "no-store" });
          const body = await response.json() as DeferredPayload & { error?: string };
          if (!response.ok || body.error) throw new Error(body.error || "Deferred detail fetch failed");
          if (selectedIdRef.current !== selectedId) return;
          deferredRef.current = { ...deferredRef.current, [scope]: body };
          setDeferred(deferredRef.current);
          setDeferredStatus((current) => ({ ...current, [scope]: "ready" }));
        } catch (fetchError) {
          if (selectedIdRef.current !== selectedId) return;
          setDeferredStatus((current) => ({ ...current, [scope]: "error" }));
          setDeferredError((current) => ({ ...current, [scope]: fetchError instanceof Error ? fetchError.message : "Deferred detail fetch failed" }));
        } finally {
          if (pendingRef.current[scope] === token) delete pendingRef.current[scope];
        }
      })();
    }
  }, [entity, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    deferredRef.current = {};
    pendingRef.current = {};
    setDeferred({});
    setDeferredStatus({ data: "idle", media: "idle" });
    setDeferredError({});
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
    const reload = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { invalidateData?: boolean } : null;
      const hadData = detail?.invalidateData !== false && Boolean(deferredRef.current.data);
      if (hadData) {
        const rest = { ...deferredRef.current };
        delete rest.data;
        deferredRef.current = rest;
        setDeferred(rest);
        setDeferredStatus((current) => ({ ...current, data: "idle" }));
      }
      load();
      if (hadData) requestDeferred(["data"]);
    };
    window.addEventListener("muuzee:master-updated", reload);
    document.body.classList.add("is-master-drawer-open");
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      controller.abort(); window.removeEventListener("muuzee:master-updated", reload);
      document.body.classList.remove("is-master-drawer-open");
      previouslyFocused.current?.focus?.({ preventScroll: true });
    };
  }, [entity, requestDeferred, selectedId]);

  useEffect(() => {
    if (requestedPanel === "image" || requestedPanel === "coordinates") requestDeferred(["data"]);
  }, [requestDeferred, requestedPanel]);

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
  const hydratedRecord = currentRecord ? {
    ...currentRecord,
    ...(deferred.data?.id === selectedId ? deferred.data : {}),
    ...(deferred.media?.id === selectedId ? deferred.media : {}),
  } as DetailRecord : null;
  const title = hydratedRecord ? entity === "works" ? workDisplayTitleJa(hydratedRecord) || config.label : String(hydratedRecord[config.titleKey] || config.label) : config.label;
  const sourceRecords = hydratedRecord ? (hydratedRecord.source_records || []) as Array<{ source_image_candidates?: SourceImageCandidateRow[] }> : [];
  const imageCandidates = sourceRecords.flatMap((source) => source.source_image_candidates || []);
  const selectableImageCandidates = imageCandidates.filter((candidate) => candidate.is_active && candidate.review_status !== "rejected" && candidate.rights_status !== "rejected");
  const coordinateCandidates = hydratedRecord ? (hydratedRecord.venue_coordinate_candidates || []) as VenueCoordinateCandidateRow[] : [];
  const deferredReady = { data: deferred.data?.id === selectedId, media: deferred.media?.id === selectedId };
  const secondaryNeedsData = requestedPanel === "image" || requestedPanel === "coordinates";
  const secondaryTitle = requestedPanel === "wikidata-fields" ? "Wikidataから取得した情報" : requestedPanel === "official-fields" ? "公式サイトから取得した情報" : requestedPanel === "coordinates" ? "位置情報候補を確認" : "画像候補を確認";
  const secondaryEyebrow = requestedPanel === "image" ? "Image Candidate" : "Data Review";
  return <div className={`master-drawer-layer${secondaryRequested ? " has-secondary" : ""}`}>
    <button type="button" className="master-drawer-scrim" aria-label="一覧へ戻る" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal={secondaryRequested ? undefined : "true"} aria-hidden={secondaryRequested || undefined} aria-labelledby="master-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{config.label} Master</p><h1 id="master-drawer-title">{title}</h1>{currentRecord && <span className={`status ${currentRecord.publication_status}`}>{displayStatus(currentRecord.publication_status)}</span>}</div><button ref={closeButton} className="drawer-close" type="button" aria-label="詳細を閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{loading && !hydratedRecord && <p className="drawer-loading">Loading...（読み込み中）</p>}<AdminFeedback variant="error" message={error}/>{hydratedRecord && <MasterDetailContent entity={entity} record={hydratedRecord} deferredReady={deferredReady} deferredError={deferredError} onRequestDeferred={requestDeferred} onOpenImageCandidate={["venues", "artists"].includes(entity) ? openImageCandidate : undefined} onOpenReviewPanel={entity === "venues" ? openReviewPanel : undefined}/>}</div>
    </aside>
    {secondaryRequested && <aside className="master-drawer master-drawer--secondary" role="dialog" aria-modal="true" aria-labelledby="master-secondary-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">{secondaryEyebrow}</p><h1 id="master-secondary-drawer-title">{secondaryTitle}</h1><p className="muted">{title}</p></div><button ref={secondaryCloseButton} className="drawer-close" type="button" aria-label={`${secondaryTitle}を閉じる`} onClick={closeSecondary}>×</button></header>
      <div className="master-drawer-body master-drawer-body--secondary">{secondaryNeedsData && !deferredReady.data ? <><p className="drawer-loading">Loading...（必要なデータを読み込み中）</p><AdminFeedback variant="error" message={deferredError.data || ""}/>{deferredStatus.data === "error" && <button type="button" className="button secondary" onClick={() => requestDeferred(["data"])}>再試行</button>}</> : requestedPanel === "image" && hydratedRecord ? selectableImageCandidates.length ? <MasterImageCandidatePicker entity={entity} ownerId={hydratedRecord.id} candidates={selectableImageCandidates} subjectLabel={title} onSelected={closeSecondary}/> : <p className="empty-state">画像候補はありません。</p> : requestedPanel === "wikidata-fields" && hydratedRecord ? <VenueWikidataReviewPanel venueId={hydratedRecord.id} matched={hydratedRecord.wikidata_match_status === "matched"}/> : requestedPanel === "official-fields" && hydratedRecord ? <VenueFieldReviewPanel venueId={hydratedRecord.id} source="official" runId={searchParams.get("run")} targetUrl={searchParams.get("targetUrl")}/> : requestedPanel === "coordinates" && hydratedRecord ? <VenueCoordinateReviewPanel venueId={hydratedRecord.id} candidates={coordinateCandidates} onSelected={closeSecondary}/> : <p className="drawer-loading">読み込み中…</p>}</div>
    </aside>}
  </div>;
}
