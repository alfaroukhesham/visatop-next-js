/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => {
    const map: Record<string, string> = {
      "payment.payAndSubmit": "Pay & Submit Application",
      "payment.preparingCheckout": "Preparing Secure Checkout...",
      "checkout.errors.termsRequired": "Please agree to VisaTop's Terms of Use before paying.",
      "checkout.errors.failedDot": "Checkout failed.",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: vi.fn(),
  CheckoutEventNames: {
    CHECKOUT_COMPLETED: "checkout.completed",
    CHECKOUT_UPDATED: "checkout.updated",
    CHECKOUT_CLOSED: "checkout.closed",
    CHECKOUT_ERROR: "checkout.error",
    CHECKOUT_FAILED: "checkout.failed",
    CHECKOUT_PAYMENT_FAILED: "checkout.payment.failed",
    CHECKOUT_PAYMENT_ERROR: "checkout.payment.error",
  },
  CheckoutEventsStatus: {
    COMPLETED: "completed",
    PAID: "paid",
    BILLED: "billed",
  },
}));

import { PaddleCheckoutButton } from "./paddle-checkout-button";

describe("PaddleCheckoutButton terms gate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not call checkout when Terms are unticked", async () => {
    const user = userEvent.setup();
    const onTermsRejected = vi.fn();
    render(
      <PaddleCheckoutButton
        applicationId="app-1"
        termsAccepted={false}
        onTermsRejected={onTermsRejected}
      />,
    );
    await user.click(screen.getByRole("button", { name: /pay & submit/i }));
    expect(onTermsRejected).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("POSTs termsAccepted: true once Terms are ticked", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: { code: "CONFLICT", message: "stop" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(<PaddleCheckoutButton applicationId="app-1" termsAccepted onError={() => undefined} />);
    await user.click(screen.getByRole("button", { name: /pay & submit/i }));
    expect(fetch).toHaveBeenCalledTimes(1);
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      applicationId: "app-1",
      termsAccepted: true,
    });
  });
});
