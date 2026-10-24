import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type { DbTransaction } from "@/lib/db";
import { auditLog, payment, paymentEvent } from "@/lib/db/schema";
import {
  FincraProviderError,
  verifyFincraCheckoutByMerchantReference,
} from "@/lib/payments/fincra-client";
import { decideFincraVerifiedPayment } from "@/lib/payments/fincra-verify";
import {
  processFincraVerifiedPaymentInTransaction,
  type ProcessFincraPaymentResult,
} from "@/lib/payments/process-fincra-payment";
import {
  computeFincraReconcilePayloadHash,
  computeFincraReconcileProbePayloadHash,
} from "@/lib/payments/payment-event-hash";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";
import {
  isPostgresOnConflictMissingConstraintError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";

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

const applyVerified = async (
  tx: DbTransaction,
  payRow: ReconcileFincraPaymentRow,
  slot: FincraReconcileSlot | "return",
  requestId: string | null | undefined,
  recordProbe: boolean,
): Promise<ReconcileFincraAttemptResult> => {
  const merchantReference = payRow.providerOperationId?.trim() || payRow.id;
  let cfg;
  try {
    cfg = getFincraServerConfig();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fincra not configured";
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slot === "return" ? "5m" : slot,
      fincraStatus: null,
      outcome: "error_config",
      error: msg,
    };
  }

  let verified;
  try {
    verified = await verifyFincraCheckoutByMerchantReference({
      apiBaseUrl: cfg.apiBaseUrl,
      secretKey: cfg.secretKey,
      businessId: cfg.businessId,
      merchantReference,
      timeoutMs: 8000,
    });
  } catch (e) {
    const msg = e instanceof FincraProviderError ? e.message : e instanceof Error ? e.message : String(e);
    console.error("[fincra-reconcile] verify failed", {
      paymentId: payRow.id,
      merchantReference,
      slot,
      error: msg,
    });
    await tx.insert(auditLog).values({
      actorType: "system",
      actorId: null,
      action: "fincra_reconcile_error",
      entityType: "payment",
      entityId: payRow.id,
      afterJson: JSON.stringify({ slot, merchantReference, error: msg }),
    });
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slot === "return" ? "5m" : slot,
      fincraStatus: null,
      outcome: "error_fincra_api",
      error: msg,
    };
  }

  if (recordProbe && slot !== "return") {
    await recordReconcileProbe(tx, payRow, slot, verified.status);
  }

  const decision = decideFincraVerifiedPayment({
    verified,
    payment: payRow,
    merchantReference,
  });

  if (decision.kind === "pending") {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slot === "return" ? "5m" : slot,
      fincraStatus: verified.status,
      outcome: `pending:${decision.reason}`,
    };
  }

  const payloadHash = computeFincraReconcilePayloadHash(payRow.id, slot, verified.status);
  const normalized = verifiedToNormalized(
    payRow,
    applyEventType(slot),
    verified.reference || verified.id,
  );

  let processResult: ProcessFincraPaymentResult;
  try {
    processResult = await processFincraVerifiedPaymentInTransaction(tx, {
      normalized,
      decision,
      payloadHash,
      eventType: applyEventType(slot),
      requestId,
      logLabel: slot === "return" ? "fincra-reconcile/return" : "fincra-reconcile",
      verifiedIds: { payCode: verified.reference, fincraId: verified.id },
    });
  } catch (e) {
    if (isPostgresOnConflictMissingConstraintError(e)) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot: slot === "return" ? "5m" : slot,
      fincraStatus: verified.status,
      outcome: "error_apply",
      error: msg,
    };
  }

  return {
    paymentId: payRow.id,
    applicationId: payRow.applicationId,
    slot: slot === "return" ? "5m" : slot,
    fincraStatus: verified.status,
    outcome: processResult.outcome,
    process: processResult,
  };
};

export const reconcileFincraPaymentRow = async (
  tx: DbTransaction,
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
  if (await hasFincraReconcileProbe(tx, payRow.id, slot)) {
    return {
      paymentId: payRow.id,
      applicationId: payRow.applicationId,
      slot,
      fincraStatus: null,
      outcome: "skipped_probe_already_ran",
    };
  }
  return applyVerified(tx, payRow, slot, requestId, true);
};

export const reconcileFincraPaymentFromReturn = async (
  tx: DbTransaction,
  payRow: ReconcileFincraPaymentRow,
  requestId?: string | null,
): Promise<ReconcileFincraAttemptResult> => applyVerified(tx, payRow, "return", requestId, false);
