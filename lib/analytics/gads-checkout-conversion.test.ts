import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGadsCheckoutConversionParams,
  claimGadsCheckoutConversionOnce,
  getGadsCheckoutConversionSendTo,
  resetGadsCheckoutConversionClaims,
} from "@/lib/analytics/gads-checkout-conversion";

const originalSendTo = process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO;

afterEach(() => {
  if (originalSendTo === undefined) {
    delete process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO;
  } else {
    process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO = originalSendTo;
  }
});

describe("getGadsCheckoutConversionSendTo", () => {
  it("has no hardcoded Ads label when the env var is unset", () => {
    delete process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO;
    expect(getGadsCheckoutConversionSendTo()).toBe("");
  });

  it("uses the env override when set", () => {
    process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO = "AW-1/custom";
    expect(getGadsCheckoutConversionSendTo()).toBe("AW-1/custom");
  });

  it("disables tracking when the env override is empty", () => {
    process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO = "";
    expect(getGadsCheckoutConversionSendTo()).toBe("");
  });
});

describe("buildGadsCheckoutConversionParams", () => {
  it("builds the Google Ads event payload from the charged amount", () => {
    expect(
      buildGadsCheckoutConversionParams(
        {
          transactionId: "app_123",
          value: 399,
          currency: "usd",
        },
        "AW-TEST/label",
      ),
    ).toEqual({
      send_to: "AW-TEST/label",
      value: 399,
      currency: "USD",
      transaction_id: "app_123",
    });
  });

  it("does not invent 1.0 or AED when amount or currency is missing", () => {
    expect(buildGadsCheckoutConversionParams({ transactionId: "app_123" })).toBeNull();
    expect(
      buildGadsCheckoutConversionParams({ transactionId: "app_123", currency: "USD" }),
    ).toBeNull();
    expect(
      buildGadsCheckoutConversionParams({ transactionId: "app_123", value: 10 }),
    ).toBeNull();
  });

  it("returns null without a transaction id so Ads cannot double-count blank ids", () => {
    expect(
      buildGadsCheckoutConversionParams({
        transactionId: "  ",
        value: 10,
        currency: "USD",
      }),
    ).toBeNull();
  });

  it("returns null when send_to is disabled", () => {
    expect(
      buildGadsCheckoutConversionParams({ transactionId: "app_123", value: 10, currency: "USD" }, ""),
    ).toBeNull();
  });
});

describe("claimGadsCheckoutConversionOnce", () => {
  afterEach(() => {
    resetGadsCheckoutConversionClaims();
  });

  it("allows the first claim and blocks repeats for the same transaction id", () => {
    expect(claimGadsCheckoutConversionOnce("app_123")).toBe(true);
    expect(claimGadsCheckoutConversionOnce("app_123")).toBe(false);
    expect(claimGadsCheckoutConversionOnce("app_456")).toBe(true);
  });
});

describe("checkout conversion call sites", () => {
  const root = process.cwd();
  const paymentCallers = [
    "components/apply/paddle-checkout-button.tsx",
    "components/apply/submitted-application-client.tsx",
    "app/(client)/apply/applications/[id]/checkout/return/checkout-return-client.tsx",
  ];

  it("routes paid conversions through trackApplyPaymentCompleted, not a raw send_to", () => {
    for (const rel of paymentCallers) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).toContain("trackApplyPaymentCompleted");
      expect(src, rel).not.toContain("trackGadsCheckoutConversion");
      expect(src, rel).not.toContain("THfyCPCPh-wcEKanophC");
    }
  });

  it("does not embed a production Ads conversion label in client source", () => {
    const files = [
      "lib/analytics/gads-checkout-conversion.ts",
      "lib/analytics/gtag-client.ts",
    ];
    for (const rel of files) {
      const src = readFileSync(join(root, rel), "utf8");
      expect(src, rel).not.toContain("THfyCPCPh-wcEKanophC");
    }
  });

  it("gates the tracker on the production marketing host before gtag conversion", () => {
    const src = readFileSync(join(root, "lib/analytics/gtag-client.ts"), "utf8");
    const tracker = src.slice(src.indexOf("export const trackGadsCheckoutConversion"));
    expect(tracker).toContain("areMarketingTagsEnabledInBrowser()");
    expect(tracker.indexOf("areMarketingTagsEnabledInBrowser()")).toBeLessThan(
      tracker.indexOf('window.gtag("event", "conversion"'),
    );
  });
});
