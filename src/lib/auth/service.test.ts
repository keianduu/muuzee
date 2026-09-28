import { describe, expect, it, vi } from "vitest";
import type { AuthClient } from "./service";
import {
  completeAuthCallback,
  loginWithPassword,
  logoutCurrentSession,
  registerWithPassword,
  requestPasswordRecovery,
  resendRegistrationConfirmation,
  updatePassword,
} from "./service";
import { AUTHENTICATED_TRANSITION } from "./types";

const USER = { id: "11111111-1111-4111-8111-111111111111" };

function providerError(code: string, message = "raw provider detail") {
  return { code, message, status: code.startsWith("over_") ? 429 : 400 };
}

function fakeClient(overrides: Record<string, unknown> = {}): AuthClient {
  return {
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: USER, session: {} }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: USER, session: null }, error: null }),
    resend: vi.fn().mockResolvedValue({ data: {}, error: null }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user: USER, session: {} }, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: { user: USER, session: {} }, error: null }),
    getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: USER.id } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
    updateUser: vi.fn().mockResolvedValue({ data: { user: USER }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  } as unknown as AuthClient;
}

describe("Auth safe domain contract", () => {
  it("maps invalid login credentials without provider text or account-existence detail", async () => {
    const result = await loginWithPassword(fakeClient({
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: providerError("invalid_credentials") }),
    }), { email: "person@example.com", password: "password123" });
    expect(result).toEqual({
      ok: false,
      status: "error",
      error: { code: "invalid_credentials", retryable: false },
    });
    expect(JSON.stringify(result)).not.toContain("raw provider detail");
  });

  it("returns a verified authenticated transition after login", async () => {
    const result = await loginWithPassword(fakeClient(), {
      email: "PERSON@example.com",
      password: "password123",
    });
    expect(result).toEqual({
      ok: true,
      status: "authenticated",
      transition: { type: AUTHENTICATED_TRANSITION, source: "login" },
    });
  });

  it("distinguishes registration confirmation wait without leaking duplicate existence", async () => {
    const waiting = await registerWithPassword(fakeClient(), {
      email: "person@example.com",
      password: "password123",
      emailRedirectTo: "http://localhost:3000/auth/callback",
    });
    const duplicate = await registerWithPassword(fakeClient({
      signUp: vi.fn().mockResolvedValue({ data: { user: null, session: null }, error: providerError("user_already_exists") }),
    }), {
      email: "person@example.com",
      password: "password123",
      emailRedirectTo: "http://localhost:3000/auth/callback",
    });
    expect(waiting).toEqual({ ok: true, status: "awaiting_email_confirmation" });
    expect(duplicate).toEqual(waiting);
    expect(JSON.stringify(duplicate)).not.toContain("already");
  });

  it("keeps forgot-password responses neutral for unknown accounts", async () => {
    const client = fakeClient({
      resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: providerError("user_not_found") }),
    });
    await expect(requestPasswordRecovery(client, {
      email: "unknown@example.com",
      redirectTo: "http://localhost:3000/auth/callback",
    })).resolves.toEqual({ ok: true, status: "recovery_requested" });
  });

  it("maps rate limits to a stable retryable error", async () => {
    const result = await resendRegistrationConfirmation(fakeClient({
      resend: vi.fn().mockResolvedValue({ data: {}, error: providerError("over_email_send_rate_limit") }),
    }), {
      email: "person@example.com",
      emailRedirectTo: "http://localhost:3000/auth/callback",
    });
    expect(result).toEqual({
      ok: false,
      status: "error",
      error: { code: "rate_limited", retryable: true },
    });
  });

  it("returns a safe error for a missing or ambiguous callback credential", async () => {
    await expect(completeAuthCallback(fakeClient(), {})).resolves.toEqual({
      ok: false,
      status: "error",
      error: { code: "expired_or_invalid_link", retryable: false },
    });
    await expect(completeAuthCallback(fakeClient(), {
      code: "code",
      tokenHash: "token",
      type: "signup",
    })).resolves.toMatchObject({ error: { code: "expired_or_invalid_link" } });
  });

  it("supports PKCE code and token-hash callbacks with verified transition results", async () => {
    const pkceClient = fakeClient();
    await expect(completeAuthCallback(pkceClient, {
      code: "one-time-code",
      intent: "confirmation",
    })).resolves.toMatchObject({
      ok: true,
      status: "authenticated",
      transition: { type: AUTHENTICATED_TRANSITION, source: "confirmation" },
    });
    expect(pkceClient.exchangeCodeForSession).toHaveBeenCalledWith("one-time-code");

    const otpClient = fakeClient();
    await expect(completeAuthCallback(otpClient, {
      tokenHash: "one-time-token-hash",
      type: "recovery",
      intent: "recovery",
    })).resolves.toMatchObject({ transition: { source: "recovery" } });
    expect(otpClient.verifyOtp).toHaveBeenCalledWith({
      token_hash: "one-time-token-hash",
      type: "recovery",
    });
  });

  it("requires a verified user before updating a password", async () => {
    const client = fakeClient({
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: providerError("session_not_found") }),
    });
    await expect(updatePassword(client, { password: "new-password" })).resolves.toMatchObject({
      error: { code: "unauthenticated" },
    });
    expect(client.updateUser).not.toHaveBeenCalled();
  });

  it("updates passwords and signs out only the current session", async () => {
    const client = fakeClient();
    await expect(updatePassword(client, { password: "new-password" })).resolves.toEqual({
      ok: true,
      status: "password_updated",
    });
    await expect(logoutCurrentSession(client)).resolves.toEqual({ ok: true, status: "signed_out" });
    expect(client.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
