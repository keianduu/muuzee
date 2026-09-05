import { describe, expect, it } from "vitest";
import { VENUE_AI_ENRICHMENT_PROMPT } from "./venue-ai-enrichment-prompt";

describe("venue AI enrichment prompt", () => {
  it("limits evidence to official crawler content and forbids guessing", () => {
    expect(VENUE_AI_ENRICHMENT_PROMPT).toContain("Web検索、第三者サイト、一般知識、推測、補完は禁止");
    expect(VENUE_AI_ENRICHMENT_PROMPT).toContain("AIはSourceではありません");
    expect(VENUE_AI_ENRICHMENT_PROMPT).toContain("既に値があるFieldは保持");
    expect(VENUE_AI_ENRICHMENT_PROMPT).toContain("200〜300字");
  });
});
