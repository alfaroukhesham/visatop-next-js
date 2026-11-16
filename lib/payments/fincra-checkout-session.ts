import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { resolveApplicantEmailTx } from "@/lib/email/resolve-applicant-email";
import { loadPartyMemberIds } from "@/lib/payments/ziina-checkout-session";
import {
  fincraCheckoutUrlFromPayCode,
  isTrustedFincraCheckoutUrl,
} from "@/lib/payments/fincra-embedded";
import { buildFincraInlineCheckoutData, type TFincraInlineCheckoutData } from "@/lib/payments/fincra-inline";
import { nextFincraAttemptReference } from "@/lib/payments/fincra-attempt-reference";
import {
  listFincraMerchantReferencesForPayment,
  listStoredFincraAttemptReferences,
  recordFincraAttemptReference,
} from "@/lib/payments/fincra-attempt-store";
import {
  summarizeFincraAttemptVerifications,
  verifyFincraMerchantReferences,
} from "@/lib/payments/fincra-attempt-verify";
import { reconcileFincraPaymentFromReturn } from "@/lib/payments/reconcile-fincra-payments";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import type { CheckoutSessionData, TResumeCheckoutSession } from "@/lib/payments/checkout-types";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { persistMetaCapiAttribution, type TMetaCapiAttribution } from "@/lib/payments/meta-capi";
import { processFincraVerifiedPaymentInTransaction } from "@/lib/payments/process-fincra-payment";
import { computeFincraReconcilePayloadHash } from "@/lib/payments/payment-event-hash";
import { abandonFincraCheckoutLock } from "@/lib/payments/fincra-checkout-lock";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";

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

export const buildFincraInlineCheckoutDataForPayment = async (
  tx: DbTransaction,
  payRow: typeof schema.payment.$inferSelect,
): Promise<TFincraInlineCheckoutData | null> => {
  let cfg;
  try {
    cfg = getFincraServerConfig();
  } catch {
    return null;
  }
  const [app] = await tx
    .select()
    .from(schema.application)
    .where(eq(schema.application.id, payRow.applicationId))
    .limit(1);
  if (!app) return null;
  const customerEmail = await resolveApplicantEmailTx(tx, app);
  if (!customerEmail) return null;
  const metadata: Record<string, string> = {
    applicationId: app.id,
    paymentId: payRow.id,
    serviceId: app.serviceId,
    isGuest: app.isGuest ? "true" : "false",
  };
  if (app.partyId) metadata.partyId = app.partyId;
  if (app.userId) metadata.userId = app.userId;
  return buildFincraInlineCheckoutData({
    publicKey: cfg.publicKey,
    amountMinor: payRow.amount,
    customer: {
      name: app.fullName?.trim() || "VisaTop customer",
      email: customerEmail,
      phoneNumber: app.phone,
    },
    reference: payRow.providerOperationId?.trim() || nextFincraAttemptReference(payRow.id, payRow.providerOperationId),
    feeBearer: cfg.feeBearer,
    metadata,
  });
};

