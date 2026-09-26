import { describe, expect, it, vi } from "vitest";
import { UserDataError, UserRepositoryError } from "./errors";
import type { UserDataRepository } from "./repository";
import { createUserDataService, requireAuthenticatedViewer, VIEWER_STATE_BATCH_LIMIT } from "./service";
import type { EntityKind, EntityRef, PersonalActionDTO, SaveArtWallItemInput } from "./types";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const IDS = {
  exhibition: "22222222-2222-4222-8222-222222222222",
  artist: "33333333-3333-4333-8333-333333333333",
  venue: "44444444-4444-4444-8444-444444444444",
  work: "55555555-5555-4555-8555-555555555555",
} satisfies Record<EntityKind, string>;

function action(id: string, kind: EntityKind, entityId: string, type: "saved" | "seen" | "favorite"): PersonalActionDTO {
  return { id, action: type, entity: { kind, id: entityId }, createdAt: "2026-09-26T00:00:00Z", seenAt: null };
}

function fakeRepository(overrides: Partial<UserDataRepository> = {}): UserDataRepository {
  return {
    getProfile: vi.fn().mockResolvedValue({ displayName: "Muuzee", avatarObjectPath: null }),
    updateProfile: vi.fn(async (_userId, input) => ({ displayName: input.displayName ?? null, avatarObjectPath: input.avatarObjectPath ?? null })),
    getPreferences: vi.fn().mockResolvedValue({
      notificationEnabled: false, newsletterEnabled: false, countryCode: null, region: null, prefecture: null, city: null,
    }),
    updatePreferences: vi.fn(async (_userId, input) => ({
      notificationEnabled: input.notificationEnabled ?? false,
      newsletterEnabled: input.newsletterEnabled ?? false,
      countryCode: input.countryCode ?? null,
      region: input.region ?? null,
      prefecture: input.prefecture ?? null,
      city: input.city ?? null,
    })),
    listActions: vi.fn().mockResolvedValue([]),
    listActionsForRefs: vi.fn().mockResolvedValue([]),
    addAction: vi.fn().mockResolvedValue(undefined),
    removeAction: vi.fn().mockResolvedValue(undefined),
    getArtWallSettings: vi.fn().mockResolvedValue(null),
    updateArtWallSettings: vi.fn(async (_userId, settings) => settings),
    getArtWallItems: vi.fn().mockResolvedValue([]),
    listSeenExhibitionIds: vi.fn().mockResolvedValue([]),
    saveArtWallItems: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function serviceFor(repository: UserDataRepository) {
  return createUserDataService({ resolveViewer: async () => ({ userId: USER_ID, repository }) });
}

async function expectCode(promise: Promise<unknown>, code: UserDataError["code"], retryable = false) {
  await expect(promise).rejects.toMatchObject({ code, retryable });
}

describe("authenticated viewer identity", () => {
  it("derives identity only from verified claims.sub", async () => {
    const getClaims = vi.fn().mockResolvedValue({ data: { claims: { sub: USER_ID } }, error: null });
    await expect(requireAuthenticatedViewer({ auth: { getClaims } })).resolves.toBe(USER_ID);
    expect(getClaims).toHaveBeenCalledOnce();
  });

  it.each([
    { data: null, error: null },
    { data: { claims: {} }, error: null },
    { data: { claims: { sub: "not-a-uuid" } }, error: null },
    { data: { claims: { sub: USER_ID } }, error: new Error("expired") },
  ])("rejects invalid or missing verified claims", async (result) => {
    await expectCode(requireAuthenticatedViewer({ auth: { getClaims: vi.fn().mockResolvedValue(result) } }), "unauthenticated");
  });
});

describe("personal action contract", () => {
  it("rejects Favorite targets other than Artist and Venue before the repository", async () => {
    const repository = fakeRepository();
    const service = serviceFor(repository);
    await expectCode(service.addAction("favorite", { kind: "exhibition", id: IDS.exhibition }), "invalid_target");
    await expectCode(service.addAction("favorite", { kind: "work", id: IDS.work }), "invalid_target");
    expect(repository.addAction).not.toHaveBeenCalled();
  });

  it.each(["exhibition", "artist", "venue", "work"] as const)("supports Saved and Seen for %s", async (kind) => {
    const repository = fakeRepository();
    const service = serviceFor(repository);
    await service.addAction("saved", { kind, id: IDS[kind] });
    await service.addAction("seen", { kind, id: IDS[kind] });
    expect(repository.addAction).toHaveBeenCalledWith(USER_ID, "saved", { kind, id: IDS[kind] });
    expect(repository.addAction).toHaveBeenCalledWith(USER_ID, "seen", { kind, id: IDS[kind] });
  });

  it("treats only the expected partial-unique duplicate as add success", async () => {
    const repository = fakeRepository({
      addAction: vi.fn().mockRejectedValue(new UserRepositoryError({
        providerCode: "23505", constraint: "user_saved_items_exhibition_uq",
      })),
    });
    await expect(serviceFor(repository).addAction("saved", { kind: "exhibition", id: IDS.exhibition })).resolves.toBeUndefined();

    repository.addAction = vi.fn().mockRejectedValue(new UserRepositoryError({
      providerCode: "23505", constraint: "some_other_constraint",
    }));
    await expectCode(serviceFor(repository).addAction("saved", { kind: "exhibition", id: IDS.exhibition }), "data_integrity");
  });

  it("treats removal of an absent membership as success", async () => {
    const repository = fakeRepository();
    await expect(serviceFor(repository).removeAction("seen", { kind: "artist", id: IDS.artist })).resolves.toBeUndefined();
    expect(repository.removeAction).toHaveBeenCalledOnce();
  });

  it("does not expose an arbitrary userId parameter on public operations", () => {
    const service = serviceFor(fakeRepository());
    expect(service.getProfile.length).toBe(0);
    expect(service.updateProfile.length).toBe(1);
    expect(service.addAction.length).toBe(2);
    expect(service.getViewerEntityStates.length).toBe(1);
  });
});

describe("safe errors", () => {
  it("maps provider failures without leaking raw SQL/PostgREST text", async () => {
    const repository = fakeRepository({
      getProfile: vi.fn().mockRejectedValue(new UserRepositoryError({ providerCode: "22P02" })),
    });
    try {
      await serviceFor(repository).getProfile();
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(UserDataError);
      expect(error).toMatchObject({ code: "data_integrity", retryable: false });
      expect(String(error)).not.toContain("22P02");
    }
  });

  it("marks unknown transient failures retryable", async () => {
    const repository = fakeRepository({ getProfile: vi.fn().mockRejectedValue(new Error("socket token raw")) });
    await expectCode(serviceFor(repository).getProfile(), "temporary", true);
  });
});

describe("viewer state", () => {
  it("deduplicates bounded input and composes separate action flags", async () => {
    const repository = fakeRepository({
      listActionsForRefs: vi.fn(async (_userId, kind) => {
        if (kind === "saved") return [action("s", "exhibition", IDS.exhibition, "saved")];
        if (kind === "seen") return [action("v", "artist", IDS.artist, "seen")];
        return [action("f", "artist", IDS.artist, "favorite")];
      }),
    });
    const service = serviceFor(repository);
    const refs: EntityRef[] = [
      { kind: "exhibition", id: IDS.exhibition },
      { kind: "exhibition", id: IDS.exhibition },
      { kind: "artist", id: IDS.artist },
      { kind: "work", id: IDS.work },
    ];
    await expect(service.getViewerEntityStates(refs)).resolves.toEqual([
      { entity: refs[0], isSaved: true, isSeen: false, isFavorite: false },
      { entity: refs[2], isSaved: false, isSeen: true, isFavorite: true },
      { entity: refs[3], isSaved: false, isSeen: false, isFavorite: false },
    ]);
    for (const call of vi.mocked(repository.listActionsForRefs).mock.calls) {
      expect(call[2]).toHaveLength(3);
    }
  });

  it("rejects an unbounded batch before repository queries", async () => {
    const repository = fakeRepository();
    const refs = Array.from({ length: VIEWER_STATE_BATCH_LIMIT + 1 }, () => ({ kind: "artist" as const, id: IDS.artist }));
    await expectCode(serviceFor(repository).getViewerEntityStates(refs), "invalid_input");
    expect(repository.listActionsForRefs).not.toHaveBeenCalled();
  });

  it("keeps viewer state out of Profile/Public DTOs", async () => {
    const profile = await serviceFor(fakeRepository()).getProfile();
    expect(profile).toEqual({ displayName: "Muuzee", avatarObjectPath: null });
    expect(profile).not.toHaveProperty("isSaved");
    expect(profile).not.toHaveProperty("isSeen");
    expect(profile).not.toHaveProperty("isFavorite");
  });
});

describe("ArtWall contract", () => {
  it("preserves repository deterministic order and filters persisted items by current Seen Exhibitions", async () => {
    const repository = fakeRepository({
      getArtWallItems: vi.fn().mockResolvedValue([
        { id: "a", exhibitionId: IDS.exhibition, sortOrder: 0, isVisible: true },
        { id: "b", exhibitionId: "66666666-6666-4666-8666-666666666666", sortOrder: 0, isVisible: false },
      ]),
      listSeenExhibitionIds: vi.fn().mockResolvedValue([IDS.exhibition]),
    });
    const wall = await serviceFor(repository).getArtWall();
    expect(wall.items).toEqual([{ id: "a", exhibitionId: IDS.exhibition, sortOrder: 0, isVisible: true }]);
  });

  it("gets candidates only through the Seen Exhibition query", async () => {
    const repository = fakeRepository({ listSeenExhibitionIds: vi.fn().mockResolvedValue([IDS.exhibition]) });
    await expect(serviceFor(repository).getArtWallCandidateExhibitionIds()).resolves.toEqual([IDS.exhibition]);
    expect(repository.listSeenExhibitionIds).toHaveBeenCalledWith(USER_ID);
    expect(repository.listActions).not.toHaveBeenCalled();
  });

  it("rejects desired non-Seen Exhibitions", async () => {
    const repository = fakeRepository({ listSeenExhibitionIds: vi.fn().mockResolvedValue([]) });
    await expectCode(serviceFor(repository).saveArtWallItems([
      { exhibitionId: IDS.exhibition, sortOrder: 0, isVisible: true },
    ]), "invalid_target");
    expect(repository.saveArtWallItems).not.toHaveBeenCalled();
  });

  it("clears an empty desired set without issuing an empty Seen-ID query", async () => {
    const repository = fakeRepository();
    await expect(serviceFor(repository).saveArtWallItems([])).resolves.toBeUndefined();
    expect(repository.listSeenExhibitionIds).not.toHaveBeenCalled();
    expect(repository.saveArtWallItems).toHaveBeenCalledWith(USER_ID, []);
  });

  it("rejects duplicate IDs and negative sort positions", async () => {
    const repository = fakeRepository();
    const duplicate: SaveArtWallItemInput[] = [
      { exhibitionId: IDS.exhibition, sortOrder: 0, isVisible: true },
      { exhibitionId: IDS.exhibition, sortOrder: 1, isVisible: false },
    ];
    await expectCode(serviceFor(repository).saveArtWallItems(duplicate), "invalid_input");
    await expectCode(serviceFor(repository).saveArtWallItems([
      { exhibitionId: IDS.exhibition, sortOrder: -1, isVisible: true },
    ]), "invalid_input");
  });

  it("converges safely when the same desired set is retried", async () => {
    let persisted: SaveArtWallItemInput[] = [];
    const repository = fakeRepository({
      listSeenExhibitionIds: vi.fn(async (_userId, ids) => ids ?? [IDS.exhibition]),
      saveArtWallItems: vi.fn(async (_userId: string, items: SaveArtWallItemInput[]) => {
        persisted = items.map((item) => ({ ...item }));
      }),
    });
    const desired = [{ exhibitionId: IDS.exhibition, sortOrder: 0, isVisible: true }];
    const service = serviceFor(repository);
    await service.saveArtWallItems(desired);
    await service.saveArtWallItems(desired);
    expect(persisted).toEqual(desired);
    expect(repository.saveArtWallItems).toHaveBeenCalledTimes(2);
  });
});
