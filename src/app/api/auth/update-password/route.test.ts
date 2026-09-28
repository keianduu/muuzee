import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import { updatePassword } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/auth/service", () => ({
  updatePassword: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

function passwordRequest(withMarker = false) {
  return new NextRequest("http://localhost:3000/api/auth/update-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withMarker ? { cookie: `${PASSWORD_RECOVERY_COOKIE}=1` } : {}),
    },
    body: JSON.stringify({ password: "new-password" }),
  });
}

describe("Password update recovery guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth: {} },
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  it("rejects a normal authenticated session without a recovery marker", async () => {
    const response = await POST(passwordRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "expired_or_invalid_link" },
    });
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("updates with marker plus fresh user verification and clears the marker", async () => {
    vi.mocked(updatePassword).mockResolvedValue({ ok: true, status: "password_updated" });

    const response = await POST(passwordRequest(true));

    expect(updatePassword).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("keeps the marker when password update can be retried", async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      ok: false,
      status: "error",
      error: { code: "temporary", retryable: true },
    });

    const response = await POST(passwordRequest(true));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
