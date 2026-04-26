import { retainRequiredDocuments } from "@/lib/applications/retain-required-documents";
import { application, auditLog, payment } from "@/lib/db/schema";
import type { DbTransaction } from "@/lib/db";
import { and, desc, eq, ne, or } from "drizzle-orm";
import type { NormalizedPaymentWebhookEvent } from "./normalized-webhook";

export type ApplyPaymentWebhookContext = {
  requestId?: string | null;
};

/**
 * Resolve `payment` by provider id or latest checkout for application from metadata.
 * Mirrors legacy Paddle webhook lookup order.
 */
export async function resolvePaymentRowForWebhook(
  tx: DbTransaction,
  event: NormalizedPaymentWebhookEvent,
): Promise<typeof payment.$inferSelect | undefined> {
  const tid = event.providerPaymentId;
  let payRow =
    tid ?
      (
        await tx
          .select()
          .from(payment)
          .where(
            or(eq(payment.providerCheckoutId, tid), eq(payment.providerTransactionId, tid)),
          )
          .limit(1)
      )[0]
    : undefined;

  const appId = event.metadata.applicationId;
  if (!payRow && typeof appId === "string" && appId) {
    const rows = await tx
      .select()
      .from(payment)
      .where(and(eq(payment.applicationId, appId), eq(payment.status, "checkout_created")))
      .orderBy(desc(payment.createdAt))
      .limit(1);
    payRow = rows[0];
  }

  // Ziina can include `operation_id` in the PaymentIntent payload; use it as a recovery lookup.
  const { operationId } = event.metadata;
  if (!payRow && event.provider === "ziina" && typeof operationId === "string" && operationId) {
    const rows = await tx
      .select()
      .from(payment)
      .where(eq(payment.providerOperationId, operationId))
      .limit(1);
    payRow = rows[0];
  }

  return payRow;
}

/**
 * Core paid / failed transitions shared by Paddle and Ziina webhooks.
 * Caller must insert `payment_event` with dedupe and only invoke this when a new row was inserted.
 */
export type ApplyPaymentWebhookEventResult = {
  /** True when this invocation performed the first transition to paid + in_progress for the application. */
  didFirstPaidTransition: boolean;
};

export async function applyPaymentWebhookEvent(
  tx: DbTransaction,
  event: NormalizedPaymentWebhookEvent,
  payRow: typeof payment.$inferSelect,
  appRow: typeof application.$inferSelect,
  providerEventId: string,
  ctx?: ApplyPaymentWebhookContext,
): Promise<ApplyPaymentWebhookEventResult> {
  void ctx;
  if (payRow.provider !== event.provider) {
    console.warn("[applyPaymentWebhookEvent] provider mismatch — caller should reject before insert", {
      paymentId: payRow.id,
      rowProvider: payRow.provider,
      eventProvider: event.provider,
    });
    return { didFirstPaidTransition: false };
  }

  if (event.kind === "payment_completed") {
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
          transactionId: event.providerPaymentId ?? null,
          paymentId: payRow.id,
          paymentAmountMinor: Number(payRow.amount),
          eventAmountMinor: event.amountMinor,
          metadata: event.metadata ?? {},
        }),
      });
      return { didFirstPaidTransition: false };
    }

    const amountMismatch = event.amountMinor !== Number(payRow.amount);
    if (amountMismatch) {
      await tx.update(application).set({ adminAttentionRequired: true }).where(eq(application.id, appRow.id));
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
          transactionId: event.providerPaymentId ?? null,
          paymentId: payRow.id,
          expectedAmountMinor: Number(payRow.amount),
          receivedAmountMinor: event.amountMinor,
          metadata: event.metadata ?? {},
        }),
      });
    }

    const paymentBecamePaid = await tx
      .update(payment)
      .set({
        status: "paid",
        providerTransactionId: event.providerPaymentId || payRow.providerTransactionId,
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
          transactionId: event.providerPaymentId ?? null,
          paymentId: payRow.id,
          amountMismatch,
          paymentAmountMinor: Number(payRow.amount),
          eventAmountMinor: event.amountMinor,
          metadata: event.metadata ?? {},
        }),
      });

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
            transactionId: event.providerPaymentId ?? null,
            paymentId: payRow.id,
            retention: retainRes,
          }),
        });
      }
    }
    return { didFirstPaidTransition: isFirstPaidTransition };
  }

  if (event.kind === "payment_failed") {
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
        transactionId: event.providerPaymentId ?? null,
        paymentId: payRow.id,
        metadata: event.metadata ?? {},
      }),
    });
    return { didFirstPaidTransition: false };
  }

  return { didFirstPaidTransition: false };
}
