import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { computePaymentEventPayloadHash } from "@/lib/payments/payment-event-hash";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
} from "@/lib/payments/payment-webhook-db-guard";
import {
  parseFincraWebhookEnvelope,
  parseFincraWebhookToNormalized,
  verifyFincraWebhookSignature,
} from "@/lib/payments/fincra-webhook";
import {
  auditFincraUnpaidAttemptEvent,
  recordFincraWebhookEvent,
} from "@/lib/payments/fincra-webhook-record";
import { verifyFincraCheckoutByMerchantReference, FincraProviderError } from "@/lib/payments/fincra-client";
import { decideFincraVerifiedPayment } from "@/lib/payments/fincra-verify";
import { processFincraVerifiedPaymentInTransaction } from "@/lib/payments/process-fincra-payment";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import { markWebhookReceivedNow, PLATFORM_KEY_LAST_WEBHOOK_FINCRA } from "@/lib/payments/webhook-health";
import { findFincraPaymentForWebhookRefs } from "@/lib/payments/fincra-payment-lookup";
import { createRequestLogger } from "@/lib/logger";
import { withSpan } from "@/lib/observability/tracing";

export const runtime = "nodejs";

export const POST = async (req: Request) =>
  withSpan("payments.webhook.fincra", { provider: "fincra", operation: "webhook" }, () =>
    postFincraWebhook(req),
  );

