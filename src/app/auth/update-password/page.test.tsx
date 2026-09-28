import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORD_RECOVERY_COOKIE } from "@/lib/auth/recovery";
import UpdatePasswordPage from "./page";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getUser: vi.fn(),
  redirect: vi.fn(),
}));

vi.stubGlobal("React", React);

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("./update-password-form", () => ({ UpdatePasswordForm: () => null }));

describe("Password recovery page guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-id" } }, error: null });
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  it("rejects a fresh normal session without the recovery marker", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });

    await expect(UpdatePasswordPage()).rejects.toThrow(
      "redirect:/auth/complete?authError=expired_or_invalid_link",
    );
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("renders only when both the fresh user and marker are present", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn((name: string) => name === PASSWORD_RECOVERY_COOKIE ? { value: "1" } : undefined),
    });

    const page = await UpdatePasswordPage();
    expect(page.type).toBe("main");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
