import { workDisplayTitleJa } from "@/lib/work-title";

export function masterOptionLabel(entity: string, row: Record<string, unknown>) {
  if (entity === "works") return workDisplayTitleJa(row) || "タイトル未設定";
  if (entity === "exhibitions") return String(row.title || "タイトル未設定");
  return String(row.name || "名称未設定");
}
