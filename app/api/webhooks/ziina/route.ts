import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { computePaymentEventPayloadHash } from "@/lib/payments/payment-event-hash";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
} from "@/lib/payments/payment-webhook-db-guard";
import { processZiinaPaymentInTransaction } from "@/lib/payments/process-ziina-payment";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";
import {
  assertZiinaWebhookSourceIpAllowed,
  parseZiinaWebhookToNormalized,
  verifyZiinaWebhookSignature,
} from "@/lib/payments/ziina-webhook";
import { ZIINA_WEBHOOK_SOURCE_IPS } from "@/lib/payments/resolve-payment-provider";
import { markWebhookReceivedNow, PLATFORM_KEY_LAST_WEBHOOK_ZIINA } from "@/lib/payments/webhook-health";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const sig = req.headers.get("x-hmac-signature") ?? hdrs.get("x-hmac-signature");

  const secret = process.env.ZIINA_WEBHOOK_SECRET?.trim() ?? "";
  const isProd = process.env.NODE_ENV === "production";
  const allowUnsigned = process.env.ZIINA_WEBHOOK_ALLOW_UNSIGNED === "true";

  if (!secret) {
    if (isProd) {
      console.error("[webhooks/ziina] WEBHOOK_SECRET_NOT_CONFIGURED — rejecting in production", {
        requestId,
      });
      return jsonError("WEBHOOK_SECRET_NOT_CONFIGURED", "Ziina webhook secret is not configured", {
        status: 503,
        requestId,
        details: { code: "webhook_secret_not_configured" },
      });
    }
    if (!allowUnsigned) {
      console.warn("[webhooks/ziina] Missing webhook secret and unsigned not allowed", { requestId });
      return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid or missing Ziina webhook signature", {
        status: 401,
        requestId,
      });
    }
    console.error("[webhooks/ziina] CRITICAL: ZIINA_WEBHOOK_ALLOW_UNSIGNED=true — webhooks are not authenticated");
  } else if (!verifyZiinaWebhookSignature(bodyText, sig, secret)) {
    console.warn("[webhooks/ziina] Invalid webhook signature", {
      requestId,
      hasSignatureHeader: Boolean(sig),
    });
    return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid Ziina webhook signature", { status: 401, requestId });
  }

  const enforceIp = process.env.ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST === "true";
  if (enforceIp) {
    const xff = req.headers.get("x-forwarded-for");
    const netlifyClientIp = req.headers.get("x-nf-client-connection-ip");
    const ok = assertZiinaWebhookSourceIpAllowed(xff, netlifyClientIp, ZIINA_WEBHOOK_SOURCE_IPS);
    if (!ok) {
      console.warn("[webhooks/ziina] Webhook source IP not allowlisted", {
        requestId,
        xForwardedFor: xff,
        clientIp: netlifyClientIp,
      });
      return jsonError("UNAUTHORIZED", "Webhook source IP not allowlisted", { status: 401, requestId });
    }
  }

  const parsed = parseZiinaWebhookToNormalized(bodyText);
  if (parsed.kind === "ignored") {
    let intentId: string | undefined;
    try {
      const body = JSON.parse(bodyText) as { data?: { id?: string; status?: string } };
      intentId = body.data?.id;
      console.info("[webhooks/ziina] Webhook ignored (no state change)", {
        requestId,
        reason: parsed.reason,
        intentId,
        ziinaStatus: body.data?.status,
      });
    } catch {
      console.info("[webhooks/ziina] Webhook ignored (no state change)", {
        requestId,
        reason: parsed.reason,
      });
    }
    return jsonOk({ received: true, ignored: parsed.reason }, { requestId });
  }

  const normalized = parsed.event;
  const payloadHash = computePaymentEventPayloadHash("ziina", bodyText);
  const eventType = normalized.rawEventType;

  let firstPaidApplicationId: string | null = null;
  try {
    const handleResult = await withSystemDbActor(async (tx) => {
      await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_ZIINA);

      const processResult = await processZiinaPaymentInTransaction(tx, {
        normalized,
        payloadHash,
        eventType,
        requestId,
        logLabel: "webhooks/ziina",
      });

      if (processResult.outcome === "rejected_provider_mismatch") {
        return { kind: "reject" as const, firstPaidApplicationId: null as string | null };
      }

      return {
        kind: "noop" as const,
        firstPaidApplicationId: processResult.firstPaidApplicationId,
      };
    });

    firstPaidApplicationId = handleResult.firstPaidApplicationId ?? null;

    if (handleResult.kind === "reject") {
      return jsonError("UNAUTHORIZED", "Provider mismatch", { status: 401, requestId });
    }
  } catch (e) {
    if (e instanceof PaymentWebhookSchemaDeploymentError || isPostgresOnConflictMissingConstraintError(e)) {
      console.error("[webhooks/ziina] payment_event idempotency index missing or ON CONFLICT unusable", {
        requestId,
        err: e instanceof Error ? e.message : e,
      });
      return jsonError(
        "SERVICE_UNAVAILABLE",
        "Payment webhook storage is not migrated; cannot record Ziina events safely. Apply database migrations, then retry.",
        {
          status: 503,
          requestId,
          details: {
            code: "payment_event_dedupe_index_missing",
            requiredIndex: "payment_event_payload_hash_unique",
          },
        },
      );
    }
    console.error("[webhooks/ziina] Unhandled webhook processing error", {
      requestId,
      intentId: normalized.providerPaymentId,
      err: e instanceof Error ? e.message : e,
    });
    throw e;
  }

  if (firstPaidApplicationId) {
    scheduleZiinaPaidSideEffects(firstPaidApplicationId, requestId);
  }

  return jsonOk({ received: true }, { requestId });
}
