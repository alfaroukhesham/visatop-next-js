import { describe, expect, it } from "vitest";
import { paymentProviderLabel } from "./provider-label";

describe("paymentProviderLabel", () => {
  it("title-cases known providers", () => {
    expect(paymentProviderLabel("ziina")).toBe("Ziina");
    expect(paymentProviderLabel("FINCRA")).toBe("Fincra");
    expect(paymentProviderLabel("paddle")).toBe("Paddle");
  });

  it("falls back to VisaTop when empty", () => {
    expect(paymentProviderLabel(null)).toBe("VisaTop");
    expect(paymentProviderLabel("")).toBe("VisaTop");
  });
});
