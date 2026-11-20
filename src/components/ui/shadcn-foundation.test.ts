import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { Input } from "./input";

const root = new URL("../../../", import.meta.url);
const components = JSON.parse(readFileSync(new URL("components.json", root), "utf8"));
const packageJson = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const css = readFileSync(new URL("src/app/globals.css", root), "utf8");

describe("shadcn foundation", () => {
  it("keeps the approved Base UI, Rhea, RSC, and source alias contract", () => {
    expect(components).toMatchObject({
      style: "base-rhea",
      rsc: true,
      tsx: true,
      iconLibrary: "lucide",
      tailwind: {
        config: "",
        css: "src/app/globals.css",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        ui: "@/components/ui",
        lib: "@/lib",
        utils: "@/lib/utils",
        hooks: "@/hooks",
      },
    });
  });

  it("loads Tailwind utilities without Preflight and retains Admin selectors", () => {
    expect(css).not.toContain('@import "tailwindcss";');
    expect(css).toContain('@import "tailwindcss/theme.css" layer(theme);');
    expect(css).toContain('@import "tailwindcss/utilities.css" layer(utilities);');

    for (const selector of [
      ".admin-shell",
      ".admin-sidebar",
      ".button",
      ".admin-icon-button",
      ".table-wrap",
      ".master-view-tabs",
      ".master-drawer",
    ]) {
      expect(css).toContain(selector);
    }
  });

  it("maps semantic utilities to the existing Muuzee Admin source tokens", () => {
    for (const sourceToken of [
      "--surface-strong: #fbfbf8",
      "--surface-hover: #eeeee8",
      "--ink-950: #1d1d18",
      "--ink-500: #82827b",
      "--admin-radius-control: 8px",
      "--admin-radius-card: 16px",
    ]) {
      expect(css).toContain(sourceToken);
    }

    expect(css).toContain("--color-background: var(--surface-strong)");
    expect(css).toContain("--color-card: var(--surface)");
    expect(css).toContain("--color-muted: var(--surface-hover)");
    expect(css).toContain("--color-muted-foreground: var(--ink-500)");
    expect(css).toContain("--color-ring: var(--admin-focus)");
    expect(css).toContain("--radius-2xl: var(--admin-radius-control)");
    expect(css).toContain("--radius-4xl: var(--admin-radius-card)");
  });

  it("exports the shared class merger and the four Phase 1A primitives", () => {
    expect(cn("block", "hidden")).toBe("hidden");
    expect([Button, Input, Badge, Card].every((component) => typeof component === "function")).toBe(true);
    expect(packageJson.dependencies.cn).toBe("0.5.2");
    expect(packageJson.dependencies.clsx).toBeUndefined();
    expect(packageJson.dependencies["tailwind-merge"]).toBeUndefined();
  });
});
