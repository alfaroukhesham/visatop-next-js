import crypto from "node:crypto";
import type { NormalizedPaymentWebhookEvent } from "@/lib/payments/normalized-webhook";
import { tryFincraMajorToMinor } from "@/lib/payments/fincra-amounts";

export type FincraWebhookParseResult =
  | { kind: "event"; event: NormalizedPaymentWebhookEvent; merchantReference: string | null }
  | { kind: "ignored"; reason: string };

const timingSafeEqualHex = (a: string, b: string): boolean => {
  try {
    const bufA = Buffer.from(a.trim(), "hex");
    const bufB = Buffer.from(b.trim(), "hex");
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

const hmacSha512Hex = (secret: string, message: string): string =>
  crypto.createHmac("sha512", secret).update(message, "utf8").digest("hex");

/**
 * Fincra signs HMAC-SHA512 of JSON.stringify(payload) (docs.fincra.com/docs/validating-webhook).
 * Also accept HMAC of the raw body in case the dashboard sends unmodified bytes.
 */
export const verifyFincraWebhookSignature = (
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean => {
  if (!secret || !signatureHeader) return false;
  const candidates = new Set<string>([rawBody]);
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    candidates.add(JSON.stringify(parsed));
  } catch {
    /* raw-body only */
  }
  for (const message of candidates) {
    if (timingSafeEqualHex(hmacSha512Hex(secret, message), signatureHeader)) return true;
  }
  return false;
};

export const parseFincraWebhookToNormalized = (rawBody: string): FincraWebhookParseResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { kind: "ignored", reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object") {
    return { kind: "ignored", reason: "invalid_shape" };
  }
  const rec = parsed as Record<string, unknown>;
  const eventName = typeof rec.event === "string" ? rec.event.trim() : "";
  if (eventName !== "charge.successful") {
    return { kind: "ignored", reason: `unsupported_event:${eventName || "missing"}` };
  }
  const { data } = rec;
  if (!data || typeof data !== "object") {
    return { kind: "ignored", reason: "missing_data" };
  }
  const d = data as Record<string, unknown>;
  const idRaw = d.id;
  const id = typeof idRaw === "number" || typeof idRaw === "string" ? String(idRaw) : "";
  const reference = typeof d.reference === "string" ? d.reference : "";
  const chargeReference = typeof d.chargeReference === "string" ? d.chargeReference : "";
  const merchantReference =
    typeof d.merchantReference === "string"
      ? d.merchantReference
      : typeof d.metadata === "object" &&
          d.metadata !== null &&
          typeof (d.metadata as Record<string, unknown>).reference === "string"
        ? String((d.metadata as Record<string, unknown>).reference)
        : null;
  const status = typeof d.status === "string" ? d.status.trim().toLowerCase() : "";
  const currency = typeof d.currency === "string" ? d.currency.trim().toUpperCase() : "NGN";
  const amountMinor =
    tryFincraMajorToMinor(d.amountReceived) ?? tryFincraMajorToMinor(d.amount) ?? BigInt(0);
  const providerPaymentId = reference || chargeReference || id;
  if (!providerPaymentId) {
    return { kind: "ignored", reason: "missing_reference" };
  }
  if (status && status !== "success") {
    return { kind: "ignored", reason: `non_success_status:${status}` };
  }

  const metadata: Record<string, string> = {};
  if (merchantReference) metadata.operationId = merchantReference;
  const collectMeta = (value: unknown, depth: number) => {
    if (depth > 2 || !value || typeof value !== "object") return;
    const meta = value as Record<string, unknown>;
    for (const key of ["applicationId", "priceQuoteId", "partyId", "serviceId", "userId", "isGuest", "paymentId"]) {
      if (typeof meta[key] === "string" && meta[key] && !metadata[key]) metadata[key] = meta[key];
    }
    collectMeta(meta.metadata, depth + 1);
  };
  collectMeta(d.metadata, 0);

  return {
    kind: "event",
    merchantReference,
    event: {
      provider: "fincra",
      kind: "payment_completed",
      providerPaymentId,
      amountMinor: Number(amountMinor),
      currency,
      metadata,
      rawEventType: eventName,
      providerEventId: id || chargeReference || reference,
    },
  };
};

export type FincraWebhookEnvelope = {
  eventName: string;
  providerEventId: string | null;
  /** Our reference sent at checkout (`<paymentId>-aN`). */
  merchantReference: string | null;
  /** Fincra pay code / charge reference (e.g. fcr-p-…). */
  providerReference: string | null;
  status: string | null;
  paymentIdFromMetadata: string | null;
  /** Provider failure copy when present (charge.failed / charge.expired). */
  failureMessage: string | null;
};

/** Lenient read of any Fincra webhook body (all event types) for audit storage and logging. */
export const parseFincraWebhookEnvelope = (rawBody: string): FincraWebhookEnvelope | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  const eventName = typeof rec.event === "string" && rec.event.trim() ? rec.event.trim() : "unknown";
  const d = rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : {};
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null;
  const meta = d.metadata && typeof d.metadata === "object" ? (d.metadata as Record<string, unknown>) : {};
  const innerMeta =
    meta.metadata && typeof meta.metadata === "object" ? (meta.metadata as Record<string, unknown>) : {};
  const errorObj = d.error && typeof d.error === "object" ? (d.error as Record<string, unknown>) : null;
  return {
    eventName,
    providerEventId: str(d.id) ?? str(d.chargeReference) ?? str(d.reference),
    merchantReference: str(d.merchantReference) ?? str(meta.reference),
    providerReference: str(d.reference) ?? str(d.chargeReference),
    status: str(d.status)?.toLowerCase() ?? null,
    paymentIdFromMetadata: str(meta.paymentId) ?? str(innerMeta.paymentId),
    failureMessage:
      str(d.message) ??
      str(d.failureReason) ??
      str(d.failure_reason) ??
      str(d.reason) ??
      str(errorObj?.message) ??
      (typeof d.error === "string" ? str(d.error) : null),
  };
};

/** Non-success charge events we record against the attempt without changing payment/application state. */
export const FINCRA_TERMINAL_UNPAID_EVENTS = new Set(["charge.failed", "charge.expired"]);
