import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { TZiinaCheckoutSession } from "@/lib/payments/checkout-types";
import { computeZiinaWidgetOpenedPayloadHash } from "@/lib/payments/payment-event-hash";
import { requirePaymentEventPayloadHashDedupeIndex } from "@/lib/payments/payment-webhook-db-guard";
import { getZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";
import {
  isTrustedZiinaEmbeddedUrl,
  isZiinaIntentOpen,
} from "@/lib/payments/ziina-embedded";
import { getActivePaymentProvider, getZiinaServerConfig } from "@/lib/payments/resolve-payment-provider";
import { reconcileZiinaPaymentFromReturn } from "@/lib/payments/reconcile-ziina-payments";
import { createRequestLogger } from "@/lib/logger";
import { loadPartyMemberIds } from "@/lib/payments/party-member-ids";

export { loadPartyMemberIds } from "@/lib/payments/party-member-ids";

export const ZIINA_WIDGET_OPENED_EVENT_TYPE = "ziina.widget.opened";

const recordZiinaWidgetOpened = async (tx: DbTransaction, payRow: typeof schema.payment.$inferSelect) => {
  await requirePaymentEventPayloadHashDedupeIndex(tx);
  await tx
    .insert(schema.paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId: payRow.providerCheckoutId,
      type: ZIINA_WIDGET_OPENED_EVENT_TYPE,
      payloadHash: computeZiinaWidgetOpenedPayloadHash(payRow.id),
      provider: "ziina",
      status: "widget_opened",
      signatureValid: true,
      matched: true,
    })
    .onConflictDoNothing({ target: schema.paymentEvent.payloadHash });
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
      createRequestLogger(requestId).warn(
        { paymentId: payRow.id, intentId, message: e.message },
        "[checkout-session] Ziina GET payment_intent failed",
      );
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
    await recordZiinaWidgetOpened(tx, payRow);
    return result({ kind: "open", embeddedUrl });
  }

  return result({ kind: "closed", status: intent.status });
};
