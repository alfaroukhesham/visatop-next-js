export const APPLICATION_STATUSES = [
  "draft",
  "needs_docs",
  "extracting",
  "needs_review",
  "ready_for_payment",
  "in_progress",
  "awaiting_authority",
  "completed",
  /** UAE authorities declined the visa (distinct from user/service cancellation). */
  "rejection_by_uae_authorities",
  "cancelled",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const TERMINAL_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  "completed",
  "rejection_by_uae_authorities",
  "cancelled",
]);

/** Post-payment statuses where admin may set ops step / uploads / terminal outcomes. */
export const ADMIN_WORKFLOW_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  "in_progress",
  "awaiting_authority",
]);

export const PAYMENT_STATUSES = [
  "unpaid", "checkout_created", "paid", "refund_pending", "refunded", "failed"
] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const FULFILLMENT_STATUSES = [
  "not_started", "automation_running", "manual_in_progress", 
  "ready_for_ops_payment", "submitted", "done"
] as const;
export type FulfillmentStatus = typeof FULFILLMENT_STATUSES[number];

export const CHECKOUT_STATES = ["none", "pending"] as const;
export type CheckoutState = typeof CHECKOUT_STATES[number];
