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
  isGuest: boolean;
  guestResumeReady: boolean;
  applicationStatus: string;
  paymentStatus: string;
  latestPaymentStatus: string | null;
  checkoutAttempt: boolean;
  checkoutCreatedAt: Date | null;
  alreadySent: boolean;
};

export type TCheckoutRecoveryWindows = {
  delayMs: number;
  maxAgeMs: number;
};

export type TCheckoutRecoveryDecision =
  | { action: "send" }
  | { action: "skip"; reason: string };

export const decideCheckoutRecoveryEmail = (
  candidate: TCheckoutRecoveryCandidate,
  windows: TCheckoutRecoveryWindows,
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
  if (candidate.isGuest && !candidate.guestResumeReady) {
    return { action: "skip", reason: "guest_resume_unavailable" };
  }
  // Still-open checkout only — reconciled failed/expired (app back to unpaid) must not get Complete payment.
  if (
    candidate.paymentStatus !== "checkout_created" ||
    candidate.latestPaymentStatus !== "checkout_created"
  ) {
    return { action: "skip", reason: "checkout_not_open" };
  }
  // TODO: generic same-day continue / next-day tips / travel reminder — checkout-only for now.
  if (!candidate.checkoutAttempt) return { action: "skip", reason: "not_checkout_created" };
  if (!candidate.checkoutCreatedAt) {
    return { action: "skip", reason: "checkout_missing_timestamp" };
  }
  const ageMs = now.getTime() - candidate.checkoutCreatedAt.getTime();
  if (ageMs < windows.delayMs) return { action: "skip", reason: "checkout_delay" };
  if (ageMs > windows.maxAgeMs) return { action: "skip", reason: "checkout_too_old" };
  return { action: "send" };
};
