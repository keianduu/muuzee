import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function filesUnder(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function implementationSource() {
  return [
    ...filesUnder(join(process.cwd(), "src/lib/auth")),
    ...filesUnder(join(process.cwd(), "src/app/api/auth")),
    ...filesUnder(join(process.cwd(), "src/app/auth")),
    join(process.cwd(), "src/lib/supabase/route.ts"),
  ]
    .filter((file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

describe("Production Auth dependency boundary", () => {
  it("does not depend on service-role/Admin Auth", () => {
    const source = implementationSource();
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("createSupabaseAdminClient");
    expect(source).not.toContain("auth.admin");
  });

  it("does not introduce custom credential storage or Prototype loginID state", () => {
    const source = implementationSource();
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("loginID");
  });

  it("uses a dedicated Recovery marker secret without credential or purpose reuse", () => {
    const recovery = readFileSync(join(process.cwd(), "src/lib/auth/recovery.ts"), "utf8");
    expect(recovery).toContain("PASSWORD_RECOVERY_MARKER_SECRET");
    expect(recovery).not.toContain("ACCOUNT_LIFECYCLE_MARKER_SECRET");
    expect(recovery).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(recovery).not.toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });
});
