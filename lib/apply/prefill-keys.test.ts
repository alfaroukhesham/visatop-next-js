import { describe, expect, it } from "vitest";
import { nonEmptyPrefillKeys } from "./prefill-keys";

describe("nonEmptyPrefillKeys", () => {
  it("omits null, undefined, and blank strings", () => {
    expect(
      [...nonEmptyPrefillKeys({
        fullName: "JANE SAMPLE",
        dateOfBirth: null,
        nationality: "  ",
        passportNumber: "X00000000",
      })].sort(),
    ).toEqual(["fullName", "passportNumber"]);
  });

  it("returns an empty set when prefill is missing", () => {
    expect(nonEmptyPrefillKeys(null).size).toBe(0);
    expect(nonEmptyPrefillKeys(undefined).size).toBe(0);
  });
});
