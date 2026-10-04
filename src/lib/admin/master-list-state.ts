export function mergeUniqueRows<T extends { id: string }>(current: T[], incoming: T[]) {
  const known = new Set(current.map((row) => row.id));
  return [...current, ...incoming.filter((row) => !known.has(row.id))];
}

export function replaceRowInPlace<T extends { id: string }>(current: T[], incoming: T) {
  return current.map((row) => row.id === incoming.id ? incoming : row);
}

export function selectedQuery(current: string, selectedId: string | null) {
  const params = new URLSearchParams(current);
  if (selectedId) params.set("selected", selectedId);
  else {
    params.delete("selected");
    params.delete("panel");
    params.delete("candidate");
    params.delete("run");
    params.delete("venueEdit");
  }
  return params.toString();
}

export function legacyDetailDestination(basePath: string, id: string, returnTo?: string) {
  const destination = returnTo?.startsWith(basePath) ? new URL(returnTo, "http://admin.local") : new URL(basePath, "http://admin.local");
  destination.searchParams.set("selected", id);
  return `${destination.pathname}?${destination.searchParams}`;
}

export type DetailPanel = "image" | "wikidata-fields" | "official-fields" | "coordinates";

export function detailPanelQuery(current: string, panel: DetailPanel | null, options: { candidateId?: string | null; runId?: string | null } = {}) {
  const params = new URLSearchParams(current);
  if (panel) {
    params.set("panel", panel);
    if (options.candidateId) params.set("candidate", options.candidateId);
    else params.delete("candidate");
    if (options.runId) params.set("run", options.runId);
    else params.delete("run");
  } else {
    params.delete("panel");
    params.delete("candidate");
    params.delete("run");
  }
  return params.toString();
}

export function pageQuery(current: string, page: number, pageSize = 50) {
  const params = new URLSearchParams(current);
  params.delete("selected");
  params.delete("panel");
  params.delete("candidate");
  params.delete("run");
  params.delete("venueEdit");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}
