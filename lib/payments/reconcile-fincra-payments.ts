import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { auditLog, payment, paymentEvent } from "@/lib/db/schema";
import {
  processFincraVerifiedPaymentInTransaction,
  type ProcessFincraPaymentResult,
} from "@/lib/payments/process-fincra-payment";
import {
  computeFincraReconcilePayloadHash,
  computeFincraReconcileProbePayloadHash,
} from "@/lib/payments/payment-event-hash";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";
import {
  isPostgresOnConflictMissingConstraintError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";
import { createRequestLogger } from "@/lib/logger";
import { setSafeSpanAttributes, withSpan } from "@/lib/observability/tracing";
import { abandonFincraCheckoutLock } from "@/lib/payments/fincra-checkout-lock";
import {
  listFincraMerchantReferencesForPayment,
  listStoredFincraAttemptReferences,
} from "@/lib/payments/fincra-attempt-store";
import {
  summarizeFincraAttemptVerifications,
  verifyFincraMerchantReferences,
  type TFincraAttemptVerifyResult,
} from "@/lib/payments/fincra-attempt-verify";
import { loadPartyMemberIds } from "@/lib/payments/party-member-ids";

const FINCRA_RECONCILE_SLOTS = [
  { slot: "5m", delayMs: 5 * 60 * 1000 },
  { slot: "15m", delayMs: 15 * 60 * 1000 },
  { slot: "60m", delayMs: 60 * 60 * 1000 },
  { slot: "24h", delayMs: 24 * 60 * 60 * 1000 },
] as const;

export type FincraReconcileSlot = (typeof FINCRA_RECONCILE_SLOTS)[number]["slot"];

export type ReconcileFincraPaymentRow = typeof payment.$inferSelect;

export type ReconcileFincraAttemptResult = {
  paymentId: string;
  applicationId: string;
  slot: FincraReconcileSlot;
  fincraStatus: string | null;
  outcome: string;
  error?: string;
  process?: ProcessFincraPaymentResult;
};

const probeEventType = (slot: FincraReconcileSlot): string => `fincra.reconcile.probe.${slot}`;
const applyEventType = (slot: string): string => `fincra.reconcile.${slot}`;

export const dueFincraReconcileSlots = (
  paymentCreatedAt: Date,
  nowMs: number = Date.now(),
): FincraReconcileSlot[] => {
  const ageMs = nowMs - paymentCreatedAt.getTime();
  const due: FincraReconcileSlot[] = [];
  for (const { slot, delayMs } of FINCRA_RECONCILE_SLOTS) {
    if (ageMs >= delayMs) due.push(slot);
  }
  return due;
};

export const hasFincraReconcileProbe = async (
  tx: DbTransaction,
  paymentId: string,
  slot: FincraReconcileSlot,
): Promise<boolean> => {
  const rows = await tx
    .select({ id: paymentEvent.id })
    .from(paymentEvent)
    .where(and(eq(paymentEvent.paymentId, paymentId), eq(paymentEvent.type, probeEventType(slot))))
    .limit(1);
  return rows.length > 0;
};

const recordReconcileProbe = async (
  tx: DbTransaction,
  payRow: ReconcileFincraPaymentRow,
  slot: FincraReconcileSlot,
  fincraStatus: string,
): Promise<void> => {
  await requirePaymentEventPayloadHashDedupeIndex(tx);
  await tx
    .insert(paymentEvent)
    .values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId: payRow.providerOperationId ?? payRow.providerCheckoutId,
      type: probeEventType(slot),
      payloadHash: computeFincraReconcileProbePayloadHash(payRow.id, slot),
    })
    .onConflictDoNothing({ target: paymentEvent.payloadHash });

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action: "fincra_reconcile_probe",
    entityType: "payment",
    entityId: payRow.id,
    afterJson: JSON.stringify({
      slot,
      fincraStatus,
      merchantReference: payRow.providerOperationId,
      payCode: payRow.providerCheckoutId,
      applicationId: payRow.applicationId,
    }),
  });
};

const verifiedToNormalized = (
  payRow: ReconcileFincraPaymentRow,
  rawEventType: string,
  providerPaymentId: string,
): NormalizedPaymentWebhookEvent => ({
  provider: "fincra",
  kind: "payment_completed",
  providerPaymentId,
  amountMinor: Number(payRow.amount),
  currency: payRow.currency,
  metadata: {
    applicationId: payRow.applicationId,
    operationId: payRow.providerOperationId ?? payRow.id,
  },
  rawEventType,
  providerEventId: providerPaymentId,
});

