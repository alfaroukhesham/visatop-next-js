import { describe, expect, it } from "vitest";
import { convertMinorBetweenUsdAed } from "./display-price";

describe("convertMinorBetweenUsdAed", () => {
  it("returns same minor when currencies match", () => {
    expect(convertMinorBetweenUsdAed(BigInt(100), "USD", "USD", 3.67)).toBe(BigInt(100));
  });

  it("converts USD minor to AED minor using rate", () => {
    // $10.00 USD → 36.70 AED at 3.67 (both in 1/100 units)
    expect(convertMinorBetweenUsdAed(BigInt(1000), "USD", "AED", 3.67)).toBe(BigInt(3670));
  });

  it("converts AED minor to USD minor", () => {
    expect(convertMinorBetweenUsdAed(BigInt(3670), "AED", "USD", 3.67)).toBe(BigInt(1000));
  });

  it("returns null for unsupported pair", () => {
    expect(convertMinorBetweenUsdAed(BigInt(100), "EUR", "USD", 3.67)).toBeNull();
  });
});
