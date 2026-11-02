import { afterEach, describe, expect, it, vi } from "vitest";
import { isVenueInitialAcquisitionEnabled } from "./venue-initial-acquisition-capability";

describe("Venue initial acquisition capability", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults enabled only for LOCAL", () => {
    expect(isVenueInitialAcquisitionEnabled({ hosted: false, configuredValue: undefined })).toBe(true);
    expect(isVenueInitialAcquisitionEnabled({ hosted: true, configuredValue: undefined })).toBe(false);
  });

  it("respects an explicit false in LOCAL", () => {
    expect(isVenueInitialAcquisitionEnabled({ hosted: false, configuredValue: "false" })).toBe(false);
  });

  it("requires an explicit true in every hosted project", () => {
    expect(isVenueInitialAcquisitionEnabled({ hosted: true, configuredValue: "false" })).toBe(false);
    expect(isVenueInitialAcquisitionEnabled({ hosted: true, configuredValue: "true" })).toBe(true);
  });
});
