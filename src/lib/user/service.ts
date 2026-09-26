import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { UserDataError, UserRepositoryError, toUserDataError } from "./errors";
import {
  ACTION_DUPLICATE_CONSTRAINTS,
  createUserDataRepository,
  type UserDataRepository,
} from "./repository";
import type {
  ArtWallDTO,
  ArtWallSettingsDTO,
  EntityRef,
  PersonalActionDTO,
  PersonalActionKind,
  PreferencesDTO,
  ProfileDTO,
  SaveArtWallItemInput,
  UpdateArtWallSettingsInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
  ViewerEntityStateDTO,
} from "./types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const VIEWER_STATE_BATCH_LIMIT = 100;

const DEFAULT_ARTWALL_SETTINGS: ArtWallSettingsDTO = {
  showIcon: true,
  title: null,
  comment: null,
  backgroundKey: null,
  columns: 4,
  wallHeightMode: "standard",
};

type ClaimsClient = {
  auth: {
    getClaims(): Promise<{
      data: { claims?: { sub?: unknown } } | null;
      error: unknown;
    }>;
  };
};

type ViewerContext = {
  userId: string;
  repository: UserDataRepository;
};

type UserDataServiceDependencies = {
  resolveViewer(): Promise<ViewerContext>;
};

function invalidInput(): never {
  throw new UserDataError("invalid_input");
}

function validateUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function validateEntityRef(ref: EntityRef): EntityRef {
  if (!ref || !["exhibition", "artist", "venue", "work"].includes(ref.kind) || !validateUuid(ref.id)) {
    return invalidInput();
  }
  return { kind: ref.kind, id: ref.id };
}

function validateActionTarget(action: PersonalActionKind, ref: EntityRef) {
  if (!(["saved", "seen", "favorite"] as string[]).includes(action)) return invalidInput();
  const validated = validateEntityRef(ref);
  if (action === "favorite" && validated.kind !== "artist" && validated.kind !== "venue") {
    throw new UserDataError("invalid_target");
  }
  return validated;
}

function assertObjectWithOnlyKeys(input: unknown, allowedKeys: readonly string[]) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalidInput();
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !allowedKeys.includes(key))) return invalidInput();
}

function validateNullableString(value: unknown) {
  if (value !== null && typeof value !== "string") return invalidInput();
}

function validateProfileInput(input: UpdateProfileInput) {
  assertObjectWithOnlyKeys(input, ["displayName", "avatarObjectPath"]);
  if ("displayName" in input) validateNullableString(input.displayName);
  if ("avatarObjectPath" in input) validateNullableString(input.avatarObjectPath);
  return input;
}

function validatePreferencesInput(input: UpdatePreferencesInput) {
  assertObjectWithOnlyKeys(input, [
    "notificationEnabled",
    "newsletterEnabled",
    "countryCode",
    "region",
    "prefecture",
    "city",
  ]);
  if ("notificationEnabled" in input && typeof input.notificationEnabled !== "boolean") return invalidInput();
  if ("newsletterEnabled" in input && typeof input.newsletterEnabled !== "boolean") return invalidInput();
  for (const key of ["countryCode", "region", "prefecture", "city"] as const) {
    if (key in input) validateNullableString(input[key]);
  }
  return input;
}

function validateArtWallSettings(input: UpdateArtWallSettingsInput): ArtWallSettingsDTO {
  if (!input || typeof input !== "object" || Array.isArray(input)) return invalidInput();
  const keys = Object.keys(input);
  const allowed = ["showIcon", "title", "comment", "backgroundKey", "columns", "wallHeightMode"];
  if (keys.length !== allowed.length || keys.some((key) => !allowed.includes(key))) return invalidInput();
  if (typeof input.showIcon !== "boolean") return invalidInput();
  validateNullableString(input.title);
  validateNullableString(input.comment);
  validateNullableString(input.backgroundKey);
  if (input.columns !== 3 && input.columns !== 4) return invalidInput();
  if (input.wallHeightMode !== "standard" && input.wallHeightMode !== "expanded") return invalidInput();
  return { ...input };
}

function validateDesiredArtWallItems(items: SaveArtWallItemInput[]) {
  if (!Array.isArray(items)) return invalidInput();
  const seen = new Set<string>();
  return items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return invalidInput();
    const keys = Object.keys(item);
    if (keys.length !== 3 || keys.some((key) => !["exhibitionId", "sortOrder", "isVisible"].includes(key))) {
      return invalidInput();
    }
    if (!validateUuid(item.exhibitionId) || seen.has(item.exhibitionId)) return invalidInput();
    if (!Number.isInteger(item.sortOrder) || item.sortOrder < 0 || typeof item.isVisible !== "boolean") {
      return invalidInput();
    }
    seen.add(item.exhibitionId);
    return { ...item };
  });
}

function isExpectedActionDuplicate(error: unknown, action: PersonalActionKind, ref: EntityRef) {
  return error instanceof UserRepositoryError
    && error.providerCode === "23505"
    && error.constraint === ACTION_DUPLICATE_CONSTRAINTS[action][ref.kind];
}

export async function requireAuthenticatedViewer(client?: ClaimsClient): Promise<string> {
  const sessionClient = client ?? await createSupabaseServerClient();
  const { data, error } = await sessionClient.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || !validateUuid(subject)) throw new UserDataError("unauthenticated");
  return subject;
}

