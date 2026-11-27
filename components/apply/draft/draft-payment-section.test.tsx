/** @vitest-environment jsdom */

import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicApplication } from "@/lib/applications/public-application";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => {
    const map: Record<string, string> = {
      "payment.previous": "Previous",
      "payment.initiatePaymentTitle": "Pay",
      "pay.payNowIncomplete": "Pay now",
      "checkout.errors.termsRequired": "Please agree to VisaTop's Terms of Use before paying.",
      "payment.termsAgree": "I agree to VisaTop's {link}",
      "payment.termsLink": "Terms of Use",
    };
    return map[key] ?? key;
  },
  useCustomerLocale: () => "en",
}));

vi.mock("../paddle-checkout-button", () => ({
  PaddleCheckoutButton: ({
    describedBy,
    onTermsRejected,
  }: {
    describedBy?: string | null;
    onTermsRejected?: () => void;
  }) => (
    <button type="button" aria-describedby={describedBy ?? undefined} onClick={() => onTermsRejected?.()}>
      Proceed to payment
    </button>
  ),
}));

import { CHECKOUT_TERMS_CHECKBOX_ID, CHECKOUT_TERMS_ERROR_ID } from "../checkout-terms-checkbox";
import { DraftPaymentSection } from "./draft-payment-section";

const app = {
  paymentStatus: "unpaid",
  checkoutOffer: null,
  applicant: { fullName: "", dateOfBirth: "", passportNumber: "" },
} as PublicApplication;

const checkout = {
  onZiinaEmbedded: vi.fn(),
  onFincraInline: vi.fn(),
  onFincraRedirect: vi.fn(),
  onFincraCompleted: vi.fn(),
  onFincraClosed: vi.fn(),
  onZiinaCompleted: vi.fn(),
  onZiinaFailed: vi.fn(),
  onZiinaCanceled: vi.fn(),
  onOverlayClosed: vi.fn(),
  onSuccess: vi.fn(),
  onStartCheckoutTimer: vi.fn(),
  onError: vi.fn(),
};

const Harness = () => {
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  return (
    <DraftPaymentSection
      applicationId="app-1"
      app={app}
      paymentReadiness="ready"
      requiredSlotKeys={[]}
      uploadedTypes={[]}
      countdown={null}
      checkoutError={null}
      onDismissCheckoutError={() => undefined}
      onCancelCheckout={() => undefined}
      checkout={checkout}
      embeddedUrl={null}
      fincraInline={null}
      confirming={false}
      sessionLoading={false}
      showPaddleRetry={false}
      termsAccepted={termsAccepted}
      onTermsAcceptedChange={setTermsAccepted}
      termsError={termsError}
      onTermsError={setTermsError}
    />
  );
};

describe("DraftPaymentSection terms error", () => {
  afterEach(() => {
    cleanup();
  });

  it("focuses the checkbox, describes the pay button, and re-announces a repeat click", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<Harness />);
    const pay = screen.getByRole("button", { name: /proceed to payment/i });
    await user.click(pay);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    const checkbox = document.getElementById(CHECKOUT_TERMS_CHECKBOX_ID);
    expect(checkbox).toHaveFocus();
    const firstAlert = screen.getByRole("alert");
    expect(firstAlert).toHaveTextContent(/terms of use/i);
    expect(pay).toHaveAttribute("aria-describedby", CHECKOUT_TERMS_ERROR_ID);
    await user.click(pay);
    expect(screen.getByRole("alert")).not.toBe(firstAlert);
    expect(document.getElementById(CHECKOUT_TERMS_CHECKBOX_ID)).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    focus.mockRestore();
    delete HTMLElement.prototype.scrollIntoView;
  });
});
