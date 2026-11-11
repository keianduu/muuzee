import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  getClaims: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { requireAdminPageAccess } from "./server-authorization";

const USER_ID = "10000000-0000-4000-8000-000000000001";

describe("Admin layout defense in depth", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
    mocks.getClaims.mockReset();
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getClaims: mocks.getClaims },
    });
  });

  it("allows a verified Admin claim", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: { muuzee_role: "admin" } } },
      error: null,
    });
    await expect(requireAdminPageAccess()).resolves.toMatchObject({ status: "allowed" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("redirects a verified non-Admin to access denied", async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID, app_metadata: {} } },
      error: null,
    });
    await expect(requireAdminPageAccess()).rejects.toThrow("redirect:/admin/access-denied");
  });

  it("fails closed to login when session verification fails", async () => {
    mocks.getClaims.mockRejectedValue(new Error("provider detail"));
    await expect(requireAdminPageAccess()).rejects.toThrow("redirect:/admin/login");
  });
});
