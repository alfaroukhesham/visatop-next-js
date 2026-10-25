import { and, eq, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { payment } from "@/lib/db/schema";

export const PAYMENT_FAILURE_MESSAGE_MAX = 200;

export const sanitizePaymentFailureCode = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
  if (!code || code.length > 64) return null;
  return code;
};

/** Provider copy only — drop emails / long blobs so the column stays non-PII. */
export const sanitizePaymentFailureMessage = (raw: unknown): string | null => {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, PAYMENT_FAILURE_MESSAGE_MAX);
  if (!trimmed) return null;
  if (/@/.test(trimmed)) return null;
  return trimmed;
};

export const fincraFailureCodeFromEventName = (eventName: string): string | null => {
  if (eventName === "charge.expired") return "expired";
  if (eventName === "charge.failed") return "failed";
  return null;
};

export const analyticsPaymentFailureKey = (provider: string, code: string): string =>
  `${provider}:${code}`;

/**
 * Write failure_code / failure_message only. Never changes status, checkout lock, or amounts.
 * Paid rows are left untouched (a later paid webhook clears codes on the paid transition).
 */
export const recordPaymentFailureInfo = async (
  tx: DbTransaction,
  params: { paymentId: string; failureCode: string; failureMessage?: string | null },
): Promise<boolean> => {
  const failureCode = sanitizePaymentFailureCode(params.failureCode);
  if (!failureCode) return false;
  const failureMessage = sanitizePaymentFailureMessage(params.failureMessage);
  const updated = await tx
    .update(payment)
    .set({ failureCode, failureMessage })
    .where(and(eq(payment.id, params.paymentId), ne(payment.status, "paid")))
    .returning({ id: payment.id });
  return updated.length > 0;
};
