import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { application, auditLog, paymentEvent } from "@/lib/db/schema";
import {
  applyPaymentWebhookEvent,
  resolvePaymentRowForWebhook,
} from "@/lib/payments/apply-payment-webhook-event";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";
import { requirePaymentEventPayloadHashDedupeIndex } from "@/lib/payments/payment-webhook-db-guard";
import { createRequestLogger } from "@/lib/logger";

export type ProcessZiinaPaymentOutcome =
  | "applied"
  | "duplicate"
  | "noop_no_payment"
  | "noop_no_application"
  | "rejected_provider_mismatch";

export type ProcessZiinaPaymentResult = {
  outcome: ProcessZiinaPaymentOutcome;
  firstPaidApplicationId: string | null;
  paymentId: string | null;
  intentId: string | null;
};

export async function processZiinaPaymentInTransaction(
  tx: DbTransaction,
  params: {
    normalized: NormalizedPaymentWebhookEvent;
    payloadHash: string;
    eventType: string;
    requestId?: string | null;
    logLabel: string;
  },
): Promise<ProcessZiinaPaymentResult> {
  const { normalized, payloadHash, eventType, requestId, logLabel } = params;
  const intentId = normalized.providerPaymentId;
  const log = createRequestLogger(requestId);

  const payRow = await resolvePaymentRowForWebhook(tx, normalized);
  if (!payRow) {
    log.info({ intentId, scope: logLabel }, `[${logLabel}] No matching payment row for Ziina intent`);
    return { outcome: "noop_no_payment", firstPaidApplicationId: null, paymentId: null, intentId };
  }

  if (payRow.provider !== "ziina") {
    log.warn(
      { paymentId: payRow.id, rowProvider: payRow.provider, intentId, scope: logLabel },
      `[${logLabel}] Payment row provider mismatch`,
    );
    const providerEventId = normalized.providerEventId ?? intentId;
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "webhook_provider_mismatch",
      entityType: "payment",
      entityId: payRow.id,
      beforeJson: JSON.stringify({ paymentProvider: payRow.provider }),
      afterJson: JSON.stringify({
        route: logLabel,
        providerEventId,
        rawEventType: normalized.rawEventType,
      }),
    });
    return {
      outcome: "rejected_provider_mismatch",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
      intentId,
    };
  }

  const [appRow] = await tx
    .select()
    .from(application)
    .where(eq(application.id, payRow.applicationId))
    .limit(1);
  if (!appRow) {
    log.warn(
      {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        intentId,
        scope: logLabel,
      },
      `[${logLabel}] Payment row without application`,
    );
    return {
      outcome: "noop_no_application",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
      intentId,
    };
  }

  if (payRow.status === "paid" && appRow.paymentStatus === "paid") {
    log.info(
      { paymentId: payRow.id, applicationId: appRow.id, intentId, scope: logLabel },
      `[${logLabel}] Payment already marked paid (idempotent skip)`,
    );
    return {
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
      intentId,
    };
  }

  await requirePaymentEventPayloadHashDedupeIndex(tx);

  const providerEventId = normalized.providerEventId ?? intentId;
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
    log.info(
      { paymentId: payRow.id, intentId, eventType, scope: logLabel },
      `[${logLabel}] Duplicate payment_event (already processed)`,
    );
    return {
      outcome: "duplicate",
      firstPaidApplicationId: null,
      paymentId: payRow.id,
      intentId,
    };
  }

  const payApply = await applyPaymentWebhookEvent(
    tx,
    normalized,
    payRow,
    appRow,
    providerEventId,
    { requestId },
  );

  if (payApply.didFirstPaidTransition) {
    log.info(
      {
        paymentId: payRow.id,
        applicationId: appRow.id,
        intentId,
        eventType,
        kind: normalized.kind,
        scope: logLabel,
      },
      `[${logLabel}] Payment marked paid via Ziina`,
    );
    return {
      outcome: "applied",
      firstPaidApplicationId: payRow.applicationId,
      paymentId: payRow.id,
      intentId,
    };
  }

  log.info(
    {
      paymentId: payRow.id,
      applicationId: appRow.id,
      intentId,
      eventType,
      kind: normalized.kind,
      paymentStatus: appRow.paymentStatus,
      applicationStatus: appRow.applicationStatus,
      scope: logLabel,
    },
    `[${logLabel}] Ziina event recorded without first-paid transition`,
  );
  return {
    outcome: "applied",
    firstPaidApplicationId: null,
    paymentId: payRow.id,
    intentId,
  };
}
