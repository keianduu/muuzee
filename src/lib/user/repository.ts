import type { SupabaseClient } from "@supabase/supabase-js";
import { UserRepositoryError } from "./errors";
import type {
  ArtWallItemDTO,
  ArtWallSettingsDTO,
  EntityKind,
  EntityRef,
  PersonalActionDTO,
  PersonalActionKind,
  PreferencesDTO,
  ProfileDTO,
  SaveArtWallItemInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from "./types";

type RawProviderError = {
  code?: string;
  message?: string;
  status?: number;
};

type RawActionRow = {
  id: string;
  exhibition_id?: string | null;
  artist_id?: string | null;
  venue_id?: string | null;
  work_id?: string | null;
  created_at: string;
  seen_at?: string | null;
};

type RawArtWallItem = {
  id: string;
  exhibition_id: string;
  sort_order: number;
  is_visible: boolean;
};

const ACTION_TABLES: Record<PersonalActionKind, string> = {
  saved: "user_saved_items",
  seen: "user_seen_items",
  favorite: "user_favorite_items",
};

const ENTITY_COLUMNS: Record<EntityKind, string> = {
  exhibition: "exhibition_id",
  artist: "artist_id",
  venue: "venue_id",
  work: "work_id",
};

const KNOWN_CONSTRAINTS = [
  "user_saved_items_exhibition_uq",
  "user_saved_items_artist_uq",
  "user_saved_items_venue_uq",
  "user_saved_items_work_uq",
  "user_seen_items_exhibition_uq",
  "user_seen_items_artist_uq",
  "user_seen_items_venue_uq",
  "user_seen_items_work_uq",
  "user_favorite_items_artist_uq",
  "user_favorite_items_venue_uq",
  "user_artwall_items_user_id_exhibition_id_key",
] as const;

export const ACTION_DUPLICATE_CONSTRAINTS: Record<PersonalActionKind, Partial<Record<EntityKind, string>>> = {
  saved: {
    exhibition: "user_saved_items_exhibition_uq",
    artist: "user_saved_items_artist_uq",
    venue: "user_saved_items_venue_uq",
    work: "user_saved_items_work_uq",
  },
  seen: {
    exhibition: "user_seen_items_exhibition_uq",
    artist: "user_seen_items_artist_uq",
    venue: "user_seen_items_venue_uq",
    work: "user_seen_items_work_uq",
  },
  favorite: {
    artist: "user_favorite_items_artist_uq",
    venue: "user_favorite_items_venue_uq",
  },
};

function repositoryError(error: RawProviderError): UserRepositoryError {
  const constraint = KNOWN_CONSTRAINTS.find((name) => error.message?.includes(name)) ?? null;
  return new UserRepositoryError({
    providerCode: error.code,
    constraint: constraint ?? undefined,
    status: error.status,
  });
}

function assertNoError(error: RawProviderError | null) {
  if (error) throw repositoryError(error);
}

function dataIntegrityError(): never {
  throw new UserRepositoryError({ providerCode: "DATA_INTEGRITY" });
}

function requireData<T>(data: T | null): T {
  if (data === null) return dataIntegrityError();
  return data;
}

export function mapActionRow(action: PersonalActionKind, row: RawActionRow): PersonalActionDTO {
  const refs = (Object.entries(ENTITY_COLUMNS) as [EntityKind, string][])
    .map(([kind, column]) => ({ kind, id: row[column as keyof RawActionRow] }))
    .filter((ref): ref is EntityRef => typeof ref.id === "string" && ref.id.length > 0);

  if (refs.length !== 1) return dataIntegrityError();

  return {
    id: row.id,
    action,
    entity: refs[0],
    createdAt: row.created_at,
    seenAt: action === "seen" ? row.seen_at ?? null : null,
  };
}

function mapSettings(row: Record<string, unknown>): ArtWallSettingsDTO {
  const columns = row.columns;
  const wallHeightMode = row.wall_height_mode;
  if (
    typeof row.show_icon !== "boolean"
    || (columns !== 3 && columns !== 4)
    || (wallHeightMode !== "standard" && wallHeightMode !== "expanded")
  ) {
    return dataIntegrityError();
  }
  return {
    showIcon: row.show_icon,
    title: typeof row.title === "string" ? row.title : null,
    comment: typeof row.comment === "string" ? row.comment : null,
    backgroundKey: typeof row.background_key === "string" ? row.background_key : null,
    columns,
    wallHeightMode,
  };
}

function mapArtWallItem(row: RawArtWallItem): ArtWallItemDTO {
  if (
    !row.exhibition_id
    || !Number.isInteger(row.sort_order)
    || row.sort_order < 0
    || typeof row.is_visible !== "boolean"
  ) {
    return dataIntegrityError();
  }
  return {
    id: row.id,
    exhibitionId: row.exhibition_id,
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
  };
}

export type UserDataRepository = {
  getProfile(userId: string): Promise<ProfileDTO | null>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<ProfileDTO>;
  getPreferences(userId: string): Promise<PreferencesDTO | null>;
  updatePreferences(userId: string, input: UpdatePreferencesInput): Promise<PreferencesDTO>;
  listActions(userId: string, action: PersonalActionKind): Promise<PersonalActionDTO[]>;
  listActionsForRefs(userId: string, action: PersonalActionKind, refs: EntityRef[]): Promise<PersonalActionDTO[]>;
  addAction(userId: string, action: PersonalActionKind, ref: EntityRef): Promise<void>;
  removeAction(userId: string, action: PersonalActionKind, ref: EntityRef): Promise<void>;
  getArtWallSettings(userId: string): Promise<ArtWallSettingsDTO | null>;
  updateArtWallSettings(userId: string, settings: ArtWallSettingsDTO): Promise<ArtWallSettingsDTO>;
  getArtWallItems(userId: string): Promise<ArtWallItemDTO[]>;
  listSeenExhibitionIds(userId: string, exhibitionIds?: string[]): Promise<string[]>;
  saveArtWallItems(userId: string, items: SaveArtWallItemInput[]): Promise<void>;
};

export function createUserDataRepository(client: SupabaseClient): UserDataRepository {
  return {
    async getProfile(userId) {
      const { data, error } = await client
        .from("profiles")
        .select("display_name, avatar_object_path")
        .eq("user_id", userId)
        .maybeSingle();
      assertNoError(error);
      return data ? { displayName: data.display_name, avatarObjectPath: data.avatar_object_path } : null;
    },

    async updateProfile(userId, input) {
      const values: Record<string, unknown> = {};
      if ("displayName" in input) values.display_name = input.displayName;
      if ("avatarObjectPath" in input) values.avatar_object_path = input.avatarObjectPath;
      const { data, error } = await client
        .from("profiles")
        .update(values)
        .eq("user_id", userId)
        .select("display_name, avatar_object_path")
        .single();
      assertNoError(error);
      const row = requireData(data);
      return { displayName: row.display_name, avatarObjectPath: row.avatar_object_path };
    },

    async getPreferences(userId) {
      const { data, error } = await client
        .from("user_preferences")
        .select("notification_enabled, newsletter_enabled, country_code, region, prefecture, city")
        .eq("user_id", userId)
        .maybeSingle();
      assertNoError(error);
      return data ? {
        notificationEnabled: data.notification_enabled,
        newsletterEnabled: data.newsletter_enabled,
        countryCode: data.country_code,
        region: data.region,
        prefecture: data.prefecture,
        city: data.city,
      } : null;
    },

    async updatePreferences(userId, input) {
      const values: Record<string, unknown> = {};
      if ("notificationEnabled" in input) values.notification_enabled = input.notificationEnabled;
      if ("newsletterEnabled" in input) values.newsletter_enabled = input.newsletterEnabled;
      if ("countryCode" in input) values.country_code = input.countryCode;
      if ("region" in input) values.region = input.region;
      if ("prefecture" in input) values.prefecture = input.prefecture;
      if ("city" in input) values.city = input.city;
      const { data, error } = await client
        .from("user_preferences")
        .update(values)
        .eq("user_id", userId)
        .select("notification_enabled, newsletter_enabled, country_code, region, prefecture, city")
        .single();
      assertNoError(error);
      const row = requireData(data);
      return {
        notificationEnabled: row.notification_enabled,
        newsletterEnabled: row.newsletter_enabled,
        countryCode: row.country_code,
        region: row.region,
        prefecture: row.prefecture,
        city: row.city,
      };
    },

    async listActions(userId, action) {
      const { data, error } = await client
        .from(ACTION_TABLES[action])
        .select("*")
        .eq("user_id", userId)
        .order(action === "seen" ? "seen_at" : "created_at", { ascending: false });
      assertNoError(error);
      return (data as RawActionRow[]).map((row) => mapActionRow(action, row));
    },

    async listActionsForRefs(userId, action, refs) {
      const rows: PersonalActionDTO[] = [];
      for (const kind of Object.keys(ENTITY_COLUMNS) as EntityKind[]) {
        const ids = refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);
        if (!ids.length || (action === "favorite" && (kind === "exhibition" || kind === "work"))) continue;
        const { data, error } = await client
          .from(ACTION_TABLES[action])
          .select("*")
          .eq("user_id", userId)
          .in(ENTITY_COLUMNS[kind], ids);
        assertNoError(error);
        rows.push(...(data as RawActionRow[]).map((row) => mapActionRow(action, row)));
      }
      return rows;
    },

    async addAction(userId, action, ref) {
      const { error } = await client.from(ACTION_TABLES[action]).insert({
        user_id: userId,
        [ENTITY_COLUMNS[ref.kind]]: ref.id,
      });
      assertNoError(error);
    },

    async removeAction(userId, action, ref) {
      const { error } = await client
        .from(ACTION_TABLES[action])
        .delete()
        .eq("user_id", userId)
        .eq(ENTITY_COLUMNS[ref.kind], ref.id);
      assertNoError(error);
    },

    async getArtWallSettings(userId) {
      const { data, error } = await client
        .from("user_artwall_settings")
        .select("show_icon, title, comment, background_key, columns, wall_height_mode")
        .eq("user_id", userId)
        .maybeSingle();
      assertNoError(error);
      return data ? mapSettings(data) : null;
    },

    async updateArtWallSettings(userId, settings) {
      const { data, error } = await client
        .from("user_artwall_settings")
        .upsert({
          user_id: userId,
          show_icon: settings.showIcon,
          title: settings.title,
          comment: settings.comment,
          background_key: settings.backgroundKey,
          columns: settings.columns,
          wall_height_mode: settings.wallHeightMode,
        }, { onConflict: "user_id" })
        .select("show_icon, title, comment, background_key, columns, wall_height_mode")
        .single();
      assertNoError(error);
      return mapSettings(requireData(data));
    },

    async getArtWallItems(userId) {
      const { data, error } = await client
        .from("user_artwall_items")
        .select("id, exhibition_id, sort_order, is_visible")
        .eq("user_id", userId)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });
      assertNoError(error);
      return (data as RawArtWallItem[]).map(mapArtWallItem);
    },

    async listSeenExhibitionIds(userId, exhibitionIds) {
      let query = client
        .from("user_seen_items")
        .select("exhibition_id")
        .eq("user_id", userId)
        .not("exhibition_id", "is", null);
      if (exhibitionIds) query = query.in("exhibition_id", exhibitionIds);
      const { data, error } = await query;
      assertNoError(error);
      return requireData(data)
        .map((row) => row.exhibition_id)
        .filter((id): id is string => typeof id === "string");
    },

    async saveArtWallItems(userId, items) {
      if (items.length) {
        const { error: upsertError } = await client.from("user_artwall_items").upsert(
          items.map((item) => ({
            user_id: userId,
            exhibition_id: item.exhibitionId,
            sort_order: item.sortOrder,
            is_visible: item.isVisible,
          })),
          { onConflict: "user_id,exhibition_id" },
        );
        assertNoError(upsertError);

        const ids = items.map((item) => item.exhibitionId);
        const { error: deleteError } = await client
          .from("user_artwall_items")
          .delete()
          .eq("user_id", userId)
          .not("exhibition_id", "in", `(${ids.join(",")})`);
        assertNoError(deleteError);
        return;
      }

      const { error } = await client.from("user_artwall_items").delete().eq("user_id", userId);
      assertNoError(error);
    },
  };
}
