import { describe, expect, it } from "vitest";
import { extractKnownArtistsFromTitle, extractStructuredArtistMentions, matchArtistMention, normalizeArtistName } from "./mention";

const artists = [
  { id: "1", name: "クロード・モネ", name_en: "Claude Monet", aliases: ["モネ"] },
  { id: "2", name: "別のモネ", aliases: ["モネ"] },
  { id: "3", name: "草間彌生", name_en: "Yayoi Kusama", aliases: [] },
];

describe("Exhibition Artist mention", () => {
  it("preserves explicit structured Artist strings", () => expect(extractStructuredArtistMentions({ common: { artists: [{ name: "草間彌生" }] } })).toEqual([{ name: "草間彌生", role: null, method: "structured_source" }]));
  it("extracts only known sufficiently specific names from title", () => expect(extractKnownArtistsFromTitle("草間彌生展 永遠の現在", artists).map((row) => row.name)).toEqual(["草間彌生"]));
  it("matches a unique alias", () => expect(matchArtistMention("Yayoi Kusama", artists).status).toBe("matched"));
  it("does not auto-match an ambiguous alias", () => expect(matchArtistMention("モネ", artists).status).toBe("ambiguous"));
  it("normalizes punctuation without fuzzy guessing", () => expect(normalizeArtistName("Claude・Monet")).toBe("claudemonet"));
});
