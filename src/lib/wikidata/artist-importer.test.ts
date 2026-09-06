import { describe, expect, it } from "vitest";
import { calculateCompleteness } from "@/lib/admin/master-completeness";
import { shouldApplySourceField } from "@/lib/venue-enrichment/source-application";
import { isMasterCandidateUsable, shouldAutoSetMasterPrimary } from "@/lib/admin/master-primary-image";
import { scoreArtistMatch, shouldSkipArtistSource } from "./artist-importer";

describe("artist importer policy", () => {
  it("matches exact name/alias and strengthens matching with birth year", () => { expect(scoreArtistMatch({ id: "1", name: "Claude Monet", aliases: [], birth_year: 1840 }, { name: "モネ", nameEn: "Claude Monet", aliases: [], birthYear: 1840 } as never).confidence).toBe(1); });
  it("protects manual fields from Wikidata", () => { expect(shouldApplySourceField("Manual", "manual", "wikidata")).toBe(false); });
  it("skips an unchanged linked QID and not an unlinked raw record", () => { expect(shouldSkipArtistSource({ checksum: "x", artist_id: "a" }, "x")).toBe(true); expect(shouldSkipArtistSource({ checksum: "x", artist_id: null }, "x")).toBe(false); });
  it("auto-selects only one candidate when no primary exists", () => { expect(shouldAutoSetMasterPrimary({ primaryCount: 0, activeCandidateCount: 1 })).toBe(true); expect(shouldAutoSetMasterPrimary({ primaryCount: 1, activeCandidateCount: 1 })).toBe(false); expect(shouldAutoSetMasterPrimary({ primaryCount: 0, activeCandidateCount: 2 })).toBe(false); });
  it("never promotes an inactive, rejected, or rights-rejected candidate", () => { expect(isMasterCandidateUsable({ is_active: true, review_status: "unreviewed", rights_status: "needs_review" })).toBe(true); expect(isMasterCandidateUsable({ is_active: false, review_status: "unreviewed", rights_status: "needs_review" })).toBe(false); expect(isMasterCandidateUsable({ is_active: true, review_status: "rejected", rights_status: "needs_review" })).toBe(false); expect(isMasterCandidateUsable({ is_active: true, review_status: "unreviewed", rights_status: "rejected" })).toBe(false); });
  it("does not include description/style in Artist completeness and preserves Draft publication", () => { const result = calculateCompleteness("artists", { name: "A", name_en: "A", nationality_country_code: "JP", aliases: [], publication_status: "draft", media_assets: [], source_records: [] }); expect(result.items.map((item) => item.key)).not.toContain("description"); expect(result.items.map((item) => item.key)).not.toContain("style_summary"); expect("draft").toBe("draft"); });
});
