import { describe, expect, it } from "vitest";
import { isValidTrackContact, parseTrackContact } from "./track-lookup";

describe("parseTrackContact", () => {
  it("parses email", () => {
    expect(parseTrackContact("  User@EXAMPLE.com ")).toEqual({ kind: "email", email: "user@example.com" });
  });

  it("parses phone digits", () => {
    expect(parseTrackContact("+971 50 123 4567")).toEqual({ kind: "phone", digits: "971501234567" });
  });
});

describe("isValidTrackContact", () => {
  it("accepts valid email", () => {
    expect(isValidTrackContact("a@b.co")).toBe(true);
  });

  it("accepts phone with enough digits", () => {
    expect(isValidTrackContact("+971501234567")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidTrackContact("nodigits")).toBe(false);
    expect(isValidTrackContact("123")).toBe(false);
  });
});
