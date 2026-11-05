import { TRANSACTIONAL_EMAIL_KINDS } from "@/lib/email/transactional-email-kinds";

export const CHECKOUT_RECOVERY_KIND = TRANSACTIONAL_EMAIL_KINDS.RECOVERY_CHECKOUT;

const SETTLED_PAYMENT_STATUSES = new Set(["paid", "refunded", "refund_pending"]);

const SKIP_APPLICATION_STATUSES = new Set([
  "cancelled",
  "completed",
  "rejection_by_uae_authorities",
  "in_progress",
  "awaiting_authority",
]);

export type TCheckoutRecoveryCandidate = {
  hasEmail: boolean;
  applicationStatus: string;
  paymentStatus: string;
  checkoutAttempt: boolean;
  checkoutCreatedAt: Date | null;
  alreadySent: boolean;
};

export type TCheckoutRecoveryDecision =
  | { action: "send" }
  | { action: "skip"; reason: string };

export const decideCheckoutRecoveryEmail = (
  candidate: TCheckoutRecoveryCandidate,
  delayMs: number,
  now: Date,
): TCheckoutRecoveryDecision => {
  if (!candidate.hasEmail) return { action: "skip", reason: "no_email" };
  if (SETTLED_PAYMENT_STATUSES.has(candidate.paymentStatus)) {
    return { action: "skip", reason: "settled_payment" };
  }
  if (SKIP_APPLICATION_STATUSES.has(candidate.applicationStatus)) {
    return {
      action: "skip",
      reason: candidate.applicationStatus === "cancelled" ? "cancelled" : "converted",
    };
  }
  if (candidate.alreadySent) return { action: "skip", reason: "already_sent" };
  // TODO: generic same-day continue / next-day tips / travel reminder — checkout-only for now.
  if (!candidate.checkoutAttempt) return { action: "skip", reason: "not_checkout_created" };
  if (!candidate.checkoutCreatedAt) {
    return { action: "skip", reason: "checkout_missing_timestamp" };
  }
  if (now.getTime() < candidate.checkoutCreatedAt.getTime() + delayMs) {
    return { action: "skip", reason: "checkout_delay" };
  }
  return { action: "send" };
};
