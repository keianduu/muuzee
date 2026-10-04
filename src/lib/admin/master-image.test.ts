import { describe, expect, it } from "vitest";
import { imageDiscoverySourceLabel } from "./master-image";

describe("imageDiscoverySourceLabel", () => {
  it("labels supported Admin discovery sources", () => {
    expect(imageDiscoverySourceLabel("open_collection")).toBe("Open collection");
    expect(imageDiscoverySourceLabel("official_press")).toBe("Official press");
    expect(imageDiscoverySourceLabel("museum_official")).toBe("Museum official");
    expect(imageDiscoverySourceLabel("unknown")).toBe("取得経路不明");
  });
});
