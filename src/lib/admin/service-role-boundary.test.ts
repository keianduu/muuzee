import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("Supabase Service Role boundary", () => {
  it("marks the Admin client server-only and never exposes the key as public config", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/supabase/admin.ts"), "utf8");
    expect(source).toContain('import "server-only"');
    expect(source).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not import the Service Role module or server adoption operation from Client Components", () => {
    const clientSources = filesUnder(join(process.cwd(), "src"))
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .map((file) => readFileSync(file, "utf8"))
      .filter((source) => /^\s*["']use client["'];/m.test(source))
      .join("\n");
    expect(clientSources).not.toContain("@/lib/supabase/admin");
    expect(clientSources).not.toContain("@/lib/work-collection/adoption\"");
  });
});
