import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { loadPartyMemberIds } from "@/lib/payments/ziina-checkout-session";
import {
  fincraCheckoutUrlFromPayCode,
  isTrustedFincraCheckoutUrl,
} from "@/lib/payments/fincra-embedded";
import { reconcileFincraPaymentFromReturn } from "@/lib/payments/reconcile-fincra-payments";
import type { TResumeCheckoutSession } from "@/lib/payments/checkout-types";

export const loadOpenFincraPayment = async (tx: DbTransaction, memberIds: string[]) => {
  const rows = await tx
    .select()
    .from(schema.payment)
    .where(
      and(
        inArray(schema.payment.applicationId, memberIds),
        eq(schema.payment.provider, "fincra"),
        eq(schema.payment.status, "checkout_created"),
      ),
    )
    .orderBy(desc(schema.payment.createdAt))
    .limit(1);
  return rows[0] ?? null;
};

export const findOpenFincraPaymentForApplication = async (tx: DbTransaction, applicationId: string) => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return null;
  return loadOpenFincraPayment(tx, memberIds);
};

export type TResolveFincraCheckoutSessionResult = {
  session: TResumeCheckoutSession;
  firstPaidApplicationId: string | null;
};

const result = (
  session: TResumeCheckoutSession,
  firstPaidApplicationId: string | null = null,
): TResolveFincraCheckoutSessionResult => ({ session, firstPaidApplicationId });

export const resolveFincraCheckoutSession = async (
  tx: DbTransaction,
  applicationId: string,
  requestId: string | null,
): Promise<TResolveFincraCheckoutSessionResult> => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return result({ kind: "none" });

  const [appRow] = await tx
    .select({ paymentStatus: schema.application.paymentStatus })
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (appRow?.paymentStatus === "paid") return result({ kind: "paid" });

  const payRow = await loadOpenFincraPayment(tx, memberIds);
  if (!payRow) return result({ kind: "none" });

  const attempt = await reconcileFincraPaymentFromReturn(tx, payRow, requestId);
  const firstPaidApplicationId = attempt.process?.firstPaidApplicationId ?? null;
  if (firstPaidApplicationId || attempt.outcome === "applied") {
    const [updated] = await tx
      .select({ paymentStatus: schema.application.paymentStatus })
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1);
    if (updated?.paymentStatus === "paid") return result({ kind: "paid" }, firstPaidApplicationId);
    if (firstPaidApplicationId) return result({ kind: "paid" }, firstPaidApplicationId);
  }

  if (attempt.outcome === "underpaid") {
    return result({ kind: "confirming" });
  }

  const payCode = payRow.providerCheckoutId?.trim() ?? "";
  const redirectUrl = payCode ? fincraCheckoutUrlFromPayCode(payCode) : "";
  if (!redirectUrl || !isTrustedFincraCheckoutUrl(redirectUrl)) {
    return result({ kind: "unavailable" });
  }
  return result({ kind: "fincra_redirect", redirectUrl });
};
