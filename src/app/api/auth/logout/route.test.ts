import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { logoutCurrentSession } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/auth/service", () => ({
  logoutCurrentSession: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

describe("Auth logout recovery cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth: {} },
      applyAuthState: (response: NextResponse) => response,
    } as never);
    vi.mocked(logoutCurrentSession).mockResolvedValue({ ok: true, status: "signed_out" });
  });

  it("clears the recovery marker", async () => {
    const response = await POST(new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` },
    }));

    expect(response.status).toBe(200);
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });
});
