import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_LIFECYCLE_COOKIE } from "@/lib/account-lifecycle/marker";
import { deleteAccount } from "@/lib/account-lifecycle/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/account-lifecycle/service", () => ({ deleteAccount: vi.fn() }));
vi.mock("@/lib/supabase/route", () => ({ createSupabaseRouteClient: vi.fn() }));

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: {},
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  it("passes a missing marker as null, denies deletion, and clears stale state", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    }));
    expect(deleteAccount).toHaveBeenCalledWith(expect.anything(), { confirm: true }, null);
    expect(response.status).toBe(403);
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
  });

  it("passes the raw marker for server verification and clears it when invalid", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({
      ok: false,
      error: { code: "reauthentication_required", retryable: false },
    });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${ACCOUNT_LIFECYCLE_COOKIE}=1`,
      },
      body: JSON.stringify({ confirm: true }),
    }));
    expect(deleteAccount).toHaveBeenCalledWith(expect.anything(), { confirm: true }, "1");
    expect(response.status).toBe(403);
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
  });

  it("expires the marker after committed deletion", async () => {
    vi.mocked(deleteAccount).mockResolvedValue({ ok: true, data: { status: "account_deleted" } });
    const response = await POST(new NextRequest("http://localhost:3000/api/account/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${ACCOUNT_LIFECYCLE_COOKIE}=1`,
      },
      body: JSON.stringify({ confirm: true }),
    }));
    expect(deleteAccount).toHaveBeenCalledWith(expect.anything(), { confirm: true }, "1");
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
  });
});
