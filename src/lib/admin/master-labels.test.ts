import { describe, expect, it } from "vitest";
import { displayStatus } from "./master-labels";

describe("admin status labels", () => {
  it("treats legacy ready as a non-public state", () => {
    expect(displayStatus("ready")).toBe("非公開");
  });
});
