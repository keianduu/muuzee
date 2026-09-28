import type { AuthCallbackIntent, AuthErrorResult } from "./types";
import { authError } from "./errors";

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const AUTH_COMPLETE_PATH = "/auth/complete";
export const DEFAULT_AUTH_RETURN_TO = AUTH_COMPLETE_PATH;
export const PASSWORD_RECOVERY_RETURN_TO = "/auth/update-password";
export const MINIMUM_PASSWORD_LENGTH = 8;

const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

function decodedPathIsUnsafe(value: string) {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.startsWith("//") || decoded.includes("\\") || CONTROL_CHARACTER.test(decoded);
  } catch {
    return true;
  }
}

export function resolveSafeReturnTo(value: string | null | undefined, fallback = DEFAULT_AUTH_RETURN_TO) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || CONTROL_CHARACTER.test(value) || decodedPathIsUnsafe(value)) return fallback;

  try {
    const url = new URL(value, "https://muuzee.invalid");
    if (url.origin !== "https://muuzee.invalid") return fallback;
    if (url.pathname === AUTH_CALLBACK_PATH || url.pathname.startsWith(`${AUTH_CALLBACK_PATH}/`)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildAuthCallbackUrl(
  requestOrigin: string,
  intent: AuthCallbackIntent,
  returnTo?: string | null,
) {
  const callback = new URL(AUTH_CALLBACK_PATH, requestOrigin);
  callback.searchParams.set("intent", intent);
  callback.searchParams.set(
    "returnTo",
    resolveSafeReturnTo(
      returnTo,
      intent === "recovery" ? PASSWORD_RECOVERY_RETURN_TO : DEFAULT_AUTH_RETURN_TO,
    ),
  );
  return callback.toString();
}

export function buildFinalAuthRedirect(
  requestOrigin: string,
  returnTo: string | null | undefined,
  errorCode?: AuthErrorResult["error"]["code"],
) {
  const target = new URL(resolveSafeReturnTo(returnTo), requestOrigin);
  if (errorCode) target.searchParams.set("authError", errorCode);
  return target;
}

export function validateEmailPassword(email: unknown, password: unknown) {
  const validatedEmail = validateEmail(email);
  if (!validatedEmail.ok || typeof password !== "string" || password.length < MINIMUM_PASSWORD_LENGTH) {
    return authError("invalid_input");
  }
  return { ok: true as const, email: validatedEmail.email, password };
}

export function validateEmail(email: unknown) {
  if (typeof email !== "string") return authError("invalid_input");
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) return authError("invalid_input");
  return { ok: true as const, email: normalizedEmail };
}

export function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < MINIMUM_PASSWORD_LENGTH) {
    return authError("invalid_input");
  }
  return { ok: true as const, password };
}