const postFincraWebhook = async (req: Request) => {
  const [bodyText, hdrs] = await Promise.all([req.text(), headers()]);
  const requestId = hdrs.get("x-request-id");
  const log = createRequestLogger(requestId);
  const sig = req.headers.get("signature") ?? hdrs.get("signature");

  let cfg;
  try {
    cfg = getFincraServerConfig();
  } catch {
    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      return jsonError("WEBHOOK_SECRET_NOT_CONFIGURED", "Fincra webhook secret is not configured", {
        status: 503,
        requestId,
        details: { code: "webhook_secret_not_configured" },
      });
    }
    return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid or missing Fincra webhook signature", {
      status: 401,
      requestId,
    });
  }

  if (!verifyFincraWebhookSignature(bodyText, sig, cfg.webhookSecret)) {
    log.warn(
      { marker: "webhook_signature_rejected", hasSignatureHeader: Boolean(sig) },
      "[webhooks/fincra] Invalid webhook signature",
    );
    return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid Fincra webhook signature", {
      status: 401,
      requestId,
    });
  }

  const envelope = parseFincraWebhookEnvelope(bodyText);
  if (!envelope) {
    log.warn("[webhooks/fincra] Verified webhook with unparseable body");
    return jsonOk({ received: true, ignored: "invalid_json" }, { requestId });
  }
  const logCtx = {
    event: envelope.eventName,
    merchantReference: envelope.merchantReference,
    providerReference: envelope.providerReference,
    providerEventId: envelope.providerEventId,
    status: envelope.status,
  };
  log.info(logCtx, "[webhooks/fincra] Webhook received");

  const payloadHash = computePaymentEventPayloadHash("fincra", bodyText);
  const parsed = parseFincraWebhookToNormalized(bodyText);

  if (parsed.kind === "ignored") {
    // Non-success (charge.failed / charge.expired / other) events: always persist, never mark paid.
    try {
      const result = await withSystemDbActor(async (tx) => {
        await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_FINCRA);
        const payRow = await findFincraPaymentForWebhookRefs(tx, {
          merchantReference: envelope.merchantReference,
          paymentIdFromMetadata: envelope.paymentIdFromMetadata,
          providerPaymentId: envelope.providerReference,
        });
        const stored = await recordFincraWebhookEvent(tx, { envelope, payloadHash, payRow });
        const attempt =
          stored && payRow ? await auditFincraUnpaidAttemptEvent(tx, { envelope, payRow, requestId }) : null;
        return { stored, matched: Boolean(payRow), paymentId: payRow?.id ?? null, attempt };
      });
      log.info(
        {
          ...logCtx,
          ...(result.matched ? {} : { marker: "webhook_unmatched" }),
          outcome: result.stored ? (result.matched ? "stored" : "stored_unmatched") : "duplicate",
          paymentId: result.paymentId,
          isCurrentAttempt: result.attempt?.isCurrentAttempt ?? null,
          ignoredReason: parsed.reason,
        },
        "[webhooks/fincra] Webhook recorded",
      );
      return jsonOk(
        { received: true, ignored: parsed.reason, matched: result.matched, duplicate: !result.stored },
        { requestId },
      );
    } catch (e) {
      if (e instanceof PaymentWebhookSchemaDeploymentError || isPostgresOnConflictMissingConstraintError(e)) {
        return jsonError("SERVICE_UNAVAILABLE", "Payment webhook storage is not migrated", {
          status: 503,
          requestId,
          details: { code: "payment_event_dedupe_index_missing" },
        });
      }
      log.error({ ...logCtx, err: e }, "[webhooks/fincra] Failed to record webhook");
      throw e;
    }
  }

  let firstPaidApplicationId: string | null = null;
  try {
    const handleResult = await withSystemDbActor(async (tx) => {
      await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_FINCRA);

      const payForAmount = await findFincraPaymentForWebhookRefs(tx, {
        merchantReference: parsed.merchantReference || parsed.event.metadata.operationId || null,
        paymentIdFromMetadata: parsed.event.metadata.paymentId || null,
        providerPaymentId: parsed.event.providerPaymentId,
      });

      if (!payForAmount) {
        const stored = await recordFincraWebhookEvent(tx, { envelope, payloadHash, payRow: null });
        log.warn(
          {
            ...logCtx,
            marker: "webhook_unmatched",
            outcome: stored ? "stored_unmatched" : "duplicate",
          },
          "[webhooks/fincra] Unknown merchant reference; stored unmatched, not marking paid",
        );
        return { kind: "noop" as const, firstPaidApplicationId: null as string | null };
      }

      const merchantReference =
        parsed.merchantReference ||
        parsed.event.metadata.operationId ||
        payForAmount.providerOperationId ||
        payForAmount.id;

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
        log.error({ error: msg }, "[webhooks/fincra] Verify API failed");
        throw e;
      }

      const decision = decideFincraVerifiedPayment({
        verified,
        payment: payForAmount,
        merchantReference,
      });

      const normalized = {
        ...parsed.event,
        metadata: {
          ...parsed.event.metadata,
          operationId: merchantReference,
          applicationId: parsed.event.metadata.applicationId || payForAmount?.applicationId || "",
          paymentId: parsed.event.metadata.paymentId || payForAmount.id,
        },
        providerPaymentId: verified.reference || parsed.event.providerPaymentId,
      };

      const processResult = await processFincraVerifiedPaymentInTransaction(tx, {
        normalized,
        decision,
        payloadHash,
        eventType: parsed.event.rawEventType,
        requestId,
        logLabel: "webhooks/fincra",
        verifiedIds: { payCode: verified.reference, fincraId: verified.id },
      });

      // Persist every verified event (pending / unknown / duplicate outcomes included); no-op if already stored.
      await recordFincraWebhookEvent(tx, { envelope, payloadHash, payRow: payForAmount });
      log.info(
        { ...logCtx, outcome: processResult.outcome, paymentId: payForAmount.id },
        "[webhooks/fincra] Webhook recorded",
      );

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
      return jsonError(
        "SERVICE_UNAVAILABLE",
        "Payment webhook storage is not migrated; cannot record Fincra events safely. Apply database migrations, then retry.",
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
    log.error({ err: e }, "[webhooks/fincra] Unhandled webhook processing error");
    throw e;
  }

  if (firstPaidApplicationId) {
    scheduleFincraPaidSideEffects(firstPaidApplicationId, requestId);
  }

  return jsonOk({ received: true }, { requestId });
};
