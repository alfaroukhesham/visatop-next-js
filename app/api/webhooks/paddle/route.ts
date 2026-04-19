import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { paddleAdapter } from "@/lib/payments/paddle-adapter";
import { application, payment, paymentEvent } from "@/lib/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { retainRequiredDocuments } from "@/lib/applications/retain-required-documents";
import { createId } from "@paralleldrive/cuid2";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const hdrs = await headers();
  const signature = hdrs.get("paddle-signature");

  if (!signature || !paddleAdapter.verifyWebhookSignature(bodyText, signature)) {
    return jsonError("UNAUTHORIZED", "Invalid signature", { status: 401 });
  }

  const payloadHash = crypto.createHash("sha256").update(bodyText).digest("hex");
  const event = paddleAdapter.parseWebhookEvent(bodyText);

  // Parse payload JSON to get raw payload
  const rawPayload = JSON.parse(bodyText);
  const providerEventId = rawPayload.event_id || "unknown";

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

    // Idempotency check
    const [existing] = await tx.select().from(paymentEvent).where(eq(paymentEvent.payloadHash, payloadHash)).limit(1);
    if (existing) return;

    // Insert event
    await tx.insert(paymentEvent).values({
      id: createId(),
      paymentId: payRow.id,
      providerEventId: providerEventId,
      type: event.type,
      payloadHash,
    });

    if (event.type === "transaction.completed") {
      // 1. Resurrection Guard
      if (appRow.applicationStatus === "cancelled") {
        await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
        return;
      }

      // 2. Amount verification
      if (event.amountMinor !== Number(payRow.amount)) {
        await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
        // We still consider it paid to release locks, but flag it
      }

      // 3. Mark paid and release checkout lock (persist txn id for support / refunds)
      await tx
        .update(payment)
        .set({
          status: "paid",
          providerTransactionId: event.transactionId || payRow.providerTransactionId,
        })
        .where(eq(payment.id, payRow.id));
      await tx.update(application).set({
        paymentStatus: "paid",
        checkoutState: "none",
        applicationStatus: "in_progress",
        fulfillmentStatus: "automation_running"
      }).where(eq(application.id, appRow.id));

      // 4. Retain docs
      const retainRes = await retainRequiredDocuments(tx, appRow.id);
      if (!retainRes.ok) {
        await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
      }
    } else if (event.type === "transaction.payment_failed") {
      await tx.update(payment).set({ status: "failed" }).where(eq(payment.id, payRow.id));
      await tx.update(application).set({ checkoutState: "none" }).where(eq(application.id, appRow.id));
    }
  });

  return jsonOk({ received: true });
}
