import { describe, expect, it } from "vitest";
import { deferredMasterScopes } from "./master-detail-loading";

describe("deferred master detail scopes", () => {
  it.each(["venues", "artists", "works"] as const)("keeps %s status initial load core-only", (entity) => {
    expect(deferredMasterScopes(entity, "status", "basic", null)).toEqual([]);
  });

  it.each(["venues", "artists", "works"] as const)("loads diagnostics only after opening %s Data", (entity) => {
    expect(deferredMasterScopes(entity, "data", "basic", null)).toEqual(["data"]);
  });

  it("loads candidate diagnostics and signed media for image editing only", () => {
    expect(deferredMasterScopes("venues", "edit", "basic", "image")).toEqual(["data", "media"]);
    expect(deferredMasterScopes("artists", "edit", "image", null)).toEqual(["data", "media"]);
    expect(deferredMasterScopes("artists", "edit", "basic", null)).toEqual([]);
    expect(deferredMasterScopes("venues", "edit", "basic", "basic")).toEqual([]);
  });
});
