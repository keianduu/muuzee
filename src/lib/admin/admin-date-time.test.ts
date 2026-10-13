import { afterEach, describe, expect, it } from "vitest";
import { formatAdminDateTime } from "./admin-date-time";

const ORIGINAL_TIME_ZONE = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TIME_ZONE === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TIME_ZONE;
});

describe("formatAdminDateTime", () => {
  it("formats an instant with the explicit Asia/Tokyo display contract", () => {
    expect(formatAdminDateTime("2026-10-01T14:19:10Z")).toBe("2026/10/01 23:19:10");
  });

  it("handles a UTC to JST day boundary", () => {
    expect(formatAdminDateTime("2026-10-01T23:30:00Z")).toBe("2026/10/02 08:30:00");
  });

  it("handles a UTC to JST year and month boundary", () => {
    expect(formatAdminDateTime("2026-12-31T15:30:00Z")).toBe("2027/01/01 00:30:00");
  });

  it.each([null, undefined, "", "not-a-date", new Date(Number.NaN)])("returns the fallback for %s", (value) => {
    expect(formatAdminDateTime(value)).toBe("—");
  });

  it("does not depend on the local process time zone", () => {
    process.env.TZ = "UTC";
    const utcProcess = formatAdminDateTime("2026-10-01T14:19:10Z");
    process.env.TZ = "America/New_York";
    const newYorkProcess = formatAdminDateTime("2026-10-01T14:19:10Z");

    expect(utcProcess).toBe("2026/10/01 23:19:10");
    expect(newYorkProcess).toBe(utcProcess);
  });
});