async function resolveDefaultViewer(): Promise<ViewerContext> {
  const client = await createSupabaseServerClient();
  const userId = await requireAuthenticatedViewer(client);
  return { userId, repository: createUserDataRepository(client as SupabaseClient) };
}

export function createUserDataService(
  dependencies: UserDataServiceDependencies = { resolveViewer: resolveDefaultViewer },
) {
  async function run<T>(operation: (context: ViewerContext) => Promise<T>): Promise<T> {
    try {
      return await operation(await dependencies.resolveViewer());
    } catch (error) {
      throw toUserDataError(error);
    }
  }

  return {
    getProfile: () => run(async ({ userId, repository }): Promise<ProfileDTO> => {
      const profile = await repository.getProfile(userId);
      if (!profile) throw new UserDataError("not_found");
      return profile;
    }),

    updateProfile: (input: UpdateProfileInput) => run(({ userId, repository }) =>
      repository.updateProfile(userId, validateProfileInput(input))),

    getPreferences: () => run(async ({ userId, repository }): Promise<PreferencesDTO> => {
      const preferences = await repository.getPreferences(userId);
      if (!preferences) throw new UserDataError("not_found");
      return preferences;
    }),

    updatePreferences: (input: UpdatePreferencesInput) => run(({ userId, repository }) =>
      repository.updatePreferences(userId, validatePreferencesInput(input))),

    listActions: (action: PersonalActionKind) => run(({ userId, repository }): Promise<PersonalActionDTO[]> => {
      if (!(["saved", "seen", "favorite"] as string[]).includes(action)) return invalidInput();
      return repository.listActions(userId, action);
    }),

    addAction: (action: PersonalActionKind, input: EntityRef) => run(async ({ userId, repository }) => {
      const ref = validateActionTarget(action, input);
      try {
        await repository.addAction(userId, action, ref);
      } catch (error) {
        if (!isExpectedActionDuplicate(error, action, ref)) throw error;
      }
    }),

    removeAction: (action: PersonalActionKind, input: EntityRef) => run(async ({ userId, repository }) => {
      const ref = validateActionTarget(action, input);
      await repository.removeAction(userId, action, ref);
    }),

    getViewerEntityStates: (input: EntityRef[]) => run(async ({ userId, repository }): Promise<ViewerEntityStateDTO[]> => {
      if (!Array.isArray(input) || input.length > VIEWER_STATE_BATCH_LIMIT) return invalidInput();
      const refs = [...new Map(input.map(validateEntityRef).map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];
      if (!refs.length) return [];
      const [saved, seen, favorite] = await Promise.all([
        repository.listActionsForRefs(userId, "saved", refs),
        repository.listActionsForRefs(userId, "seen", refs),
        repository.listActionsForRefs(userId, "favorite", refs),
      ]);
      const keys = (items: PersonalActionDTO[]) => new Set(items.map((item) => `${item.entity.kind}:${item.entity.id}`));
      const savedKeys = keys(saved);
      const seenKeys = keys(seen);
      const favoriteKeys = keys(favorite);
      return refs.map((entity) => {
        const key = `${entity.kind}:${entity.id}`;
        return {
          entity,
          isSaved: savedKeys.has(key),
          isSeen: seenKeys.has(key),
          isFavorite: (entity.kind === "artist" || entity.kind === "venue") && favoriteKeys.has(key),
        };
      });
    }),

    getArtWall: () => run(async ({ userId, repository }): Promise<ArtWallDTO> => {
      const [settings, items, seenExhibitionIds] = await Promise.all([
        repository.getArtWallSettings(userId),
        repository.getArtWallItems(userId),
        repository.listSeenExhibitionIds(userId),
      ]);
      const eligible = new Set(seenExhibitionIds);
      return {
        settings: settings ?? { ...DEFAULT_ARTWALL_SETTINGS },
        items: items.filter((item) => eligible.has(item.exhibitionId)),
      };
    }),

    updateArtWallSettings: (input: UpdateArtWallSettingsInput) => run(({ userId, repository }) =>
      repository.updateArtWallSettings(userId, validateArtWallSettings(input))),

    getArtWallCandidateExhibitionIds: () => run(({ userId, repository }) =>
      repository.listSeenExhibitionIds(userId)),

    saveArtWallItems: (input: SaveArtWallItemInput[]) => run(async ({ userId, repository }) => {
      const desired = validateDesiredArtWallItems(input);
      const desiredIds = desired.map((item) => item.exhibitionId);
      if (!desiredIds.length) {
        await repository.saveArtWallItems(userId, []);
        return;
      }
      const eligibleIds = new Set(await repository.listSeenExhibitionIds(userId, desiredIds));
      if (desiredIds.some((id) => !eligibleIds.has(id))) throw new UserDataError("invalid_target");
      await repository.saveArtWallItems(userId, desired);
    }),
  };
}

const service = createUserDataService();

export const getProfile = service.getProfile;
export const updateProfile = service.updateProfile;
export const getPreferences = service.getPreferences;
export const updatePreferences = service.updatePreferences;
export const listPersonalActions = service.listActions;
export const addPersonalAction = service.addAction;
export const removePersonalAction = service.removeAction;
export const getViewerEntityStates = service.getViewerEntityStates;
export const getArtWall = service.getArtWall;
export const updateArtWallSettings = service.updateArtWallSettings;
export const getArtWallCandidateExhibitionIds = service.getArtWallCandidateExhibitionIds;
export const saveArtWallItems = service.saveArtWallItems;
