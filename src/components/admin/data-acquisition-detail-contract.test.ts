import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");

describe("Data Acquisition same-screen detail contract", () => {
  it("guards current and future nested action controls", () => {
    const trigger = read("./data-acquisition-detail-trigger.tsx");
    for (const selector of ["a", "button", "input", "select", "textarea", "form", "summary", "label"]) {
      expect(trigger).toContain(`\"${selector}\"`);
    }
    expect(trigger).toContain("hasNestedInteractiveTarget(event.target, event.currentTarget)");
    expect(trigger).toContain("shouldActivateDataAcquisitionDetail(event.key, nested)");
    expect(trigger).toContain('role="button"');
    expect(trigger).toContain("tabIndex={0}");
  });

  it("reuses the master Drawer interaction shell", () => {
    const drawer = read("./data-acquisition-summary-drawer.tsx");
    expect(drawer).toContain("master-drawer-layer data-acquisition-summary-drawer");
    expect(drawer).toContain("master-drawer-scrim");
    expect(drawer).toContain("master-drawer master-drawer--primary");
    expect(drawer).toContain('event.key === "Escape"');
    expect(drawer).toContain('event.key !== "Tab"');
    expect(drawer).toContain('document.body.classList.add("is-master-drawer-open")');
    expect(drawer).toContain("data-data-acquisition-detail-trigger");
  });
});
