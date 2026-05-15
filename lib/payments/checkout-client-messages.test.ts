import { describe, expect, it } from "vitest";
import { checkoutErrorToUserMessage } from "./checkout-client-messages";

describe("checkoutErrorToUserMessage", () => {
  it("maps checkout_in_progress", () => {
    const msg = checkoutErrorToUserMessage({
      code: "CONFLICT",
      details: { reason: "checkout_in_progress" },
    });
    expect(msg).toMatch(/already have a payment session/i);
    expect(msg).toMatch(/Cancel & Reset/i);
  });

  it("maps not_ready_for_payment", () => {
    const msg = checkoutErrorToUserMessage({
      code: "CONFLICT",
      details: { reason: "not_ready_for_payment" },
    });
    expect(msg).toMatch(/isn't ready for payment/i);
  });

  it("maps payments_origin_blocked", () => {
    const msg = checkoutErrorToUserMessage({
      code: "PAYMENT_PROVIDER_ERROR",
      details: { reason: "payments_origin_blocked" },
    });
    expect(msg).toMatch(/localhost|https/i);
  });

  it("ignores generic conflict server message", () => {
    const msg = checkoutErrorToUserMessage({
      code: "CONFLICT",
      message: "Application locked, not ready, or checkout already in progress",
      details: { reason: "checkout_in_progress" },
    });
    expect(msg).not.toMatch(/Application locked/);
  });
});
