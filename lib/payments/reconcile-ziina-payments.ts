import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { auditLog, payment, paymentEvent } from "@/lib/db/schema";
import { getZiinaPaymentIntent, ZiinaProviderError } from "@/lib/payments/ziina-client";
import { mapZiinaIntentSnapshotToNormalized } from "@/lib/payments/ziina-intent-status";
import {
  computeZiinaReconcilePayloadHash,
  computeZiinaReconcileProbePayloadHash,
} from "@/lib/payments/payment-event-hash";
import {
  processZiinaPaymentInTransaction,
  type ProcessZiinaPaymentResult,
} from "@/lib/payments/process-ziina-payment";
import { getZiinaServerConfig } from "@/lib/payments/resolve-payment-provider";
import { createId } from "@paralleldrive/cuid2";
import {
  isPostgresOnConflictMissingConstraintError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";

const ZIINA_RECONCILE_SLOTS = [
  { slot: "5m", delayMs: 5 * 60 * 1000 },
  { slot: "10m", delayMs: 10 * 60 * 1000 },
  { slot: "15m", delayMs: 15 * 60 * 1000 },
] as const;

export type ZiinaReconcileSlot = (typeof ZIINA_RECONCILE_SLOTS)[number]["slot"];

export type ReconcileZiinaPaymentRow = typeof payment.$inferSelect;

export type ReconcileZiinaAttemptResult = {
  paymentId: string;
  applicationId: string;
  slot: ZiinaReconcileSlot;
  ziinaStatus: string | null;
  outcome: string;
  error?: string;
  process?: ProcessZiinaPaymentResult;
};

function probeEventType(slot: ZiinaReconcileSlot): string {
  return `ziina.reconcile.probe.${slot}`;
}

function applyEventType(slot: ZiinaReconcileSlot): string {
  return `ziina.reconcile.${slot}`;
}

export async function hasZiinaReconcileProbe(
  tx: DbTransaction,
  paymentId: string,
  slot: ZiinaReconcileSlot,
): Promise<boolean> {
  const rows = await tx
    .select({ id: paymentEvent.id })
    .from(paymentEvent)
    .where(
      and(eq(paymentEvent.paymentId, paymentId), eq(paymentEvent.type, probeEventType(slot))),
    )
    .limit(1);
  return rows.length > 0;
}

async function recordReconcileProbe(
  tx: DbTransaction,
  payRow: ReconcileZiinaPaymentRow,
  slot: ZiinaReconcileSlot,
  ziinaStatus: string,
): Promise<void> {
  await requirePaymentEventPayloadHashDedupeIndex(tx);
  await tx
    .insert(paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId: payRow.providerCheckoutId,
      type: probeEventType(slot),
      payloadHash: computeZiinaReconcileProbePayloadHash(payRow.id, slot),
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash });

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: "ziina_reconcile_probe",
    entityType: "payment",
    entityId: payRow.id,
    afterJson: JSON.stringify({
      slot,
      ziinaStatus,
      intentId: payRow.providerCheckoutId,
      applicationId: payRow.applicationId,
    }),
  });
}

export function dueZiinaReconcileSlots(
  paymentCreatedAt: Date,
  nowMs: number = Date.now(),
): ZiinaReconcileSlot[] {
  const ageMs = nowMs - paymentCreatedAt.getTime();
  const due: ZiinaReconcileSlot[] = [];
  for (const { slot, delayMs } of ZIINA_RECONCILE_SLOTS) {
    if (ageMs >= delayMs) due.push(slot);
  }
  return due;
}

