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
