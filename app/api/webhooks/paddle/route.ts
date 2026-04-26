import { headers } from "next/headers";
import { after } from "next/server";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { paddleAdapter } from "@/lib/payments/paddle-adapter";
import {
  applyPaymentWebhookEvent,
  resolvePaymentRowForWebhook,
} from "@/lib/payments/apply-payment-webhook-event";
import { parsePaddleWebhookBodyToNormalized } from "@/lib/payments/paddle-webhook-normalize";
import { computePaymentEventPayloadHash } from "@/lib/payments/payment-event-hash";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";
import { application, auditLog, paymentEvent } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { markWebhookReceivedNow, PLATFORM_KEY_LAST_WEBHOOK_PADDLE } from "@/lib/payments/webhook-health";
import { sendPaymentReceivedInProgressEmail } from "@/lib/email/send-application-transactional-emails";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const signature = hdrs.get("paddle-signature");

  if (!signature || !(await paddleAdapter.verifyWebhookSignature(bodyText, signature))) {
    return jsonError("UNAUTHORIZED", "Invalid signature", { status: 401, requestId });
  }

  const payloadHash = computePaymentEventPayloadHash("paddle", bodyText);
  let normalized;
  try {
    normalized = parsePaddleWebhookBodyToNormalized(bodyText);
  } catch {
    return jsonError("VALIDATION_ERROR", "Invalid webhook payload", { status: 400, requestId });
  }

  const rawPayload = JSON.parse(bodyText) as { event_id?: string };
  const providerEventId = typeof rawPayload.event_id === "string" ? rawPayload.event_id : "unknown";

  let firstPaidApplicationId: string | null = null;
  try {
    const handleResult = await withSystemDbActor(async (tx) => {
      await markWebhookReceivedNow(tx, PLATFORM_KEY_LAST_WEBHOOK_PADDLE);

      const payRow = await resolvePaymentRowForWebhook(tx, normalized);
      if (!payRow) {
        console.warn("[webhooks/paddle] No payment row for event", {
          type: normalized.rawEventType,
          transactionId: normalized.providerPaymentId,
          applicationId: normalized.metadata.applicationId,
        });
        return { kind: "noop" as const, firstPaidApplicationId: null as string | null };
      }

      if (payRow.provider !== "paddle") {
        console.warn("[webhooks/paddle] payment row provider mismatch", {
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
            route: "paddle",
            providerEventId,
            rawEventType: normalized.rawEventType,
          }),
        });
        return { kind: "reject" as const, status: 401 as const, firstPaidApplicationId: null as string | null };
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

      const payApply = await applyPaymentWebhookEvent(tx, normalized, payRow, appRow, providerEventId, {
        requestId,
      });
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
      console.error("[webhooks/paddle] payment_event idempotency index missing or ON CONFLICT unusable", {
        requestId,
        err: e instanceof Error ? e.message : e,
      });
      return jsonError(
        "SERVICE_UNAVAILABLE",
        "Payment webhook storage is not migrated; cannot record Paddle events safely. Apply database migrations, then retry.",
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
        console.error("[webhooks/paddle] payment_received_in_progress email failed", {
          applicationId: firstPaidApplicationId,
          requestId,
          err: err instanceof Error ? err.message : err,
        });
      });
    });
  }

  return jsonOk({ received: true }, { requestId });
}
