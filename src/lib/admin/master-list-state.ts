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
  }
  return params.toString();
}

export function detailPanelQuery(current: string, panel: "image" | null, candidateId: string | null = null) {
  const params = new URLSearchParams(current);
  if (panel) {
    params.set("panel", panel);
    if (candidateId) params.set("candidate", candidateId);
    else params.delete("candidate");
  } else {
    params.delete("panel");
    params.delete("candidate");
  }
  return params.toString();
}

export function pageQuery(current: string, page: number, pageSize = 50) {
  const params = new URLSearchParams(current);
  params.delete("selected");
  params.delete("panel");
  params.delete("candidate");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}
