import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readFxRate,
  readFxRateString,
  fxUsdToAed,
  fxAedToUsd,
  deriveAedFromUsd,
  deriveUsdFromAed,
  FxRateMissingError,
  FxRateInvalidError,
  PLATFORM_KEY_FX_AED_PER_USD,
  parseFxAedPerUsdFromStored,
  peekResolvedFxRateFromTx,
  getResolvedFxRateFromTx,
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
    expect(fxUsdToAed(BigInt(10000), RATE)).toBe(BigInt(36725));
  });

  it("rounds correctly for fractional fils", () => {
    // $1.00 = 100 cents → 100 * 3.6725 = 367.25 → round to 367
    expect(fxUsdToAed(BigInt(100), RATE)).toBe(BigInt(367));
  });

  it("handles zero", () => {
    expect(fxUsdToAed(BigInt(0), RATE)).toBe(BigInt(0));
  });
});

describe("fxAedToUsd", () => {
  const RATE = 3.6725;

  it("converts AED minor to USD minor via inverse", () => {
    // AED 367 fils / 3.6725 ≈ 99.93... → round to 100
    expect(fxAedToUsd(BigInt(36725), RATE)).toBe(BigInt(10000));
  });

  it("handles zero", () => {
    expect(fxAedToUsd(BigInt(0), RATE)).toBe(BigInt(0));
  });
});

describe("deriveAedFromUsd", () => {
  it("returns aedMinor and correct fxLeg", () => {
    const result = deriveAedFromUsd(BigInt(10000), 3.6725);
    expect(result.fxLeg).toBe("aed_from_usd");
    expect(result.aedMinor).toBe(BigInt(36725));
  });
});

describe("deriveUsdFromAed", () => {
  it("returns usdMinor and correct fxLeg", () => {
    const result = deriveUsdFromAed(BigInt(36725), 3.6725);
    expect(result.fxLeg).toBe("usd_from_aed");
    expect(result.usdMinor).toBe(BigInt(10000));
  });
});

describe("PLATFORM_KEY_FX_AED_PER_USD", () => {
  it("is fx_aed_per_usd", () => {
    expect(PLATFORM_KEY_FX_AED_PER_USD).toBe("fx_aed_per_usd");
  });
});

describe("parseFxAedPerUsdFromStored", () => {
  it("returns null for empty or missing values", () => {
    expect(parseFxAedPerUsdFromStored(undefined)).toBeNull();
    expect(parseFxAedPerUsdFromStored(null)).toBeNull();
    expect(parseFxAedPerUsdFromStored("")).toBeNull();
    expect(parseFxAedPerUsdFromStored("   ")).toBeNull();
  });

  it("returns null for zero, negative, or non-numeric values", () => {
    expect(parseFxAedPerUsdFromStored("0")).toBeNull();
    expect(parseFxAedPerUsdFromStored("-3.67")).toBeNull();
    expect(parseFxAedPerUsdFromStored("bad")).toBeNull();
  });

  it("returns trimmed positive decimal string", () => {
    expect(parseFxAedPerUsdFromStored(" 3.6725 ")).toBe("3.6725");
    expect(parseFxAedPerUsdFromStored("3.67")).toBe("3.67");
  });
});

function mockTxWithStoredFx(value: string | undefined) {
  const limit = vi.fn().mockResolvedValue(value !== undefined ? [{ value }] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  return { select: vi.fn().mockReturnValue({ from }) };
}

describe("peekResolvedFxRateFromTx", () => {
  const ORIG_ENV = { ...process.env };

  afterEach(() => {
    delete process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"];
    delete process.env["FX_AED_PER_USD"];
    Object.assign(process.env, ORIG_ENV);
  });

  it("returns setting source when platform row is valid", async () => {
    const tx = mockTxWithStoredFx("3.6725");
    const result = await peekResolvedFxRateFromTx(tx as never);
    expect(result).toEqual({ fxAedPerUsd: "3.6725", source: "setting" });
  });

  it("falls back to env when stored setting is invalid", async () => {
    process.env["FX_AED_PER_USD"] = "3.67";
    const tx = mockTxWithStoredFx("0");
    const result = await peekResolvedFxRateFromTx(tx as never);
    expect(result).toEqual({ fxAedPerUsd: "3.67", source: "env" });
  });

  it("returns env source when no platform row exists", async () => {
    process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"] = "3.6725";
    const tx = mockTxWithStoredFx(undefined);
    const result = await peekResolvedFxRateFromTx(tx as never);
    expect(result).toEqual({ fxAedPerUsd: "3.6725", source: "env" });
  });

  it("returns missing when neither setting nor env is configured", async () => {
    const tx = mockTxWithStoredFx(undefined);
    const result = await peekResolvedFxRateFromTx(tx as never);
    expect(result).toEqual({ fxAedPerUsd: null, source: "missing" });
  });
});

describe("getResolvedFxRateFromTx", () => {
  const ORIG_ENV = { ...process.env };

  afterEach(() => {
    delete process.env["NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD"];
    delete process.env["FX_AED_PER_USD"];
    Object.assign(process.env, ORIG_ENV);
  });

  it("returns platform setting when valid", async () => {
    const tx = mockTxWithStoredFx("3.6725");
    await expect(getResolvedFxRateFromTx(tx as never)).resolves.toBe("3.6725");
  });

  it("falls back to env when no platform row", async () => {
    process.env["FX_AED_PER_USD"] = "3.67";
    const tx = mockTxWithStoredFx(undefined);
    await expect(getResolvedFxRateFromTx(tx as never)).resolves.toBe("3.67");
  });

  it("throws FxRateMissingError when neither setting nor env works", async () => {
    const tx = mockTxWithStoredFx(undefined);
    await expect(getResolvedFxRateFromTx(tx as never)).rejects.toThrow(FxRateMissingError);
  });
});
