import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO,
  buildGadsCheckoutConversionParams,
  getGadsCheckoutConversionSendTo,
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
  it("defaults to the Checkout Completed send_to from Google Ads", () => {
    delete process.env.NEXT_PUBLIC_GADS_CHECKOUT_CONVERSION_SEND_TO;
    expect(getGadsCheckoutConversionSendTo()).toBe(
      "AW-17767633830/THfyCPCPh-wcEKanophC",
    );
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
  it("builds the Google Ads event payload with transaction id", () => {
    expect(
      buildGadsCheckoutConversionParams({
        transactionId: "app_123",
      }),
    ).toEqual({
      send_to: DEFAULT_GADS_CHECKOUT_CONVERSION_SEND_TO,
      value: 1.0,
      currency: "AED",
      transaction_id: "app_123",
    });
  });

  it("passes through a charged amount when provided", () => {
    expect(
      buildGadsCheckoutConversionParams({
        transactionId: "app_123",
        value: 399,
        currency: "USD",
      }),
    ).toMatchObject({
      value: 399,
      currency: "USD",
      transaction_id: "app_123",
    });
  });

  it("returns null without a transaction id so Ads cannot double-count blank ids", () => {
    expect(buildGadsCheckoutConversionParams({ transactionId: "  " })).toBeNull();
  });

  it("returns null when send_to is disabled", () => {
    expect(
      buildGadsCheckoutConversionParams({ transactionId: "app_123" }, ""),
    ).toBeNull();
  });
});
