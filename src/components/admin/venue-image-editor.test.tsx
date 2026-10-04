import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { SourceImageCandidateRow, VenueRow } from "@/lib/admin/types";
import { VenueImageEditor } from "./venue-image-editor";

vi.stubGlobal("React", React);

const venue = {
  id: "32500000-0000-4325-8325-000000000001",
  name: "LOCAL Image Candidate Venue",
  media_assets: [],
} as unknown as VenueRow;

const candidate = (id: string): SourceImageCandidateRow => ({
  id, image_url: `https://example.com/${id}.jpg`, thumbnail_url: null, provider: "wikimedia_commons", stable_identifier: id,
  source_url: `https://example.com/${id}`, author: "Fixture", credit: "Fixture credit", license_short_name: "CC BY 4.0",
  license_url: "https://creativecommons.org/licenses/by/4.0/", usage_terms: "Attribution", rights_status: "needs_review",
  candidate_entity_id: "Q1", candidate_entity_label: "Fixture", candidate_match_confidence: 0.8, candidate_match_threshold: 0.6,
  candidate_kind: "image", discovery_source: id === "a" ? "wikidata_p18" : "commons_category", contents_rights_type: null,
  contents_access: null, review_status: "unreviewed", is_active: true,
});

describe("VenueImageEditor", () => {
  it("keeps the approved section order and hides the empty registration preview", () => {
    const markup = renderToStaticMarkup(
      <VenueImageEditor
        venue={venue}
        busy={false}
        candidates={[]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onSetPrimary={vi.fn()}
      />,
    );

    const registered = markup.indexOf('data-venue-image-section="registered"');
    const candidates = markup.indexOf('data-venue-image-section="candidates"');
    const registration = markup.indexOf('data-venue-image-section="registration"');
    expect(registered).toBeGreaterThan(-1);
    expect(candidates).toBeGreaterThan(registered);
    expect(registration).toBeGreaterThan(candidates);
    expect(markup).toContain('aria-label="登録画像なし"');
    expect(markup).not.toContain("venue-image-preview");
  });

  it("uses one image selection entry point and removes competing candidate actions", () => {
    const markup = renderToStaticMarkup(<VenueImageEditor venue={venue} busy={false} candidates={[candidate("a"), candidate("b")]} onUpload={vi.fn()} onRemove={vi.fn()} onOpenImageCandidate={vi.fn()} onSetPrimary={vi.fn()}/>);
    expect(markup).toContain("選択できる候補 2件");
    expect(markup).toContain("画像候補を選択");
    expect(markup).not.toContain("候補を確認");
    expect(markup).not.toContain("利用条件を開く");
    expect(markup).not.toContain("候補として残す");
    expect(markup).not.toContain("候補から除外");
  });

  it("keeps the coordinate secondary trigger only in Basic Edit", () => {
    const editor = readFileSync(new URL("./venue-editor.tsx", import.meta.url), "utf8");
    const basic = readFileSync(new URL("./venue-basic-editor.tsx", import.meta.url), "utf8");
    expect(editor).not.toContain("第二Drawerで確認");
    expect(editor).toContain('data-secondary-return-anchor={tab.id === "image" ? "image" : undefined}');
    expect(basic).toContain("位置情報候補を確認");
    expect(basic).toContain('data-secondary-trigger="coordinates"');
  });
});
