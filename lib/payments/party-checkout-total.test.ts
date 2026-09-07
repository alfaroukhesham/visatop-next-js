import { describe, expect, it } from "vitest";
import { sumCheckoutTotals, sumPartyLines, type TPartyLine } from "./party-checkout-total";

describe("sumPartyLines", () => {
  it("sums two lines", () => {
    const lines: TPartyLine[] = [
      { applicationId: "a1", serviceId: "s1", amountMinor: BigInt(12000), currency: "USD" },
      { applicationId: "a2", serviceId: "s2", amountMinor: BigInt(8000), currency: "USD" },
    ];
    expect(sumPartyLines(lines)).toBe(BigInt(20000));
  });

  it("returns 0 for empty", () => {
    expect(sumPartyLines([])).toBe(BigInt(0));
  });
});

describe("sumCheckoutTotals", () => {
  const total = (displayMinor: bigint, currency: "USD" | "AED") =>
    ({ displayMinor, currency, fxRateUsed: null, fxLeg: null, source: "x", wasFxDerived: false }) as const;

  it("sums two totals", () => {
    expect(sumCheckoutTotals([total(BigInt(12000), "USD"), total(BigInt(8000), "USD")])).toBe(BigInt(20000));
  });

  it("returns 0 for empty", () => {
    expect(sumCheckoutTotals([])).toBe(BigInt(0));
  });

  it("returns null when any total is missing", () => {
    expect(sumCheckoutTotals([total(BigInt(12000), "USD"), null])).toBeNull();
  });

  it("returns null on mixed currency", () => {
    expect(sumCheckoutTotals([total(BigInt(12000), "USD"), total(BigInt(8000), "AED")])).toBeNull();
  });
});
