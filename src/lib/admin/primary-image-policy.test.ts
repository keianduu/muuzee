import { describe, expect, it } from "vitest";
import { assertManualImageRightsConfirmed, candidateRightsDecision, canRegisterPrimaryCandidate, chooseAutoPrimaryCandidate, isLegacyMediaRightsApprovable } from "./primary-image-policy";

describe("Registered Image Rights policy", () => {
  const candidate = (rightsStatus?: string | null, extra: Record<string, unknown> = {}) => ({ id: String(rightsStatus), is_active: true, review_status: "unreviewed", rights_status: rightsStatus, ...extra });

  it("auto-promotes only an approved candidate", () => {
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("approved")] }).candidateId).toBe("approved");
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("needs_review")] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate(null)] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate(undefined)] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("future_unknown")] }).candidateId).toBeNull();
    expect(chooseAutoPrimaryCandidate({ primaryCount: 0, candidates: [candidate("rejected")] }).candidateId).toBeNull();
  });

  it("requires explicit approval for every non-approved candidate Rights state", () => {
    expect(canRegisterPrimaryCandidate(candidate("approved"))).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate("needs_review"))).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate("needs_review"), true)).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate(null))).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate(null), true)).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate(undefined))).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate(undefined), true)).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate("future_unknown"))).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate("future_unknown"), true)).toBe(true);
    expect(canRegisterPrimaryCandidate(candidate("rejected"), true)).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate("approved", { review_status: "rejected" }), true)).toBe(false);
    expect(canRegisterPrimaryCandidate(candidate("approved", { is_active: false }), true)).toBe(false);
  });

  it("classifies approved, rejected, and review-required candidates for the shared UI", () => {
    expect(candidateRightsDecision(candidate("approved"))).toBe("approved");
    expect(candidateRightsDecision(candidate("rejected"))).toBe("rejected");
    expect(candidateRightsDecision(candidate(null))).toBe("review_required");
    expect(candidateRightsDecision(candidate(undefined))).toBe("review_required");
    expect(candidateRightsDecision(candidate("future_unknown"))).toBe("review_required");
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
