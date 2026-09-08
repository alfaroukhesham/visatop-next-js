import { describe, expect, it } from "vitest";
import { composeE164, splitStoredPhone } from "./phone-country";

describe("composeE164", () => {
  it("joins dial and national digits with a leading plus", () => {
    expect(composeE164("91", "9876543210")).toBe("+919876543210");
  });

  it("strips non-digits from both parts", () => {
    expect(composeE164("+91", "987-654-3210")).toBe("+919876543210");
  });

  it("returns national-only E.164 when dial is missing", () => {
    expect(composeE164("", "9876543210")).toBe("+9876543210");
  });

  it("returns empty string when both parts are empty", () => {
    expect(composeE164("", "")).toBe("");
    expect(composeE164("  ", "  ")).toBe("");
  });
});

describe("splitStoredPhone", () => {
  it("splits E.164 when stored starts with + and matches fallback dial", () => {
    expect(splitStoredPhone("+919876543210", "91")).toEqual({
      dial: "91",
      national: "9876543210",
    });
  });

  it("uses fallback dial when stored does not start with +", () => {
    expect(splitStoredPhone("9876543210", "91")).toEqual({
      dial: "91",
      national: "9876543210",
    });
  });

  it("uses fallback dial when + prefix does not match fallback", () => {
    expect(splitStoredPhone("+14155551234", "91")).toEqual({
      dial: "91",
      national: "14155551234",
    });
  });

  it("returns empty national when stored is empty", () => {
    expect(splitStoredPhone("", "91")).toEqual({ dial: "91", national: "" });
  });
});
