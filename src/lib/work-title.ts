export type WorkTitleFields = {
  title?: string | null;
  title_ja?: string | null;
  title_en?: string | null;
  title_original?: string | null;
};

function firstTitle(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || null;
}

function titleFields(value: unknown): WorkTitleFields {
  return value && typeof value === "object" ? value as WorkTitleFields : {};
}

/** Japan-first display title. Keep this shared; pages must not recreate the fallback. */
export function workDisplayTitleJa(value: unknown) {
  const work = titleFields(value);
  return firstTitle(work.title_ja, work.title_original, work.title_en, work.title);
}

/** Future English UI fallback. */
export function workDisplayTitleEn(value: unknown) {
  const work = titleFields(value);
  return firstTitle(work.title_en, work.title_original, work.title_ja, work.title);
}

export function hasWorkTitle(value: unknown) {
  const work = titleFields(value);
  return Boolean(firstTitle(work.title_ja, work.title_original, work.title_en, work.title));
}
