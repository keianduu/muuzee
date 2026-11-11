import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSION,
  authorizeAdminClaims,
  classifyAdminPath,
} from "./authorization";

const USER_ID = "10000000-0000-4000-8000-000000000001";

describe("Admin authorization", () => {
  it("allows only an authenticated claim with the Muuzee Admin app role", () => {
    expect(authorizeAdminClaims({
      sub: USER_ID,
      app_metadata: { muuzee_role: "admin" },
    })).toEqual({ status: "allowed", permission: ADMIN_PERMISSION });
  });

  it.each([
    ["no claims", null, "unauthenticated"],
    ["missing subject", { app_metadata: { muuzee_role: "admin" } }, "unauthenticated"],
    ["missing role", { sub: USER_ID, app_metadata: {} }, "forbidden"],
    ["normal user", { sub: USER_ID, app_metadata: { muuzee_role: "user" } }, "forbidden"],
    ["top-level role only", { sub: USER_ID, role: "admin" }, "forbidden"],
    ["malformed metadata", { sub: USER_ID, app_metadata: "admin" }, "forbidden"],
  ])("rejects %s", (_label, claims, status) => {
    expect(authorizeAdminClaims(claims)).toEqual({ status });
  });
});

describe("Admin protected path contract", () => {
  it.each([
    ["/admin", "page"],
    ["/admin/venues", "page"],
    ["/admin/imports", "page"],
    ["/api/admin/venues", "api"],
    ["/api/admin/imports/daily-sync", "api"],
    ["/api/admin/arbitrary/nested/path", "api"],
    ["/%61dmin/venues", "page"],
    ["/api/%61dmin/venues", "api"],
    ["/admin%2Fvenues", "page"],
  ])("protects %s", (pathname, expected) => {
    expect(classifyAdminPath(pathname)).toBe(expected);
  });

  it.each([
    "/admin/login",
    "/admin/access-denied",
    "/api/auth/login",
    "/api/auth/logout",
    "/auth/callback",
    "/",
    "/exhibitions",
  ])("keeps %s public", (pathname) => {
    expect(classifyAdminPath(pathname)).toBe("public");
  });
});
