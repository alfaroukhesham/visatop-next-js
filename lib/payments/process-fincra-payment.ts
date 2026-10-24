import { and, eq, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { application, auditLog, payment, paymentEvent } from "@/lib/db/schema";
import {
  applyPaymentWebhookEvent,
  resolvePaymentRowForWebhook,
} from "@/lib/payments/apply-payment-webhook-event";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";
import { requirePaymentEventPayloadHashDedupeIndex } from "@/lib/payments/payment-webhook-db-guard";
import { computeFincraUnderpayPayloadHash } from "@/lib/payments/payment-event-hash";
import type { TFincraVerifyDecision } from "@/lib/payments/fincra-verify";

export type ProcessFincraPaymentOutcome =
  | "applied"
  | "duplicate"
  | "mismatch"
  | "pending"
  | "unknown_reference"
  | "noop_no_payment"
  | "noop_no_application"
  | "rejected_provider_mismatch";

export type ProcessFincraPaymentResult = {
  outcome: ProcessFincraPaymentOutcome;
  firstPaidApplicationId: string | null;
  paymentId: string | null;
};

const flagMismatch = async (
  tx: DbTransaction,
  params: {
    payRow: typeof payment.$inferSelect;
    appRow: typeof application.$inferSelect;
    decision: Extract<TFincraVerifyDecision, { kind: "mismatch" }>;
    providerEventId: string;
    payloadHash: string;
    eventType: string;
    logLabel: string;
    requestId?: string | null;
  },
): Promise<ProcessFincraPaymentResult> => {
  const { payRow, appRow, decision, providerEventId, payloadHash, eventType, logLabel, requestId } =
    params;
  await requirePaymentEventPayloadHashDedupeIndex(tx);
  const received = decision.amountReceivedMinor?.toString() ?? "unknown";
  const mismatchHash = computeFincraUnderpayPayloadHash(payRow.id, `${decision.reason}:${received}`);
  const [inserted] = await tx
    .insert(paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId,
      type: eventType,
      payloadHash: payloadHash || mismatchHash,
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash })
    .returning();

  if (!inserted) {
    return {
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
    };
  }

  await tx
    .update(payment)
    .set({
      status: "mismatch",
      amountReceivedMinor: decision.amountReceivedMinor,
      feeMinor: decision.feeMinor,
      varianceType: decision.reason,
    })
    .where(eq(payment.id, payRow.id));

  const mismatchAppPatch = {
    adminAttentionRequired: true as const,
    checkoutState: "none",
    paymentStatus: "unpaid",
  };
  if (appRow.partyId) {
    await tx
      .update(application)
      .set(mismatchAppPatch)
      .where(and(eq(application.partyId, appRow.partyId), ne(application.paymentStatus, "paid")));
  } else {
    await tx
      .update(application)
      .set(mismatchAppPatch)
      .where(and(eq(application.id, appRow.id), ne(application.paymentStatus, "paid")));
  }

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: "payment_fincra_mismatch_flagged",
    entityType: "application",
    entityId: appRow.id,
    beforeJson: JSON.stringify({
      paymentStatus: appRow.paymentStatus,
      adminAttentionRequired: appRow.adminAttentionRequired,
      expectedAmountMinor: payRow.amount.toString(),
      expectedCurrency: payRow.currency,
    }),
    afterJson: JSON.stringify({
      providerEventId,
      paymentId: payRow.id,
      reason: decision.reason,
      expectedAmountMinor: payRow.amount.toString(),
      expectedCurrency: payRow.currency,
      receivedAmountMinor: received,
      reportedCurrency: decision.reportedCurrency,
      requestId: requestId ?? null,
    }),
  });

  console.warn(`[${logLabel}] Fincra charge mismatch held for admin review (not marked paid)`, {
    requestId: requestId ?? null,
    paymentId: payRow.id,
    applicationId: appRow.id,
    reason: decision.reason,
    expectedAmountMinor: payRow.amount.toString(),
    expectedCurrency: payRow.currency,
    receivedAmountMinor: received,
    reportedCurrency: decision.reportedCurrency,
  });

  return { outcome: "mismatch", firstPaidApplicationId: null, paymentId: payRow.id };
};

