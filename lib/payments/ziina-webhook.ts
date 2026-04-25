import crypto from "node:crypto";
import type { NormalizedPaymentWebhookEvent } from "./normalized-webhook";

export type ZiinaWebhookParseResult =
  | { kind: "event"; event: NormalizedPaymentWebhookEvent }
  | { kind: "ignored"; reason: string };

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a.trim(), "hex");
    const bufB = Buffer.from(b.trim(), "hex");
    if (bufA.length !== bufB.length || bufA.length === 0) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Verify `X-Hmac-Signature` (hex HMAC-SHA256 of raw body) per Ziina docs.
 */
export function verifyZiinaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!secret || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return timingSafeEqualHex(expected, signatureHeader);
}

function readForwardedClientIp(forwardedFor: string | null): string | null {
  if (!forwardedFor) return null;
  const first = forwardedFor.split(",")[0]?.trim();
  return first || null;
}

export function assertZiinaWebhookSourceIpAllowed(
  forwardedFor: string | null,
  remoteAddr: string | null,
  allowed: ReadonlySet<string>,
): boolean {
  const candidates = new Set<string>();
  const direct = (remoteAddr ?? "").trim();
  if (direct) candidates.add(direct);
  const fromXff = (forwardedFor ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const ip of fromXff) candidates.add(ip);
  if (candidates.size === 0) return false;
  for (const ip of candidates) {
    if (allowed.has(ip)) return true;
  }
  return false;
}

export function parseZiinaWebhookToNormalized(rawBody: string): ZiinaWebhookParseResult {
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
  const eventName = typeof rec.event === "string" ? rec.event : "";
  if (eventName !== "payment_intent.status.updated") {
    return { kind: "ignored", reason: `unsupported_event:${eventName || "missing"}` };
  }

  const { data } = rec;
  if (!data || typeof data !== "object") {
    return { kind: "ignored", reason: "missing_data" };
  }
  const d = data as Record<string, unknown>;
  const id = typeof d.id === "string" ? d.id : "";
  const status = typeof d.status === "string" ? d.status : "";
  const amount = typeof d.amount === "number" ? d.amount : Number(d.amount);
  const currency =
    typeof d.currency_code === "string" ? d.currency_code.trim().toUpperCase() : "USD";
  const operationId = typeof d.operation_id === "string" ? d.operation_id : null;

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
        rawEventType: eventName,
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
        rawEventType: eventName,
        providerEventId: id,
      },
    };
  }

  return { kind: "ignored", reason: `unknown_status:${status}` };
}
