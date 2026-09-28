import { NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearPasswordRecoveryMarker,
  hasPasswordRecoveryMarker,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_MAX_AGE_SECONDS,
  setPasswordRecoveryMarker,
} from "./recovery";

describe("password recovery purpose marker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a short-lived HttpOnly marker without user or token data", () => {
    const response = setPasswordRecoveryMarker(NextResponse.json({ ok: true }));
    const marker = response.cookies.get(PASSWORD_RECOVERY_COOKIE);

    expect(marker?.value).toBe("1");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
    expect(response.headers.get("set-cookie")).toContain(`Max-Age=${PASSWORD_RECOVERY_MAX_AGE_SECONDS}`);
  });

  it("marks the cookie Secure in Production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = setPasswordRecoveryMarker(NextResponse.json({ ok: true }));
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("recognizes the exact marker and clears it with the same path", () => {
    expect(hasPasswordRecoveryMarker({
      get: () => ({ value: "1" }),
    })).toBe(true);
    expect(hasPasswordRecoveryMarker({
      get: () => ({ value: "other" }),
    })).toBe(false);

    const response = clearPasswordRecoveryMarker(NextResponse.json({ ok: true }));
    expect(response.headers.get("set-cookie")).toContain(`${PASSWORD_RECOVERY_COOKIE}=;`);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("set-cookie")).toContain("Path=/");
  });
});
