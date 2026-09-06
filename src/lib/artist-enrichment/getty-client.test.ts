import { describe, expect, it } from "vitest";
import { explicitGettyNationalityCode, matchGettyCandidates, parseGettyUlanRecord, type GettyUlanRecord } from "./getty-client";

const record = (overrides: Partial<GettyUlanRecord> = {}): GettyUlanRecord => ({
  id: "500319544", url: "http://vocab.getty.edu/page/ulan/500319544", name: "Hirayama, Ikuo",
  preferredName: "Hirayama, Ikuo", nameEn: "Hirayama, Ikuo", aliases: ["平山郁夫"], variantNames: ["平山郁夫"],
  birthYear: 1930, deathYear: 2009, birthPlace: null, nationalities: ["Japanese"], roles: ["artists"], ...overrides,
});

describe("Getty ULAN targeted matching", () => {
  it("accepts one exact alias and date match", () => {
    expect(matchGettyCandidates({ name: "平山郁夫", birthYear: 1930 }, [record()]).status).toBe("exact");
  });

  it("does not silently choose between exact duplicates", () => {
    expect(matchGettyCandidates({ name: "平山郁夫" }, [record(), record({ id: "500000002" })]).status).toBe("ambiguous");
  });

  it("uses only one explicit mapped nationality", () => {
    expect(explicitGettyNationalityCode(["Japanese"])).toBe("JP");
    expect(explicitGettyNationalityCode(["Japanese", "Italian"])).toBeNull();
    expect(explicitGettyNationalityCode(["Austrian", "Italian (culture or style)"])).toBeNull();
    expect(explicitGettyNationalityCode([])).toBeNull();
    expect(explicitGettyNationalityCode(["possibly Japanese"])).toBeNull();
  });

  it("parses an explicit nationality classification from Linked Art", () => {
    const parsed = parseGettyUlanRecord({ _label: "Hirayama, Ikuo", classified_as: [{ _label: "Japanese", classified_as: [{ _label: "nationality" }] }] }, "500319544");
    expect(parsed.nationalities).toEqual(["Japanese"]);
  });
});
