import { MASTER_CONFIGS, type MasterEntity } from "./master-config";

export function hasValue(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function calculateCompleteness(entity: MasterEntity, row: Record<string, unknown>) {
  const items = MASTER_CONFIGS[entity].completeness.map((item) => ({
    key: item.key,
    label: item.label,
    met: item.test ? item.test(row) : hasValue(row[item.key]),
  }));
  const met = items.filter((item) => item.met).length;
  return { percent: Math.round((met / items.length) * 100), met, total: items.length, items };
}
