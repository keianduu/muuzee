import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("./config", () => ({
  getSupabasePublicEnvironment: () => ({ url: "https://example.supabase.co", anonKey: "public-anon" }),
}));

import { refreshSupabaseSession } from "./middleware";

const USER_ID = "10000000-0000-4000-8000-000000000001";

function request(pathname: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${pathname}`, init);
}

describe("Admin middleware boundary", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.getClaims.mockReset();
    mocks.createServerClient.mockReset();
    mocks.createServerClient.mockImplementation(() => ({
      auth: { getClaims: mocks.getClaims },
    }));
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it("redirects unauthenticated Admin pages to login", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: new Error("expired") });
    const response = await refreshSupabaseSession(request("/admin/venues"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/login");
    expect(warn).toHaveBeenCalledWith("[admin:auth]", {
      path: "/admin/venues",
      reason: "unauthenticated",
      method: "GET",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("cookie");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("token");
  });

  it("redirects authenticated non-Admin pages to access denied", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { muuzee_role: "user" } } },
      error: null,
    });
    const response = await refreshSupabaseSession(request("/admin/venues"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/admin/access-denied");
  });

  it("continues Admin pages for the verified app_metadata role", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { muuzee_role: "admin" } } },
      error: null,
    });
    const response = await refreshSupabaseSession(request("/admin/venues"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns stable 401 and 403 JSON before Admin APIs continue", async () => {
    mocks.getClaims.mockResolvedValueOnce({ data: null, error: null });
    const unauthenticated = await refreshSupabaseSession(request("/api/admin/imports/daily-sync", {
      method: "POST",
    }));
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      code: "admin_unauthenticated",
      error: "Authentication is required.",
    });

    mocks.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: USER_ID, app_metadata: {} } },
      error: null,
    });
    const forbidden = await refreshSupabaseSession(request("/api/admin/venues", { method: "POST" }));
    expect(forbidden.status).toBe(403);
    await expect(forbidden.json()).resolves.toEqual({
      code: "admin_forbidden",
      error: "Admin access is required.",
    });
  });

  it("does not trust role headers, queries, or direct API navigation", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, role: "admin", app_metadata: {} } },
      error: null,
    });
    const response = await refreshSupabaseSession(request(
      "/api/admin/imports/daily-sync?muuzee_role=admin",
      { method: "POST", headers: { "x-muuzee-role": "admin" } },
    ));
    expect(response.status).toBe(403);
  });

  it("does not reach a representative Admin mutation after a denied boundary", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    const runDailySync = vi.fn();
    const response = await refreshSupabaseSession(request("/api/admin/imports/daily-sync", {
      method: "POST",
    }));
    if (response.headers.get("x-middleware-next") === "1") await runDailySync();
    expect(response.status).toBe(401);
    expect(runDailySync).not.toHaveBeenCalled();
  });

  it("preserves refreshed Auth cookies and response headers on a denied response", async () => {
    mocks.createServerClient.mockImplementation((
      _url: string,
      _key: string,
      options: { cookies: { setAll: (cookies: Array<Record<string, unknown>>, headers: Record<string, string>) => void } },
    ) => ({
      auth: {
        getClaims: async () => {
          options.cookies.setAll([
            { name: "sb-refresh", value: "rotated", options: { httpOnly: true } },
          ], { "x-auth-refresh": "applied" });
          return { data: null, error: null };
        },
      },
    }));
    const response = await refreshSupabaseSession(request("/api/admin/venues"));
    expect(response.status).toBe(401);
    expect(response.cookies.get("sb-refresh")?.value).toBe("rotated");
    expect(response.headers.get("x-auth-refresh")).toBe("applied");
  });

  it("keeps login, access-denied, Auth, and public routes outside the Admin boundary", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    for (const pathname of [
      "/admin/login",
      "/admin/access-denied",
      "/api/auth/login",
      "/api/auth/logout",
      "/auth/callback",
      "/",
    ]) {
      const response = await refreshSupabaseSession(request(pathname));
      expect(response.headers.get("x-middleware-next"), pathname).toBe("1");
    }
  });
});
