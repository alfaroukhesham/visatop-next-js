import type { NormalizedPaymentWebhookEvent } from "./normalized-webhook";

export type ZiinaIntentSnapshot = {
  id: string;
  status: string;
  amountMinor: number;
  currencyCode: string;
  operationId?: string | null;
};

export type ZiinaIntentMapResult =
  | { kind: "event"; event: NormalizedPaymentWebhookEvent }
  | { kind: "ignored"; reason: string };

/**
 * Map a Ziina PaymentIntent status (webhook `data` or GET /payment_intent/{id}) to a normalized event.
 */
export function mapZiinaIntentSnapshotToNormalized(
  snapshot: ZiinaIntentSnapshot,
  rawEventType: string,
): ZiinaIntentMapResult {
  const { id, status } = snapshot;
  const amount = snapshot.amountMinor;
  const currency = snapshot.currencyCode.trim().toUpperCase() || "USD";
  const operationId = snapshot.operationId ?? null;

  if (!id) {
    return { kind: "ignored", reason: "missing_intent_id" };
  }

  if (
    status === "requires_payment_instrument" ||
    status === "pending" ||
    status === "requires_user_action"
  ) {
    return { kind: "ignored", reason: `non_terminal_status:${status}` };
  }

  if (status === "completed") {
    return {
      kind: "event",
      event: {
        provider: "ziina",
        kind: "payment_completed",
        providerPaymentId: id,
        amountMinor: Number.isFinite(amount) ? amount : 0,
        currency: currency.length === 3 ? currency : "USD",
        metadata: operationId ? { operationId } : {},
        rawEventType,
        providerEventId: id,
      },
    };
  }

  if (status === "failed" || status === "canceled") {
    return {
      kind: "event",
      event: {
        provider: "ziina",
        kind: "payment_failed",
        providerPaymentId: id,
        amountMinor: Number.isFinite(amount) ? amount : 0,
        currency: currency.length === 3 ? currency : "USD",
        metadata: operationId ? { operationId } : {},
        rawEventType,
        providerEventId: id,
      },
    };
  }

  return { kind: "ignored", reason: `unknown_status:${status}` };
}

export function ziinaIntentFromApiRecord(rec: Record<string, unknown>): ZiinaIntentSnapshot | null {
  const id = typeof rec.id === "string" ? rec.id : "";
  const status = typeof rec.status === "string" ? rec.status : "";
  const amountRaw = rec.amount;
  const amount =
    typeof amountRaw === "number" ? amountRaw : typeof amountRaw === "string" ? Number(amountRaw) : NaN;
  const currencyCode =
    typeof rec.currency_code === "string" ? rec.currency_code : "USD";
  const operationId = typeof rec.operation_id === "string" ? rec.operation_id : null;
  if (!id || !status) return null;
  return {
    id,
    status,
    amountMinor: Number.isFinite(amount) ? amount : 0,
    currencyCode,
    operationId,
  };
}
