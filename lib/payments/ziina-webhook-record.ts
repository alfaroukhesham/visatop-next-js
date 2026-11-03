import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { payment, paymentEvent } from "@/lib/db/schema";
import type { TZiinaWebhookEnvelope } from "@/lib/payments/ziina-webhook";

type PaymentRow = typeof payment.$inferSelect;

export const ZIINA_WEBHOOK_EVENT_TYPE = "payment_intent.status.updated";

export const recordZiinaWebhookEvent = async (
  tx: DbTransaction,
  params: {
    envelope: TZiinaWebhookEnvelope;
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
      providerEventId: envelope.intentId,
      type: envelope.eventName || ZIINA_WEBHOOK_EVENT_TYPE,
      payloadHash,
      provider: "ziina",
      status: envelope.status,
      signatureValid: true,
      matched: Boolean(payRow),
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash })
    .returning({ id: paymentEvent.id });
  if (inserted) return true;
  await tx
    .update(paymentEvent)
    .set({
      provider: "ziina",
      status: envelope.status,
      matched: Boolean(payRow),
      signatureValid: true,
    })
    .where(eq(paymentEvent.payloadHash, payloadHash));
  return false;
};
