import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TargetedResolutionForm } from "./targeted-resolution-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.stubGlobal("React", React);

const humanItem = (status: "ambiguous" | "no_candidate") => ({
  id: status,
  entity_type: "venue",
  source_value: "Fixture Venue",
  resolution_status: status,
  exhibitions: { title: "Fixture Exhibition" },
});

function render(counts: Record<string, number>, items: Array<Record<string, unknown>> = []) {
  return renderToStaticMarkup(<TargetedResolutionForm overview={{ counts, items }}/>);
}

describe("TargetedResolutionForm operator queues", () => {
  it.each([
    ["pending-only", { venuePending: 1 }],
    ["failed-only", { artistFailed: 1 }],
  ])("keeps retry actions visible for %s work", (_label, counts) => {
    const html = render(counts);
    expect(html).toContain("自動処理待ち <strong>1</strong>件");
    expect(html).toContain("解決内容を確認");
    expect(html).toContain("自動で解決する");
    expect(html).not.toContain("要確認の内容を見る");
  });

  it.each([
    ["ambiguous-only", { venueAmbiguous: 1 }, humanItem("ambiguous")],
    ["no-candidate-only", { artistNoCandidate: 1 }, humanItem("no_candidate")],
  ])("shows %s as a Human Gate without automatic actions", (_label, counts, item) => {
    const html = render(counts, [item]);
    expect(html).toContain("要確認 <strong>1</strong>件");
    expect(html).toContain("要確認の内容を見る");
    expect(html).not.toContain("解決内容を確認");
    expect(html).not.toContain("自動で解決する");
  });

  it("shows no exception work for resolved-only state", () => {
    const html = render({ resolved: 2 });
    expect(html).toContain("Venue / Artistの要確認項目はありません。");
    expect(html).not.toContain("自動処理待ち <strong>");
    expect(html).not.toContain("要確認の内容を見る");
  });

  it("separates automatic and Human Gate counts in a mixed state", () => {
    const html = render(
      { venuePending: 2, artistFailed: 1, venueAmbiguous: 4, artistNoCandidate: 3 },
      [humanItem("ambiguous"), humanItem("no_candidate")],
    );
    expect(html).toContain("自動処理待ち <strong>3</strong>件");
    expect(html).toContain("要確認 <strong>7</strong>件");
    expect(html).toContain("解決内容を確認");
    expect(html).toContain("要確認の内容を見る");
  });
});
