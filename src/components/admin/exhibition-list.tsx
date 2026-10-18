"use client";

/* eslint-disable @next/next/no-img-element */

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ExhibitionRow } from "@/lib/admin/types";
import { canonicalizeExhibitionScheduleQuery, selectedQuery, shouldActivateListRowFromKeyboard } from "@/lib/admin/master-list-state";
import { formatAdminDateTime } from "@/lib/admin/admin-date-time";
import { AdminRelationCount } from "./admin-relation-count";
import { ExhibitionDetailDrawer } from "./exhibition-detail-drawer";

function firstLinked<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ExhibitionList({ rows, initialSelectedId }: { rows: ExhibitionRow[]; initialSelectedId?: string }) {
  const pathname = usePathname();
  const [activeSelectedId, setActiveSelectedId] = useState<string | undefined>(initialSelectedId);

  const openDrawer = useCallback((id: string) => {
    setActiveSelectedId(id);
    const current = canonicalizeExhibitionScheduleQuery(window.location.search.slice(1));
    const query = selectedQuery(current, id);
    window.history.pushState(null, "", `${pathname}${query ? `?${query}` : ""}`);
  }, [pathname]);

  useEffect(() => {
    const syncSelection = () => setActiveSelectedId(new URLSearchParams(window.location.search).get("selected") || undefined);
    window.addEventListener("popstate", syncSelection);
    return () => window.removeEventListener("popstate", syncSelection);
  }, []);

  return <>
    <div className="table-wrap"><table className="admin-exhibition-table"><thead><tr><th>画像</th><th>展示会</th><th>会場 / 会期</th><th>会場照合</th><th>関連</th><th>画像状態</th><th>更新</th></tr></thead><tbody>
      {rows.map((item) => {
        const occurrence = item.exhibition_occurrences?.[0];
        const venue = firstLinked(occurrence?.venues);
        const venueMention = item.exhibition_venue_mentions?.[0];
        const source = item.source_records?.[0];
        const primary = item.media_assets?.find((asset) => asset.is_primary);
        const candidate = source?.source_image_candidates?.find((entry) => entry.is_active);
        const thumbnail = primary?.signedUrl || candidate?.thumbnail_url || candidate?.image_url;
        return <tr className="master-row" tabIndex={0} role="button" aria-label={`${item.title}の詳細を開く`} key={item.id} data-exhibition-detail-trigger={item.id} onClick={() => openDrawer(item.id)} onKeyDown={(event) => { if (shouldActivateListRowFromKeyboard(event.key, event.target === event.currentTarget)) { event.preventDefault(); openDrawer(item.id); } }}>
          <td>{thumbnail ? <img className="thumb" alt="" src={thumbnail}/> : <span className="thumb"/>}</td>
          <td><strong>{item.title}</strong></td>
          <td>{venue?.name || "-"}<br/><span className="muted">{occurrence?.start_date || "?"} – {occurrence?.end_date || "?"}</span></td>
          <td><span className={`status ${venueMention?.resolution_status || (venue ? "resolved" : "pending")}`}>{venueMention?.resolution_status || (venue ? "resolved" : "pending")}</span></td>
          <td><AdminRelationCount items={[{ kind: "artists", count: item.exhibition_artists?.filter((relation) => relation.relation_status !== "stale").length || 0 }]}/>{item.exhibition_artist_mentions?.some((mention) => mention.resolution_status === "ambiguous" || mention.resolution_status === "pending") ? <><br/><small className="muted">未解決候補あり</small></> : null}</td>
          <td><span className={`status ${primary?.rights_status || ""}`}>{primary ? primary.rights_status : candidate ? "API candidate" : "missing"}</span></td>
          <td>{formatAdminDateTime(item.updated_at)}</td>
        </tr>;
      })}
      {!rows.length && <tr><td colSpan={7} className="empty-state">条件に合う展覧会はありません。</td></tr>}
    </tbody></table></div>
    <ExhibitionDetailDrawer selectedId={activeSelectedId} onRequestClose={() => setActiveSelectedId(undefined)}/>
  </>;
}
