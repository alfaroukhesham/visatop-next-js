import { headers } from "next/headers";
import { after } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  applyPaymentWebhookEvent,
  resolvePaymentRowForWebhook,
} from "@/lib/payments/apply-payment-webhook-event";
import { computePaymentEventPayloadHash } from "@/lib/payments/payment-event-hash";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";
import {
  assertZiinaWebhookSourceIpAllowed,
  parseZiinaWebhookToNormalized,
  verifyZiinaWebhookSignature,
} from "@/lib/payments/ziina-webhook";
import { ZIINA_WEBHOOK_SOURCE_IPS } from "@/lib/payments/resolve-payment-provider";
import { application, auditLog, paymentEvent } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { markWebhookReceivedNow, PLATFORM_KEY_LAST_WEBHOOK_ZIINA } from "@/lib/payments/webhook-health";
import { sendPaymentReceivedInProgressEmail } from "@/lib/email/send-application-transactional-emails";

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
    // Never allow unsigned webhooks in production.
    if (isProd) {
      return jsonError("WEBHOOK_SECRET_NOT_CONFIGURED", "Ziina webhook secret is not configured", {
        status: 503,
        requestId,
        details: { code: "webhook_secret_not_configured" },
      });
    }
    if (!allowUnsigned) {
      return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid or missing Ziina webhook signature", {
        status: 401,
        requestId,
      });
    }
    console.error("[webhooks/ziina] CRITICAL: ZIINA_WEBHOOK_ALLOW_UNSIGNED=true — webhooks are not authenticated");
  } else if (!verifyZiinaWebhookSignature(bodyText, sig, secret)) {
    return jsonError("WEBHOOK_SIGNATURE_INVALID", "Invalid Ziina webhook signature", { status: 401, requestId });
  }

  const enforceIp = process.env.ZIINA_ENFORCE_WEBHOOK_IP_ALLOWLIST === "true";
  if (enforceIp) {
    // Netlify sets `x-nf-client-connection-ip`; fall back to checking *any* IP in x-forwarded-for.
    const xff = req.headers.get("x-forwarded-for");
    const netlifyClientIp = req.headers.get("x-nf-client-connection-ip");
    const ok = assertZiinaWebhookSourceIpAllowed(xff, netlifyClientIp, ZIINA_WEBHOOK_SOURCE_IPS);
    if (!ok) {
      return jsonError("UNAUTHORIZED", "Webhook source IP not allowlisted", { status: 401, requestId });
    }
  }

  const parsed = parseZiinaWebhookToNormalized(bodyText);
  if (parsed.kind === "ignored") {
    return jsonOk({ received: true, ignored: parsed.reason }, { requestId });
  }

  const normalized = parsed.event;
  const payloadHash = computePaymentEventPayloadHash("ziina", bodyText);
  const providerEventId =
    typeof normalized.providerEventId === "string" && normalized.providerEventId ?
      normalized.providerEventId
    : normalized.providerPaymentId;

  let firstPaidApplicationId: string | null = null;
  try {
    const handleResult = await withSystemDbActor(async (tx) => {
      await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_ZIINA);

      const payRow = await resolvePaymentRowForWebhook(tx, normalized);
      if (!payRow) {
        // Expected for admin smoke-test intents (not linked to an application payment row).
        console.info("[webhooks/ziina] Webhook received but no matching payment row", {
          intentId: normalized.providerPaymentId,
        });
        return { kind: "noop" as const, firstPaidApplicationId: null as string | null };
      }

      if (payRow.provider !== "ziina") {
        console.warn("[webhooks/ziina] payment row provider mismatch", {
          paymentId: payRow.id,
          rowProvider: payRow.provider,
        });
        await tx.insert(auditLog).values({
          actorType: "system",
          actorId: null,
          action: "webhook_provider_mismatch",
          entityType: "payment",
          entityId: payRow.id,
          beforeJson: JSON.stringify({ paymentProvider: payRow.provider }),
          afterJson: JSON.stringify({
            route: "ziina",
            providerEventId,
            rawEventType: normalized.rawEventType,
          }),
        });
        return { kind: "reject" as const, firstPaidApplicationId: null as string | null };
      }

      const [appRow] = await tx.select().from(application).where(eq(application.id, payRow.applicationId)).limit(1);
      if (!appRow) return { kind: "noop" as const, firstPaidApplicationId: null as string | null };

      await requirePaymentEventPayloadHashDedupeIndex(tx);

      const [insertedEvent] = await tx
        .insert(paymentEvent)
        .values({
          id: createId(),
          paymentId: payRow.id,
          providerEventId,
          type: normalized.rawEventType,
          payloadHash,
        })
        .onConflictDoNothing({ target: paymentEvent.payloadHash })
        .returning();
      if (!insertedEvent) return { kind: "noop" as const, firstPaidApplicationId: null as string | null };

      const payApply = await applyPaymentWebhookEvent(tx, normalized, payRow, appRow, providerEventId, { requestId });
      return {
        kind: "noop" as const,
        firstPaidApplicationId: payApply.didFirstPaidTransition ? payRow.applicationId : null,
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
    throw e;
  }

  if (firstPaidApplicationId) {
    after(() => {
      void sendPaymentReceivedInProgressEmail(firstPaidApplicationId!, requestId).catch((err) => {
        console.error("[webhooks/ziina] payment_received_in_progress email failed", {
          applicationId: firstPaidApplicationId,
          requestId,
          err: err instanceof Error ? err.message : err,
        });
      });
    });
  }

  return jsonOk({ received: true }, { requestId });
}