export const rotateOpenFincraInlineAttempt = async (
  tx: DbTransaction,
  params: {
    payRow: typeof schema.payment.$inferSelect;
    memberIds: string[];
    requestId: string | null;
  },
): Promise<TFincraInlineCheckoutData | null> => {
  const nextReference = nextFincraAttemptReference(params.payRow.id, params.payRow.providerOperationId);
  const [updated] = await tx
    .update(schema.payment)
    .set({ providerOperationId: nextReference })
    .where(
      and(
        eq(schema.payment.id, params.payRow.id),
        eq(schema.payment.status, "checkout_created"),
        eq(schema.payment.amount, params.payRow.amount),
        eq(schema.payment.currency, params.payRow.currency),
      ),
    )
    .returning();
  if (!updated) return null;

  const previousReference = params.payRow.providerOperationId?.trim() || params.payRow.id;
  await recordFincraAttemptReference(tx, {
    paymentId: params.payRow.id,
    merchantReference: previousReference,
  });
  await recordFincraAttemptReference(tx, {
    paymentId: params.payRow.id,
    merchantReference: nextReference,
  });

  await tx
    .update(schema.application)
    .set({ checkoutState: "pending" })
    .where(and(inArray(schema.application.id, params.memberIds), ne(schema.application.paymentStatus, "paid")));
  await tx.insert(schema.auditLog).values({
    actorType: "system",
    actorId: null,
    action: "payment_fincra_attempt_rotated",
    entityType: "payment",
    entityId: params.payRow.id,
    afterJson: JSON.stringify({
      previousReference: params.payRow.providerOperationId ?? params.payRow.id,
      nextReference,
      amount: params.payRow.amount.toString(),
      currency: params.payRow.currency,
      requestId: params.requestId,
    }),
  });
  return buildFincraInlineCheckoutDataForPayment(tx, {
    ...params.payRow,
    providerOperationId: nextReference,
  });
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
  applicationId: string,
  requestId: string | null,
): Promise<TResolveFincraCheckoutSessionResult> => {
  const loaded = await withSystemDbActor(async (tx) => {
    const memberIds = await loadPartyMemberIds(tx, applicationId);
    if (!memberIds) return { kind: "none" as const };
    const [appRow] = await tx
      .select({ paymentStatus: schema.application.paymentStatus })
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1);
    if (appRow?.paymentStatus === "paid") return { kind: "paid" as const };
    const payRow = await loadOpenFincraPayment(tx, memberIds);
    if (!payRow) return { kind: "none" as const };
    return { kind: "open" as const, payRow, memberIds };
  });
  if (loaded.kind === "none") return result({ kind: "none" });
  if (loaded.kind === "paid") return result({ kind: "paid" });

  const attempt = await reconcileFincraPaymentFromReturn(loaded.payRow, requestId);
  const firstPaidApplicationId = attempt.process?.firstPaidApplicationId ?? null;
  if (firstPaidApplicationId || attempt.outcome === "applied") {
    const paid = await withSystemDbActor(async (tx) => {
      const [updated] = await tx
        .select({ paymentStatus: schema.application.paymentStatus })
        .from(schema.application)
        .where(eq(schema.application.id, applicationId))
        .limit(1);
      return updated?.paymentStatus === "paid";
    });
    if (paid || firstPaidApplicationId) return result({ kind: "paid" }, firstPaidApplicationId);
  }

  if (attempt.outcome === "mismatch" || attempt.outcome === "underpaid") {
    return result({ kind: "closed", status: "mismatch" });
  }

  return withSystemDbActor(async (tx) => {
    const payRow = await loadOpenFincraPayment(tx, loaded.memberIds);
    if (!payRow) return result({ kind: "none" });
    const payCode = payRow.providerCheckoutId?.trim() ?? "";
    const redirectUrl = payCode ? fincraCheckoutUrlFromPayCode(payCode) : "";
    if (redirectUrl && isTrustedFincraCheckoutUrl(redirectUrl)) {
      return result({ kind: "fincra_redirect", redirectUrl });
    }
    const inline = await buildFincraInlineCheckoutDataForPayment(tx, payRow);
    if (inline) return result({ kind: "fincra_inline", checkout: inline });
    return result({ kind: "unavailable" });
  });
};

export type TFincraLockedRetry = {
  kind: "fincra_locked_retry";
  action: "rotate" | "self_heal";
  payRow: typeof schema.payment.$inferSelect;
  memberIds: string[];
};