const slotOrDefault = (slot: FincraReconcileSlot | "return"): FincraReconcileSlot =>
  slot === "return" ? "5m" : slot;

const applyOneVerified = async (
  tx: DbTransaction,
  payRow: ReconcileFincraPaymentRow,
  result: Extract<TFincraAttemptVerifyResult, { kind: "verified" }>,
  slot: FincraReconcileSlot | "return",
  requestId: string | null | undefined,
  hashKey: string,
): Promise<ProcessFincraPaymentResult> => {
  const payloadHash = computeFincraReconcilePayloadHash(payRow.id, hashKey, result.verified.status);
  const normalized: NormalizedPaymentWebhookEvent = {
    ...verifiedToNormalized(
      payRow,
      applyEventType(slot),
      result.verified.reference || result.verified.id,
    ),
    metadata: {
      applicationId: payRow.applicationId,
      operationId: result.merchantReference,
    },
  };
  return processFincraVerifiedPaymentInTransaction(tx, {
    normalized,
    decision: result.decision,
    payloadHash,
    eventType: applyEventType(slot),
    requestId,
    logLabel: slot === "return" ? "fincra-reconcile/return" : "fincra-reconcile",
    verifiedIds: { payCode: result.verified.reference, fincraId: result.verified.id },
  });
};

const applyVerificationsInTransaction = async (
  tx: DbTransaction,
  payRow: ReconcileFincraPaymentRow,
  results: TFincraAttemptVerifyResult[],
  slot: FincraReconcileSlot | "return",
  requestId: string | null | undefined,
  recordProbe: boolean,
): Promise<ReconcileFincraAttemptResult> => {
  const summary = summarizeFincraAttemptVerifications(results, {
    paymentCreatedAt: payRow.createdAt instanceof Date ? payRow.createdAt : new Date(payRow.createdAt),
  });
  const probeStatus =
    summary.paid?.verified.status ??
    results.find((result) => result.kind === "verified")?.verified.status ??
    (results.some((result) => result.kind === "not_found") ? "not_found" : "unknown");

  if (recordProbe && slot !== "return") {
    await recordReconcileProbe(tx, payRow, slot, probeStatus);
  }

  if (summary.hasVerifyError && !summary.paid) {
    const err = results.find((result) => result.kind === "error");
    const msg = err && err.kind === "error" ? err.message : "Fincra verify failed";
    createRequestLogger(requestId).error(
      { paymentId: payRow.id, slot, error: msg },
      "[fincra-reconcile] verify failed",
    );
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "fincra_reconcile_error",
      entityType: "payment",
      entityId: payRow.id,
      afterJson: JSON.stringify({
        slot,
        error: msg,
        merchantReferences: results.map((result) => result.merchantReference),
      }),
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slotOrDefault(slot),
      fincraStatus: null,
      outcome: "error_fincra_api",
      error: msg,
    };
  }

  if (summary.paid) {
    let processResult: ProcessFincraPaymentResult;
    try {
      processResult = await applyOneVerified(tx, payRow, summary.paid, slot, requestId, String(slot));
      for (const extra of summary.extraPaid) {
        await applyOneVerified(
          tx,
          { ...payRow, status: "paid", settledMerchantReference: summary.paid.merchantReference },
          extra,
          slot,
          requestId,
          `${slot}:${extra.merchantReference}`,
        );
      }
    } catch (e) {
      if (isPostgresOnConflictMissingConstraintError(e)) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      return {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        slot: slotOrDefault(slot),
        fincraStatus: summary.paid.verified.status,
        outcome: "error_apply",
        error: msg,
      };
    }
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slotOrDefault(slot),
      fincraStatus: summary.paid.verified.status,
      outcome: processResult.outcome,
      process: processResult,
    };
  }

  if (summary.mismatch) {
    let processResult: ProcessFincraPaymentResult;
    try {
      processResult = await applyOneVerified(tx, payRow, summary.mismatch, slot, requestId, `${slot}:mismatch`);
    } catch (e) {
      if (isPostgresOnConflictMissingConstraintError(e)) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      return {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        slot: slotOrDefault(slot),
        fincraStatus: summary.mismatch.verified.status,
        outcome: "error_apply",
        error: msg,
      };
    }
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slotOrDefault(slot),
      fincraStatus: summary.mismatch.verified.status,
      outcome: processResult.outcome,
      process: processResult,
    };
  }

  if (summary.hasPending) {
    const pending = results.find(
      (result) => result.kind === "verified" && result.decision.kind === "pending",
    );
    const reason =
      pending && pending.kind === "verified" && pending.decision.kind === "pending"
        ? pending.decision.reason
        : "open_attempt";
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slotOrDefault(slot),
      fincraStatus: pending && pending.kind === "verified" ? pending.verified.status : null,
      outcome: `pending:${reason}`,
    };
  }

  if (summary.allAbandonable) {
    const memberIds = await loadPartyMemberIds(tx, payRow.applicationId);
    if (memberIds) {
      await abandonFincraCheckoutLock(tx, {
        memberIds,
        paymentId: payRow.id,
        reason: "provider_expired",
        requestId,
      });
    }
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slotOrDefault(slot),
      fincraStatus: probeStatus,
      outcome: "expired",
    };
  }

  return {
    paymentId: payRow.id,
    applicationId: payRow.applicationId,
    slot: slotOrDefault(slot),
    fincraStatus: probeStatus,
    outcome: "pending:not_found",
  };
};

