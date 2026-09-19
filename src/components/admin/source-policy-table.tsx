"use client";

import { useState } from "react";
import type { AdminSourcePolicy, SourceAssertionPolicy } from "@/lib/admin/source-policy";

const LABELS: Record<SourceAssertionPolicy["assertion_type"], string> = {
  work_artist: "Work Artist",
  collection_holding: "Collection Holding",
  work_presentation: "Work Presentation",
  media: "Media / Image",
};

export function SourcePolicyTable({ sources }: { sources: AdminSourcePolicy[] }) {
  const [rows, setRows] = useState(sources);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function save(sourceId: string, policy: SourceAssertionPolicy, patch: Partial<SourceAssertionPolicy>) {
    const key = `${sourceId}:${policy.assertion_type}`;
    const next = { ...policy, ...patch };
    setBusy(key); setMessage("");
    try {
      const response = await fetch(`/api/admin/sources/${sourceId}/policies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assertionType: next.assertion_type,
          enabled: next.enabled,
          autoApply: next.auto_apply,
          defaultVisibility: next.default_visibility,
          reviewRequired: next.review_required,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Policy update failed");
      setRows((current) => current.map((source) => {
        if (source.id !== sourceId) return source;
        const policies = source.policies.map((item) => item.assertion_type === next.assertion_type ? body.policy : item) as SourceAssertionPolicy[];
        return {
          ...source,
          enabled: policies.some((item) => item.enabled),
          entityScope: policies.filter((item) => item.enabled).map((item) => item.assertion_type),
          policies,
        };
      }));
      setMessage(`${body.sourceName} / ${LABELS[next.assertion_type]}を更新しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Policy update failed");
    } finally { setBusy(""); }
  }

  return <>
    {message && <div className={message.includes("failed") || message.includes("Invalid") ? "error" : "notice"}>{message}</div>}
    {rows.map((source) => <section className="card source-policy-card" key={source.id}>
      <div className="detail-status"><div><h2>{source.name}</h2><p className="muted">{source.key}</p></div><div className="preview-counts"><span className={`status ${source.enabled ? "approved" : ""}`}>{source.enabled ? "Enabled" : "Disabled"}</span><span className={`status ${source.configured ? "approved" : "rejected"}`}>{source.configured ? "Configured" : "Not configured"}</span></div></div>
      <p className="muted">Scope: {source.entityScope.join(" / ") || "未設定"} · Last sync: {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString("ja-JP") : "—"} · Result: {source.lastResult || "—"}{source.lastError ? ` · Error: ${source.lastError}` : ""}</p>
      <div className="table-wrap"><table className="source-policy-table"><thead><tr><th>Assertion</th><th>Enabled</th><th>Auto Apply</th><th>Default visibility</th><th>Review Required</th></tr></thead><tbody>
        {source.policies.map((policy) => {
          const key = `${source.id}:${policy.assertion_type}`;
          const reviewOnly = policy.assertion_type === "work_presentation" || policy.assertion_type === "media";
          return <tr key={policy.assertion_type}><td><strong>{LABELS[policy.assertion_type]}</strong>{reviewOnly && <><br/><small className="muted">Safety boundary</small></>}</td>
            <td><input type="checkbox" aria-label={`${LABELS[policy.assertion_type]} enabled`} checked={policy.enabled} disabled={busy === key} onChange={(event) => save(source.id, policy, { enabled: event.target.checked })}/></td>
            <td><input type="checkbox" aria-label={`${LABELS[policy.assertion_type]} auto apply`} checked={policy.auto_apply} disabled={busy === key || reviewOnly} onChange={(event) => save(source.id, policy, { auto_apply: event.target.checked, review_required: event.target.checked ? false : policy.review_required })}/></td>
            <td><select aria-label={`${LABELS[policy.assertion_type]} default visibility`} value={policy.default_visibility} disabled={busy === key || reviewOnly} onChange={(event) => save(source.id, policy, { default_visibility: event.target.value as "public" | "hidden" })}><option value="public">Public</option><option value="hidden">Hidden</option></select></td>
            <td><input type="checkbox" aria-label={`${LABELS[policy.assertion_type]} review required`} checked={policy.review_required} disabled={busy === key || reviewOnly} onChange={(event) => save(source.id, policy, { review_required: event.target.checked, auto_apply: event.target.checked ? false : policy.auto_apply })}/></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>)}
  </>;
}
