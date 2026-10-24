/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initialize = vi.fn();

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => {
    const map: Record<string, string> = {
      "payment.preparingCheckout": "Preparing Secure Checkout...",
      "payment.completeInWidget": "Complete your payment in the window.",
      "payment.fincraWindowClosed": "Payment window closed.",
      "payment.continueFincraPayment": "Continue payment",
      "checkout.confirmingWithServers": "Confirming with our servers…",
      "checkout.errors.failedDot": "Checkout failed.",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/lib/payments/fincra-inline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/fincra-inline")>("@/lib/payments/fincra-inline");
  return {
    ...actual,
    loadFincraInlineScript: vi.fn(async () => ({ initialize })),
  };
});

import { FincraInlineCheckout } from "./fincra-inline-checkout";
import { resetFincraInlineWidgetLockForTests, type TFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";

const checkoutFor = (reference: string): TFincraInlineCheckoutData => ({
  provider: "fincra",
  mode: "inline",
  key: "pk_test",
  amount: 185000,
  currency: "NGN",
  customer: { name: "Ada", email: "ada@mail.com" },
  reference,
  feeBearer: "business",
  metadata: { paymentId: "pay_inline_retry" },
});

describe("FincraInlineCheckout", () => {
  beforeEach(() => {
    initialize.mockReset();
    resetFincraInlineWidgetLockForTests();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    resetFincraInlineWidgetLockForTests();
  });

  it("opens the inline popup with server-computed values and paymentMethods", async () => {
    initialize.mockImplementation(() => undefined);

    render(
      <FincraInlineCheckout
        checkout={checkoutFor("pay_inline_retry-a1")}
        applicationId="app-1"
        onCompleted={() => undefined}
        onClosed={() => undefined}
        onHostedRedirect={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize.mock.calls[0]?.[0]).toMatchObject({
      key: "pk_test",
      amount: 185000,
      currency: "NGN",
      reference: "pay_inline_retry-a1",
      paymentMethods: ["card", "bank_transfer"],
    });
    expect(screen.getByRole("button", { name: /continue payment/i })).toBeDisabled();
  });

  it("POSTs /checkout for a fresh session after close instead of reusing the old reference", async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    const onClosed = vi.fn();
    const onSession = vi.fn();
    initialize.mockImplementation((options: { onClose: () => void }) => {
      options.onClose();
    });
    const nextCheckout = checkoutFor("pay_inline_retry-a2");
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: nextCheckout }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const view = render(
      <FincraInlineCheckout
        checkout={checkoutFor("pay_inline_retry-a1")}
        applicationId="app-1"
        onCompleted={onCompleted}
        onClosed={onClosed}
        onSession={onSession}
        onHostedRedirect={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize.mock.calls[0]?.[0]).toMatchObject({ reference: "pay_inline_retry-a1" });
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Payment window closed.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /continue payment/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      applicationId: "app-1",
      termsAccepted: true,
    });
    await waitFor(() => expect(onSession).toHaveBeenCalledWith(nextCheckout));
    expect(initialize).toHaveBeenCalledTimes(1);

    view.rerender(
      <FincraInlineCheckout
        checkout={nextCheckout}
        applicationId="app-1"
        onCompleted={onCompleted}
        onClosed={onClosed}
        onSession={onSession}
        onHostedRedirect={() => undefined}
        onError={() => undefined}
      />,
    );
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
    expect(initialize.mock.calls[1]?.[0]).toMatchObject({ reference: "pay_inline_retry-a2" });
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
