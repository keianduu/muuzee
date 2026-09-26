export const ENTITY_KINDS = ["exhibition", "artist", "venue", "work"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export type EntityRef = {
  kind: EntityKind;
  id: string;
};

export const PERSONAL_ACTION_KINDS = ["saved", "seen", "favorite"] as const;
export type PersonalActionKind = (typeof PERSONAL_ACTION_KINDS)[number];

export type ProfileDTO = {
  displayName: string | null;
  avatarObjectPath: string | null;
};

export type UpdateProfileInput = Partial<ProfileDTO>;

export type PreferencesDTO = {
  notificationEnabled: boolean;
  newsletterEnabled: boolean;
  countryCode: string | null;
  region: string | null;
  prefecture: string | null;
  city: string | null;
};

export type UpdatePreferencesInput = Partial<PreferencesDTO>;

export type PersonalActionDTO = {
  id: string;
  action: PersonalActionKind;
  entity: EntityRef;
  createdAt: string;
  seenAt: string | null;
};

export type ViewerEntityStateDTO = {
  entity: EntityRef;
  isSaved: boolean;
  isSeen: boolean;
  isFavorite: boolean;
};

export type ArtWallSettingsDTO = {
  showIcon: boolean;
  title: string | null;
  comment: string | null;
  backgroundKey: string | null;
  columns: 3 | 4;
  wallHeightMode: "standard" | "expanded";
};

export type UpdateArtWallSettingsInput = ArtWallSettingsDTO;

export type ArtWallItemDTO = {
  id: string;
  exhibitionId: string;
  sortOrder: number;
  isVisible: boolean;
};

export type SaveArtWallItemInput = Omit<ArtWallItemDTO, "id">;

export type ArtWallDTO = {
  settings: ArtWallSettingsDTO;
  items: ArtWallItemDTO[];
};
