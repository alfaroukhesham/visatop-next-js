import { describe, expect, it } from "vitest";
import { convertMinorBetweenUsdAed } from "./display-price";

describe("convertMinorBetweenUsdAed", () => {
  it("returns same minor when currencies match", () => {
    expect(convertMinorBetweenUsdAed(100n, "USD", "USD", 3.67)).toBe(100n);
  });

  it("converts USD minor to AED minor using rate", () => {
    // $10.00 USD → 36.70 AED at 3.67 (both in 1/100 units)
    expect(convertMinorBetweenUsdAed(1000n, "USD", "AED", 3.67)).toBe(3670n);
  });

  it("converts AED minor to USD minor", () => {
    expect(convertMinorBetweenUsdAed(3670n, "AED", "USD", 3.67)).toBe(1000n);
  });

  it("returns null for unsupported pair", () => {
    expect(convertMinorBetweenUsdAed(100n, "EUR", "USD", 3.67)).toBeNull();
  });
});
