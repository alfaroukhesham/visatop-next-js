/**
 * Admin applications list status display + payment overlay.
 *
 * Fincra reconcile marks expired checkouts `payment.status = failed`
 * (`failure_code = expired`) and resets `application.paymentStatus` to
 * `unpaid`. Ziina keeps `checkout_created` until 24h. Ops still need both
 * to show as Checkout Created: the customer opened checkout and has not paid.
 * Overlay is display/list-query only — payment locks and retry are unchanged.
 */

export const formatAdminListStatus = (value: string): string => {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
};

/** Money-settled statuses that must not overlay as Checkout Created. */
export const ADMIN_LIST_SETTLED_PAYMENT_STATUSES = [
  "paid",
  "refunded",
  "refund_pending",
] as const;

/**
 * Card-processor declines we can tell apart from expiry/abandon.
 * Generic `failed` / missing codes stay Checkout Created.
 */
export const ADMIN_LIST_CARD_FAILURE_CODES = [
  "card_declined",
  "payment_failed",
  "declined",
] as const;

export type TAdminListPaymentStatusInput = {
  applicationPaymentStatus: string;
  latestPaymentStatus?: string | null;
  latestPaymentFailureCode?: string | null;
};

const isSettledPaymentStatus = (status: string | null | undefined): boolean =>
  Boolean(status && (ADMIN_LIST_SETTLED_PAYMENT_STATUSES as readonly string[]).includes(status));

const isDistinguishableCardFailure = (failureCode: string | null | undefined): boolean => {
  const code = failureCode?.trim().toLowerCase() ?? "";
  return (ADMIN_LIST_CARD_FAILURE_CODES as readonly string[]).includes(code);
};

/**
 * Latest payment row is a checkout the customer opened and has not settled.
 * Includes still-open sessions and Fincra/Ziina expiry-abandon (`failed` +
 * `expired`, or failed without a card-decline code).
 */
export const isAdminListCheckoutCreatedAttempt = (
  input: TAdminListPaymentStatusInput,
): boolean => {
  if (isSettledPaymentStatus(input.applicationPaymentStatus)) return false;
  const status = input.latestPaymentStatus?.trim() ?? "";
  if (!status || isSettledPaymentStatus(status)) return false;
  if (status === "failed" && isDistinguishableCardFailure(input.latestPaymentFailureCode)) {
    return false;
  }
  return true;
};

export const resolveAdminListPaymentStatus = (
  input: TAdminListPaymentStatusInput,
): string => {
  if (input.applicationPaymentStatus === "paid") return "paid";
  if (isSettledPaymentStatus(input.applicationPaymentStatus)) {
    return input.applicationPaymentStatus;
  }
  if (isAdminListCheckoutCreatedAttempt(input)) return "checkout_created";
  if (
    input.latestPaymentStatus === "failed" &&
    isDistinguishableCardFailure(input.latestPaymentFailureCode)
  ) {
    return "failed";
  }
  return input.applicationPaymentStatus;
};
