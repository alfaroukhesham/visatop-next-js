/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/client/customer-i18n-provider", () => ({
  useCustomerT: () => (key: string) => {
    const map: Record<string, string> = {
      "payment.termsAgree": "I agree to VisaTop's {link}",
      "payment.termsLink": "Terms of Use",
      "checkout.errors.termsRequired": "Please agree to VisaTop's Terms of Use before paying.",
    };
    return map[key] ?? key;
  },
}));

import { CheckoutTermsCheckbox } from "./checkout-terms-checkbox";
import { TERMS_OF_USE_URL } from "@/lib/legal/terms";

describe("CheckoutTermsCheckbox", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts unticked and associates the label with the control", () => {
    render(
      <CheckoutTermsCheckbox checked={false} onCheckedChange={() => undefined} error={null} />,
    );
    const box = screen.getByRole("checkbox", { name: /i agree to visatop's terms of use/i });
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute("id", "checkout-terms-accepted");
  });

  it("opens Terms of Use in a new tab", () => {
    render(
      <CheckoutTermsCheckbox checked={false} onCheckedChange={() => undefined} error={null} />,
    );
    const link = screen.getByRole("link", { name: "Terms of Use" });
    expect(link).toHaveAttribute("href", TERMS_OF_USE_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("toggles via the keyboard-accessible checkbox", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <CheckoutTermsCheckbox checked={false} onCheckedChange={onCheckedChange} error={null} />,
    );
    await user.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("announces an error when payment is attempted without agreement", () => {
    render(
      <CheckoutTermsCheckbox
        checked={false}
        onCheckedChange={() => undefined}
        error="Please agree to VisaTop's Terms of Use before paying."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/terms of use/i);
  });
});
