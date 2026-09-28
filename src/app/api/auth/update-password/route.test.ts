import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_LIFECYCLE_COOKIE } from "@/lib/account-lifecycle/marker";
import {
  createPasswordRecoveryMarker,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/recovery";
import { updatePassword } from "@/lib/auth/service";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { POST } from "./route";

vi.mock("@/lib/auth/service", () => ({
  updatePassword: vi.fn(),
}));

vi.mock("@/lib/supabase/route", () => ({
  createSupabaseRouteClient: vi.fn(),
}));

const USER_A = "24400000-0000-4000-8000-000000000001";
const USER_B = "24400000-0000-4000-8000-000000000002";
const SECRET = "order244-recovery-marker-secret-with-at-least-32-bytes";
const getUser = vi.fn();
const auth = { getUser };

function passwordRequest(marker?: string) {
  return new NextRequest("http://localhost:3000/api/auth/update-password", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(marker ? { cookie: `${PASSWORD_RECOVERY_COOKIE}=${marker}` } : {}),
    },
    body: JSON.stringify({ password: "new-password" }),
  });
}

function signedMarker(userId = USER_A, now = new Date()) {
  return createPasswordRecoveryMarker(userId, { secret: SECRET, now });
}

function tamperedMarker() {
  const segments = signedMarker().split(".");
  const signature = segments.at(-1) ?? "";
  segments[segments.length - 1] = `${signature.startsWith("A") ? "B" : "A"}${signature.slice(1)}`;
  return segments.join(".");
}

describe("Password update recovery guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", SECRET);
    getUser.mockResolvedValue({ data: { user: { id: USER_A } }, error: null });
    vi.mocked(createSupabaseRouteClient).mockReturnValue({
      supabase: { auth },
      applyAuthState: (response: NextResponse) => response,
    } as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects a normal authenticated session without a recovery marker", async () => {
    const response = await POST(passwordRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "expired_or_invalid_link" },
    });
    expect(updatePassword).not.toHaveBeenCalled();
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it.each([
    ["the former fixed marker", "1"],
    ["a tampered marker", tamperedMarker()],
    ["an expired marker", signedMarker(USER_A, new Date(Date.now() - (16 * 60 * 1000)))],
    ["a marker for another user", signedMarker(USER_B)],
  ])("rejects %s without reaching password mutation", async (_label, marker) => {
    const response = await POST(passwordRequest(marker));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "expired_or_invalid_link" },
    });
    expect(updatePassword).not.toHaveBeenCalled();
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("clears the marker and blocks mutation when the fresh session is unauthenticated", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
      error: { code: "session_not_found" },
    });

    const response = await POST(passwordRequest(signedMarker()));

    expect(response.status).toBe(401);
    expect(updatePassword).not.toHaveBeenCalled();
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("fails closed and clears the marker when the signing secret is unavailable", async () => {
    const marker = signedMarker();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", "");

    const response = await POST(passwordRequest(marker));

    expect(response.status).toBe(400);
    expect(updatePassword).not.toHaveBeenCalled();
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
  });

  it("updates only for a valid marker bound to the fresh current user", async () => {
    vi.mocked(updatePassword).mockResolvedValue({ ok: true, status: "password_updated" });

    const response = await POST(passwordRequest(signedMarker()));

    expect(updatePassword).toHaveBeenCalledWith(auth, { password: "new-password" }, USER_A);
    expect(response.status).toBe(200);
    expect(response.cookies.get(PASSWORD_RECOVERY_COOKIE)?.value).toBe("");
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
  });

  it("keeps the marker when password update can be retried", async () => {
    vi.mocked(updatePassword).mockResolvedValue({
      ok: false,
      status: "error",
      error: { code: "temporary", retryable: true },
    });

    const response = await POST(passwordRequest(signedMarker()));

    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
