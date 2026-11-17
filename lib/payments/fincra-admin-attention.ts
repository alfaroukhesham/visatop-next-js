import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { application, auditLog } from "@/lib/db/schema";

export const FINCRA_ATTENTION_EXTRA_COLLECTION = "fincra_extra_collection";
export const FINCRA_ATTENTION_PAID_AFTER_CANCEL = "fincra_paid_after_cancel";
export const FINCRA_ATTENTION_AMOUNT_MISMATCH = "fincra_amount_mismatch";
export const FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT = "fincra_variance_underpayment";
export const FINCRA_ATTENTION_VARIANCE_OVERPAYMENT = "fincra_variance_overpayment";

export type TFincraAdminAttentionReason =
  | typeof FINCRA_ATTENTION_EXTRA_COLLECTION
  | typeof FINCRA_ATTENTION_PAID_AFTER_CANCEL
  | typeof FINCRA_ATTENTION_AMOUNT_MISMATCH
  | typeof FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT
  | typeof FINCRA_ATTENTION_VARIANCE_OVERPAYMENT;

export const fincraAttentionReasonFromMismatch = (
  reason: "amount_mismatch" | "currency_mismatch" | "variance_underpayment" | "variance_overpayment",
): TFincraAdminAttentionReason => {
  if (reason === "variance_underpayment") return FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT;
  if (reason === "variance_overpayment") return FINCRA_ATTENTION_VARIANCE_OVERPAYMENT;
  return FINCRA_ATTENTION_AMOUNT_MISMATCH;
};

const ATTENTION_REASONS = new Set<string>([
  FINCRA_ATTENTION_EXTRA_COLLECTION,
  FINCRA_ATTENTION_PAID_AFTER_CANCEL,
  FINCRA_ATTENTION_AMOUNT_MISMATCH,
  FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT,
  FINCRA_ATTENTION_VARIANCE_OVERPAYMENT,
]);

export type TFincraAdminAttentionEvent = {
  reason: TFincraAdminAttentionReason;
  providerReference: string | null;
  merchantReference: string;
  amountMinor: string;
  currency: string;
  timestamp: string;
};

export type TFincraAdminAttentionDetails = {
  events: TFincraAdminAttentionEvent[];
};

export const parseFincraAdminAttentionDetails = (
  raw: unknown,
): TFincraAdminAttentionDetails => {
  if (!raw || typeof raw !== "object") return { events: [] };
  const eventsRaw = (raw as { events?: unknown }).events;
  if (!Array.isArray(eventsRaw)) return { events: [] };
  const events: TFincraAdminAttentionEvent[] = [];
  for (const item of eventsRaw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const reason = rec.reason;
    if (typeof reason !== "string" || !ATTENTION_REASONS.has(reason)) {
      continue;
    }
    events.push({
      reason: reason as TFincraAdminAttentionReason,
      providerReference: typeof rec.providerReference === "string" ? rec.providerReference : null,
      merchantReference: typeof rec.merchantReference === "string" ? rec.merchantReference : "",
      amountMinor: typeof rec.amountMinor === "string" ? rec.amountMinor : "0",
      currency: typeof rec.currency === "string" ? rec.currency : "",
      timestamp: typeof rec.timestamp === "string" ? rec.timestamp : "",
    });
  }
  return { events };
};

