import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { paddleAdapter } from "@/lib/payments/paddle-adapter";
import {
  isPostgresOnConflictMissingConstraintError,
  PaymentWebhookSchemaDeploymentError,
  requirePaymentEventPayloadHashDedupeIndex,
} from "@/lib/payments/payment-webhook-db-guard";
import { application, auditLog, payment, paymentEvent } from "@/lib/db/schema";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { retainRequiredDocuments } from "@/lib/applications/retain-required-documents";
import { createId } from "@paralleldrive/cuid2";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const signature = hdrs.get("paddle-signature");

  if (!signature || !(await paddleAdapter.verifyWebhookSignature(bodyText, signature))) {
    return jsonError("UNAUTHORIZED", "Invalid signature", { status: 401, requestId });
  }

  const payloadHash = crypto.createHash("sha256").update(bodyText).digest("hex");
  let event;
  try {
    event = paddleAdapter.parseWebhookEvent(bodyText);
  } catch {
    return jsonError("VALIDATION_ERROR", "Invalid webhook payload", { status: 400, requestId });
  }

  // Parse payload JSON to get raw payload
  const rawPayload = JSON.parse(bodyText);
  const providerEventId = rawPayload.event_id || "unknown";

  try {
    await withSystemDbActor(async (tx) => {
      // Checkout stores Paddle's transaction id on `provider_checkout_id`; after capture the same
      // `txn_*` appears on webhooks. Do not look up only `provider_transaction_id` or no row matches.
      let payRow =
        event.transactionId ?
          (
            await tx
              .select()
              .from(payment)
              .where(
                or(
                  eq(payment.providerCheckoutId, event.transactionId),
                  eq(payment.providerTransactionId, event.transactionId),
                ),
              )
              .limit(1)
          )[0]
        : undefined;

      if (!payRow && typeof event.metadata.applicationId === "string" && event.metadata.applicationId) {
        const rows = await tx
          .select()
          .from(payment)
          .where(
            and(
              eq(payment.applicationId, event.metadata.applicationId),
              eq(payment.status, "checkout_created"),
            ),
          )
          .orderBy(desc(payment.createdAt))
          .limit(1);
        payRow = rows[0];
      }

      if (!payRow) {
        console.warn("[webhooks/paddle] No payment row for event", {
          type: event.type,
          transactionId: event.transactionId,
          applicationId: event.metadata.applicationId,
        });
        return;
      }

      // Lookup application
      const [appRow] = await tx.select().from(application).where(eq(application.id, payRow.applicationId)).limit(1);
      if (!appRow) return;

      // `ON CONFLICT (payload_hash)` requires migration 0010 unique index; gate before insert so we never "succeed" silently.
      await requirePaymentEventPayloadHashDedupeIndex(tx);

      const [insertedEvent] = await tx
        .insert(paymentEvent)
        .values({
          id: createId(),
          paymentId: payRow.id,
          providerEventId: providerEventId,
          type: event.type,
          payloadHash,
        })
        .onConflictDoNothing({ target: paymentEvent.payloadHash })
        .returning();
      if (!insertedEvent) return;

      // `transaction.paid` fires when payment is captured; `transaction.completed` when Paddle finishes
      // internal processing. Either can arrive first; treat both as authoritative for unlocking the app.
      if (event.type === "transaction.completed" || event.type === "transaction.paid") {
        // 1. Resurrection Guard
        if (appRow.applicationStatus === "cancelled") {
          await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
          await tx.insert(auditLog).values({
            actorType: "system",
            actorId: null,
            action: "payment_paid_but_application_cancelled",
            entityType: "application",
            entityId: appRow.id,
            beforeJson: JSON.stringify({
              applicationStatus: appRow.applicationStatus,
              paymentStatus: appRow.paymentStatus,
              adminAttentionRequired: appRow.adminAttentionRequired,
            }),
            afterJson: JSON.stringify({
              providerEventId,
              transactionId: event.transactionId ?? null,
              paymentId: payRow.id,
              paymentAmountMinor: Number(payRow.amount),
              eventAmountMinor: event.amountMinor,
              metadata: event.metadata ?? {},
            }),
          });
          return;
        }

        // 2. Amount verification
        const amountMismatch = event.amountMinor !== Number(payRow.amount);
        if (amountMismatch) {
          await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
          // We still consider it paid to release locks, but flag it
          await tx.insert(auditLog).values({
            actorType: "system",
            actorId: null,
            action: "payment_amount_mismatch_flagged",
            entityType: "application",
            entityId: appRow.id,
            beforeJson: JSON.stringify({
              adminAttentionRequired: appRow.adminAttentionRequired,
              expectedAmountMinor: Number(payRow.amount),
            }),
            afterJson: JSON.stringify({
              providerEventId,
              transactionId: event.transactionId ?? null,
              paymentId: payRow.id,
              expectedAmountMinor: Number(payRow.amount),
              receivedAmountMinor: event.amountMinor,
              metadata: event.metadata ?? {},
            }),
          });
        }

        // 3. Mark paid + release checkout lock (atomic).
        //
        // Paddle can send `transaction.paid` and `transaction.completed` back-to-back, and they can
        // be handled concurrently. Make the paid transition idempotent at the DB level so only
        // one handler performs the "first paid" side effects (audit + doc retention).
        const paymentBecamePaid = await tx
          .update(payment)
          .set({
            status: "paid",
            providerTransactionId: event.transactionId || payRow.providerTransactionId,
          })
          .where(and(eq(payment.id, payRow.id), ne(payment.status, "paid")))
          .returning({ id: payment.id });

        const applicationBecamePaid = await tx
          .update(application)
          .set({
            paymentStatus: "paid",
            checkoutState: "none",
            applicationStatus: "in_progress",
            fulfillmentStatus: "automation_running",
          })
          .where(and(eq(application.id, appRow.id), ne(application.paymentStatus, "paid")))
          .returning({ id: application.id });

        const isFirstPaidTransition = paymentBecamePaid.length > 0 || applicationBecamePaid.length > 0;

        if (isFirstPaidTransition) {
          await tx.insert(auditLog).values({
            actorType: "system",
            actorId: null,
            action: "payment_marked_paid",
            entityType: "application",
            entityId: appRow.id,
            beforeJson: JSON.stringify({
              paymentStatus: appRow.paymentStatus,
              checkoutState: appRow.checkoutState,
              applicationStatus: appRow.applicationStatus,
              fulfillmentStatus: appRow.fulfillmentStatus,
              adminAttentionRequired: appRow.adminAttentionRequired,
            }),
            afterJson: JSON.stringify({
              providerEventId,
              transactionId: event.transactionId ?? null,
              paymentId: payRow.id,
              amountMismatch,
              paymentAmountMinor: Number(payRow.amount),
              eventAmountMinor: event.amountMinor,
              metadata: event.metadata ?? {},
            }),
          });

          // 4. Retain docs (spec: do not silently partially-paid; flag for ops)
          const retainRes = await retainRequiredDocuments(tx, appRow.id);
          if (!retainRes.ok) {
            await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
            await tx.insert(auditLog).values({
              actorType: "system",
              actorId: null,
              action: "payment_paid_docs_retain_failed_flagged",
              entityType: "application",
              entityId: appRow.id,
              beforeJson: JSON.stringify({ adminAttentionRequired: appRow.adminAttentionRequired }),
              afterJson: JSON.stringify({
                providerEventId,
                transactionId: event.transactionId ?? null,
                paymentId: payRow.id,
                retention: retainRes,
              }),
            });
          }
        }
      } else if (event.type === "transaction.payment_failed") {
        await tx.update(payment).set({ status: "failed" }).where(eq(payment.id, payRow.id));
        await tx.update(application).set({ checkoutState: "none" }).where(eq(application.id, appRow.id));
        await tx.insert(auditLog).values({
          actorType: "system",
          actorId: null,
          action: "payment_failed",
          entityType: "application",
          entityId: appRow.id,
          beforeJson: JSON.stringify({
            paymentStatus: appRow.paymentStatus,
            checkoutState: appRow.checkoutState,
            adminAttentionRequired: appRow.adminAttentionRequired,
          }),
          afterJson: JSON.stringify({
            providerEventId,
            transactionId: event.transactionId ?? null,
            paymentId: payRow.id,
            metadata: event.metadata ?? {},
          }),
        });
      }
    });
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

  return jsonOk({ received: true }, { requestId });
}
