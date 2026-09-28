import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeAuthCallback } from "@/lib/auth/service";
import {
  createPasswordRecoveryCallbackState,
  PASSWORD_RECOVERY_COOKIE,
  verifyPasswordRecoveryMarker,
} from "@/lib/auth/recovery";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { GET } from "./route";

vi.mock("@/lib/auth/service", () => ({
  completeAuthCallback: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

const USER_ID = "24400000-0000-4000-8000-000000000001";
const SECRET = "order244-recovery-marker-secret-with-at-least-32-bytes";
const EMAIL_A = "person@example.com";
const EMAIL_B = "other@example.com";
const getUser = vi.fn();

function authenticated(source: "confirmation" | "recovery") {
  return {
    ok: true as const,
    status: "authenticated" as const,
    transition: { type: "authenticated" as const, source },
  };
}

function callbackState(email = EMAIL_A, now = new Date()) {
  return createPasswordRecoveryCallbackState(email, { secret: SECRET, now });
}

function pkceCallbackUrl(state?: string, intent = "recovery") {
  const url = new URL("http://localhost:3000/auth/callback");
  url.searchParams.set("code", "one-time-code");
  url.searchParams.set("intent", intent);
  if (state !== undefined) url.searchParams.set("recovery_state", state);
  return url;
}

describe("Auth callback recovery boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", SECRET);
    getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: EMAIL_A } },
      error: null,
    });
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: {
        auth: {
          getUser,
        },
      },
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("sets the marker after a valid Recovery PKCE code and signed callback state", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));

    const response = await GET(new NextRequest(pkceCallbackUrl(callbackState())));

    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/update-password");
    const marker = response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value ?? null;
    expect(verifyPasswordRecoveryMarker(marker, USER_ID, { secret: SECRET })).toBe(true);
  });

  it("does not elevate a confirmation code through an unsigned Recovery intent", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));

    const response = await GET(new NextRequest(pkceCallbackUrl()));
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/auth/complete");
    expect(location.searchParams.get("authError")).toBe("expired_or_invalid_link");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it.each([
    ["tampered", () => `${callbackState()}x`, EMAIL_A],
    ["expired", () => callbackState(EMAIL_A, new Date(Date.now() - (61 * 60 * 1000))), EMAIL_A],
    ["wrong-user", () => callbackState(EMAIL_A), EMAIL_B],
    ["malformed", () => "not.a.signed.state", EMAIL_A],
  ])("rejects a %s PKCE Recovery state without issuing a marker", async (
    _label,
    stateFactory,
    currentEmail,
  ) => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));
    getUser.mockResolvedValue({
      data: { user: { id: USER_ID, email: currentEmail } },
      error: null,
    });

    const response = await GET(new NextRequest(pkceCallbackUrl(stateFactory())));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("authError")).toBe("expired_or_invalid_link");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("fails closed when callback state verification has no signing secret", async () => {
    const state = callbackState();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", "");
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));

    const response = await GET(new NextRequest(pkceCallbackUrl(state)));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("authError")).toBe("expired_or_invalid_link");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("sets the marker for a provider-verified Recovery token hash", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("recovery"));

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=one-time-hash&type=recovery&intent=recovery",
    ));

    const marker = response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value ?? null;
    expect(verifyPasswordRecoveryMarker(marker, USER_ID, { secret: SECRET })).toBe(true);
  });

  it("does not issue the marker for a valid confirmation token hash", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=one-time-hash&type=signup&intent=recovery",
    ));

    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("does not retain a recovery marker after signup confirmation", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("confirmation"));

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=one-time-code&intent=confirmation",
      { headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } },
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/complete");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
    expect(getUser).not.toHaveBeenCalled();
  });

  it("fails closed and clears a stale marker when fresh user resolution fails", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("recovery"));
    getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "session_not_found" },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=one-time-hash&type=recovery&intent=recovery",
      { headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } },
    ));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("authError")).toBe("unauthenticated");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("fails closed and clears a stale marker when signing is not configured", async () => {
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", "");
    vi.mocked(completeAuthCallback).mockResolvedValue(authenticated("recovery"));

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=one-time-hash&type=recovery&intent=recovery",
      { headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } },
    ));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("authError")).toBe("temporary");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("sends invalid callbacks to the neutral completion page without credentials", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: false,
      status: "error",
      error: { code: "expired_or_invalid_link", retryable: false },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=secret&type=recovery&returnTo=https://evil.example",
      { headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } },
    ));
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/auth/complete");
    expect(location.searchParams.get("authError")).toBe("expired_or_invalid_link");
    expect(location.searchParams.has("token_hash")).toBe(false);
    expect(location.origin).toBe("http://localhost:3000");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });
});
