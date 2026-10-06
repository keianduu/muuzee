export const ADMIN_TAG_TYPES = ["genre", "movement", "era", "theme", "other"] as const;

export type AdminTagType = (typeof ADMIN_TAG_TYPES)[number];

export type AdminTag = {
  id: string;
  type: AdminTagType;
  name: string;
  slug: string;
};

export function isAdminTagType(value: unknown): value is AdminTagType {
  return typeof value === "string" && (ADMIN_TAG_TYPES as readonly string[]).includes(value);
}

function tagFromRelation(row: Record<string, unknown>) {
  const value = row.tags;
  const tag = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | undefined;
  if (!tag || typeof tag.id !== "string" || !isAdminTagType(tag.type) || typeof tag.name !== "string") return null;
  return {
    id: tag.id,
    type: tag.type,
    name: tag.name,
    slug: typeof tag.slug === "string" ? tag.slug : "",
  } satisfies AdminTag;
}

export function attachedAdminTags(rows: Array<Record<string, unknown>>) {
  return rows.map(tagFromRelation).filter((tag): tag is AdminTag => Boolean(tag));
}

export function availableAdminTags(catalog: AdminTag[], attached: AdminTag[]) {
  const attachedIds = new Set(attached.map((tag) => tag.id));
  return catalog.filter((tag) => !attachedIds.has(tag.id));
}

export function attachAdminTag(attached: AdminTag[], tag: AdminTag) {
  return attached.some((item) => item.id === tag.id) ? attached : [...attached, tag];
}

export function detachAdminTag(attached: AdminTag[], tagId: string) {
  return attached.filter((tag) => tag.id !== tagId);
}
