import type { ParsedWebhookEvent } from "./types";
import { paddleAdapter } from "./paddle-adapter";
import type { NormalizedPaymentWebhookEvent } from "./normalized-webhook";

function readPaddleCurrencyCode(data: Record<string, unknown>): string {
  const direct = data.currency_code;
  if (typeof direct === "string" && /^[A-Za-z]{3}$/.test(direct.trim())) {
    return direct.trim().toUpperCase();
  }
  const details = data.details as Record<string, unknown> | undefined;
  const totals = details?.totals as Record<string, unknown> | undefined;
  const tCur = totals?.currency_code;
  if (typeof tCur === "string" && /^[A-Za-z]{3}$/.test(tCur.trim())) {
    return tCur.trim().toUpperCase();
  }
  const dataTotals = data.totals as Record<string, unknown> | undefined;
  const dtCur = dataTotals?.currency_code;
  if (typeof dtCur === "string" && /^[A-Za-z]{3}$/.test(dtCur.trim())) {
    return dtCur.trim().toUpperCase();
  }
  return "USD";
}

/**
 * Map Paddle webhook JSON + adapter parse output to a normalized event for `applyPaymentWebhookEvent`.
 * Throws if the payload cannot be normalized for supported Paddle event types.
 */
export function parsePaddleWebhookBodyToNormalized(bodyText: string): NormalizedPaymentWebhookEvent {
  const parsed = paddleAdapter.parseWebhookEvent(bodyText);
  const raw = JSON.parse(bodyText) as {
    event_type?: string;
    event_id?: string;
    data?: Record<string, unknown>;
  };
  const data = raw.data ?? {};
  const rawEventType = typeof raw.event_type === "string" ? raw.event_type : parsed.type;
  const currency = readPaddleCurrencyCode(data);

  const kind = paddleParsedToKind(parsed);
  if (!kind) {
    throw new Error(`Unsupported Paddle webhook event for apply: ${rawEventType}`);
  }

  return {
    provider: "paddle",
    kind,
    providerPaymentId: parsed.transactionId,
    amountMinor: parsed.amountMinor,
    currency,
    metadata: parsed.metadata ?? {},
    rawEventType,
    providerEventId: typeof raw.event_id === "string" ? raw.event_id : null,
  };
}

function paddleParsedToKind(event: ParsedWebhookEvent): NormalizedPaymentWebhookEvent["kind"] | null {
  if (event.type === "transaction.completed" || event.type === "transaction.paid") {
    return "payment_completed";
  }
  if (event.type === "transaction.payment_failed") {
    return "payment_failed";
  }
  return null;
}
