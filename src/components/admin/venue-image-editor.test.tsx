import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { VenueRow } from "@/lib/admin/types";
import { VenueImageEditor } from "./venue-image-editor";

vi.stubGlobal("React", React);

const venue = {
  id: "32500000-0000-4325-8325-000000000001",
  name: "LOCAL Image Candidate Venue",
  media_assets: [],
} as unknown as VenueRow;

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
        onReview={vi.fn()}
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
});
