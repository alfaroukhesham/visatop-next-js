import { describe, expect, it } from "vitest";
import { fincraCheckoutUrlFromPayCode, isTrustedFincraCheckoutUrl } from "./fincra-embedded";

describe("isTrustedFincraCheckoutUrl", () => {
  it("accepts https checkout.fincra.com", () => {
    expect(isTrustedFincraCheckoutUrl("https://checkout.fincra.com/pay/fcr-p-abc")).toBe(true);
    expect(isTrustedFincraCheckoutUrl("https://pay.checkout.fincra.com/x")).toBe(true);
  });

  it("rejects http and foreign hosts", () => {
    expect(isTrustedFincraCheckoutUrl("http://checkout.fincra.com/pay/x")).toBe(false);
    expect(isTrustedFincraCheckoutUrl("https://evil.example/checkout.fincra.com")).toBe(false);
    expect(isTrustedFincraCheckoutUrl("not-a-url")).toBe(false);
  });
});

describe("fincraCheckoutUrlFromPayCode", () => {
  it("builds the hosted pay URL", () => {
    expect(fincraCheckoutUrlFromPayCode("fcr-p-abc")).toBe("https://checkout.fincra.com/pay/fcr-p-abc");
  });
});
