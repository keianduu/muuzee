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
    const roots = [join(process.cwd(), "src/lib/user"), join(process.cwd(), "src/lib/viewer")];
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
});
