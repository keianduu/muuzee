import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyPasswordRecoveryCallbackState } from "@/lib/auth/recovery";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

const SECRET = "order244-recovery-marker-secret-with-at-least-32-bytes";
const resetPasswordForEmail = vi.fn();

describe("Forgot Password callback proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", SECRET);
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth: { resetPasswordForEmail } },
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("places an email-bound signed state in the provider Recovery redirect", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " Person@Example.com " }),
    }));

    expect(response.status).toBe(200);
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    const [email, options] = resetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string }];
    const redirect = new URL(options.redirectTo);
    const state = redirect.searchParams.get("recovery_state");

    expect(email).toBe("person@example.com");
    expect(redirect.searchParams.get("intent")).toBe("recovery");
    expect(verifyPasswordRecoveryCallbackState(state, email, { secret: SECRET })).toBe(true);
  });

  it("keeps the public response neutral for an unknown account", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: "user_not_found", message: "not found", status: 400 },
    });

    const response = await POST(new NextRequest("http://localhost:3000/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "unknown@example.com" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, status: "recovery_requested" });
  });
});
