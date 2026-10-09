import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataAcquisitionEntitySwitch } from "./data-acquisition-entity-switch";

vi.stubGlobal("React", React);

describe("DataAcquisitionEntitySwitch", () => {
  it("renders all four Entity links with one current page", () => {
    const markup = renderToStaticMarkup(<DataAcquisitionEntitySwitch entity="artists"/>);
    expect(markup).toContain("entity=exhibitions");
    expect(markup).toContain("entity=venues");
    expect(markup).toContain("entity=artists");
    expect(markup).toContain("entity=works");
    expect(markup).toContain('aria-current="page"');
  });
});