export const processFincraVerifiedPaymentInTransaction = async (
  tx: DbTransaction,
  params: {
    normalized: NormalizedPaymentWebhookEvent;
    decision: TFincraVerifyDecision;
    payloadHash: string;
    eventType: string;
    requestId?: string | null;
    logLabel: string;
    verifiedIds?: { payCode?: string | null; fincraId?: string | null };
  },
): Promise<ProcessFincraPaymentResult> => {
  const { normalized, decision, payloadHash, eventType, requestId, logLabel, verifiedIds } = params;

  if (decision.kind === "unknown_reference") {
    console.warn(`[${logLabel}] Fincra reference does not map to a stored payment (not marked paid)`, {
      requestId: requestId ?? null,
      providerPaymentId: normalized.providerPaymentId,
    });
    return { outcome: "unknown_reference", firstPaidApplicationId: null, paymentId: null };
  }

  const payRow = await resolvePaymentRowForWebhook(tx, normalized);
  if (!payRow) {
    console.info(`[${logLabel}] No matching payment row for Fincra reference`, {
      requestId: requestId ?? null,
      providerPaymentId: normalized.providerPaymentId,
    });
    return { outcome: "unknown_reference", firstPaidApplicationId: null, paymentId: null };
  }

  if (payRow.provider !== "fincra") {
    console.warn(`[${logLabel}] Payment row provider mismatch`, {
      requestId: requestId ?? null,
      paymentId: payRow.id,
      rowProvider: payRow.provider,
    });
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "webhook_provider_mismatch",
      entityType: "payment",
      entityId: payRow.id,
      beforeJson: JSON.stringify({ paymentProvider: payRow.provider }),
      afterJson: JSON.stringify({
        route: logLabel,
        providerEventId: normalized.providerEventId ?? normalized.providerPaymentId,
        rawEventType: normalized.rawEventType,
        requestId: requestId ?? null,
      }),
    });
    return {
      outcome: "rejected_provider_mismatch",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
    };
  }

  const [appRow] = await tx
    .select()
    .from(application)
    .where(eq(application.id, payRow.applicationId))
    .limit(1);
  if (!appRow) {
    return {
      outcome: "noop_no_application",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
    };
  }

  if (payRow.status === "paid") {
    return {
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
    };
  }

  const providerEventId = normalized.providerEventId ?? normalized.providerPaymentId;

  if (decision.kind === "pending") {
    return { outcome: "pending", firstPaidApplicationId: null, paymentId: payRow.id };
  }

  if (decision.kind === "mismatch") {
    return flagMismatch(tx, {
      payRow,
      appRow,
      decision,
      providerEventId,
      payloadHash,
      eventType,
      logLabel,
      requestId,
    });
  }

  await requirePaymentEventPayloadHashDedupeIndex(tx);
  const [insertedEvent] = await tx
    .insert(paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId,
      type: eventType,
      payloadHash,
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash })
    .returning();

  if (!insertedEvent) {
    return {
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
    };
  }

  await tx
    .update(payment)
    .set({
      amountReceivedMinor: decision.amountReceivedMinor,
      feeMinor: decision.feeMinor,
      varianceType: decision.varianceType,
      providerCheckoutId: verifiedIds?.payCode || payRow.providerCheckoutId,
      providerTransactionId: verifiedIds?.fincraId || payRow.providerTransactionId,
    })
    .where(eq(payment.id, payRow.id));

  const paidNormalized: NormalizedPaymentWebhookEvent = {
    ...normalized,
    amountMinor: Number(payRow.amount),
    currency: payRow.currency,
    providerPaymentId: verifiedIds?.payCode || normalized.providerPaymentId,
  };

  const [freshPay] = await tx.select().from(payment).where(eq(payment.id, payRow.id)).limit(1);
  const payApply = await applyPaymentWebhookEvent(
    tx,
    paidNormalized,
    freshPay ?? payRow,
    appRow,
    providerEventId,
    { requestId },
  );

  if (payApply.didFirstPaidTransition) {
    return {
      outcome: "applied",
      firstPaidApplicationId: payRow.applicationId,
      paymentId: payRow.id,
    };
  }

  return {
    outcome: "applied",
    firstPaidApplicationId: null,
    paymentId: payRow.id,
  };
};
