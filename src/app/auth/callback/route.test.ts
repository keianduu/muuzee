import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeAuthCallback } from "@/lib/auth/service";
import {
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
const getUser = vi.fn();

describe("Auth callback recovery boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", SECRET);
    getUser.mockResolvedValue({
      data: { user: { id: USER_ID } },
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

  it("sets the recovery marker only after a verified recovery callback", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: true,
      status: "authenticated",
      transition: { type: "authenticated", source: "recovery" },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?code=one-time-code&intent=recovery",
    ));

    expect(response.headers.get("location")).toBe("http://localhost:3000/auth/update-password");
    const marker = response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value ?? null;
    expect(verifyPasswordRecoveryMarker(marker, USER_ID, { secret: SECRET })).toBe(true);
  });

  it("does not retain a recovery marker after signup confirmation", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: true,
      status: "authenticated",
      transition: { type: "authenticated", source: "confirmation" },
    });

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
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: true,
      status: "authenticated",
      transition: { type: "authenticated", source: "recovery" },
    });
    getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "session_not_found" },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?code=one-time-code&intent=recovery",
      { headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } },
    ));
    const location = new URL(response.headers.get("location") as string);

    expect(location.searchParams.get("authError")).toBe("unauthenticated");
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("fails closed and clears a stale marker when signing is not configured", async () => {
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", "");
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: true,
      status: "authenticated",
      transition: { type: "authenticated", source: "recovery" },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?code=one-time-code&intent=recovery",
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
