import { describe, expect, it } from "vitest";
import { formatMinorUnitsAmount, minorUnitsToMajor } from "./format-minor-units";

describe("minorUnitsToMajor", () => {
  it("converts minor units to major", () => {
    expect(minorUnitsToMajor(BigInt(41900))).toBe(419);
    expect(minorUnitsToMajor(BigInt(41950))).toBe(419.5);
    expect(minorUnitsToMajor(BigInt(123456789))).toBe(1234567.89);
  });
});

describe("formatMinorUnitsAmount", () => {
  it("formats USD with two decimals and grouping", () => {
    expect(formatMinorUnitsAmount(BigInt(41900), "USD")).toBe("$419.00");
    expect(formatMinorUnitsAmount(BigInt(123456789), "usd")).toBe("$1,234,567.89");
  });

  it("handles nullish amounts", () => {
    expect(formatMinorUnitsAmount(null, "USD")).toBe("—");
    expect(formatMinorUnitsAmount(undefined, "USD")).toBe("—");
  });

  it("accepts numeric and string minor values", () => {
    expect(formatMinorUnitsAmount(41900, "USD")).toBe("$419.00");
    expect(formatMinorUnitsAmount("41900", "USD")).toBe("$419.00");
  });
});
