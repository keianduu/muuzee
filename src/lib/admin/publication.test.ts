import { describe, expect, it } from "vitest";
import { evaluatePublication, statusAfterUnpublish } from "./publication";

const complete = { title: "展覧会", venueId: "venue", startDate: "2026-09-01", endDate: null, primaryImage: { id: "image", rightsStatus: "approved" } };
describe("publication guard", () => {
  it("allows a complete, rights-approved draft", () => { expect(evaluatePublication(complete).canPublish).toBe(true); });
  it("blocks missing or unapproved primary images", () => { expect(evaluatePublication({ ...complete, primaryImage: null }).missing).toContain("Primary画像"); expect(evaluatePublication({ ...complete, primaryImage: { rightsStatus: "pending" } }).missing).toContain("Primary画像のRights承認"); });
  it("always returns to draft when unpublished", () => { expect(statusAfterUnpublish()).toBe("draft"); });
});
