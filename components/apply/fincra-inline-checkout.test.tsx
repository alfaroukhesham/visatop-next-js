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
import type { TFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";

const checkoutFor = (reference: string): TFincraInlineCheckoutData => ({
  provider: "fincra",
  mode: "inline",
  key: "pk_test",
  amount: 185000,
  currency: "NGN",
  customer: { name: "Ada", email: "ada@example.com" },
  reference,
  feeBearer: "business",
  metadata: { paymentId: reference },
});

describe("FincraInlineCheckout", () => {
  beforeEach(() => {
    initialize.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("opens the inline popup with server-computed values and lets the user retry after close", async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    const onClosed = vi.fn();
    initialize.mockImplementation((options: { onClose: () => void }) => {
      options.onClose();
    });

    render(
      <FincraInlineCheckout
        checkout={checkoutFor("pay_inline_retry")}
        applicationId="app-1"
        onCompleted={onCompleted}
        onClosed={onClosed}
        onHostedRedirect={() => undefined}
        onError={() => undefined}
      />,
    );

    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(initialize.mock.calls[0]?.[0]).toMatchObject({
      key: "pk_test",
      amount: 185000,
      currency: "NGN",
      reference: "pay_inline_retry",
    });
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(screen.getByText("Payment window closed.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /continue payment/i }));
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
  });
});
