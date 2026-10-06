import type { ReactNode } from "react";
import {
  adminSourceLabel,
  hasAdminFieldValue,
  linkedAdminExternalSources,
  summarizedAdminExternalSources,
  type AdminSourceRecord,
  type AdminSourceReference,
} from "@/lib/admin/data-review";

export type AdminProvenanceSource = {
  field_name: string;
  source?: string | null;
  source_url?: string | null;
  is_current?: boolean;
};

export function AdminDataReview({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`admin-data-review${className ? ` ${className}` : ""}`}>{children}</div>;
}
export function AdminDataSection({ title, description, action, children, className = "" }: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return <section className={`admin-data-section${className ? ` ${className}` : ""}`}>
    <div className="section-heading-row">
      <div><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>
      {action}
    </div>
    {children}
  </section>;
}

export function AdminProvenanceSummary({ record, fields, sources, sourceLabel = adminSourceLabel }: {
  record: Record<string, unknown>;
  fields: ReadonlyArray<readonly [string, string]>;
  sources: AdminProvenanceSource[];
  sourceLabel?: (source: string | null | undefined) => string;
}) {
  const currentSources = new Map(sources.filter((source) => source.is_current !== false).map((source) => [source.field_name, source]));
  return <div className="admin-provenance-list">{fields.map(([key, label]) => {
    const source = currentSources.get(key);
    if (!hasAdminFieldValue(record[key])) return <div className="admin-provenance-row" key={key}><span><strong>{label}</strong><code>{key}</code></span><b>—</b></div>;
    const labelText = sourceLabel(source?.source);
    return <div className="admin-provenance-row" key={key}><span><strong>{label}</strong><code>{key}</code></span>{source?.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer">{labelText} ↗</a> : <b>{labelText}</b>}</div>;
  })}</div>;
}

export function AdminExternalSourceSummary({ sourceRecords, provenance = [] }: {
  sourceRecords: AdminSourceRecord[];
  provenance?: AdminSourceReference[];
}) {
  const sources = summarizedAdminExternalSources(sourceRecords, provenance);
  if (!sources.length) return <>なし</>;
  return <div className="admin-source-chips">{sources.map((source) => source.sourceUrl
    ? <a className="admin-source-chip" href={source.sourceUrl} target="_blank" rel="noreferrer" key={source.key}>{source.label} ↗</a>
    : <span className="admin-source-chip" key={source.key}>{source.label}</span>)}</div>;
}

export function AdminExternalSourceList({ sourceRecords }: { sourceRecords: AdminSourceRecord[] }) {
  const sources = linkedAdminExternalSources(sourceRecords);
  if (!sources.length) return <p className="empty-state">外部データはありません。</p>;
  return <div className="admin-external-source-list">{sources.map((source, index) => <div className="admin-external-source-row" key={`${source.key}-${source.externalId || ""}-${source.sourceUrl || index}`}>
    <span><strong>{source.label}</strong>{source.externalId && <code>{source.externalId}</code>}</span>
    {source.sourceUrl ? <a href={source.sourceUrl} target="_blank" rel="noreferrer">データ元 ↗</a> : <b>URL未設定</b>}
  </div>)}</div>;
}

export type AdminReviewQueueItem = {
  id: string;
  label: string;
  externalId?: string | null;
  sourceUrl?: string | null;
  meta?: string | null;
};

export function AdminReviewQueue({ title, items }: { title: string; items: AdminReviewQueueItem[] }) {
  if (!items.length) return null;
  return <section className="admin-review-queue"><h3>{title}</h3><div className="admin-identity-candidates">{items.map((item) => <article className="card admin-identity-candidate" key={item.id}>
    <div className="section-heading-row"><strong>{item.label}</strong><span className="status">確認待ち</span></div>
    {(item.externalId || item.meta) && <p className="muted">{item.sourceUrl && item.externalId ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.externalId} · データ元 ↗</a> : item.externalId}{item.externalId && item.meta ? " · " : ""}{item.meta}</p>}
  </article>)}</div></section>;
}
