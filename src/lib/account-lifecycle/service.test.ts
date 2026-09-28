import { describe, expect, it, vi } from "vitest";
import type { UserDataRepository } from "@/lib/user/repository";
import type { ProfileDTO } from "@/lib/user/types";
import {
  createAccountLifecycleMarker,
  verifyAccountLifecycleMarker,
} from "./marker";
import {
  deleteAccount,
  deletionAggregate,
  exportAccountData,
  reauthenticateAccount,
  type AccountDeletionDependencies,
  type AccountExportDependencies,
  type AccountReauthenticationDependencies,
} from "./service";

const user = {
  id: "25100000-0000-4000-8000-000000000001",
  email: "person@example.com",
  created_at: "2025-09-01T00:00:00.000Z",
  email_confirmed_at: "2025-09-01T00:05:00.000Z",
};
const markerSecret = "order251-review-fixture-secret-with-at-least-32-bytes";
const markerIssuedAt = new Date("2026-09-28T00:00:00.000Z");
const markerVerificationTime = new Date("2026-09-28T00:01:00.000Z");

function signedMarker(userId = user.id, now = markerIssuedAt) {
  return createAccountLifecycleMarker(userId, { secret: markerSecret, now });
}

function tamperedMarker() {
  const segments = signedMarker().split(".");
  const signature = segments.at(-1) ?? "";
  segments[segments.length - 1] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  return segments.join(".");
}

function auth(overrides: Record<string, unknown> = {}) {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

function repository(profile: ProfileDTO = { displayName: "Person", avatarObjectPath: null }): UserDataRepository {
  return {
    getProfile: vi.fn().mockResolvedValue(profile),
    updateProfile: vi.fn(),
    getPreferences: vi.fn().mockResolvedValue({
      notificationEnabled: false,
      newsletterEnabled: false,
      countryCode: null,
      region: null,
      prefecture: null,
      city: null,
    }),
    updatePreferences: vi.fn(),
    listActions: vi.fn().mockResolvedValue([]),
    listActionsForRefs: vi.fn(),
    addAction: vi.fn(),
    removeAction: vi.fn(),
    getArtWallSettings: vi.fn().mockResolvedValue(null),
    updateArtWallSettings: vi.fn(),
    getArtWallItems: vi.fn().mockResolvedValue([]),
    listSeenExhibitionIds: vi.fn(),
    saveArtWallItems: vi.fn(),
  };
}

describe("Account export", () => {
  it("exports only the current account's safe typed data", async () => {
    const dependencies: AccountExportDependencies = {
      auth: auth(),
      repository: repository(),
      listConsents: vi.fn().mockResolvedValue([]),
    };
    const result = await exportAccountData({} as never, dependencies);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.account).toEqual({
      id: user.id,
      email: user.email,
      createdAt: user.created_at,
      emailConfirmedAt: user.email_confirmed_at,
    });
    expect(result.data.avatarAsset).toEqual({ status: "not_present" });
    expect(JSON.stringify(result.data)).not.toMatch(/password|access_token|refresh_token|jwt/i);
  });

  it("reports a non-null avatar as unavailable instead of pretending it was exported", async () => {
    const dependencies: AccountExportDependencies = {
      auth: auth(),
      repository: repository({ displayName: "Person", avatarObjectPath: "avatars/a.png" }),
      listConsents: vi.fn().mockResolvedValue([]),
    };
    const result = await exportAccountData({} as never, dependencies);
    expect(result.ok && result.data.avatarAsset).toEqual({
      status: "unavailable",
      reason: "storage_export_not_implemented",
    });
  });

  it("requires a fresh authenticated user", async () => {
    const dependencies: AccountExportDependencies = {
      auth: auth({ getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: {} }) }),
      repository: repository(),
      listConsents: vi.fn().mockResolvedValue([]),
    };
    await expect(exportAccountData({} as never, dependencies)).resolves.toEqual({
      ok: false,
      error: { code: "unauthenticated", retryable: false },
    });
  });
});

