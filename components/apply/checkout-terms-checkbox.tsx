"use client";

import type { FC } from "react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { TERMS_OF_USE_URL } from "@/lib/legal/terms";

const CHECKBOX_ID = "checkout-terms-accepted";
const ERROR_ID = "checkout-terms-error";

interface ICheckoutTermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error: string | null;
}

export const CheckoutTermsCheckbox: FC<ICheckoutTermsCheckboxProps> = ({
  checked,
  onCheckedChange,
  error,
}) => {
  const t = useCustomerT();
  const [beforeLink, afterLink] = t("payment.termsAgree").split("{link}");
  const showError = Boolean(error);

  return (
    <div className="space-y-2">
      <label
        htmlFor={CHECKBOX_ID}
        className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed"
      >
        <input
          id={CHECKBOX_ID}
          type="checkbox"
          className="accent-primary mt-1 size-4 shrink-0"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-invalid={showError}
          aria-describedby={showError ? ERROR_ID : undefined}
        />
        <span>
          {beforeLink}
          <a
            href={TERMS_OF_USE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            {t("payment.termsLink")}
          </a>
          {afterLink}
        </span>
      </label>
      {showError ? (
        <p id={ERROR_ID} role="alert" className="text-destructive text-sm leading-relaxed">
          {error}
        </p>
      ) : null}
    </div>
  );
};
