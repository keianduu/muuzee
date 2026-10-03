import { describe, expect, it } from "vitest";
import { masterOptionLabel } from "@/lib/admin/master-options";

describe("Admin master option labels", () => {
  it("uses the canonical Work title helper", () => {
    expect(masterOptionLabel("works", { title: "Legacy", title_ja: "睡蓮", title_en: "Water Lilies" })).toBe("睡蓮");
    expect(masterOptionLabel("works", { title: "Legacy", title_original: "Nymphéas", original_language: "fr" })).toBe("Nymphéas");
  });

  it("uses Exhibition title and Master name directly", () => {
    expect(masterOptionLabel("exhibitions", { title: "未来の都市" })).toBe("未来の都市");
    expect(masterOptionLabel("venues", { name: "東京都現代美術館" })).toBe("東京都現代美術館");
  });
});
