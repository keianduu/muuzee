import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_LIFECYCLE_COOKIE } from "@/lib/account-lifecycle/marker";
import { reauthenticateAccount } from "@/lib/account-lifecycle/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/account-lifecycle/service", () => ({ reauthenticateAccount: vi.fn() }));
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteClient: vi.fn() }));

describe("POST /api/account/reauthenticate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: {},
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  it("sets the short-lived marker only after successful password verification", async () => {
    vi.mocked(reauthenticateAccount).mockResolvedValue({
      ok: true,
      data: { reauthenticated: true },
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/reauthenticate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "secret-password" }),
    }));
    expect(response.status).toBe(200);
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("1");
  });
});
