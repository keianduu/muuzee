import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createUserDataRepository, type UserDataRepository } from "@/lib/user/repository";
import { listLegalConsents } from "@/lib/legal-consent/service";
import {
  createAccountLifecycleMarker,
  verifyAccountLifecycleMarker,
} from "./marker";
import type {
  AccountDeletionAggregate,
  AccountExportDTO,
  AccountLifecycleErrorCode,
  AccountLifecycleResult,
} from "./types";

type ViewerAuthClient = Pick<SupabaseClient["auth"], "getUser" | "signInWithPassword" | "signOut">;

export type AccountExportDependencies = {
  auth: ViewerAuthClient;
  repository: UserDataRepository;
  listConsents(): ReturnType<typeof listLegalConsents>;
};

export type AccountReauthenticationDependencies = {
  auth: ViewerAuthClient;
  issueMarker(userId: string): string;
};

export type AccountDeletionDependencies = {
  auth: ViewerAuthClient;
  repository: UserDataRepository;
  verifyMarker(marker: string | null, userId: string): boolean;
  cleanupExternalProcessors(): Promise<void>;
  deleteAuthUser(userId: string): Promise<{ error: unknown }>;
  emitDeletionAggregate(payload: AccountDeletionAggregate): Promise<void>;
};

function failure<T>(code: AccountLifecycleErrorCode, retryable = false): AccountLifecycleResult<T> {
  return { ok: false, error: { code, retryable } };
}

async function requireFreshUser(auth: ViewerAuthClient): Promise<User | null> {
  try {
    const { data, error } = await auth.getUser();
    return error || !data.user ? null : data.user;
  } catch {
    return null;
  }
}

function defaultExportDependencies(client: SupabaseClient): AccountExportDependencies {
  return {
    auth: client.auth,
    repository: createUserDataRepository(client),
    listConsents: () => listLegalConsents(client),
  };
}

function defaultDeletionDependencies(client: SupabaseClient): AccountDeletionDependencies {
  const admin = createSupabaseAdminClient();
  return {
    auth: client.auth,
    repository: createUserDataRepository(client),
    verifyMarker: verifyAccountLifecycleMarker,
    // No Account-linked external processor exists today. Each future
    // integration must choose blocking cleanup or a reviewed minimal retry.
    cleanupExternalProcessors: async () => undefined,
    deleteAuthUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      return { error };
    },
    // Order 470 owns the durable analytics sink. This typed hook is deliberately
    // a no-op until that privacy-reviewed destination exists.
    emitDeletionAggregate: async () => undefined,
  };
}

export async function exportAccountData(
  client: SupabaseClient,
  dependencies: AccountExportDependencies = defaultExportDependencies(client),
): Promise<AccountLifecycleResult<AccountExportDTO>> {
  const viewer = await requireFreshUser(dependencies.auth);
  if (!viewer) return failure("unauthenticated");

  try {
    const [profile, preferences, saved, seen, favorite, settings, items, legalConsents] = await Promise.all([
      dependencies.repository.getProfile(viewer.id),
      dependencies.repository.getPreferences(viewer.id),
      dependencies.repository.listActions(viewer.id, "saved"),
      dependencies.repository.listActions(viewer.id, "seen"),
      dependencies.repository.listActions(viewer.id, "favorite"),
      dependencies.repository.getArtWallSettings(viewer.id),
      dependencies.repository.getArtWallItems(viewer.id),
      dependencies.listConsents(),
    ]);

    return {
      ok: true,
      data: {
        exportedAt: new Date().toISOString(),
        account: {
          id: viewer.id,
          email: viewer.email ?? null,
          createdAt: viewer.created_at,
          emailConfirmedAt: viewer.email_confirmed_at ?? null,
        },
        profile,
        avatarAsset: profile?.avatarObjectPath
          ? { status: "unavailable", reason: "storage_export_not_implemented" }
          : { status: "not_present" },
        preferences,
        saved,
        seen,
        favorite,
        artWall: { settings, items },
        legalConsents,
      },
    };
  } catch {
    return failure("temporary", true);
  }
}

