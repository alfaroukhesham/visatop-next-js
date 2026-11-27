"use client";

import type { FC } from "react";
import { AlertTriangle } from "lucide-react";
import { useCustomerT } from "@/components/client/customer-i18n-provider";
import { TERMS_OF_USE_URL } from "@/lib/legal/terms";

export const CHECKOUT_TERMS_CHECKBOX_ID = "checkout-terms-accepted";
export const CHECKOUT_TERMS_ERROR_ID = "checkout-terms-error";

interface ICheckoutTermsCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  error: string | null;
  /** Bumps when the same error must be announced again. */
  errorKey?: number;
}

export const CheckoutTermsCheckbox: FC<ICheckoutTermsCheckboxProps> = ({
  checked,
  onCheckedChange,
  error,
  errorKey = 0,
}) => {
  const t = useCustomerT();
  const [beforeLink, afterLink] = t("payment.termsAgree").split("{link}");
  const showError = Boolean(error);

  return (
    <div className="space-y-2">
      <label
        htmlFor={CHECKOUT_TERMS_CHECKBOX_ID}
        className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed"
      >
        <input
          id={CHECKOUT_TERMS_CHECKBOX_ID}
          type="checkbox"
          className="accent-primary mt-1 size-4 shrink-0"
          checked={checked}
          onChange={(event) => onCheckedChange(event.target.checked)}
          aria-invalid={showError}
          aria-describedby={showError ? CHECKOUT_TERMS_ERROR_ID : undefined}
        />
        <span>
          {beforeLink}
          <a
            href={TERMS_OF_USE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary underline underline-offset-2"
            onClick={(event) => event.stopPropagation()}
          >
            {t("payment.termsLink")}
          </a>
          {afterLink}
        </span>
      </label>
      {showError ? (
        <p
          key={errorKey}
          id={CHECKOUT_TERMS_ERROR_ID}
          role="alert"
          className="text-destructive flex items-start gap-2 text-sm leading-relaxed"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
};
