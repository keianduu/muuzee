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
    const signedMarker = "v1.account-delete.issued.expires.nonce.signature";
    vi.mocked(reauthenticateAccount).mockResolvedValue({
      ok: true,
      data: { reauthenticated: true, marker: signedMarker },
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/reauthenticate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "secret-password" }),
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { reauthenticated: true } });
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe(signedMarker);
  });

  it("does not issue a marker when reauthentication fails", async () => {
    vi.mocked(reauthenticateAccount).mockResolvedValue({
      ok: false,
      error: { code: "invalid_credentials", retryable: false },
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/reauthenticate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "wrong-password" }),
    }));
    expect(response.status).toBe(401);
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)).toBeUndefined();
  });
});
