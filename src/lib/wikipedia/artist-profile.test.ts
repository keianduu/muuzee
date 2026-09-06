import { describe, expect, it } from "vitest";
import { extractWikipediaArtistProfile } from "./artist-profile";

describe("Wikipedia Artist explicit profile", () => {
  it("extracts an explicit single nationality and supplemental fields", () => {
    const value = extractWikipediaArtistProfile("{{Infobox artist| name = Claude Monet | nationality = French | birth_date = 14 November 1840 | death_date = 5 December 1926 | birth_place = [[Paris]] | other_names = Oscar-Claude Monet}}", "en");
    expect(value).toMatchObject({ nationalityCountryCode: "FR", explicitNationality: true, nameEn: "Claude Monet", birthYear: 1840, deathYear: 1926, birthPlace: "Paris" });
  });
  it("does not infer nationality from birthplace", () => {
    const value = extractWikipediaArtistProfile("{{Infobox artist| name = Artist | birth_place = [[Tokyo]], Japan}}", "en");
    expect(value.nationalityCountryCode).toBeNull();
    expect(value.explicitNationality).toBe(false);
  });
  it("uses the last year in death-and-age templates", () => {
    const profile = extractWikipediaArtistProfile("{{Infobox person|birth_date={{birth date|1909|1|1}}|death_date={{death date and age|1990|1|1|1909|1|1}}}}", "en");
    expect(profile.birthYear).toBe(1909);
    expect(profile.deathYear).toBe(1990);
  });
  it("does not auto-select multiple nationalities", () => {
    expect(extractWikipediaArtistProfile("{{Infobox person| nationality = Japanese / American}}", "en").nationalityCountryCode).toBeNull();
  });
});