export const completeFincraLockedCheckoutRetry = async (params: {
  retry: TFincraLockedRetry;
  requestId: string | null;
  capiAttribution: TMetaCapiAttribution;
}): Promise<{ kind: "response"; response: Response } | { kind: "abandoned_retry_checkout" }> => {
  const { retry, requestId, capiAttribution } = params;
  const storedReferences = await withSystemDbActor((tx) =>
    listStoredFincraAttemptReferences(tx, retry.payRow.id),
  );
  const merchantReferences = listFincraMerchantReferencesForPayment(retry.payRow, storedReferences);
  const results = await verifyFincraMerchantReferences({
    merchantReferences,
    payment: retry.payRow,
    alreadyPaid: retry.payRow.status === "paid",
  });
  const summary = summarizeFincraAttemptVerifications(results, {
    paymentCreatedAt:
      retry.payRow.createdAt instanceof Date
        ? retry.payRow.createdAt
        : new Date(retry.payRow.createdAt),
  });

  if (summary.hasVerifyError && !summary.paid) {
    const err = results.find((result) => result.kind === "error");
    const message = err && err.kind === "error" ? err.message : "Fincra verify failed";
    return {
      kind: "response",
      response: jsonError("FINCRA_UNAVAILABLE", message, {
        status: 502,
        requestId,
        details: { reason: "provider_unavailable" },
      }),
    };
  }

  if (summary.paid) {
    const processResult = await withSystemDbActor(async (tx) => {
      const paid = await processFincraVerifiedPaymentInTransaction(tx, {
        normalized: {
          provider: "fincra",
          kind: "payment_completed",
          providerPaymentId: summary.paid!.verified.reference || summary.paid!.verified.id,
          amountMinor: Number(retry.payRow.amount),
          currency: retry.payRow.currency,
          metadata: {
            applicationId: retry.payRow.applicationId,
            operationId: summary.paid!.merchantReference,
          },
          rawEventType: "fincra.checkout.verify",
          providerEventId: summary.paid!.verified.reference || summary.paid!.verified.id,
        } satisfies NormalizedPaymentWebhookEvent,
        decision: summary.paid!.decision,
        payloadHash: computeFincraReconcilePayloadHash(
          retry.payRow.id,
          "rotate-verify",
          summary.paid!.verified.status,
        ),
        eventType: "fincra.checkout.verify",
        requestId,
        logLabel: "checkout/fincra-rotate-verify",
        verifiedIds: {
          payCode: summary.paid!.verified.reference,
          fincraId: summary.paid!.verified.id,
        },
      });
      for (const extra of summary.extraPaid) {
        await processFincraVerifiedPaymentInTransaction(tx, {
          normalized: {
            provider: "fincra",
            kind: "payment_completed",
            providerPaymentId: extra.verified.reference || extra.verified.id,
            amountMinor: Number(retry.payRow.amount),
            currency: retry.payRow.currency,
            metadata: {
              applicationId: retry.payRow.applicationId,
              operationId: extra.merchantReference,
            },
            rawEventType: "fincra.checkout.verify",
            providerEventId: extra.verified.reference || extra.verified.id,
          } satisfies NormalizedPaymentWebhookEvent,
          decision: extra.decision,
          payloadHash: computeFincraReconcilePayloadHash(
            retry.payRow.id,
            `rotate-verify:${extra.merchantReference}`,
            extra.verified.status,
          ),
          eventType: "fincra.checkout.verify",
          requestId,
          logLabel: "checkout/fincra-rotate-verify",
          verifiedIds: {
            payCode: extra.verified.reference,
            fincraId: extra.verified.id,
          },
        });
      }
      await persistMetaCapiAttribution(tx, retry.payRow.applicationId, capiAttribution);
      return paid;
    });
    if (processResult.firstPaidApplicationId) {
      scheduleFincraPaidSideEffects(processResult.firstPaidApplicationId, requestId);
    }
    const data: CheckoutSessionData = { provider: "fincra", mode: "paid" };
    return { kind: "response", response: jsonOk(data, { requestId }) };
  }

  if (summary.mismatch) {
    await withSystemDbActor(async (tx) => {
      await processFincraVerifiedPaymentInTransaction(tx, {
        normalized: {
          provider: "fincra",
          kind: "payment_completed",
          providerPaymentId: summary.mismatch!.verified.reference || summary.mismatch!.verified.id,
          amountMinor: Number(retry.payRow.amount),
          currency: retry.payRow.currency,
          metadata: {
            applicationId: retry.payRow.applicationId,
            operationId: summary.mismatch!.merchantReference,
          },
          rawEventType: "fincra.checkout.verify",
          providerEventId: summary.mismatch!.verified.reference || summary.mismatch!.verified.id,
        } satisfies NormalizedPaymentWebhookEvent,
        decision: summary.mismatch!.decision,
        payloadHash: computeFincraReconcilePayloadHash(
          retry.payRow.id,
          "rotate-verify-mismatch",
          summary.mismatch!.verified.status,
        ),
        eventType: "fincra.checkout.verify",
        requestId,
        logLabel: "checkout/fincra-rotate-verify",
        verifiedIds: {
          payCode: summary.mismatch!.verified.reference,
          fincraId: summary.mismatch!.verified.id,
        },
      });
    });
    return {
      kind: "response",
      response: jsonError(
        "CONFLICT",
        "This Fincra payment does not match the locked amount and is held for admin review.",
        {
          status: 409,
          requestId,
          details: { reason: "fincra_amount_mismatch" },
        },
      ),
    };
  }

  if (retry.action === "rotate") {
    const rotated = await withSystemDbActor(async (tx) => {
      const checkout = await rotateOpenFincraInlineAttempt(tx, {
        payRow: retry.payRow,
        memberIds: retry.memberIds,
        requestId,
      });
      if (checkout) {
        await persistMetaCapiAttribution(tx, retry.payRow.applicationId, capiAttribution);
      }
      return checkout;
    });
    if (rotated) {
      const data: CheckoutSessionData = rotated;
      return { kind: "response", response: jsonOk(data, { requestId }) };
    }
    return {
      kind: "response",
      response: jsonError("CONFLICT", "Checkout cannot be started for this application", {
        status: 409,
        requestId,
      }),
    };
  }

  if (!summary.allAbandonable) {
    return {
      kind: "response",
      response: jsonError(
        "CONFLICT",
        "An open Fincra payment is still pending. Complete or wait for the existing transfer.",
        {
          status: 409,
          requestId,
          details: { reason: "fincra_pending_open" },
        },
      ),
    };
  }

  await withSystemDbActor(async (tx) => {
    await abandonFincraCheckoutLock(tx, {
      memberIds: retry.memberIds,
      paymentId: retry.payRow.id,
      reason: retry.payRow.providerCheckoutId?.trim() ? "stale_checkout" : "unprovisioned_checkout",
      requestId,
    });
  });
  return { kind: "abandoned_retry_checkout" };
};
