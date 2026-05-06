import { describe, it, expect } from "vitest";
import {
  detectHeaderRowIndex,
  parseMoneyCell,
  parseHeaderRow,
  normalizeCountryName,
  matchNationality,
  parseCurrencySignal,
  extractNumericValue,
  toMinorUnits,
} from "./parse-price-sheet";

describe("detectHeaderRowIndex", () => {
  it("detects header at row 0 (simple sheet)", () => {
    const rows = [["#", "Country", "Tourist Visa", "Work Permit"]];
    expect(detectHeaderRowIndex(rows)).toBe(0);
  });

  it("detects header at row 3 (title rows above)", () => {
    const rows = [
      ["Price List — Visatop", null, null],
      ["For internal use only", null, null],
      [null, null, null],
      ["#", "Country", "60 Day Tourist Visa"],
      ["1", "India", "USD 150"],
    ];
    expect(detectHeaderRowIndex(rows)).toBe(3);
  });

  it("returns -1 when no header row found in 25 rows", () => {
    const rows: (string | null)[][] = Array.from({ length: 30 }, () => [
      "foo",
      "bar",
      "baz",
    ]);
    expect(detectHeaderRowIndex(rows)).toBe(-1);
  });

  it("requires at least one service column beyond # and Country", () => {
    const rows = [["#", "Country"]];
    expect(detectHeaderRowIndex(rows)).toBe(-1);
  });

  it("is case-insensitive for # and Country", () => {
    const rows = [["#", "COUNTRY", "E-Visa"]];
    expect(detectHeaderRowIndex(rows)).toBe(0);
  });

  it("does not exceed HEADER_SCAN_LIMIT", () => {
    // Header at row 26 — beyond limit, should not be found
    const rows: (string | number | null)[][] = Array.from({ length: 26 }, (_, i) =>
      i === 25 ? ["#", "Country", "Visa"] : ["nope", null, null],
    );
    expect(detectHeaderRowIndex(rows)).toBe(-1);
  });
});

describe("parseMoneyCell", () => {
  it("empty / null → empty", () => {
    expect(parseMoneyCell(null)).toEqual({ kind: "empty" });
    expect(parseMoneyCell(undefined)).toEqual({ kind: "empty" });
    expect(parseMoneyCell("")).toEqual({ kind: "empty" });
    expect(parseMoneyCell("  ")).toEqual({ kind: "empty" });
  });

  it("zero values → empty", () => {
    expect(parseMoneyCell(0)).toEqual({ kind: "empty" });
    expect(parseMoneyCell("0")).toEqual({ kind: "empty" });
    expect(parseMoneyCell("USD 0")).toEqual({ kind: "empty" });
  });

  it("numeric string with USD signal → priced USD", () => {
    const r = parseMoneyCell("USD 150");
    expect(r).toEqual({ kind: "priced", currency: "USD", amountMinor: 15000n });
  });

  it("$ prefix → priced USD", () => {
    const r = parseMoneyCell("$150.00");
    expect(r).toEqual({ kind: "priced", currency: "USD", amountMinor: 15000n });
  });

  it("AED signal → priced AED", () => {
    const r = parseMoneyCell("AED 550");
    expect(r).toEqual({ kind: "priced", currency: "AED", amountMinor: 55000n });
  });

  it("dirham keyword → priced AED", () => {
    const r = parseMoneyCell("550 Dirham");
    expect(r).toEqual({ kind: "priced", currency: "AED", amountMinor: 55000n });
  });

  it("plain number (ExcelJS numeric) → ambiguous", () => {
    const r = parseMoneyCell(150);
    expect(r).toEqual({ kind: "ambiguous", amountMinor: 15000n });
  });

  it("plain numeric string → ambiguous", () => {
    const r = parseMoneyCell("150");
    expect(r).toEqual({ kind: "ambiguous", amountMinor: 15000n });
  });

  it("fractional amounts rounded correctly", () => {
    // $1.005 should round to 101 cents
    const r = parseMoneyCell("USD 1.005");
    expect(r.kind).toBe("priced");
    if (r.kind === "priced") expect(r.amountMinor).toBe(101n);
  });

  it("non-numeric text → empty", () => {
    expect(parseMoneyCell("N/A")).toEqual({ kind: "empty" });
    expect(parseMoneyCell("-")).toEqual({ kind: "empty" });
  });
});

describe("parseCurrencySignal", () => {
  it("detects USD variants", () => {
    expect(parseCurrencySignal("USD 100")).toBe("USD");
    expect(parseCurrencySignal("$100")).toBe("USD");
    expect(parseCurrencySignal("100 dollars")).toBe("USD");
  });

  it("detects AED variants", () => {
    expect(parseCurrencySignal("AED 100")).toBe("AED");
    expect(parseCurrencySignal("100 DH")).toBe("AED");
    expect(parseCurrencySignal("100 dirhams")).toBe("AED");
  });

  it("returns null for no signal", () => {
    expect(parseCurrencySignal("100")).toBeNull();
    expect(parseCurrencySignal("")).toBeNull();
  });
});

describe("extractNumericValue", () => {
  it("strips USD and returns float", () => {
    expect(extractNumericValue("USD 150.50")).toBeCloseTo(150.5);
  });

  it("handles comma thousands separator", () => {
    expect(extractNumericValue("1,234")).toBeCloseTo(1234);
  });

  it("returns null for no number", () => {
    expect(extractNumericValue("N/A")).toBeNull();
  });
});

describe("toMinorUnits", () => {
  it("converts 1.00 → 100n", () => {
    expect(toMinorUnits(1.0)).toBe(100n);
  });

  it("rounds boundary: 1.005 → 101n", () => {
    expect(toMinorUnits(1.005)).toBe(101n);
  });

  it("converts 150 → 15000n", () => {
    expect(toMinorUnits(150)).toBe(15000n);
  });
});

describe("normalizeCountryName", () => {
  it("lowercases and trims", () => {
    expect(normalizeCountryName("  India  ")).toBe("india");
  });

  it("strips diacritics", () => {
    expect(normalizeCountryName("Côte d'Ivoire")).toBe("cote d'ivoire");
  });

  it("collapses internal spaces", () => {
    expect(normalizeCountryName("Saudi  Arabia")).toBe("saudi arabia");
  });
});

describe("matchNationality", () => {
  const map = new Map([
    ["india", "IN"],
    ["saudi arabia", "SA"],
    ["united arab emirates", "AE"],
  ]);

  it("matches exact (normalised)", () => {
    expect(matchNationality("India", map)).toBe("IN");
    expect(matchNationality("SAUDI ARABIA", map)).toBe("SA");
  });

  it("returns null for unresolved", () => {
    expect(matchNationality("Freedonia", map)).toBeNull();
  });

  it("returns null for empty/null", () => {
    expect(matchNationality(null, map)).toBeNull();
    expect(matchNationality("", map)).toBeNull();
  });
});

describe("parseHeaderRow", () => {
  it("correctly identifies column indices", () => {
    const row = ["#", "Country", "Tourist Visa", "Work Permit"];
    const h = parseHeaderRow(row);
    expect(h.hashColIdx).toBe(0);
    expect(h.countryColIdx).toBe(1);
    expect(h.serviceColumns).toHaveLength(2);
    expect(h.serviceColumns[0]).toMatchObject({
      colIdx: 2,
      trimmedName: "Tourist Visa",
    });
    expect(h.serviceColumns[1]).toMatchObject({
      colIdx: 3,
      trimmedName: "Work Permit",
    });
  });
});
