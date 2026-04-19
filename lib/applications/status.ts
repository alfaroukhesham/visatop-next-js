export const APPLICATION_STATUS = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  IN_REVIEW: "in_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;
export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PENDING: "pending",
  PAID: "paid",
  REFUNDED: "refunded",
  FAILED: "failed",
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const FULFILLMENT_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  FAILED: "failed",
} as const;
export type FulfillmentStatus =
  (typeof FULFILLMENT_STATUS)[keyof typeof FULFILLMENT_STATUS];

/** Nullable checkout-freeze gate on `application.checkout_state`. */
export const CHECKOUT_STATE = {
  NONE: "none",
  PENDING: "pending",
} as const;
export type CheckoutState = (typeof CHECKOUT_STATE)[keyof typeof CHECKOUT_STATE];
