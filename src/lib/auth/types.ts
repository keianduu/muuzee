export const AUTHENTICATED_TRANSITION = "authenticated" as const;

export type AuthenticatedTransition = {
  type: typeof AUTHENTICATED_TRANSITION;
  source: "login" | "registration" | "confirmation" | "recovery";
};

export type AuthErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "rate_limited"
  | "expired_or_invalid_link"
  | "unauthenticated"
  | "temporary";

export type AuthErrorResult = {
  ok: false;
  status: "error";
  error: {
    code: AuthErrorCode;
    retryable: boolean;
  };
};

export type AuthSuccessResult = {
  ok: true;
  status:
    | "authenticated"
    | "awaiting_email_confirmation"
    | "confirmation_requested"
    | "recovery_requested"
    | "password_updated"
    | "signed_out";
  transition?: AuthenticatedTransition;
};

export type AuthOperationResult = AuthSuccessResult | AuthErrorResult;

export type AuthCallbackIntent = "confirmation" | "recovery";
