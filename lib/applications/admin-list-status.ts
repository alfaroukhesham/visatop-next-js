/**
 * Admin applications list status display + payment overlay.
 *
 * The list historically showed `application.paymentStatus` only. Fincra
 * checkouts persist `checkout_created` on the `payment` row when the customer
 * starts (but has not finished) paying. If the application row is still
 * `unpaid`, overlay the open payment status so the list matches ops reality.
 */

export const formatAdminListStatus = (value: string): string => {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
};

export type TAdminListPaymentStatusInput = {
  applicationPaymentStatus: string;
  latestPaymentStatus?: string | null;
};

export const resolveAdminListPaymentStatus = (
  input: TAdminListPaymentStatusInput,
): string => {
  if (input.applicationPaymentStatus === "paid") return "paid";
  if (input.latestPaymentStatus === "checkout_created") return "checkout_created";
  return input.applicationPaymentStatus;
};
