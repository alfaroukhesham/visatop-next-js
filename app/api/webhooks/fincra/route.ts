import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { computePaymentEventPayloadHash } from "@/lib/payments/payment-event-hash";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
} from "@/lib/payments/payment-webhook-db-guard";
import {
  parseFincraWebhookToNormalized,
  verifyFincraWebhookSignature,
} from "@/lib/payments/fincra-webhook";
import { verifyFincraCheckoutByMerchantReference, FincraProviderError } from "@/lib/payments/fincra-client";
import { decideFincraVerifiedPayment } from "@/lib/payments/fincra-verify";
import { processFincraVerifiedPaymentInTransaction } from "@/lib/payments/process-fincra-payment";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";
import { getFincraServerConfig } from "@/lib/payments/resolve-payment-provider";
import { markWebhookReceivedNow, PLATFORM_KEY_LAST_WEBHOOK_FINCRA } from "@/lib/payments/webhook-health";
import { payment } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const [bodyText, hdrs] = await Promise.all([req.text(), headers()]);
  const requestId = hdrs.get("x-request-id");
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
    console.warn("[webhooks/fincra] Invalid webhook signature", {
      requestId,
      hasSignatureHeader: Boolean(sig),
    });
    return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid Fincra webhook signature", {
      status: 401,
      requestId,
    });
  }

  const parsed = parseFincraWebhookToNormalized(bodyText);
  if (parsed.kind === "ignored") {
    return jsonOk({ received: true, ignored: parsed.reason }, { requestId });
  }

  const payloadHash = computePaymentEventPayloadHash("fincra", bodyText);

  let firstPaidApplicationId: string | null = null;
  try {
    const handleResult = await withSystemDbActor(async (tx) => {
      await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_FINCRA);

      let merchantReference = parsed.merchantReference || parsed.event.metadata.operationId || null;
      if (!merchantReference && parsed.event.providerPaymentId) {
        const [byPayCode] = await tx
          .select({ providerOperationId: payment.providerOperationId, id: payment.id })
          .from(payment)
          .where(eq(payment.providerCheckoutId, parsed.event.providerPaymentId))
          .limit(1);
        merchantReference = byPayCode?.providerOperationId ?? byPayCode?.id ?? null;
      }

      if (!merchantReference) {
        console.warn("[webhooks/fincra] Missing merchant reference; cannot verify", {
          requestId,
          providerPaymentId: parsed.event.providerPaymentId,
        });
        return { kind: "noop" as const, firstPaidApplicationId: null as string | null };
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
        console.error("[webhooks/fincra] Verify API failed", { requestId, merchantReference, error: msg });
        throw e;
      }

      const [payForAmount] = await tx
        .select()
        .from(payment)
        .where(or(eq(payment.providerOperationId, merchantReference), eq(payment.id, merchantReference)))
        .limit(1);

      const expectedMinor = payForAmount?.amount ?? BigInt(parsed.event.amountMinor);
      const expectedCurrency = payForAmount?.currency ?? parsed.event.currency;
      const decision = decideFincraVerifiedPayment({
        verified,
        expectedMinor,
        expectedCurrency,
      });

      const normalized = {
        ...parsed.event,
        metadata: {
          ...parsed.event.metadata,
          operationId: merchantReference,
          applicationId: parsed.event.metadata.applicationId || payForAmount?.applicationId || "",
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
    console.error("[webhooks/fincra] Unhandled webhook processing error", {
      requestId,
      err: e instanceof Error ? e.message : e,
    });
    throw e;
  }

  if (firstPaidApplicationId) {
    scheduleFincraPaidSideEffects(firstPaidApplicationId, requestId);
  }

  return jsonOk({ received: true }, { requestId });
}
