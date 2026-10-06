export const ADMIN_SOURCE_LABELS: Record<string, string> = {
  manual: "手動",
  wikidata: "Wikidata",
  wikipedia: "Wikipedia",
  apj_daj: "APJ DAJ",
  getty_ulan: "Getty ULAN",
  official_website: "公式サイト",
  wikimedia_commons: "Wikimedia Commons",
  official_artist_image: "公式画像",
  csv_import: "CSV",
  trusted_api: "Trusted API",
  geolonia: "Geolonia",
  japan_post: "日本郵便",
};

export type AdminSourceRecord = {
  id?: unknown;
  external_id?: unknown;
  source_url?: unknown;
  data_sources?: { key?: unknown; name?: unknown } | Array<{ key?: unknown; name?: unknown }> | null;
};

export type AdminSourceReference = {
  source?: string | null;
  source_url?: string | null;
  is_current?: boolean;
};

export type AdminExternalSource = {
  key: string;
  label: string;
  externalId: string | null;
  sourceUrl: string | null;
};

const NON_EXTERNAL_SOURCE_KEYS = new Set(["manual", "csv", "csv_import"]);

function humanizeSourceKey(source: string) {
  return source.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

export function adminSourceLabel(source: string | null | undefined, sourceName?: string | null) {
  if (source && ADMIN_SOURCE_LABELS[source]) return ADMIN_SOURCE_LABELS[source];
  if (sourceName?.trim()) return sourceName.trim();
  return "不明";
}

function sourceRelations(record: AdminSourceRecord) {
  return Array.isArray(record.data_sources) ? record.data_sources : record.data_sources ? [record.data_sources] : [];
}

function externalSource(key: string, name: string | null, externalId: unknown, sourceUrl: unknown): AdminExternalSource | null {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey || NON_EXTERNAL_SOURCE_KEYS.has(normalizedKey)) return null;
  return {
    key: normalizedKey,
    label: ADMIN_SOURCE_LABELS[normalizedKey] || name?.trim() || humanizeSourceKey(normalizedKey),
    externalId: externalId == null || String(externalId).trim() === "" ? null : String(externalId),
    sourceUrl: sourceUrl == null || String(sourceUrl).trim() === "" ? null : String(sourceUrl),
  };
}

export function linkedAdminExternalSources(records: AdminSourceRecord[]) {
  const seen = new Set<string>();
  const entries: AdminExternalSource[] = [];
  for (const record of records) {
    for (const relation of sourceRelations(record)) {
      const key = String(relation.key || relation.name || "");
      const entry = externalSource(key, relation.name ? String(relation.name) : null, record.external_id, record.source_url);
      if (!entry) continue;
      const identity = `${entry.key}\u0000${entry.externalId || ""}\u0000${entry.sourceUrl || ""}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      entries.push(entry);
    }
  }
  return entries;
}

export function summarizedAdminExternalSources(records: AdminSourceRecord[], provenance: AdminSourceReference[] = []) {
  const entries = new Map<string, AdminExternalSource>();
  for (const entry of linkedAdminExternalSources(records)) {
    if (!entries.has(entry.key)) entries.set(entry.key, entry);
  }
  for (const reference of provenance) {
    if (reference.is_current === false) continue;
    const entry = externalSource(String(reference.source || ""), null, null, reference.source_url);
    if (!entry) continue;
    const current = entries.get(entry.key);
    if (!current) entries.set(entry.key, entry);
    else if (!current.sourceUrl && entry.sourceUrl) entries.set(entry.key, { ...current, sourceUrl: entry.sourceUrl });
  }
  return [...entries.values()];
}
export function hasAdminFieldValue(value: unknown) {
  return value != null && String(value).trim() !== "";
}
