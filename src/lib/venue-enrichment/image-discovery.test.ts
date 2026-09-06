import { describe, expect, it } from "vitest";
import { scoreVenueImageTitle, selectVenueImageFiles } from "./image-discovery";

describe("Venue image discovery", () => {
  it("keeps P18 first and deduplicates the same Commons file across sources", () => {
    const selected = selectVenueImageFiles({
      p18: "Iwate Museum of Art.jpg",
      commonsFiles: ["File:Iwate Museum of Art.jpg", "File:Iwate Museum of Art Grand Gallery.jpg"],
      wikipediaFiles: ["ファイル:Iwate Museum of Art Grand Gallery.jpg", "File:Iwate Museum of Art Exhibition.jpg"],
      venueNames: ["岩手県立美術館", "Iwate Museum of Art"],
    });
    expect(selected[0]).toMatchObject({ fileTitle: "Iwate Museum of Art.jpg", discoverySource: "wikidata_p18" });
    expect(selected.filter((item) => item.fileTitle.includes("Grand Gallery"))).toHaveLength(1);
    expect(selected).toHaveLength(3);
  });

  it("excludes logos, maps, SVGs, and artworks", () => {
    expect(scoreVenueImageTitle("File:Example museum logo.svg", ["Example Museum"], "commons_category")).toBeNull();
    expect(scoreVenueImageTitle("File:Example Museum map.png", ["Example Museum"], "wikipedia_article")).toBeNull();
    expect(scoreVenueImageTitle("File:Portrait of a visitor.jpg", ["Example Museum"], "wikipedia_article")).toBeNull();
    expect(scoreVenueImageTitle("File:Example Museum exterior.jpg", ["Example Museum"], "commons_category")).toBeGreaterThan(0);
  });
});
