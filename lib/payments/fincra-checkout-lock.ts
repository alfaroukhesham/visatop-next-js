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
  amount?: bigint;
  currency?: string;
};

export type TFincraRotateMemberLock = {
  checkoutState: string | null;
  paymentStatus: string;
};

export const isFincraOpenPaymentStale = (createdAt: Date, nowMs: number = Date.now()): boolean =>
  nowMs - createdAt.getTime() >= FINCRA_OPEN_PAYMENT_STALE_MS;

export const isFincraOpenPaymentUnprovisioned = (providerCheckoutId: string | null | undefined): boolean =>
  !(providerCheckoutId ?? "").trim();

/**
 * 409 self-heal: a hosted Fincra row that never received a pay code (provider
 * create failed) or that has gone stale should not block a clean retry.
 * Inline checkouts never get a pay code, so missing `providerCheckoutId` is
 * not treated as failed unless `treatMissingPayCodeAsFailed` is true.
 */
export const shouldSelfHealFincraOpenPayment = (
  payRow: TFincraOpenPaymentLock,
  nowMs: number = Date.now(),
  options?: { treatMissingPayCodeAsFailed?: boolean },
): boolean => {
  if (payRow.provider !== "fincra") return false;
  if (payRow.status !== "checkout_created") return false;
  const treatMissingPayCodeAsFailed = options?.treatMissingPayCodeAsFailed ?? true;
  if (treatMissingPayCodeAsFailed && isFincraOpenPaymentUnprovisioned(payRow.providerCheckoutId)) return true;
  return isFincraOpenPaymentStale(payRow.createdAt, nowMs);
};

/**
 * Continue-payment may mint `${paymentId}-aN` only for the caller's own still-
 * pending inline Fincra row. Amount and currency must stay on that row.
 */
export const canRotateFincraInlineAttempt = (params: {
  fincraMode: "inline" | "hosted";
  payRow: {
    provider: string;
    status: string;
    amount: bigint;
    currency: string;
  };
  members: TFincraRotateMemberLock[];
  expectedAmount: bigint;
  expectedCurrency: string;
}): boolean => {
  if (params.fincraMode !== "inline") return false;
  if (params.payRow.provider !== "fincra") return false;
  if (params.payRow.status !== "checkout_created") return false;
  if (params.payRow.amount !== params.expectedAmount) return false;
  if (params.payRow.currency.trim().toUpperCase() !== params.expectedCurrency.trim().toUpperCase()) {
    return false;
  }
  if (params.members.length === 0) return false;
  return params.members.every(
    (member) => member.checkoutState === "pending" && member.paymentStatus !== "paid",
  );
};

export type TFincraLockedCheckoutRetry = "rotate" | "self_heal" | "conflict";

export const classifyFincraLockedCheckoutRetry = (params: {
  fincraMode: "inline" | "hosted";
  payRow: (TFincraOpenPaymentLock & { amount: bigint; currency: string }) | null;
  members: TFincraRotateMemberLock[];
  nowMs?: number;
}): TFincraLockedCheckoutRetry => {
  if (!params.payRow) return "conflict";
  if (
    canRotateFincraInlineAttempt({
      fincraMode: params.fincraMode,
      payRow: params.payRow,
      members: params.members,
      expectedAmount: params.payRow.amount,
      expectedCurrency: params.payRow.currency,
    })
  ) {
    return "rotate";
  }
  if (
    params.fincraMode === "hosted" &&
    shouldSelfHealFincraOpenPayment(params.payRow, params.nowMs ?? Date.now(), {
      treatMissingPayCodeAsFailed: true,
    })
  ) {
    return "self_heal";
  }
  return "conflict";
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
