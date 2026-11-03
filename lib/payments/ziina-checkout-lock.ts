import { and, eq, inArray, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, auditLog, payment } from "@/lib/db/schema";
import {
  sanitizePaymentFailureCode,
  sanitizePaymentFailureMessage,
} from "@/lib/payments/payment-failure-info";

export const abandonZiinaCheckoutLock = async (
  tx: DbTransaction,
  params: {
    memberIds: string[];
    paymentId: string;
    reason: string;
    failureCode?: string;
    failureMessage?: string | null;
    requestId?: string | null;
  },
): Promise<void> => {
  await tx
    .update(application)
    .set({ checkoutState: "none", paymentStatus: "unpaid" })
    .where(and(inArray(application.id, params.memberIds), ne(application.paymentStatus, "paid")));

  const failureCode = sanitizePaymentFailureCode(params.failureCode ?? params.reason) ?? "failed";
  const failureMessage = sanitizePaymentFailureMessage(params.failureMessage);
  await tx
    .update(payment)
    .set({ status: "failed", failureCode, failureMessage })
    .where(and(eq(payment.id, params.paymentId), ne(payment.status, "paid")));

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: "payment_ziina_checkout_abandoned",
    entityType: "payment",
    entityId: params.paymentId,
    afterJson: JSON.stringify({
      reason: params.reason,
      failureCode,
      requestId: params.requestId ?? null,
    }),
  });
};
