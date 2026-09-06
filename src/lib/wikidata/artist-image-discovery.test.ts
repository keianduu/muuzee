import { describe, expect, it } from "vitest";
import { classifyArtistImageTitle, scoreArtistImageTitle, selectArtistImageFiles } from "./artist-image-discovery";

describe("artist image discovery", () => {
  it("prefers P18 and can fall back to Commons and Wikipedia", () => {
    const rows = selectArtistImageFiles({ p18: "Claude Monet portrait.jpg", commonsFiles: ["Claude Monet photograph 1899.jpg"], wikipediaFiles: ["Portrait of Claude Monet.jpg"], names: ["Claude Monet"] });
    expect(rows).toHaveLength(3); expect(rows[0].discoverySource).toBe("wikidata_p18");
  });
  it("prefers the Wikipedia lead image over the Commons category fallback", () => {
    const rows = selectArtistImageFiles({ p18: null, commonsFiles: ["Claude Monet photograph 1899.jpg"], wikipediaFiles: ["Portrait of Claude Monet.jpg"], names: ["Claude Monet"] });
    expect(rows[0].discoverySource).toBe("wikipedia_article");
  });
  it("classifies human-review candidates conservatively", () => {
    expect(classifyArtistImageTitle("Artist photograph 2020.jpg")).toBe("portrait_photo");
    expect(classifyArtistImageTitle("Artist at work in studio.jpg")).toBe("artist_at_work");
    expect(classifyArtistImageTitle("Self portrait of Artist.jpg")).toBe("self_portrait");
    expect(classifyArtistImageTitle("Portrait drawing of Artist.jpg")).toBe("portrait_artwork");
  });
  it("excludes artworks, posters, books, signatures, logos, maps and diagrams", () => {
    for (const title of ["Artist painting Water lilies.jpg", "Artist exhibition poster.jpg", "Artist signature.svg", "Artist map.png"]) expect(scoreArtistImageTitle(title, ["Artist"], "commons_category")).toBeNull();
  });
  it("deduplicates the same file across discovery routes", () => {
    expect(selectArtistImageFiles({ p18: "Artist portrait.jpg", commonsFiles: ["File:Artist portrait.jpg"], wikipediaFiles: [], names: ["Artist"] })).toHaveLength(1);
  });
});
