export const APPLICATION_STATUSES = [
  "draft", "needs_docs", "extracting", "needs_review", 
  "ready_for_payment", "in_progress", "awaiting_authority", 
  "completed", "cancelled"
] as const;
export type ApplicationStatus = typeof APPLICATION_STATUSES[number];

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