const verifyThenApply = async (
  payRow: ReconcileFincraPaymentRow,
  slot: FincraReconcileSlot | "return",
  requestId: string | null | undefined,
  recordProbe: boolean,
): Promise<ReconcileFincraAttemptResult> => {
  const storedReferences = await withSystemDbActor((tx) =>
    listStoredFincraAttemptReferences(tx, payRow.id),
  );
  const merchantReferences = listFincraMerchantReferencesForPayment(payRow, storedReferences);
  const results = await verifyFincraMerchantReferences({
    merchantReferences,
    payment: payRow,
    alreadyPaid: payRow.status === "paid",
  });
  return withSystemDbActor((tx) =>
    applyVerificationsInTransaction(tx, payRow, results, slot, requestId, recordProbe),
  );
};

export const reconcileFincraPaymentRow = async (
  payRow: ReconcileFincraPaymentRow,
  slot: FincraReconcileSlot,
  requestId?: string | null,
): Promise<ReconcileFincraAttemptResult> =>
  withSpan(
    "reconcile.fincra.payment",
    {
      provider: "fincra",
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      operation: "reconcile.payment",
    },
    async (span) => {
      const result = await reconcileFincraPaymentRowUntraced(payRow, slot, requestId);
      setSafeSpanAttributes(span, { status: result.outcome, errorCode: result.error ? result.outcome : undefined });
      return result;
    },
  );

const reconcileFincraPaymentRowUntraced = async (
  payRow: ReconcileFincraPaymentRow,
  slot: FincraReconcileSlot,
  requestId?: string | null,
): Promise<ReconcileFincraAttemptResult> => {
  if (!(payRow.providerOperationId ?? "").trim() && !payRow.id) {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      fincraStatus: null,
      outcome: "skipped_no_reference",
    };
  }
  const alreadyProbed = await withSystemDbActor((tx) => hasFincraReconcileProbe(tx, payRow.id, slot));
  if (alreadyProbed) {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      fincraStatus: null,
      outcome: "skipped_probe_already_ran",
    };
  }
  return verifyThenApply(payRow, slot, requestId, true);
};

export const reconcileFincraPaymentFromReturn = async (
  payRow: ReconcileFincraPaymentRow,
  requestId?: string | null,
): Promise<ReconcileFincraAttemptResult> => verifyThenApply(payRow, "return", requestId, false);

export const reconcileFincraPaymentRowsSequentially = async (
  rows: ReconcileFincraPaymentRow[],
  reconcileOne: (
    row: ReconcileFincraPaymentRow,
  ) => Promise<ReconcileFincraAttemptResult>,
): Promise<ReconcileFincraAttemptResult[]> => {
  const attempts: ReconcileFincraAttemptResult[] = [];
  for (const row of rows) {
    try {
      attempts.push(await reconcileOne(row));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      createRequestLogger(null).error(
        { paymentId: row.id, error: msg },
        "[fincra-reconcile] row failed; continuing",
      );
      attempts.push({
        paymentId: row.id,
        applicationId: row.applicationId,
        slot: "5m",
        fincraStatus: null,
        outcome: "error_unhandled",
        error: msg,
      });
    }
  }
  return attempts;
};
