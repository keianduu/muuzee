import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeAuthCallback } from "@/lib/auth/service";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { GET } from "./route";

vi.mock("@/lib/auth/service", () => ({
  completeAuthCallback: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

describe("Auth callback recovery boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth: {} },
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

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
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("1");
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
  });

  it("sends invalid callbacks to the neutral completion page without credentials", async () => {
    vi.mocked(completeAuthCallback).mockResolvedValue({
      ok: false,
      status: "error",
      error: { code: "expired_or_invalid_link", retryable: false },
    });

    const response = await GET(new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=secret&type=recovery&returnTo=https://evil.example",
    ));
    const location = new URL(response.headers.get("location") as string);

    expect(location.pathname).toBe("/auth/complete");
    expect(location.searchParams.get("authError")).toBe("expired_or_invalid_link");
    expect(location.searchParams.has("token_hash")).toBe(false);
    expect(location.origin).toBe("http://localhost:3000");
  });
});
