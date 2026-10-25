import { describe, expect, it } from "vitest";
import { buildMasterOperatorOverview } from "./data-acquisition-operator-overview";

describe("Master operator overview", () => {
  it("defines every non-published canonical Master as unpublished", () => {
    expect(buildMasterOperatorOverview("venues", 58, 12)).toEqual({
      entity: "venues",
      total: 58,
      published: 12,
      unpublished: 46,
    });
  });

  it("keeps total equal to published plus unpublished", () => {
    const overview = buildMasterOperatorOverview("works", 0, 0);
    expect(overview.total).toBe(overview.published + overview.unpublished);
  });
});
