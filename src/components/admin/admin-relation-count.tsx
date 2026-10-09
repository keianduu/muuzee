import React from "react";

type RelationKind = "exhibitions" | "works" | "artists" | "venues";

const RELATION_LABELS: Record<RelationKind, string> = {
  exhibitions: "展覧会",
  works: "作品",
  artists: "アーティスト",
  venues: "会場",
};

function RelationIcon({ kind }: { kind: RelationKind }) {
  if (kind === "exhibitions") return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><path d="M5 3V1.8M11 3V1.8M5 6.5h6M5 9h4"/></svg>;
  if (kind === "works") return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><circle cx="6" cy="6" r="1"/><path d="m4 11 2.5-2.5L8.5 10l1.5-1.5 2 2"/></svg>;
  if (kind === "artists") return <svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="5" r="2.25"/><path d="M3.5 13c.4-2.4 2-3.8 4.5-3.8s4.1 1.4 4.5 3.8"/></svg>;
  return <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 6.2 8 2l6 4.2M3 6.5h10M4 6.5v5.8M7 6.5v5.8M10 6.5v5.8M13 6.5v5.8M2.5 13h11"/></svg>;
}

export type AdminRelationCountItem = { kind: RelationKind; count: number };

export function AdminRelationCount({ items }: { items: AdminRelationCountItem[] }) {
  return <span className="admin-relation-counts" role="group" aria-label="関連件数">
    {items.map(({ kind, count }) => {
      const label = `${RELATION_LABELS[kind]} ${count}件`;
      return <span className={`admin-relation-count${count === 0 ? " is-zero" : ""}`} aria-label={label} title={label} key={kind}>
        <RelationIcon kind={kind}/><span aria-hidden="true">{count}</span>
      </span>;
    })}
  </span>;
}
