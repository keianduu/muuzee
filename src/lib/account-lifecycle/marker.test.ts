import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_LIFECYCLE_COOKIE,
  ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS,
  clearAccountLifecycleMarker,
  hasAccountLifecycleMarker,
  setAccountLifecycleMarker,
} from "./marker";

describe("Account lifecycle reauthentication marker", () => {
  it("uses an opaque short-lived HttpOnly cookie", () => {
    const response = setAccountLifecycleMarker(NextResponse.json({ ok: true }));
    const cookie = response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE);
    expect(cookie?.value).toBe("1");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.maxAge).toBe(ACCOUNT_LIFECYCLE_MAX_AGE_SECONDS);
    expect(hasAccountLifecycleMarker(response.cookies)).toBe(true);
  });

  it("expires the marker", () => {
    const response = clearAccountLifecycleMarker(NextResponse.json({ ok: true }));
    expect(response.cookies.get(ACCOUNT_LIFECYCLE_COOKIE)?.value).toBe("");
    expect(hasAccountLifecycleMarker(response.cookies)).toBe(false);
  });
});
