import { describe, it, expect } from "vitest";
import { resolveDisplayPrice } from "./resolve-customer-catalog-price";

describe("resolveDisplayPrice", () => {
  it("returns direct AED row when catalog currency is AED and FX is unavailable", () => {
    const row = {
      AED: { currency: "AED" as const, amountMinor: BigInt(12_345), source: "admin_import" },
    };
    const r = resolveDisplayPrice(row, "AED", null);
    expect(r).not.toBeNull();
    expect(r!.displayMinor).toBe(BigInt(12_345));
    expect(r!.currency).toBe("AED");
    expect(r!.wasFxDerived).toBe(false);
  });

  it("returns null when only USD is stored, catalog is AED, and FX is null", () => {
    const row = {
      USD: { currency: "USD" as const, amountMinor: BigInt(100), source: "admin_import" },
    };
    expect(resolveDisplayPrice(row, "AED", null)).toBeNull();
  });
});
