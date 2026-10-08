"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CsvPreviewRow } from "@/lib/admin/master-csv";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";
import { selectedQuery } from "@/lib/admin/master-list-state";
import { AdminListDrawer, announceAdminListDrawer, restoreListDrawerFocus, type AdminListDrawerKind } from "./admin-list-drawer";
import { MasterEditor } from "./master-editor";

type Preview = { rows: CsvPreviewRow[]; summary: { total: number; new: number; update: number; unchanged: number; invalid: number; conflicts: number } };
type ListAction = Extract<AdminListDrawerKind, "new" | "csv">;

function CsvIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function AdminMasterListActions({ entity }: { entity: MasterEntity }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const config = MASTER_CONFIGS[entity];
  const [active, setActive] = useState<ListAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [csvText, setCsvText] = useState("");
  const newTriggerRef = useRef<HTMLButtonElement>(null);
  const csvTriggerRef = useRef<HTMLButtonElement>(null);
  const newInitialFocusRef = useRef<HTMLDivElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const selected = searchParams.get("selected");

  const close = useCallback((restoreFocus = true) => {
    const closing = active;
    setActive(null);
    if (restoreFocus && closing) restoreListDrawerFocus(closing === "new" ? newTriggerRef : csvTriggerRef);
  }, [active]);

  useEffect(() => {
    if (selected && active) close(false);
  }, [active, close, selected]);

  const open = (kind: ListAction) => {
    announceAdminListDrawer(kind);
    setActive(kind);
  };

  async function previewCsv(file: File) {
    setBusy(true); setMessage(""); setPreview(null);
    try {
      const text = await file.text(); setCsvText(text);
      const form = new FormData(); form.set("file", file);
      const response = await fetch(`/api/admin/masters/${entity}/csv/preview`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Preview failed");
      setPreview(body);
      setMessage("Parse / Validationが完了しました。内容を確認してConfirmしてください。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview failed"); }
    finally { setBusy(false); }
  }

  async function executeCsv() {
    if (!preview) return;
    if (preview.summary.invalid) { setMessage("Invalid行を修正してから再度Previewしてください。"); return; }
    if (!window.confirm(`New ${preview.summary.new} / Update ${preview.summary.update} をImportしますか？${preview.summary.conflicts ? `\n${preview.summary.conflicts}件の高優先度Fieldは保護し、それ以外を反映します。` : ""}`)) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/masters/${entity}/csv/execute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, allowConflicts: false }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed");
      setPreview(null); setCsvText("");
      setMessage(body.message || "CSV Importが完了しました。");
      window.dispatchEvent(new CustomEvent("muuzee:master-updated"));
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Import failed"); }
    finally { setBusy(false); }
  }

  const onCreated = (id: string) => {
    setActive(null);
    const query = selectedQuery(searchParams.toString(), id);
    router.push(`${pathname}?${query}`, { scroll: false });
  };

  return <>
    <div className="admin-list-header-actions">
      <button ref={newTriggerRef} className="button" type="button" aria-expanded={active === "new"} aria-controls="admin-list-new-drawer" onClick={() => open("new")}>＋新規追加</button>
      <button ref={csvTriggerRef} className="button secondary admin-list-csv-trigger" type="button" aria-expanded={active === "csv"} aria-controls="admin-list-csv-drawer" onClick={() => open("csv")}><CsvIcon/><span>CSV</span></button>
    </div>
    <AdminListDrawer kind="new" open={active === "new"} eyebrow={`${config.label} MASTER`} title={`${config.label}を追加`} labelledBy="admin-list-new-drawer" initialFocusRef={newInitialFocusRef} onClose={close} bodyClassName="admin-list-new-body">
      <div ref={newInitialFocusRef} tabIndex={-1} className="admin-list-new-intro"><p className="muted">基本情報を入力して、非公開のManual recordとして作成します。</p></div>
      <MasterEditor entity={entity} mode="new" embeddedInList onCreated={onCreated}/>
    </AdminListDrawer>
    <AdminListDrawer kind="csv" open={active === "csv"} eyebrow="LIST UTILITY" title="CSV" labelledBy="admin-list-csv-drawer" initialFocusRef={csvInputRef} onClose={close} bodyClassName="admin-list-csv-body">
      <section className="admin-list-csv-section"><h3>Export</h3><div className="actions"><a className="button secondary" href={`/api/admin/masters/${entity}/csv?mode=all`}>全件Export</a><a className="button secondary" href={`/api/admin/masters/${entity}/csv?mode=template`}>template Export</a></div></section>
      <section className="admin-list-csv-section"><h3>Upload</h3><label className="field"><span>CSVファイル</span><input ref={csvInputRef} type="file" accept=".csv,text/csv" disabled={busy} onChange={(event) => event.target.files?.[0] && previewCsv(event.target.files[0])}/></label></section>
      {preview && <section className="admin-list-csv-section"><h3>Preview / Validation</h3><div className="preview-counts">{Object.entries(preview.summary).map(([key, value]) => <span className={`status ${key === "invalid" || key === "conflicts" ? "rejected" : key === "new" ? "approved" : ""}`} key={key}>{key}: {value}</span>)}</div><div className="table-wrap"><table><thead><tr><th>Line</th><th>Record</th><th>Classification</th><th>Before → After</th><th>Conflict / Error</th></tr></thead><tbody>{preview.rows.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.label}</td><td><span className={`status ${row.status === "invalid" ? "rejected" : row.status === "new" ? "approved" : ""}`}>{row.status}</span></td><td>{row.changes.map((change) => `${change.field}: ${String(change.before ?? "—")} → ${String(change.after ?? "—")}`).join(" / ") || "なし"}</td><td>{[...row.conflicts.map((field) => `${field}: higher-priority source`), ...row.errors].join(" / ") || "なし"}</td></tr>)}</tbody></table></div><div className="actions"><button className="button" type="button" disabled={busy || preview.summary.invalid > 0} onClick={executeCsv}>取り込みを確定</button><button className="button secondary" type="button" onClick={() => { setPreview(null); setCsvText(""); setMessage(""); }}>Previewを取消</button></div></section>}
      {message && <div className={message.includes("失敗") || message.includes("Invalid") || message.includes("failed") ? "error" : "notice"} role="status">{message}</div>}
    </AdminListDrawer>
  </>;
}
