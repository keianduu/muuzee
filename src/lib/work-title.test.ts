import { describe, expect, it } from "vitest";
import { hasWorkTitle, workDisplayTitleEn, workDisplayTitleJa } from "./work-title";

describe("Work title localization", () => {
  it("prioritizes Japanese title for the Japan-first UI", () => {
    expect(workDisplayTitleJa({ title_ja: "星月夜", title_original: "De sterrennacht", title_en: "The Starry Night", title: "Legacy" })).toBe("星月夜");
  });

  it("falls back to original, English, then legacy title", () => {
    expect(workDisplayTitleJa({ title_original: "De sterrennacht", title_en: "The Starry Night", title: "Legacy" })).toBe("De sterrennacht");
    expect(workDisplayTitleJa({ title_en: "The Starry Night", title: "Legacy" })).toBe("The Starry Night");
    expect(workDisplayTitleJa({ title: "Legacy" })).toBe("Legacy");
  });

  it("supports a Japanese work with an English title without losing either", () => {
    const work = { title_ja: "神奈川沖浪裏", title_original: "神奈川沖浪裏", title_en: "The Great Wave off Kanagawa" };
    expect(workDisplayTitleJa(work)).toBe("神奈川沖浪裏");
    expect(workDisplayTitleEn(work)).toBe("The Great Wave off Kanagawa");
  });

  it("supports a foreign work with a Japanese title while preserving the original", () => {
    const work = { title_ja: "星月夜", title_original: "De sterrennacht", title_en: "The Starry Night" };
    expect(workDisplayTitleJa(work)).toBe("星月夜");
    expect(work.title_original).toBe("De sterrennacht");
  });

  it("keeps a Work publishable when only one title field exists", () => {
    expect(hasWorkTitle({ title_original: "Les Demoiselles d'Avignon" })).toBe(true);
    expect(hasWorkTitle({})).toBe(false);
  });
});
