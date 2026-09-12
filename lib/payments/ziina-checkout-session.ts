import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { TZiinaCheckoutSession } from "@/lib/payments/checkout-types";
import { getZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";
import {
  isTrustedZiinaEmbeddedUrl,
  isZiinaIntentOpen,
} from "@/lib/payments/ziina-embedded";
import { getActivePaymentProvider, getZiinaServerConfig } from "@/lib/payments/resolve-payment-provider";
import { reconcileZiinaPaymentFromReturn } from "@/lib/payments/reconcile-ziina-payments";

export const loadPartyMemberIds = async (tx: DbTransaction, applicationId: string): Promise<string[] | null> => {
  const [requestedApp] = await tx
    .select({
      id: schema.application.id,
      partyId: schema.application.partyId,
      paymentStatus: schema.application.paymentStatus,
    })
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (!requestedApp) return null;
  if (!requestedApp.partyId) return [requestedApp.id];
  const members = await tx
    .select({ id: schema.application.id })
    .from(schema.application)
    .where(eq(schema.application.partyId, requestedApp.partyId))
    .orderBy(asc(schema.application.travelerIndex));
  return members.map((m) => m.id);
};

export const loadOpenZiinaPayment = async (tx: DbTransaction, memberIds: string[]) => {
  const rows = await tx
    .select()
    .from(schema.payment)
    .where(
      and(
        inArray(schema.payment.applicationId, memberIds),
        eq(schema.payment.provider, "ziina"),
        eq(schema.payment.status, "checkout_created"),
      ),
    )
    .orderBy(desc(schema.payment.createdAt))
    .limit(1);
  return rows[0] ?? null;
};

export const findOpenZiinaPaymentForApplication = async (tx: DbTransaction, applicationId: string) => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return null;
  return loadOpenZiinaPayment(tx, memberIds);
};

export type TResolveZiinaCheckoutSessionResult = {
  session: TZiinaCheckoutSession;
  firstPaidApplicationId: string | null;
};

const result = (
  session: TZiinaCheckoutSession,
  firstPaidApplicationId: string | null = null,
): TResolveZiinaCheckoutSessionResult => ({ session, firstPaidApplicationId });

export const resolveZiinaCheckoutSession = async (
  tx: DbTransaction,
  applicationId: string,
  requestId: string | null,
): Promise<TResolveZiinaCheckoutSessionResult> => {
  const memberIds = await loadPartyMemberIds(tx, applicationId);
  if (!memberIds) return result({ kind: "none" });

  const [appRow] = await tx
    .select({ paymentStatus: schema.application.paymentStatus })
    .from(schema.application)
    .where(eq(schema.application.id, applicationId))
    .limit(1);
  if (appRow?.paymentStatus === "paid") {
    return result({ kind: "paid" });
  }

  const payRow = await loadOpenZiinaPayment(tx, memberIds);
  if (!payRow) {
    if (getActivePaymentProvider() !== "ziina") return result({ kind: "not_ziina" });
    return result({ kind: "none" });
  }

  const intentId = payRow.providerCheckoutId?.trim();
  if (!intentId) return result({ kind: "unavailable" });

  let ziinaCfg;
  try {
    ziinaCfg = getZiinaServerConfig();
  } catch {
    return result({ kind: "unavailable" });
  }

  let intent;
  try {
    intent = await getZiinaPaymentIntent({
      baseUrl: ziinaCfg.apiBaseUrl,
      accessToken: ziinaCfg.accessToken,
      paymentIntentId: intentId,
      timeoutMs: 8000,
    });
  } catch (e) {
    if (e instanceof ZiinaProviderError) {
      console.warn("[checkout-session] Ziina GET payment_intent failed", {
        paymentId: payRow.id,
        intentId,
        message: e.message,
      });
    }
    return result({ kind: "unavailable" });
  }

  if (intent.status === "completed") {
    const attempt = await reconcileZiinaPaymentFromReturn(tx, payRow, requestId);
    const firstPaidApplicationId = attempt.process?.firstPaidApplicationId ?? null;
    if (firstPaidApplicationId) {
      return result({ kind: "paid" }, firstPaidApplicationId);
    }
    const [updated] = await tx
      .select({ paymentStatus: schema.application.paymentStatus })
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1);
    if (updated?.paymentStatus === "paid") return result({ kind: "paid" });
    return result({ kind: "confirming" });
  }

  if (isZiinaIntentOpen(intent.status)) {
    const embeddedUrl = intent.embeddedUrl?.trim() ?? "";
    if (!isTrustedZiinaEmbeddedUrl(embeddedUrl)) return result({ kind: "unavailable" });
    return result({ kind: "open", embeddedUrl });
  }

  return result({ kind: "closed", status: intent.status });
};
