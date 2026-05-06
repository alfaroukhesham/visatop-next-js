import { describe, it, expect } from "vitest";
import { suggestIso3166Alpha2FromCountryLabel, withSuggestedAlpha2 } from "./suggest-country-alpha2";

describe("suggestIso3166Alpha2FromCountryLabel", () => {
  it("resolves English country names (diacritic-insensitive)", () => {
    expect(suggestIso3166Alpha2FromCountryLabel("Germany")).toBe("DE");
    expect(suggestIso3166Alpha2FromCountryLabel("UNITED ARAB EMIRATES")).toBe("AE");
    expect(suggestIso3166Alpha2FromCountryLabel("United States")).toBe("US");
  });

  it("accepts valid alpha-2 as-is", () => {
    expect(suggestIso3166Alpha2FromCountryLabel("in")).toBe("IN");
    expect(suggestIso3166Alpha2FromCountryLabel("  ae  ")).toBe("AE");
  });

  it("accepts valid alpha-3", () => {
    expect(suggestIso3166Alpha2FromCountryLabel("deu")).toBe("DE");
    expect(suggestIso3166Alpha2FromCountryLabel("USA")).toBe("US");
  });

  it("uses common aliases", () => {
    expect(suggestIso3166Alpha2FromCountryLabel("UAE")).toBe("AE");
    expect(suggestIso3166Alpha2FromCountryLabel("UK")).toBe("GB");
  });

  it("returns null for unknown labels", () => {
    expect(suggestIso3166Alpha2FromCountryLabel("Freedonia")).toBeNull();
    expect(suggestIso3166Alpha2FromCountryLabel("")).toBeNull();
  });
});

describe("withSuggestedAlpha2", () => {
  it("adds suggestedAlpha2 to each entry", () => {
    const out = withSuggestedAlpha2([
      { normKey: "germany", exampleRaw: "Germany", exampleRowIdx: 2 },
      { normKey: "x", exampleRaw: "NowhereLand", exampleRowIdx: 3 },
    ]);
    expect(out[0].suggestedAlpha2).toBe("DE");
    expect(out[1].suggestedAlpha2).toBeNull();
  });
});
