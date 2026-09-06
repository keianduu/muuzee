import { describe, expect, it } from "vitest";
import { exactNameMatch, explicitPresentation, parseExplicitYear, workDuplicateKey } from "./mapping";

describe("work collection mapping", () => {
  it("matches only normalized explicit artist names", () => {
    expect(exactNameMatch({ name: "草間 彌生", name_en: "Yayoi Kusama", aliases: ["草間弥生"] }, "草間弥生")).toBe(true);
    expect(exactNameMatch({ name: "草間 彌生" }, "草間彌生展")).toBe(false);
  });

  it("keeps unknown year null and maps explicit ranges", () => {
    expect(parseExplicitYear("制作年不詳")).toEqual({ text: "制作年不詳", from: null, to: null });
    expect(parseExplicitYear("1928–1930")).toEqual({ text: "1928–1930", from: 1928, to: 1930 });
  });

  it("does not infer display state from holding", () => {
    expect(explicitPresentation("所蔵作品")).toEqual({ type: null, status: null });
    expect(explicitPresentation("常設展示中")).toEqual({ type: "permanent", status: "currently_displayed" });
  });

  it("builds a normalized duplicate key", () => {
    expect(workDuplicateKey({ title: " 作品 A ", artistName: "Artist-A", venueName: "Museum A" })).toBe("作品a::artista::museuma");
  });
});
