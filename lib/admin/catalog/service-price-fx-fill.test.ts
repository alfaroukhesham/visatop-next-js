import { describe, expect, it } from "vitest";
import {
  applyManualAedChange,
  applyManualUsdChange,
  convertAedMajorToUsdMajor,
  convertUsdMajorToAedMajor,
  needsFxForPair,
} from "./service-price-fx-fill";

describe("service-price-fx-fill", () => {
  const fxRate = "3.67";

  it("converts USD major to AED major", () => {
    expect(convertUsdMajorToAedMajor("100.00", fxRate)).toBe("367.00");
  });

  it("converts AED major to USD major", () => {
    expect(convertAedMajorToUsdMajor("367.00", fxRate)).toBe("100.00");
  });

  it("auto-fills USD when AED is typed and USD is not dirty", () => {
    const result = applyManualAedChange("367.00", "", { aed: false, usd: false }, true, fxRate);
    expect(result.usd).toBe("100.00");
  });

  it("does not overwrite manually edited USD", () => {
    const result = applyManualAedChange(
      "400.00",
      "99.00",
      { aed: false, usd: true },
      true,
      fxRate,
    );
    expect(result.usd).toBe("99.00");
  });

  it("re-enables auto-fill when AED is cleared", () => {
    const cleared = applyManualAedChange("", "99.00", { aed: false, usd: true }, true, fxRate);
    expect(cleared.dirty.usd).toBe(false);

    const refilled = applyManualAedChange("367.00", "99.00", cleared.dirty, true, fxRate);
    expect(refilled.usd).toBe("100.00");
  });

  it("does not overwrite manually edited AED when USD is typed later", () => {
    const afterAed = applyManualAedChange("367.00", "", { aed: false, usd: false }, true, fxRate);
    expect(afterAed.dirty.aed).toBe(true);
    const afterUsd = applyManualUsdChange("90.00", afterAed.aed, afterAed.dirty, true, fxRate);
    expect(afterUsd.aed).toBe("367.00");
    expect(afterUsd.usd).toBe("90.00");
  });

  it("auto-fills AED when USD is typed and AED is not dirty", () => {
    const result = applyManualUsdChange("100.00", "", { aed: false, usd: false }, true, fxRate);
    expect(result.aed).toBe("367.00");
  });

  it("detects when FX is required for a pair", () => {
    expect(needsFxForPair("100.00", "")).toBe(true);
    expect(needsFxForPair("100.00", "367.00")).toBe(false);
  });
});
