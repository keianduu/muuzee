import { describe, expect, it, vi } from "vitest";
import type { UserDataRepository } from "@/lib/user/repository";
import type { ProfileDTO } from "@/lib/user/types";
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
    const dependencies: AccountReauthenticationDependencies = { auth: auth() };
    const result = await reauthenticateAccount({} as never, { password: "secret-password" }, dependencies);
    expect(result).toEqual({ ok: true, data: { reauthenticated: true } });
    expect(dependencies.auth.signInWithPassword).toHaveBeenCalledWith({
      email: user.email,
      password: "secret-password",
    });
  });

  it("rejects invalid credentials and identity swaps", async () => {
    const swapped = { ...user, id: "25100000-0000-4000-8000-000000000002" };
    const dependencies: AccountReauthenticationDependencies = {
      auth: auth({ signInWithPassword: vi.fn().mockResolvedValue({ data: { user: swapped }, error: null }) }),
    };
    await expect(reauthenticateAccount({} as never, { password: "secret-password" }, dependencies)).resolves.toEqual({
      ok: false,
      error: { code: "invalid_credentials", retryable: false },
    });
  });
});

describe("Account deletion", () => {
  function dependencies(profile: ProfileDTO = { displayName: "Person", avatarObjectPath: null }) {
    return {
      auth: auth(),
      repository: repository(profile),
      cleanupExternalProcessors: vi.fn().mockResolvedValue(undefined),
      deleteAuthUser: vi.fn().mockResolvedValue({ error: null }),
      emitDeletionAggregate: vi.fn().mockResolvedValue(undefined),
    } satisfies AccountDeletionDependencies;
  }

  it("requires the short-lived reauthentication marker before identity lookup or deletion", async () => {
    const deps = dependencies();
    const result = await deleteAccount({} as never, { confirm: true }, false, deps);
    expect(result).toEqual({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    expect(deps.auth.getUser).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("fails closed when avatar cleanup cannot be completed", async () => {
    const deps = dependencies({ displayName: "Person", avatarObjectPath: "avatars/a.png" });
    const result = await deleteAccount({} as never, { confirm: true }, true, deps);
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
    const result = await deleteAccount({} as never, { confirm: true }, true, deps);
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