export async function reauthenticateAccount(
  client: SupabaseClient,
  input: unknown,
  dependencies: AccountReauthenticationDependencies = {
    auth: client.auth,
    issueMarker: createAccountLifecycleMarker,
  },
): Promise<AccountLifecycleResult<{ reauthenticated: true; marker: string }>> {
  if (
    !input
    || typeof input !== "object"
    || Array.isArray(input)
    || Object.keys(input).some((key) => key !== "password")
    || typeof (input as { password?: unknown }).password !== "string"
    || !(input as { password: string }).password
  ) {
    return failure("invalid_input");
  }

  const viewer = await requireFreshUser(dependencies.auth);
  if (!viewer) return failure("unauthenticated");
  if (!viewer.email || !viewer.email_confirmed_at) return failure("invalid_credentials");

  let verification;
  try {
    verification = await dependencies.auth.signInWithPassword({
      email: viewer.email,
      password: (input as { password: string }).password,
    });
  } catch {
    return failure("temporary", true);
  }
  const { data, error } = verification;
  if (error || !data.user || data.user.id !== viewer.id) return failure("invalid_credentials");
  try {
    return {
      ok: true,
      data: {
        reauthenticated: true,
        marker: dependencies.issueMarker(viewer.id),
      },
    };
  } catch {
    return failure("temporary", true);
  }
}

export function deletionAggregate(createdAt: string, now = new Date()): AccountDeletionAggregate {
  const created = new Date(createdAt);
  const ageDays = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
  const tenureBucket = ageDays <= 30
    ? "0-30"
    : ageDays <= 90
      ? "31-90"
      : ageDays <= 180
        ? "91-180"
        : ageDays <= 365
          ? "181-365"
          : "366+";
  return {
    deletedOn: now.toISOString().slice(0, 10),
    signupMonth: created.toISOString().slice(0, 7),
    tenureBucket,
  };
}

export async function deleteAccount(
  client: SupabaseClient,
  input: unknown,
  marker: string | null,
  dependencies?: AccountDeletionDependencies,
): Promise<AccountLifecycleResult<{ status: "account_deleted" }>> {
  if (
    !input
    || typeof input !== "object"
    || Array.isArray(input)
    || Object.keys(input).length !== 1
    || (input as { confirm?: unknown }).confirm !== true
  ) {
    return failure("invalid_input");
  }

  const viewer = await requireFreshUser(dependencies?.auth ?? client.auth);
  if (!viewer) return failure("unauthenticated");

  const markerIsValid = (() => {
    try {
      return (dependencies?.verifyMarker ?? verifyAccountLifecycleMarker)(marker, viewer.id);
    } catch {
      return false;
    }
  })();
  if (!markerIsValid) return failure("reauthentication_required");

  let activeDependencies: AccountDeletionDependencies;
  try {
    activeDependencies = dependencies ?? defaultDeletionDependencies(client);
  } catch {
    return failure("temporary", true);
  }

  try {
    const profile = await activeDependencies.repository.getProfile(viewer.id);
    // No avatar bucket/cleanup adapter exists yet. Fail closed instead of
    // deleting Storage metadata with SQL or claiming incomplete cleanup.
    if (profile?.avatarObjectPath) return failure("storage_cleanup_required");
    await activeDependencies.cleanupExternalProcessors();
  } catch {
    return failure("temporary", true);
  }

  const aggregate = deletionAggregate(viewer.created_at);
  let deletion;
  try {
    deletion = await activeDependencies.deleteAuthUser(viewer.id);
  } catch {
    return failure("temporary", true);
  }
  const { error } = deletion;
  if (error) return failure("temporary", true);

  // Auth deletion is the commit point. Nothing below may convert a completed,
  // irreversible deletion into an apparent failure.
  await Promise.allSettled([
    activeDependencies.emitDeletionAggregate(aggregate),
    activeDependencies.auth.signOut({ scope: "local" }),
  ]);

  return { ok: true, data: { status: "account_deleted" } };
}
