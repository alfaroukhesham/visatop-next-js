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

const trackEventOnce = vi.fn();
vi.mock("@/lib/analytics/gtag-client", () => ({
  trackEventOnce: (...args: unknown[]) => trackEventOnce(...args),
  trackApplyPaymentCompleted: vi.fn(),
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

import {
  rememberCheckoutRecapTotal,
  resetCheckoutRecapTotal,
} from "@/lib/analytics/checkout-recap-total";
import { PaddleCheckoutButton } from "./paddle-checkout-button";

describe("PaddleCheckoutButton terms gate", () => {
  beforeEach(() => {
    trackEventOnce.mockReset();
    resetCheckoutRecapTotal();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    resetCheckoutRecapTotal();
    vi.unstubAllGlobals();
  });

  it("does not call checkout when Terms are unticked", async () => {
    const onTermsRejected = vi.fn();
    render(
      <PaddleCheckoutButton
        applicationId="app-1"
        termsAccepted={false}
        onTermsRejected={onTermsRejected}
      />,
    );
    expect(screen.getByRole("button", { name: /pay & submit/i })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
    expect(onTermsRejected).not.toHaveBeenCalled();
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

  it("keeps Fincra checkout on-page when the API returns mode inline", async () => {
    const user = userEvent.setup();
    const onFincraInline = vi.fn();
    const onFincraRedirect = vi.fn();
    const inline = {
      provider: "fincra" as const,
      mode: "inline" as const,
      key: "pk_test",
      amount: 185000,
      currency: "NGN" as const,
      customer: { name: "Ada", email: "ada@example.com" },
      reference: "pay_1",
      feeBearer: "business" as const,
      metadata: { paymentId: "pay_1" },
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: inline }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(
      <PaddleCheckoutButton
        applicationId="app-1"
        termsAccepted
        onFincraInline={onFincraInline}
        onFincraRedirect={onFincraRedirect}
      />,
    );
    await user.click(screen.getByRole("button", { name: /pay & submit/i }));
    expect(onFincraInline).toHaveBeenCalledWith(inline);
    expect(onFincraRedirect).not.toHaveBeenCalled();
    expect(trackEventOnce).toHaveBeenCalledWith(
      "apply_payment_started",
      expect.objectContaining({
        application_id: "app-1",
        payment_provider: "fincra",
        value: 185000,
        currency: "NGN",
      }),
      "apply_payment_started:app-1:fincra",
    );
    expect(trackEventOnce.mock.calls.some((call) => call[0] === "purchase")).toBe(false);
  });

  it("sends Ziina apply_payment_started with the recap total and no Purchase", async () => {
    const user = userEvent.setup();
    rememberCheckoutRecapTotal({
      applicationId: "app-1",
      value: 169,
      currency: "AED",
      nationality: "IN",
      serviceId: "svc_1",
    });
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ ok: true, data: { provider: "ziina", embeddedUrl: "https://pay.ziina.com/x" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(
      <PaddleCheckoutButton
        applicationId="app-1"
        termsAccepted
        onZiinaEmbedded={() => undefined}
      />,
    );
    await user.click(screen.getByRole("button", { name: /pay & submit/i }));
    expect(trackEventOnce).toHaveBeenCalledWith(
      "apply_payment_started",
      {
        application_id: "app-1",
        payment_provider: "ziina",
        nationality: "IN",
        service_id: "svc_1",
        value: 169,
        currency: "AED",
      },
      "apply_payment_started:app-1:ziina",
    );
    expect(trackEventOnce.mock.calls.some((call) => call[0] === "purchase")).toBe(false);
  });
});
