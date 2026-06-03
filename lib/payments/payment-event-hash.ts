import crypto from "node:crypto";

export type PaymentEventHashProvider = "paddle" | "ziina";

/**
 * Dedupe key for `payment_event.payload_hash` (spec §5.3).
 * `rawBody` must be the exact webhook POST body string used for signature verification.
 */
export function computePaymentEventPayloadHash(
  provider: PaymentEventHashProvider,
  rawBody: string,
): string {
  const input = `${provider}\n${rawBody}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Idempotency key for scheduled Ziina reconcile probes (5m / 10m / 15m / return). */
export function computeZiinaReconcilePayloadHash(
  paymentId: string,
  source: string,
  intentStatus: string,
): string {
  const input = `ziina-reconcile\n${paymentId}\n${source}\n${intentStatus}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/** Records that a reconcile probe ran for a slot without applying a terminal transition. */
export function computeZiinaReconcileProbePayloadHash(paymentId: string, slot: string): string {
  const input = `ziina-reconcile-probe\n${paymentId}\n${slot}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
