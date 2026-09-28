import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import {
  isNeutralAccountLookupError,
  isNeutralRegistrationExistenceError,
  mapAuthProviderError,
} from "./errors";
import {
  validateEmail,
  validateEmailPassword,
  validatePassword,
} from "./validation";
import {
  AUTHENTICATED_TRANSITION,
  type AuthCallbackIntent,
  type AuthOperationResult,
  type AuthSuccessResult,
  type AuthenticatedTransition,
} from "./types";

export type AuthClient = Pick<SupabaseClient["auth"],
  | "exchangeCodeForSession"
  | "getClaims"
  | "getUser"
  | "resend"
  | "resetPasswordForEmail"
  | "signInWithPassword"
  | "signOut"
  | "signUp"
  | "updateUser"
  | "verifyOtp"
>;

type CallbackInput = {
  code?: string | null;
  tokenHash?: string | null;
  type?: string | null;
  intent?: AuthCallbackIntent | null;
};

const CALLBACK_OTP_TYPES = new Set<EmailOtpType>(["signup", "recovery", "email"]);

function success(status: Exclude<AuthSuccessResult["status"], "authenticated">): AuthOperationResult {
  return { ok: true, status };
}

function authenticated(source: AuthenticatedTransition["source"]): AuthOperationResult {
  return {
    ok: true,
    status: "authenticated",
    transition: { type: AUTHENTICATED_TRANSITION, source },
  };
}

async function requireVerifiedSession(client: AuthClient, source: AuthenticatedTransition["source"]) {
  const { data, error } = await client.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== "string" || !subject) {
    return mapAuthProviderError(error, "authenticated");
  }
  return authenticated(source);
}

export async function loginWithPassword(
  client: AuthClient,
  input: { email?: unknown; password?: unknown },
): Promise<AuthOperationResult> {
  const credentials = validateEmailPassword(input.email, input.password);
  if (!credentials.ok) return credentials;

  const { error } = await client.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (error) return mapAuthProviderError(error, "credentials");
  return requireVerifiedSession(client, "login");
}

export async function registerWithPassword(
  client: AuthClient,
  input: { email?: unknown; password?: unknown; emailRedirectTo: string },
): Promise<AuthOperationResult> {
  const credentials = validateEmailPassword(input.email, input.password);
  if (!credentials.ok) return credentials;

  const { data, error } = await client.signUp({
    email: credentials.email,
    password: credentials.password,
    options: { emailRedirectTo: input.emailRedirectTo },
  });
  if (error) {
    if (isNeutralRegistrationExistenceError(error)) return success("awaiting_email_confirmation");
    return mapAuthProviderError(error);
  }
  if (!data.session) return success("awaiting_email_confirmation");
  return requireVerifiedSession(client, "registration");
}

export async function resendRegistrationConfirmation(
  client: AuthClient,
  input: { email?: unknown; emailRedirectTo: string },
): Promise<AuthOperationResult> {
  const validated = validateEmail(input.email);
  if (!validated.ok) return validated;

  const { error } = await client.resend({
    type: "signup",
    email: validated.email,
    options: { emailRedirectTo: input.emailRedirectTo },
  });
  if (error && !isNeutralAccountLookupError(error) && !isNeutralRegistrationExistenceError(error)) {
    return mapAuthProviderError(error);
  }
  return success("confirmation_requested");
}

export async function requestPasswordRecovery(
  client: AuthClient,
  input: { email?: unknown; buildRedirectTo: (normalizedEmail: string) => string },
): Promise<AuthOperationResult> {
  const validated = validateEmail(input.email);
  if (!validated.ok) return validated;

  const { error } = await client.resetPasswordForEmail(validated.email, {
    redirectTo: input.buildRedirectTo(validated.email),
  });
  if (error && !isNeutralAccountLookupError(error)) return mapAuthProviderError(error);
  return success("recovery_requested");
}

export async function updatePassword(
  client: AuthClient,
  input: { password?: unknown },
  expectedUserId?: string,
): Promise<AuthOperationResult> {
  const validated = validatePassword(input.password);
  if (!validated.ok) return validated;

  const { data: viewer, error: viewerError } = await client.getUser();
  if (viewerError || !viewer.user) return mapAuthProviderError(viewerError, "authenticated");
  if (expectedUserId && viewer.user.id !== expectedUserId) {
    return mapAuthProviderError(null, "authenticated");
  }

  const { error } = await client.updateUser({ password: validated.password });
  if (error) return mapAuthProviderError(error);
  return success("password_updated");
}

export async function logoutCurrentSession(client: AuthClient): Promise<AuthOperationResult> {
  const { error } = await client.signOut({ scope: "local" });
  if (error) return mapAuthProviderError(error);
  return success("signed_out");
}

export async function completeAuthCallback(
  client: AuthClient,
  input: CallbackInput,
): Promise<AuthOperationResult> {
  const hasCode = typeof input.code === "string" && input.code.length > 0;
  const hasTokenHash = typeof input.tokenHash === "string" && input.tokenHash.length > 0;
  const validOtpType = CALLBACK_OTP_TYPES.has(input.type as EmailOtpType);

  if (hasCode === hasTokenHash) return mapAuthProviderError(null, "callback");

  if (hasTokenHash) {
    if (!validOtpType) return mapAuthProviderError(null, "callback");
    const { error } = await client.verifyOtp({
      token_hash: input.tokenHash as string,
      type: input.type as EmailOtpType,
    });
    if (error) return mapAuthProviderError(error, "callback");
  } else {
    const { error } = await client.exchangeCodeForSession(input.code as string);
    if (error) return mapAuthProviderError(error, "callback");
  }

  // `intent` is a navigation hint only. A token-hash callback has provider
  // recovery proof; PKCE recovery purpose is verified by the route's signed state.
  const source = hasTokenHash && input.type === "recovery"
    ? "recovery"
    : "confirmation";
  return requireVerifiedSession(client, source);
}
