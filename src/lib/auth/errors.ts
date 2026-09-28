import type { AuthErrorCode, AuthErrorResult } from "./types";

type ProviderError = {
  code?: unknown;
  status?: unknown;
};

const RATE_LIMIT_CODES = new Set([
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "over_sms_send_rate_limit",
]);

const INVALID_CREDENTIAL_CODES = new Set([
  "invalid_credentials",
  "email_not_confirmed",
]);

const INVALID_LINK_CODES = new Set([
  "bad_code_verifier",
  "flow_state_not_found",
  "flow_state_expired",
  "otp_expired",
  "otp_disabled",
]);

const UNAUTHENTICATED_CODES = new Set([
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "refresh_token_already_used",
]);

const INVALID_INPUT_CODES = new Set([
  "validation_failed",
  "weak_password",
  "same_password",
  "email_address_invalid",
]);

const REGISTRATION_EXISTENCE_CODES = new Set([
  "email_exists",
  "user_already_exists",
  "identity_already_exists",
]);

function providerCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const code = (error as ProviderError).code;
  return typeof code === "string" ? code : null;
}

function providerStatus(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const status = (error as ProviderError).status;
  return typeof status === "number" ? status : null;
}

export function isNeutralRegistrationExistenceError(error: unknown) {
  return REGISTRATION_EXISTENCE_CODES.has(providerCode(error) ?? "");
}

export function isNeutralAccountLookupError(error: unknown) {
  return ["user_not_found", "email_address_not_authorized"].includes(providerCode(error) ?? "");
}

export function authError(code: AuthErrorCode, retryable = false): AuthErrorResult {
  return { ok: false, status: "error", error: { code, retryable } };
}

export function mapAuthProviderError(
  error: unknown,
  context: "credentials" | "callback" | "authenticated" | "general" = "general",
): AuthErrorResult {
  const code = providerCode(error);
  const status = providerStatus(error);

  if ((code && RATE_LIMIT_CODES.has(code)) || status === 429) {
    return authError("rate_limited", true);
  }
  if (context === "credentials" && code && INVALID_CREDENTIAL_CODES.has(code)) {
    return authError("invalid_credentials");
  }
  if (context === "callback" || (code && INVALID_LINK_CODES.has(code))) {
    return authError("expired_or_invalid_link");
  }
  if (context === "authenticated" || (code && UNAUTHENTICATED_CODES.has(code))) {
    return authError("unauthenticated");
  }
  if (code && INVALID_INPUT_CODES.has(code)) {
    return authError("invalid_input");
  }
  return authError("temporary", true);
}
