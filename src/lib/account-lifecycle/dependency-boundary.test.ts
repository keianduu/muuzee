import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Account lifecycle privileged dependency boundary", () => {
  it("keeps service-role access in the two explicitly trusted server modules", () => {
    const legal = readFileSync(join(process.cwd(), "src/lib/legal-consent/service.ts"), "utf8");
    const lifecycle = readFileSync(join(process.cwd(), "src/lib/account-lifecycle/service.ts"), "utf8");
    expect(legal).toContain("createSupabaseAdminClient");
    expect(lifecycle).toContain("createSupabaseAdminClient");
  });

  it("does not expose privileged imports from route modules", () => {
    for (const path of [
      "src/app/api/account/export/route.ts",
      "src/app/api/account/reauthenticate/route.ts",
      "src/app/api/account/delete/route.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source).not.toContain("@/lib/supabase/admin");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });

  it("clears the purpose marker across Auth identity transitions", () => {
    for (const path of [
      "src/app/api/auth/login/route.ts",
      "src/app/api/auth/register/route.ts",
      "src/app/api/auth/logout/route.ts",
      "src/app/api/auth/update-password/route.ts",
      "src/app/auth/callback/route.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source).toContain("clearAccountLifecycleMarker");
    }
  });
});
