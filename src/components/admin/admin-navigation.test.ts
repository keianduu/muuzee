import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isAdminNavigationItemActive } from "@/lib/admin/admin-navigation-state";

describe("Admin import navigation", () => {
  it("uses one Data Acquisition destination for Imports, Summary, and Sources", () => {
    const item = { href: "/admin/imports", aliases: ["/admin/sources"] };
    expect(isAdminNavigationItemActive("/admin/imports", item)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/imports/summary", item)).toBe(true);
    expect(isAdminNavigationItemActive("/admin/sources", item)).toBe(true);
    const navigation = readFileSync(new URL("./admin-navigation.tsx", import.meta.url), "utf8");
    expect(navigation.match(/label: "データ取り込み"/g)).toHaveLength(1);
    expect(navigation).not.toContain('label: "データ取得サマリ"');
    expect(navigation).not.toContain('label: "外部Source設定"');
  });
});
