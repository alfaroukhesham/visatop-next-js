/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO,
  resetGadsCheckoutConversionClaims,
} from "@/lib/analytics/gads-checkout-conversion";
import {
  trackApplyPaymentCompleted,
  trackGadsCheckoutConversion,
} from "@/lib/analytics/gtag-client";

const paid = {
  applicationId: "app_123",
  value: 169,
  currency: "usd",
};

const setHostname = (hostname: string): void => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      hostname,
      pathname: "/visa-processing/apply/applications/app_123/submitted",
      origin: `https://${hostname}`,
      protocol: "https:",
      search: "",
    },
  });
};

const conversionCalls = (gtag: ReturnType<typeof vi.fn>): unknown[][] =>
  gtag.mock.calls.filter((call) => call[0] === "event" && call[1] === "conversion");

beforeEach(() => {
  resetGadsCheckoutConversionClaims();
  sessionStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  window.gtag = vi.fn();
  setHostname("visatop.com");
});

afterEach(() => {
  resetGadsCheckoutConversionClaims();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("trackGadsCheckoutConversion", () => {
  it("fires once with send_to, charged value, currency, and transaction_id", () => {
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toEqual([
      [
        "event",
        "conversion",
        {
          send_to: DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO,
          value: 169,
          currency: "USD",
          transaction_id: "app_123",
        },
      ],
    ]);
  });

  it("does not fire without a confirmed amount (pending / missing charge)", () => {
    trackGadsCheckoutConversion({ transactionId: paid.applicationId });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toEqual([]);
  });

  it("does not fire twice on reload of the same transaction", () => {
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toHaveLength(1);
  });

  it("is a no-op when marketing tags are gated off", () => {
    setHostname("app-staging.visatop.com");
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    setHostname("localhost");
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toEqual([]);
  });

  it("is a no-op when gtag is not loaded", () => {
    window.gtag = undefined;
    trackGadsCheckoutConversion({
      transactionId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    expect(window.gtag).toBeUndefined();
  });
});

describe("trackApplyPaymentCompleted", () => {
  it("fires Checkout Completed with the same transaction_id as GA4 purchase", () => {
    trackApplyPaymentCompleted({
      applicationId: paid.applicationId,
      paymentProvider: "ziina",
      value: paid.value,
      currency: paid.currency,
    });
    const gtag = window.gtag as ReturnType<typeof vi.fn>;
    expect(conversionCalls(gtag)).toEqual([
      [
        "event",
        "conversion",
        {
          send_to: DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO,
          value: 169,
          currency: "USD",
          transaction_id: "app_123",
        },
      ],
    ]);
    expect(gtag.mock.calls.some((call) => call[0] === "event" && call[1] === "purchase")).toBe(
      true,
    );
  });

  it("does not fire Ads conversion without a charged amount (Paddle overlay / pending)", () => {
    trackApplyPaymentCompleted({
      applicationId: paid.applicationId,
      paymentProvider: "paddle",
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toEqual([]);
  });

  it("does not fire Ads conversion twice when thank-you and return both run", () => {
    trackApplyPaymentCompleted({
      applicationId: paid.applicationId,
      value: paid.value,
      currency: "AED",
    });
    trackApplyPaymentCompleted({
      applicationId: paid.applicationId,
      value: paid.value,
      currency: "AED",
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toHaveLength(1);
  });

  it("does not fire Ads conversion on staging even with a paid payload", () => {
    setHostname("app-staging.visatop.com");
    trackApplyPaymentCompleted({
      applicationId: paid.applicationId,
      value: paid.value,
      currency: paid.currency,
    });
    expect(conversionCalls(window.gtag as ReturnType<typeof vi.fn>)).toEqual([]);
  });
});
