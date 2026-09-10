import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import type { TCustomerMessageVars } from "@/lib/i18n/customer-messages";

/** Machine-readable checkout blockers returned in API `error.details.reason`. */
export type CheckoutBlockReason =
  | "checkout_in_progress"
  | "not_ready_for_payment"
  | "payments_origin_blocked"
  | "missing_guest_email"
  | "missing_passport"
  | "pricing_unavailable"
  | "provider_unavailable"
  | "unknown";

export type CheckoutApiErrorShape = {
  code?: string;
  message?: string;
  details?: { reason?: string; [key: string]: unknown };
};

export type TCheckoutTranslate = (key: string, vars?: TCustomerMessageVars) => string;

/**
 * Customer-facing copy for checkout failures (secure payment section).
 * Keeps technical detail out of the UI while remaining actionable.
 */
export const checkoutErrorToUserMessage = (
  err: CheckoutApiErrorShape | null | undefined,
  t: TCheckoutTranslate = createCustomerT("en"),
): string => {
  if (!err) return t("checkout.errors.genericStart");

  const reason = (err.details?.reason as CheckoutBlockReason | undefined) ?? inferReasonFromCode(err.code);

  switch (reason) {
    case "checkout_in_progress":
      return t("checkout.errors.checkoutInProgress");
    case "not_ready_for_payment":
      return t("checkout.errors.notReady");
    case "payments_origin_blocked":
      return t("checkout.errors.originBlocked");
    case "missing_guest_email":
      return t("checkout.errors.missingGuestEmail");
    case "missing_passport":
      return t("checkout.errors.missingPassport");
    case "pricing_unavailable":
      return t("checkout.errors.pricingUnavailable");
    case "provider_unavailable":
      return t("checkout.errors.providerUnavailable");
    case "unknown":
    default:
      if (err.code === "PAYMENT_PROVIDER_ERROR" || err.code === "ZIINA_UNAVAILABLE") {
        return checkoutErrorToUserMessage({ ...err, details: { reason: "provider_unavailable" } }, t);
      }
      if (err.message && !isGenericConflictMessage(err.message)) {
        return err.message;
      }
      return t("checkout.errors.refreshAndRetry");
  }
};

const inferReasonFromCode = (code: string | undefined): CheckoutBlockReason => {
  switch (code) {
    case "CONFLICT":
      return "unknown";
    case "PAYMENT_PROVIDER_ERROR":
      return "payments_origin_blocked";
    case "VALIDATION_ERROR":
      return "unknown";
    case "ZIINA_UNAVAILABLE":
    case "SERVICE_UNAVAILABLE":
      return "provider_unavailable";
    default:
      return "unknown";
  }
};

const isGenericConflictMessage = (message: string): boolean => {
  return /locked|not ready|already in progress/i.test(message);
};
