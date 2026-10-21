import { and, eq, inArray, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, auditLog, payment } from "@/lib/db/schema";

/** Open Fincra sessions older than this are treated as stale and can be cleared. */
export const FINCRA_OPEN_PAYMENT_STALE_MS = 15 * 60 * 1000;

export type TFincraOpenPaymentLock = {
  id: string;
  provider: string;
  status: string;
  providerCheckoutId: string | null;
  createdAt: Date;
};

export const isFincraOpenPaymentStale = (createdAt: Date, nowMs: number = Date.now()): boolean =>
  nowMs - createdAt.getTime() >= FINCRA_OPEN_PAYMENT_STALE_MS;

export const isFincraOpenPaymentUnprovisioned = (providerCheckoutId: string | null | undefined): boolean =>
  !(providerCheckoutId ?? "").trim();

/**
 * 409 self-heal: a Fincra row that never received a hosted pay code (provider
 * create failed) or that has gone stale should not block a clean retry.
 */
export const shouldSelfHealFincraOpenPayment = (
  payRow: TFincraOpenPaymentLock,
  nowMs: number = Date.now(),
): boolean => {
  if (payRow.provider !== "fincra") return false;
  if (payRow.status !== "checkout_created") return false;
  return isFincraOpenPaymentUnprovisioned(payRow.providerCheckoutId) || isFincraOpenPaymentStale(payRow.createdAt, nowMs);
};

export const abandonFincraCheckoutLock = async (
  tx: DbTransaction,
  params: {
    memberIds: string[];
    paymentId: string;
    reason: string;
    requestId?: string | null;
  },
): Promise<void> => {
  await tx
    .update(application)
    .set({ checkoutState: "none", paymentStatus: "unpaid" })
    .where(and(inArray(application.id, params.memberIds), ne(application.paymentStatus, "paid")));

  await tx
    .update(payment)
    .set({ status: "failed" })
    .where(and(eq(payment.id, params.paymentId), ne(payment.status, "paid")));

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: "payment_fincra_checkout_abandoned",
    entityType: "payment",
    entityId: params.paymentId,
    afterJson: JSON.stringify({
      reason: params.reason,
      requestId: params.requestId ?? null,
    }),
  });
};
