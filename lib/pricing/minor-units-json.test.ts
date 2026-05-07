import { describe, it, expect } from "vitest";
import { minorUnitsToJsonSafeNumber } from "./minor-units-json";

describe("minorUnitsToJsonSafeNumber", () => {
  it("returns Number for values within JSON safe integer range", () => {
    expect(minorUnitsToJsonSafeNumber(BigInt(0))).toBe(0);
    expect(minorUnitsToJsonSafeNumber(BigInt(10_500))).toBe(10_500);
    expect(minorUnitsToJsonSafeNumber(BigInt(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws when amount exceeds MAX_SAFE_INTEGER", () => {
    expect(() => minorUnitsToJsonSafeNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1))).toThrow(RangeError);
  });

  it("throws on negative amounts", () => {
    expect(() => minorUnitsToJsonSafeNumber(BigInt(-1))).toThrow(RangeError);
  });
});
