import { describe, it, expect, afterEach } from "vitest";
import {
  readFxRate,
  readFxRateString,
  fxUsdToAed,
  fxAedToUsd,
  deriveAedFromUsd,
  deriveUsdFromAed,
  FxRateMissingError,
  FxRateInvalidError,
} from "./fx-usd-aed";

describe("readFxRate", () => {
  const ORIG_ENV = { ...process.env };

  afterEach(() => {
    // Restore env
    for (const key of [
      "NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD",
      "FX_AED_PER_USD",
    ]) {
      delete process.env[key];
    }
    Object.assign(process.env, ORIG_ENV);
  });

  it("throws FxRateMissingError when no env var set", () => {
    delete process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"];
    delete process.env["FX_AED_PER_USD"];
    expect(() => readFxRate()).toThrow(FxRateMissingError);
  });

  it("reads NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD", () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "3.6725";
    delete process.env["FX_AED_PER_USD"];
    expect(readFxRate()).toBeCloseTo(3.6725);
  });

  it("prefers FX_AED_PER_USD (server mirror) over NEXT_PUBLIC", () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "3.00";
    process.env["FX_AED_PER_USD"] = "3.6725";
    expect(readFxRate()).toBeCloseTo(3.6725);
  });

  it("throws FxRateInvalidError for non-numeric value", () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "bad_value";
    expect(() => readFxRate()).toThrow(FxRateInvalidError);
  });

  it("throws FxRateInvalidError for zero", () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "0";
    expect(() => readFxRate()).toThrow(FxRateInvalidError);
  });

  it("throws FxRateInvalidError for negative rate", () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "-3.67";
    expect(() => readFxRate()).toThrow(FxRateInvalidError);
  });
});

describe("readFxRateString", () => {
  afterEach(() => {
    delete process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"];
    delete process.env["FX_AED_PER_USD"];
  });

  it("returns the raw string representation", () => {
    process.env["FX_AED_PER_USD"] = "3.6725";
    expect(readFxRateString()).toBe("3.6725");
  });
});

describe("fxUsdToAed", () => {
  const RATE = 3.6725;

  it("converts USD minor to AED minor correctly", () => {
    // $100.00 → 10000 cents * 3.6725 = 36725 fils
    expect(fxUsdToAed(10000n, RATE)).toBe(36725n);
  });

  it("rounds correctly for fractional fils", () => {
    // $1.00 = 100 cents → 100 * 3.6725 = 367.25 → round to 367
    expect(fxUsdToAed(100n, RATE)).toBe(367n);
  });

  it("handles zero", () => {
    expect(fxUsdToAed(0n, RATE)).toBe(0n);
  });
});

describe("fxAedToUsd", () => {
  const RATE = 3.6725;

  it("converts AED minor to USD minor via inverse", () => {
    // AED 367 fils / 3.6725 ≈ 99.93... → round to 100
    expect(fxAedToUsd(36725n, RATE)).toBe(10000n);
  });

  it("handles zero", () => {
    expect(fxAedToUsd(0n, RATE)).toBe(0n);
  });
});

describe("deriveAedFromUsd", () => {
  it("returns aedMinor and correct fxLeg", () => {
    const result = deriveAedFromUsd(10000n, 3.6725);
    expect(result.fxLeg).toBe("aed_from_usd");
    expect(result.aedMinor).toBe(36725n);
  });
});

describe("deriveUsdFromAed", () => {
  it("returns usdMinor and correct fxLeg", () => {
    const result = deriveUsdFromAed(36725n, 3.6725);
    expect(result.fxLeg).toBe("usd_from_aed");
    expect(result.usdMinor).toBe(10000n);
  });
});
