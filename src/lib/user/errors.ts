export type UserDataErrorCode =
  | "unauthenticated"
  | "invalid_input"
  | "invalid_target"
  | "forbidden"
  | "not_found"
  | "temporary"
  | "data_integrity";

const PUBLIC_MESSAGES: Record<UserDataErrorCode, string> = {
  unauthenticated: "Authentication is required.",
  invalid_input: "The request is invalid.",
  invalid_target: "The requested target is not supported.",
  forbidden: "This operation is not allowed.",
  not_found: "The requested data was not found.",
  temporary: "The operation could not be completed. Please retry.",
  data_integrity: "The stored data could not be read safely.",
};

export class UserDataError extends Error {
  readonly code: UserDataErrorCode;
  readonly retryable: boolean;

  constructor(code: UserDataErrorCode, retryable = code === "temporary") {
    super(PUBLIC_MESSAGES[code]);
    this.name = "UserDataError";
    this.code = code;
    this.retryable = retryable;
  }
}

export class UserRepositoryError extends Error {
  readonly providerCode: string | null;
  readonly constraint: string | null;
  readonly status: number | null;

  constructor(input: { providerCode?: string; constraint?: string; status?: number }) {
    super("User data repository operation failed.");
    this.name = "UserRepositoryError";
    this.providerCode = input.providerCode ?? null;
    this.constraint = input.constraint ?? null;
    this.status = input.status ?? null;
  }
}

export function toUserDataError(error: unknown): UserDataError {
  if (error instanceof UserDataError) return error;
  if (!(error instanceof UserRepositoryError)) return new UserDataError("temporary", true);

  if (error.providerCode === "42501" || error.status === 401 || error.status === 403) {
    return new UserDataError("forbidden");
  }
  if (error.providerCode === "DATA_INTEGRITY") return new UserDataError("data_integrity");
  if (error.providerCode === "PGRST116") return new UserDataError("not_found");
  if (
    error.providerCode &&
    ["22P02", "23502", "23503", "23505", "23514"].includes(error.providerCode)
  ) {
    return new UserDataError("data_integrity");
  }
  return new UserDataError("temporary", true);
}