describe("Account reauthentication", () => {
  it("uses the confirmed email from fresh Auth state and verifies the returned identity", async () => {
    const issuedMarker = signedMarker();
    const dependencies: AccountReauthenticationDependencies = {
      auth: auth(),
      issueMarker: vi.fn(() => issuedMarker),
    };
    const result = await reauthenticateAccount({} as never, { password: "secret-password" }, dependencies);
    expect(result).toEqual({ ok: true, data: { reauthenticated: true, marker: issuedMarker } });
    expect(dependencies.auth.signInWithPassword).toHaveBeenCalledWith({
      email: user.email,
      password: "secret-password",
    });
  });

  it("rejects invalid credentials and identity swaps", async () => {
    const swapped = { ...user, id: "25100000-0000-4000-8000-000000000002" };
    const dependencies: AccountReauthenticationDependencies = {
      auth: auth({ signInWithPassword: vi.fn().mockResolvedValue({ data: { user: swapped }, error: null }) }),
      issueMarker: vi.fn(() => signedMarker()),
    };
    await expect(reauthenticateAccount({} as never, { password: "secret-password" }, dependencies)).resolves.toEqual({
      ok: false,
      error: { code: "invalid_credentials", retryable: false },
    });
    expect(dependencies.issueMarker).not.toHaveBeenCalled();
  });

  it("fails closed after successful password verification when marker signing is unavailable", async () => {
    const dependencies: AccountReauthenticationDependencies = {
      auth: auth(),
      issueMarker: vi.fn(() => { throw new Error("missing signing secret"); }),
    };
    await expect(reauthenticateAccount({} as never, { password: "secret-password" }, dependencies)).resolves.toEqual({
      ok: false,
      error: { code: "temporary", retryable: true },
    });
  });
});

describe("Account deletion", () => {
  function dependencies(profile: ProfileDTO = { displayName: "Person", avatarObjectPath: null }) {
    return {
      auth: auth(),
      repository: repository(profile),
      verifyMarker: vi.fn((value, userId) => verifyAccountLifecycleMarker(value, userId, {
        secret: markerSecret,
        now: markerVerificationTime,
      })),
      cleanupExternalProcessors: vi.fn().mockResolvedValue(undefined),
      deleteAuthUser: vi.fn().mockResolvedValue({ error: null }),
      emitDeletionAggregate: vi.fn().mockResolvedValue(undefined),
    } satisfies AccountDeletionDependencies;
  }

  it("gets fresh identity before rejecting a missing marker", async () => {
    const deps = dependencies();
    const result = await deleteAccount({} as never, { confirm: true }, null, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    expect(deps.auth.getUser).toHaveBeenCalledOnce();
    expect(deps.verifyMarker).toHaveBeenCalledWith(null, user.id);
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it.each([
    ["the former fixed marker", "1"],
    ["a malformed marker", "not.a.valid.marker"],
    ["an expired marker", signedMarker(user.id, new Date("2026-09-27T23:00:00.000Z"))],
    ["a tampered marker", tamperedMarker()],
  ])("never reaches Admin delete with %s", async (_label, value) => {
    const deps = dependencies();
    const result = await deleteAccount({} as never, { confirm: true }, value, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
    expect(deps.repository.getProfile).not.toHaveBeenCalled();
  });

  it("rejects a User A marker when fresh Auth state belongs to User B", async () => {
    const deps = dependencies();
    const userB = { ...user, id: "25100000-0000-4000-8000-000000000002" };
    vi.mocked(deps.auth.getUser).mockResolvedValue({ data: { user: userB }, error: null } as never);
    const result = await deleteAccount({} as never, { confirm: true }, signedMarker(user.id), deps);
    expect(result).toEqual({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("fails closed when avatar cleanup cannot be completed", async () => {
    const deps = dependencies({ displayName: "Person", avatarObjectPath: "avatars/a.png" });
    const result = await deleteAccount({} as never, { confirm: true }, signedMarker(), deps);
    expect(result).toEqual({
      ok: false,
      error: { code: "storage_cleanup_required", retryable: false },
    });
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("uses Admin hard-delete as the commit point and keeps later failures non-blocking", async () => {
    const deps = dependencies();
    deps.emitDeletionAggregate.mockRejectedValue(new Error("sink unavailable"));
    vi.mocked(deps.auth.signOut).mockRejectedValue(new Error("already gone"));
    const result = await deleteAccount({} as never, { confirm: true }, signedMarker(), deps);
    expect(result).toEqual({ ok: true, data: { status: "account_deleted" } });
    expect(deps.deleteAuthUser).toHaveBeenCalledWith(user.id);
    expect(deps.emitDeletionAggregate).toHaveBeenCalledWith(expect.objectContaining({
      deletedOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      signupMonth: "2025-09",
      tenureBucket: expect.any(String),
    }));
  });

  it("uses the fixed non-identifying tenure buckets", () => {
    const now = new Date("2026-09-28T00:00:00.000Z");
    expect(deletionAggregate("2026-09-28T00:00:00.000Z", now).tenureBucket).toBe("0-30");
    expect(deletionAggregate("2026-08-01T00:00:00.000Z", now).tenureBucket).toBe("31-90");
    expect(deletionAggregate("2026-05-01T00:00:00.000Z", now).tenureBucket).toBe("91-180");
    expect(deletionAggregate("2026-01-01T00:00:00.000Z", now).tenureBucket).toBe("181-365");
    expect(deletionAggregate("2025-01-01T00:00:00.000Z", now).tenureBucket).toBe("366+");
  });
});
