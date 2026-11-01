"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dataAcquisitionDetailQuery } from "@/lib/admin/data-acquisition-detail-state";
import type { DataAcquisitionEntity } from "@/lib/admin/data-acquisition-entity";

const LABELS: Record<DataAcquisitionEntity, string> = {
  exhibitions: "Exhibition",
  venues: "Venue",
  artists: "Artist",
  works: "Works",
};

export function DataAcquisitionSummaryDrawer({ entity, children }: { entity: DataAcquisitionEntity; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    const query = dataAcquisitionDetailQuery(searchParams.toString(), null);
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    document.body.classList.add("is-master-drawer-open");
    window.requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      document.body.classList.remove("is-master-drawer-open");
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-data-acquisition-detail-trigger="${entity}"]`)?.focus({ preventScroll: true });
      });
    };
  }, [entity]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const drawer = closeButton.current?.closest("aside");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return <div className="master-drawer-layer data-acquisition-summary-drawer">
    <button type="button" className="master-drawer-scrim" aria-label="サマリを閉じる" tabIndex={-1} onClick={close}/>
    <aside className="master-drawer master-drawer--primary" role="dialog" aria-modal="true" aria-labelledby="data-acquisition-summary-drawer-title">
      <header className="master-drawer-header"><div><p className="eyebrow">Data Acquisition Summary</p><h1 id="data-acquisition-summary-drawer-title">{LABELS[entity]}データ取得サマリ</h1></div><button ref={closeButton} className="drawer-close" type="button" aria-label="サマリを閉じる" onClick={close}>×</button></header>
      <div className="master-drawer-body">{children}</div>
    </aside>
  </div>;
}
