import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { loginWithPassword } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/auth/service", () => ({
  loginWithPassword: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

describe("Login recovery-purpose isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth: {} },
      applyAuthState: (response: NextResponse) => response,
    } as never);
    vi.mocked(loginWithPassword).mockResolvedValue({
      ok: true,
      status: "authenticated",
      transition: { type: "authenticated", source: "login" },
    });
  });

  it("clears any stale recovery marker from a normal Login response", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${PASSWORD_RECOVERY_COOKIE}=1`,
      },
      body: JSON.stringify({ email: "person@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(200);
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });
});
