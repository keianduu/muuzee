export const VENUE_EDIT_TABS = [
  { id: "basic", label: "基本情報" },
  { id: "image", label: "画像登録" },
  { id: "relations", label: "関連情報" },
] as const;

export type VenueEditTab = typeof VENUE_EDIT_TABS[number]["id"];

export function venueEditTab(value: string | null | undefined): VenueEditTab {
  return VENUE_EDIT_TABS.some((tab) => tab.id === value) ? value as VenueEditTab : "basic";
}

export function venueEditTabQuery(current: string, tab: VenueEditTab) {
  const params = new URLSearchParams(current);
  params.set("venueEdit", tab);
  return params.toString();
}

export const VENUE_IMAGE_SECTION_ORDER = ["registered", "candidates", "registration"] as const;
