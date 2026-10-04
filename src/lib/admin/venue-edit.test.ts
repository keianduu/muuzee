import { describe, expect, it } from "vitest";
import { VENUE_EDIT_TABS, VENUE_IMAGE_SECTION_ORDER, venueEditTab, venueEditTabQuery } from "./venue-edit";

describe("Venue edit information architecture", () => {
  it("has exactly the three approved context tabs", () => {
    expect(VENUE_EDIT_TABS).toEqual([
      { id: "basic", label: "基本情報" },
      { id: "image", label: "画像登録" },
      { id: "relations", label: "関連情報" },
    ]);
  });

  it("retains the selected sub-tab in URL state across refreshes", () => {
    const related = venueEditTabQuery("selected=venue-1&q=tokyo", "relations");
    const image = venueEditTabQuery(related, "image");
    expect(venueEditTab(new URLSearchParams(related).get("venueEdit"))).toBe("relations");
    expect(venueEditTab(new URLSearchParams(image).get("venueEdit"))).toBe("image");
    expect(image).toContain("selected=venue-1");
    expect(image).toContain("q=tokyo");
  });

  it("keeps the final image section order", () => {
    expect(VENUE_IMAGE_SECTION_ORDER).toEqual(["registered", "candidates", "registration"]);
  });
});
