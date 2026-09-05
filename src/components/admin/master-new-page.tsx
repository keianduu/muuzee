import Link from "next/link";
import { MasterEditor } from "./master-editor";
import { MASTER_CONFIGS, type MasterEntity } from "@/lib/admin/master-config";

export function MasterNewPage({ entity }: { entity: MasterEntity }) {
  const config = MASTER_CONFIGS[entity];
  return <><nav className="breadcrumbs"><Link href="/admin">Admin</Link><span>/</span><Link href={`/admin/${entity}`}>{config.label}s</Link><span>/</span><strong>New</strong></nav><div className="page-head"><div><p className="eyebrow">Manual Input</p><h1>New {config.label}</h1></div></div><MasterEditor entity={entity} mode="new"/></>;
}
