import { describe, expect, it } from "vitest";
import { COUNTRY_OPTIONS, JP_PREFECTURES, SUBDIVISIONS_BY_COUNTRY, countryOption, countryOptionLabel, subdivisionModeForCountry, subdivisionLabelForCountry } from "./geo-master";

describe("Admin geographic master", () => {
  it("covers every country represented by the current Venue prototype", () => {
    expect(COUNTRY_OPTIONS.map((option) => option.code)).toEqual(["JP", "FR", "US", "GB", "ES", "NL"]);
    expect(countryOption("jp")).toMatchObject({ code: "JP", subdivisionMode: "jp" });
    expect(countryOptionLabel(COUNTRY_OPTIONS[0])).toBe("🇯🇵 JP — 日本");
    expect(JP_PREFECTURES).toHaveLength(47);
  });

  it("uses country-specific controlled subdivisions outside Japan", () => {
    expect(subdivisionModeForCountry("JP")).toBe("jp");
    expect(subdivisionModeForCountry("US")).toBe("region");
    expect(SUBDIVISIONS_BY_COUNTRY.US).toContain("New York");
    expect(SUBDIVISIONS_BY_COUNTRY.FR).toContain("Île-de-France");
    expect(SUBDIVISIONS_BY_COUNTRY.GB).toContain("England");
    expect(SUBDIVISIONS_BY_COUNTRY.ES).toContain("País Vasco");
    expect(SUBDIVISIONS_BY_COUNTRY.NL).toContain("Noord-Holland");
    expect(subdivisionLabelForCountry("US")).toBe("State");
  });

  it("preserves a safe region mode for an unknown existing country code", () => {
    expect(countryOption("DE")).toBeNull();
    expect(subdivisionModeForCountry("DE")).toBe("region");
    expect(subdivisionLabelForCountry("DE")).toBe("Region / subdivision");
  });
});
