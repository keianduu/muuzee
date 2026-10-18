import { describe, expect, it } from "vitest";
import { assertManualImageRightsConfirmed, canRegisterPrimaryCandidate, chooseAutoPrimaryCandidate, isLegacyMediaRightsApprovable } from "./primary-image-policy";

describe("Registered Image Rights policy", () => {
  const candidate = (rightsStatus: "approved" | "needs_review" | "rejected") => ({ id: rightsStatus, is_active: true, review_status: "unreviewed", rights_status: rightsStatus });

  it("auto-promotes only an approved candidate", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("approved")] }).candidateId).toBe("approved");
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("needs_review")] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("rejected")] }).candidateId).toBeNull();
  });

  it("requires explicit approval for needs-review candidates and always blocks rejected candidates", () => {
    expect(canRegisterPrimaryCandidate(candidate("approved"))).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate("needs_review"))).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate("needs_review"), true)).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate("rejected"), true)).toBe(false);
  });

  it("accepts manual registration only after the explicit confirmation", () => {
    expect(assertManualImageRightsConfirmed("true")).toBe("approved");
    expect(() => assertManualImageRightsConfirmed(null)).toThrow("利用条件の確認");
    expect(() => assertManualImageRightsConfirmed("approved")).toThrow("利用条件の確認");
  });

  it("allows only legacy needs-review Registered Images to use remediation", () => {
    expect(isLegacyMediaRightsApprovable("needs_review")).toBe(true);
    expect(isLegacyMediaRightsApprovable("approved")).toBe(false);
    expect(isLegacyMediaRightsApprovable("rejected")).toBe(false);
  });
});
