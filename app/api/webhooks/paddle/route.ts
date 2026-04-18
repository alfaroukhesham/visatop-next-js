import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { paddleAdapter } from "@/lib/payments/paddle-adapter";
import { application, payment, paymentEvent } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
    // Lookup payment
    const [payRow] = await tx.select().from(payment).where(eq(payment.providerTransactionId, event.transactionId)).limit(1);
    if (!payRow) return; // Unknown transaction, ignore

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

      // 3. Mark paid and release checkout lock
      await tx.update(payment).set({ status: "paid" }).where(eq(payment.id, payRow.id));
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
