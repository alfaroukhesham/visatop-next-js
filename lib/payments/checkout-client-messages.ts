/** Machine-readable checkout blockers returned in API `error.details.reason`. */
export type CheckoutBlockReason =
  | "checkout_in_progress"
  | "not_ready_for_payment"
  | "payments_origin_blocked"
  | "missing_guest_email"
  | "pricing_unavailable"
  | "provider_unavailable"
  | "unknown";

export type CheckoutApiErrorShape = {
  code?: string;
  message?: string;
  details?: { reason?: string; [key: string]: unknown };
};

/**
 * Customer-facing copy for checkout failures (secure payment section).
 * Keeps technical detail out of the UI while remaining actionable.
 */
export function checkoutErrorToUserMessage(err: CheckoutApiErrorShape | null | undefined): string {
  if (!err) return "We couldn't start checkout. Please try again in a moment.";

  const reason = (err.details?.reason as CheckoutBlockReason | undefined) ?? inferReasonFromCode(err.code);

  switch (reason) {
    case "checkout_in_progress":
      return (
        "You already have a payment session open for this application. " +
        "Use Complete your payment below to continue, or choose Cancel & Reset to start over."
      );
    case "not_ready_for_payment":
      return (
        "This application isn't ready for payment yet. Refresh the page—if you just saved your details, wait a moment and try again."
      );
    case "payments_origin_blocked":
      return (
        "Payments can't be started from this address (for example localhost without HTTPS). " +
        "Use the published https link for this site, or ask your developer to enable local payment testing."
      );
    case "missing_guest_email":
      return "Add your email on the visa selection step before paying.";
    case "pricing_unavailable":
      return "We couldn't load a price for this visa right now. Refresh the page or contact support if it continues.";
    case "provider_unavailable":
      return "Our payment partner is temporarily unavailable. Please try again in a few minutes.";
    case "unknown":
    default:
      if (err.code === "PAYMENT_PROVIDER_ERROR" || err.code === "ZIINA_UNAVAILABLE") {
        return checkoutErrorToUserMessage({ ...err, details: { reason: "provider_unavailable" } });
      }
      if (err.message && !isGenericConflictMessage(err.message)) {
        return err.message;
      }
      return "We couldn't start checkout. Please refresh the page and try again.";
  }
}

function inferReasonFromCode(code: string | undefined): CheckoutBlockReason {
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
}

function isGenericConflictMessage(message: string): boolean {
  return /locked|not ready|already in progress/i.test(message);
}
