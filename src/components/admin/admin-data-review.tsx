import type { ReactNode } from "react";
import { adminSourceLabel, hasAdminFieldValue } from "@/lib/admin/data-review";

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
