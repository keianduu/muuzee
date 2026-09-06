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
  else params.delete("selected");
  return params.toString();
}

export function pageQuery(current: string, page: number, pageSize = 50) {
  const params = new URLSearchParams(current);
  params.delete("selected");
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return params.toString();
}
