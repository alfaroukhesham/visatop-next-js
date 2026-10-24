import { describe, expect, it } from "vitest";
import { isPlausibleGuestEmail } from "./guest-email";

describe("isPlausibleGuestEmail", () => {
  it("accepts ordinary contact emails", () => {
    expect(isPlausibleGuestEmail("ada@gmail.com")).toBe(true);
    expect(isPlausibleGuestEmail("  Applicant@VisaTop.co  ")).toBe(true);
  });

  it("rejects obvious junk, single-character parts, and example/test domains", () => {
    expect(isPlausibleGuestEmail("x@x.com")).toBe(false);
    expect(isPlausibleGuestEmail("a@gmail.com")).toBe(false);
    expect(isPlausibleGuestEmail("ada@x.com")).toBe(false);
    expect(isPlausibleGuestEmail("guest@example.com")).toBe(false);
    expect(isPlausibleGuestEmail("guest@mail.example.org")).toBe(false);
    expect(isPlausibleGuestEmail("guest@test.com")).toBe(false);
    expect(isPlausibleGuestEmail("guest@foo.test")).toBe(false);
    expect(isPlausibleGuestEmail("not-an-email")).toBe(false);
  });
});
