import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("User Data dependency boundary", () => {
  it("does not import or reference Admin/service-role credentials", () => {
    const roots = [
      join(process.cwd(), "src/lib/user"),
      join(process.cwd(), "src/lib/viewer"),
      join(process.cwd(), "src/lib/guest-saved"),
      join(process.cwd(), "src/app/api/user"),
    ];
    const files = roots.flatMap((root) => {
      try { return filesUnder(root); } catch { return []; }
    }).filter((file) => file.endsWith(".ts") && !file.endsWith("dependency-boundary.test.ts"));
    const source = files.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("@/lib/supabase/admin");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps Viewer State flags out of Public Content modules", () => {
    const publicSource = filesUnder(join(process.cwd(), "src/lib/public"))
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(publicSource).not.toMatch(/\bisSaved\b/);
    expect(publicSource).not.toMatch(/\bisSeen\b/);
    expect(publicSource).not.toMatch(/\bisFavorite\b/);
  });

  it("does not reverse-sync Account Saved from the logout route", () => {
    const source = readFileSync(join(process.cwd(), "src/app/api/auth/logout/route.ts"), "utf8");
    expect(source).not.toContain("guest-saved");
    expect(source).not.toContain("muuzee:guest-saved:v1");
  });

  it("does not import Prototype storage keys into the Production Guest Saved boundary", () => {
    const roots = [join(process.cwd(), "src/lib/guest-saved"), join(process.cwd(), "src/app/api/user")];
    const source = roots.flatMap(filesUnder)
      .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    for (const key of [
      "muuzee:saved-exhibitions",
      "muuzee:saved-museums",
      "muuzee:saved-artists",
      "muuzee:seen-items",
    ]) {
      expect(source).not.toContain(key);
    }
  });
});
