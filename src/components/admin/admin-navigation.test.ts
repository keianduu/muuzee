import { describe, expect, it } from "vitest";
import { isAdminNavigationItemActive } from "@/lib/admin/admin-navigation-state";

describe("Admin import navigation", () => {
  it("keeps import execution exact and gives the summary its own active state", () => {
    expect(isAdminNavigationItemActive("/admin/imports", { href: "/admin/imports", exact: true })).toBe(true);
    expect(isAdminNavigationItemActive("/admin/imports/summary", { href: "/admin/imports", exact: true })).toBe(false);
    expect(isAdminNavigationItemActive("/admin/imports/summary", { href: "/admin/imports/summary" })).toBe(true);
  });
});
