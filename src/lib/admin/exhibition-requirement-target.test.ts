import { describe, expect, it } from "vitest";
import { exhibitionRequirementTarget } from "./exhibition-requirement-target";

describe("Exhibition publication requirement targets", () => {
  it.each([
    ["title", "basic", "#exhibition-title"],
    ["venue", "basic", "#exhibition-venue-name"],
    ["dates", "basic", "#exhibition-start-date"],
    ["primary_image", "image", 'data-admin-image-section="candidates"'],
    ["image_rights", "image", "data-admin-rights-remediation"],
  ] as const)("maps %s to its actionable editor target", (key, editTab, selectorPart) => {
    const target = exhibitionRequirementTarget(key);
    expect(target.detailTab).toBe("edit");
    expect(target.editTab).toBe(editTab);
    expect(target.selector).toContain(selectorPart);
  });
});
