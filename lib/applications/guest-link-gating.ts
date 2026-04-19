export type GatingInput = {
  paymentStatus: string;
  applicationStatus: string;
  userId: string | null;
  isGuest?: boolean;
  adminAttentionRequired?: boolean;
};

/**
 * Blocked for guest link per spec §5 — literal strings must stay aligned with
 * `PAYMENT_STATUSES` (`refund_pending`, `refunded`, `failed`).
 */
const BLOCKED_PAYMENT = new Set<string>(["refund_pending", "refunded", "failed"]);

export function canMintGuestLinkIntent(
  row: GatingInput,
): { ok: true } | { ok: false; reason: string } {
  if (row.userId != null) return { ok: false, reason: "not_guest_unclaimed" };
  if (row.isGuest === false) return { ok: false, reason: "not_guest_row" };
  if (BLOCKED_PAYMENT.has(row.paymentStatus)) return { ok: false, reason: "payment_blocked" };
  if (row.paymentStatus !== "paid") return { ok: false, reason: "intent_requires_paid" };
  if (row.applicationStatus === "cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true };
}

/** Matrix-only for rows where `user_id` IS NULL` (unclaimed guest). Caller handles D3 / claimed rows. */
export function guestLinkMatrixAllowsLink(
  row: GatingInput,
): { ok: true } | { ok: false; reason: string } {
  if (row.userId != null) return { ok: false, reason: "not_unclaimed" };
  if (BLOCKED_PAYMENT.has(row.paymentStatus)) return { ok: false, reason: "payment_blocked" };
  if (row.paymentStatus !== "paid") return { ok: false, reason: "link_requires_paid" };
  if (row.applicationStatus === "cancelled") return { ok: false, reason: "cancelled" };
  return { ok: true };
}
