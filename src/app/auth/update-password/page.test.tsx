import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPasswordRecoveryMarker,
  PASSWORD_RECOVERY_COOKIE,
} from "@/lib/auth/recovery";
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

const USER_ID = "24400000-0000-4000-8000-000000000001";
const SECRET = "order244-recovery-marker-secret-with-at-least-32-bytes";

describe("Password recovery page guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("PASSWORD_RECOVERY_MARKER_SECRET", SECRET);
    mocks.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects a fresh normal session without the recovery marker", async () => {
    mocks.cookies.mockResolvedValue({ get: vi.fn(() => undefined) });

    await expect(UpdatePasswordPage()).rejects.toThrow(
      "redirect:/auth/complete?authError=expired_or_invalid_link",
    );
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("rejects the former fixed marker", async () => {
    mocks.cookies.mockResolvedValue({
      get: vi.fn((name: string) => name === PASSWORD_RECOVERY_COOKIE ? { value: "1" } : undefined),
    });

    await expect(UpdatePasswordPage()).rejects.toThrow(
      "redirect:/auth/complete?authError=expired_or_invalid_link",
    );
  });

  it("renders only when a signed marker matches the fresh current user", async () => {
    const marker = createPasswordRecoveryMarker(USER_ID, { secret: SECRET });
    mocks.cookies.mockResolvedValue({
      get: vi.fn((name: string) => name === PASSWORD_RECOVERY_COOKIE ? { value: marker } : undefined),
    });

    const page = await UpdatePasswordPage();
    expect(page.type).toBe("main");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
