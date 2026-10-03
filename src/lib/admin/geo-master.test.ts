import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS, JP_PREFECTURES, countryOption, countryOptionLabel, subdivisionModeForCountry } from "./geo-master";

describe("Admin geographic master", () => {
  it("keeps the initial catalog intentionally JP-only", () => {
    expect(COUNTRY_OPTIONS).toHaveLength(1);
    expect(countryOption("jp")).toMatchObject({ code: "JP", subdivisionMode: "jp" });
    expect(countryOptionLabel(COUNTRY_OPTIONS[0])).toBe("🇯🇵 JP — 日本");
    expect(JP_PREFECTURES).toHaveLength(47);
  });

  it("uses a future-safe region mode for an unregistered country", () => {
    expect(countryOption("US")).toBeNull();
    expect(subdivisionModeForCountry("JP")).toBe("jp");
    expect(subdivisionModeForCountry("US")).toBe("region");
  });
});