export const formatFincraAdminAttentionBanner = (params: {
  reason: string | null | undefined;
  details: unknown;
}): { title: string; body: string } => {
  const details = parseFincraAdminAttentionDetails(params.details);
  const latest = details.events[details.events.length - 1];
  const reason = params.reason ?? latest?.reason ?? null;
  if (reason === FINCRA_ATTENTION_EXTRA_COLLECTION) {
    const parts = [
      "A second Fincra collection landed on an already-paid payment.",
      "Do not treat this as a harmless duplicate — refund from the existing refund control after checking the provider reference.",
    ];
    if (latest) {
      parts.push(
        `Reason: ${reason}. Provider ref: ${latest.providerReference ?? "n/a"}. Merchant ref: ${latest.merchantReference}. Amount: ${latest.amountMinor} ${latest.currency}. At: ${latest.timestamp}.`,
      );
    }
    return { title: "Fincra extra collection — refund required", body: parts.join(" ") };
  }
  if (reason === FINCRA_ATTENTION_PAID_AFTER_CANCEL) {
    const parts = [
      "Fincra reported a successful charge after this application was cancelled.",
      "The application was not marked paid. Refund from the existing refund control after checking the provider reference.",
    ];
    if (latest) {
      parts.push(
        `Reason: ${reason}. Provider ref: ${latest.providerReference ?? "n/a"}. Merchant ref: ${latest.merchantReference}. Amount: ${latest.amountMinor} ${latest.currency}. At: ${latest.timestamp}.`,
      );
    }
    return { title: "Fincra paid after cancel — refund required", body: parts.join(" ") };
  }
  if (reason === FINCRA_ATTENTION_VARIANCE_UNDERPAYMENT) {
    return {
      title: "Fincra underpayment — held for review",
      body: `Reason: ${reason}. Fincra reported an underpayment (status can still be success). Not marked paid. Check amountReceived vs amountExpected; Fincra auto-reverses underpayments by default.`,
    };
  }
  if (reason === FINCRA_ATTENTION_VARIANCE_OVERPAYMENT) {
    return {
      title: "Fincra overpayment — held for review",
      body: `Reason: ${reason}. Fincra reported an overpayment (status can still be success). Not marked paid. Check amountReceived vs amountExpected; Fincra auto-reverses excess overpayments by default.`,
    };
  }
  if (reason === FINCRA_ATTENTION_AMOUNT_MISMATCH) {
    return {
      title: "Fincra amount or currency mismatch — held for review",
      body: `Reason: ${reason}. Customer-paid amount or currency does not match the locked quote. Not marked paid. Do not match on amountToSettle.`,
    };
  }
  return {
    title: "Manual Intervention Required",
    body: "This application was flagged by the system — check the audit log for details.",
  };
};

export const recordFincraAdminAttention = async (
  tx: DbTransaction,
  params: {
    appRow: {
      id: string;
      adminAttentionRequired: boolean;
      adminAttentionReason?: string | null;
      adminAttentionDetails?: unknown;
    };
    reason: TFincraAdminAttentionReason;
    providerReference: string | null;
    merchantReference: string;
    amountMinor: bigint | number | string;
    currency: string;
    requestId?: string | null;
    timestamp?: Date;
    amountAudit?: Record<string, string | null>;
  },
): Promise<void> => {
  const timestamp = (params.timestamp ?? new Date()).toISOString();
  const event: TFincraAdminAttentionEvent = {
    reason: params.reason,
    providerReference: params.providerReference,
    merchantReference: params.merchantReference,
    amountMinor: params.amountMinor.toString(),
    currency: params.currency,
    timestamp,
  };
  const existing = parseFincraAdminAttentionDetails(params.appRow.adminAttentionDetails);
  const details: TFincraAdminAttentionDetails = { events: [...existing.events, event] };

  await tx
    .update(application)
    .set({
      adminAttentionRequired: true,
      adminAttentionReason: params.reason,
      adminAttentionDetails: details,
    })
    .where(eq(application.id, params.appRow.id));

  await tx.insert(auditLog).values({
    actorType: "system",
    actorId: null,
    action:
      params.reason === FINCRA_ATTENTION_EXTRA_COLLECTION
        ? "payment_fincra_extra_collection"
        : params.reason === FINCRA_ATTENTION_PAID_AFTER_CANCEL
          ? "payment_fincra_paid_after_cancel"
          : "payment_fincra_mismatch_flagged",
    entityType: "application",
    entityId: params.appRow.id,
    beforeJson: JSON.stringify({
      adminAttentionRequired: params.appRow.adminAttentionRequired,
      adminAttentionReason: params.appRow.adminAttentionReason ?? null,
    }),
    afterJson: JSON.stringify({
      reason: params.reason,
      providerReference: params.providerReference,
      merchantReference: params.merchantReference,
      amountMinor: event.amountMinor,
      currency: params.currency,
      timestamp,
      requestId: params.requestId ?? null,
      ...(params.amountAudit ?? {}),
    }),
  });
};
