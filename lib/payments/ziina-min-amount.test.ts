import { describe, expect, it } from "vitest";
import {
  isBelowZiinaMinimum,
  sanitizeZiinaProviderBody,
  ziinaProviderBodyLooksLikeMinimum,
  ZIINA_MIN_AMOUNT_AED_MINOR,
} from "./ziina-min-amount";

describe("ziina-min-amount", () => {
  it("treats AED below 2.00 as under the documented minimum", () => {
    expect(ZIINA_MIN_AMOUNT_AED_MINOR).toBe(200);
    expect(isBelowZiinaMinimum({ amountMinor: 199, currency: "AED" })).toBe(true);
    expect(isBelowZiinaMinimum({ amountMinor: 200, currency: "AED" })).toBe(false);
  });

  it("converts USD with the display FX rate (2 AED ≈ 0.54 USD at 3.6725)", () => {
    expect(isBelowZiinaMinimum({ amountMinor: 54, currency: "USD", aedPerUsd: 3.6725 })).toBe(true);
    expect(isBelowZiinaMinimum({ amountMinor: 55, currency: "USD", aedPerUsd: 3.6725 })).toBe(false);
  });

  it("does not block unknown currencies or USD without a rate", () => {
    expect(isBelowZiinaMinimum({ amountMinor: 1, currency: "NGN" })).toBe(false);
    expect(isBelowZiinaMinimum({ amountMinor: 1, currency: "USD" })).toBe(false);
  });

  it("redacts emails and bearer tokens from Ziina error bodies", () => {
    const body = sanitizeZiinaProviderBody(
      'Bearer sk_live_abc amount below minimum for a@b.com {"code":"min"}',
    );
    expect(body).toContain("Bearer [redacted]");
    expect(body).toContain("[redacted]");
    expect(body).not.toMatch(/sk_live|a@b.com/);
    expect(ziinaProviderBodyLooksLikeMinimum(body)).toBe(true);
  });
});