export async function reconcileZiinaPaymentRow(
  tx: DbTransaction,
  payRow: ReconcileZiinaPaymentRow,
  slot: ZiinaReconcileSlot,
  requestId?: string | null,
): Promise<ReconcileZiinaAttemptResult> {
  const intentId = payRow.providerCheckoutId?.trim();
  if (!intentId) {
    console.warn("[ziina-reconcile] Missing provider_checkout_id on payment", {
      paymentId: payRow.id,
      slot,
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: null,
      outcome: "skipped_no_intent_id",
    };
  }

  if (await hasZiinaReconcileProbe(tx, payRow.id, slot)) {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: null,
      outcome: "skipped_probe_already_ran",
    };
  }

  let ziinaCfg;
  try {
    ziinaCfg = getZiinaServerConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ziina not configured";
    console.error("[ziina-reconcile] Ziina config missing", { paymentId: payRow.id, slot, msg });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: null,
      outcome: "error_config",
      error: msg,
    };
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
    const msg = e instanceof ZiinaProviderError ? e.message : e instanceof Error ? e.message : String(e);
    console.error("[ziina-reconcile] Ziina GET payment_intent failed", {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      intentId,
      error: msg,
    });
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "ziina_reconcile_error",
      entityType: "payment",
      entityId: payRow.id,
      afterJson: JSON.stringify({ slot, intentId, error: msg }),
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: null,
      outcome: "error_ziina_api",
      error: msg,
    };
  }

  await recordReconcileProbe(tx, payRow, slot, intent.status);

  const mapped = mapZiinaIntentSnapshotToNormalized(
    {
      id: intent.id,
      status: intent.status,
      amountMinor: intent.amountMinor,
      currencyCode: intent.currencyCode,
      operationId: intent.operationId,
    },
    applyEventType(slot),
  );

  if (mapped.kind === "ignored") {
    console.info("[ziina-reconcile] Ziina intent not terminal yet", {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      intentId,
      ziinaStatus: intent.status,
      reason: mapped.reason,
    });
    if (slot === "15m") {
      console.warn("[ziina-reconcile] Final reconcile probe: payment still not terminal on Ziina", {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        intentId,
        ziinaStatus: intent.status,
        reason: mapped.reason,
      });
    }
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: intent.status,
      outcome: `pending:${mapped.reason}`,
    };
  }

  const payloadHash = computeZiinaReconcilePayloadHash(payRow.id, slot, intent.status);
  let processResult: ProcessZiinaPaymentResult;
  try {
    processResult = await processZiinaPaymentInTransaction(tx, {
      normalized: mapped.event,
      payloadHash,
      eventType: applyEventType(slot),
      requestId,
      logLabel: "ziina-reconcile",
    });
  } catch (e) {
    if (isPostgresOnConflictMissingConstraintError(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ziina-reconcile] Failed to apply Ziina terminal status", {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      intentId,
      ziinaStatus: intent.status,
      kind: mapped.event.kind,
      error: msg,
    });
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "ziina_reconcile_apply_failed",
      entityType: "payment",
      entityId: payRow.id,
      afterJson: JSON.stringify({
        slot,
        intentId,
        ziinaStatus: intent.status,
        kind: mapped.event.kind,
        error: msg,
      }),
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      ziinaStatus: intent.status,
      outcome: "error_apply",
      error: msg,
    };
  }

  if (
    slot === "15m" &&
    processResult.outcome !== "applied" &&
    intent.status === "completed"
  ) {
    console.error(
      "[ziina-reconcile] CRITICAL: Ziina shows completed but payment was not marked paid in our DB",
      {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        intentId,
        processOutcome: processResult.outcome,
      },
    );
  }

  return {
    paymentId: payRow.id,
    applicationId: payRow.applicationId,
    slot,
    ziinaStatus: intent.status,
    outcome: processResult.outcome,
    process: processResult,
  };
}

/** Reconcile from checkout return (no slot probe bookkeeping beyond apply). */
export async function reconcileZiinaPaymentFromReturn(
  tx: DbTransaction,
  payRow: ReconcileZiinaPaymentRow,
  requestId?: string | null,
): Promise<ReconcileZiinaAttemptResult> {
  const intentId = payRow.providerCheckoutId?.trim();
  if (!intentId) {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: "5m",
      ziinaStatus: null,
      outcome: "skipped_no_intent_id",
    };
  }

  let ziinaCfg;
  try {
    ziinaCfg = getZiinaServerConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ziina not configured";
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: "5m",
      ziinaStatus: null,
      outcome: "error_config",
      error: msg,
    };
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
    const msg = e instanceof ZiinaProviderError ? e.message : e instanceof Error ? e.message : String(e);
    console.warn("[ziina-reconcile/return] Ziina GET payment_intent failed", {
      paymentId: payRow.id,
      intentId,
      error: msg,
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: "5m",
      ziinaStatus: null,
      outcome: "error_ziina_api",
      error: msg,
    };
  }

  const mapped = mapZiinaIntentSnapshotToNormalized(
    {
      id: intent.id,
      status: intent.status,
      amountMinor: intent.amountMinor,
      currencyCode: intent.currencyCode,
      operationId: intent.operationId,
    },
    "ziina.reconcile.return",
  );

  if (mapped.kind === "ignored") {
    console.info("[ziina-reconcile/return] Ziina intent not terminal on return", {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      intentId,
      ziinaStatus: intent.status,
      reason: mapped.reason,
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: "5m",
      ziinaStatus: intent.status,
      outcome: `pending:${mapped.reason}`,
    };
  }

  const payloadHash = computeZiinaReconcilePayloadHash(payRow.id, "return", intent.status);
  const processResult = await processZiinaPaymentInTransaction(tx, {
    normalized: mapped.event,
    payloadHash,
    eventType: "ziina.reconcile.return",
    requestId,
    logLabel: "ziina-reconcile/return",
  });

  return {
    paymentId: payRow.id,
    applicationId: payRow.applicationId,
    slot: "5m",
    ziinaStatus: intent.status,
    outcome: processResult.outcome,
    process: processResult,
  };
}
