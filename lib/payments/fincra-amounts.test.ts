import { describe, expect, it } from "vitest";
import { fincraMajorToMinor, fincraMinorToMajorNumber, tryFincraMajorToMinor } from "./fincra-amounts";

describe("fincra amounts", () => {
  it("converts major naira to kobo", () => {
    expect(fincraMajorToMinor(185000)).toBe(BigInt(18_500_000));
    expect(fincraMajorToMinor("185000.50")).toBe(BigInt(18_500_050));
  });

  it("converts kobo back to major units for the checkout API", () => {
    expect(fincraMinorToMajorNumber(BigInt(18_500_000))).toBe(185000);
    expect(fincraMinorToMajorNumber(BigInt(301))).toBe(3.01);
  });

  it("returns null for non-numeric majors", () => {
    expect(tryFincraMajorToMinor(null)).toBeNull();
    expect(tryFincraMajorToMinor(undefined)).toBeNull();
    expect(tryFincraMajorToMinor("n/a")).toBeNull();
  });
});
