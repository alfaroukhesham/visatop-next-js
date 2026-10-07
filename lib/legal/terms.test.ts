import { describe, expect, it } from "vitest";
import { isCheckoutTermsAccepted, TERMS_OF_USE_URL } from "./terms";

describe("isCheckoutTermsAccepted", () => {
  it("is true only for the boolean true", () => {
    expect(isCheckoutTermsAccepted({ applicationId: "a", termsAccepted: true })).toBe(true);
  });

  it("rejects missing, false, and non-boolean values", () => {
    expect(isCheckoutTermsAccepted({ applicationId: "a" })).toBe(false);
    expect(isCheckoutTermsAccepted({ termsAccepted: false })).toBe(false);
    expect(isCheckoutTermsAccepted({ termsAccepted: "true" })).toBe(false);
    expect(isCheckoutTermsAccepted({ termsAccepted: 1 })).toBe(false);
    expect(isCheckoutTermsAccepted(null)).toBe(false);
    expect(isCheckoutTermsAccepted(undefined)).toBe(false);
  });
});

describe("TERMS_OF_USE_URL", () => {
  it("points at the live VisaTop terms page", () => {
    expect(TERMS_OF_USE_URL).toBe("https://visatop.com/term-of-use/");
  });
});
