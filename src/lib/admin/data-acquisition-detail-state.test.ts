import { describe, expect, it } from "vitest";
import { dataAcquisitionDetailQuery, normalizeDataAcquisitionDetail, shouldActivateDataAcquisitionDetail } from "./data-acquisition-detail-state";

describe("Data Acquisition detail state", () => {
  it.each(["venues", "artists", "works", "exhibitions"] as const)("accepts %s", (entity) => {
    expect(normalizeDataAcquisitionDetail(entity)).toBe(entity);
  });

  it.each([undefined, "", "venue", "invalid"])("rejects invalid detail %s", (value) => {
    expect(normalizeDataAcquisitionDetail(value)).toBeNull();
  });

  it("opens and closes detail without changing unrelated query state", () => {
    expect(dataAcquisitionDetailQuery("view=operator", "venues")).toBe("view=operator&detail=venues");
    expect(dataAcquisitionDetailQuery("view=operator&detail=venues", null)).toBe("view=operator");
  });

  it("allows row keyboard activation but rejects nested controls", () => {
    expect(shouldActivateDataAcquisitionDetail("Enter", false)).toBe(true);
    expect(shouldActivateDataAcquisitionDetail(" ", false)).toBe(true);
    expect(shouldActivateDataAcquisitionDetail("Enter", true)).toBe(false);
    expect(shouldActivateDataAcquisitionDetail(" ", true)).toBe(false);
  });
});
