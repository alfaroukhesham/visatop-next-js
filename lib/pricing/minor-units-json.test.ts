import { describe, it, expect } from "vitest";
import { minorUnitsToJsonSafeNumber } from "./minor-units-json";

describe("minorUnitsToJsonSafeNumber", () => {
  it("returns Number for values within JSON safe integer range", () => {
    expect(minorUnitsToJsonSafeNumber(0n)).toBe(0);
    expect(minorUnitsToJsonSafeNumber(10_500n)).toBe(10_500);
    expect(minorUnitsToJsonSafeNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws when amount exceeds MAX_SAFE_INTEGER", () => {
    expect(() => minorUnitsToJsonSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(RangeError);
  });

  it("throws on negative amounts", () => {
    expect(() => minorUnitsToJsonSafeNumber(-1n)).toThrow(RangeError);
  });
});
