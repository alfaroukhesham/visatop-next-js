import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { auditLog, payment, paymentEvent } from "@/lib/db/schema";
import type { FincraWebhookEnvelope } from "@/lib/payments/fincra-webhook";
import { FINCRA_TERMINAL_UNPAID_EVENTS } from "@/lib/payments/fincra-webhook";
import {
  fincraFailureCodeFromEventName,
  recordPaymentFailureInfo,
} from "@/lib/payments/payment-failure-info";

type PaymentRow = typeof payment.$inferSelect;

/**
 * Store a signature-verified Fincra webhook in `payment_event`, idempotent on payload hash
 * (Fincra re-delivers the identical body; duplicates are no-ops). Returns true when newly stored.
 */
export const recordFincraWebhookEvent = async (
  tx: DbTransaction,
  params: {
    envelope: FincraWebhookEnvelope;
    payloadHash: string;
    payRow: PaymentRow | null;
  },
): Promise<boolean> => {
  const { envelope, payloadHash, payRow } = params;
  const [inserted] = await tx
    .insert(paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow?.id ?? null,
      providerEventId: envelope.providerEventId,
      type: envelope.eventName,
      payloadHash,
      provider: "fincra",
      merchantReference: envelope.merchantReference,
      status: envelope.status,
      signatureValid: true,
      matched: Boolean(payRow),
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash })
    .returning({ id: paymentEvent.id });
  if (inserted) return true;
  // Row may have been written by the paid-path processor without the audit columns: fill them in.
  await tx
    .update(paymentEvent)
    .set({
      provider: "fincra",
      merchantReference: envelope.merchantReference,
      status: envelope.status,
      matched: Boolean(payRow),
    })
    .where(eq(paymentEvent.payloadHash, payloadHash));
  return false;
};

/**
 * charge.failed / charge.expired: audit only. Payment and application state are NOT changed so the
 * checkout lock rule holds (customer finishes via Continue payment, or an admin uses Cancel & Reset),
 * and a paid row is never touched.
 */
export const auditFincraUnpaidAttemptEvent = async (
  tx: DbTransaction,
  params: { envelope: FincraWebhookEnvelope; payRow: PaymentRow; requestId?: string | null },
): Promise<{ isCurrentAttempt: boolean } | null> => {
  const { envelope, payRow, requestId } = params;
  if (!FINCRA_TERMINAL_UNPAID_EVENTS.has(envelope.eventName)) return null;
  const isCurrentAttempt =
    !envelope.merchantReference || envelope.merchantReference === (payRow.providerOperationId ?? payRow.id);
  const failureCode = fincraFailureCodeFromEventName(envelope.eventName);
  if (failureCode) {
    await recordPaymentFailureInfo(tx, {
      paymentId: payRow.id,
      failureCode,
      failureMessage: envelope.failureMessage ?? envelope.status,
    });
  }
  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: envelope.eventName === "charge.expired" ? "payment_fincra_attempt_expired" : "payment_fincra_attempt_failed",
    entityType: "payment",
    entityId: payRow.id,
    beforeJson: JSON.stringify({ paymentStatus: payRow.status }),
    afterJson: JSON.stringify({
      merchantReference: envelope.merchantReference,
      providerReference: envelope.providerReference,
      providerEventId: envelope.providerEventId,
      isCurrentAttempt,
      paymentStatusUnchanged: true,
      failureCode,
      requestId: requestId ?? null,
    }),
  });
  return { isCurrentAttempt };
};
