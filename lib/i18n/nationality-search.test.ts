import { describe, expect, it } from "vitest";
import {
  filterNationalityOptions,
  nationalityLocalizedName,
  normalizeNationalityQuery,
} from "@/lib/i18n/nationality-search";

const OPTIONS = [
  { code: "NG", name: "Nigeria" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "KE", name: "Kenya" },
  { code: "IN", name: "India" },
];

describe("normalizeNationalityQuery", () => {
  it("folds alef forms, hamza, taa marbuta, and diacritics", () => {
    expect(normalizeNationalityQuery("الإم")).toBe(normalizeNationalityQuery("الام"));
    expect(normalizeNationalityQuery("إِمَارَات")).toContain("امار");
    expect(normalizeNationalityQuery("مكة")).toBe(normalizeNationalityQuery("مكه"));
  });
});

describe("nationalityLocalizedName", () => {
  it("returns the Arabic region name in the ar locale", () => {
    expect(nationalityLocalizedName("NG", "Nigeria", "ar")).toMatch(/نيجيريا/);
    expect(nationalityLocalizedName("AE", "United Arab Emirates", "ar")).toMatch(/إمارات|الامارات|الإمارات/);
  });

  it("keeps the catalog English name in en", () => {
    expect(nationalityLocalizedName("NG", "Nigeria", "en")).toBe("Nigeria");
  });
});

describe("filterNationalityOptions", () => {
  it("matches Arabic prefixes in the AR locale after normalization", () => {
    const nigeria = filterNationalityOptions(OPTIONS, "ني", "ar").map((n) => n.code);
    expect(nigeria).toContain("NG");

    const uae = filterNationalityOptions(OPTIONS, "الإم", "ar").map((n) => n.code);
    expect(uae).toContain("AE");
  });

  it("still matches English names and ISO codes in the AR locale", () => {
    expect(filterNationalityOptions(OPTIONS, "Ken", "ar").map((n) => n.code)).toEqual(["KE"]);
    expect(filterNationalityOptions(OPTIONS, "ng", "ar").map((n) => n.code)).toContain("NG");
  });

  it("does not require Arabic names in the English locale", () => {
    expect(filterNationalityOptions(OPTIONS, "Ken", "en").map((n) => n.code)).toEqual(["KE"]);
  });

  it("filters a longer Latin query in English", () => {
    expect(filterNationalityOptions(OPTIONS, "Niger", "en").map((n) => n.code)).toEqual(["NG"]);
  });
});
