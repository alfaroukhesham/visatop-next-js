import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { PaddleProviderError, paddleAdapter } from "@/lib/payments/paddle-adapter";
import { getZiinaServerConfig } from "@/lib/payments/resolve-payment-provider";
import { initiateZiinaRefund, ZiinaProviderError } from "@/lib/payments/ziina-client";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { PaddleRefundReason } from "@/lib/payments/types";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params;
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(
    requestId,
    ["payments.refund"],
    async ({ tx, adminUserId }) => {
      const { reason, amount } = (await req.json().catch(() => ({}))) as {
        reason: PaddleRefundReason;
        amount?: number;
      };

      if (!reason) {
        return jsonError("VALIDATION_ERROR", "Reason is required", {
          status: 400,
          requestId,
        });
      }

      if (amount !== undefined && amount !== null) {
        return jsonError("VALIDATION_ERROR", "Partial refunds are not supported yet", {
          status: 400,
          requestId,
        });
      }

      const [app] = await tx
        .select()
        .from(schema.application)
        .where(eq(schema.application.id, applicationId))
        .limit(1);

      if (!app) {
        return jsonError("NOT_FOUND", "Application not found", {
          status: 404,
          requestId,
        });
      }

      if (app.paymentStatus !== "paid") {
        return jsonError("CONFLICT", "Application is not in a paid state", {
          status: 400,
          requestId,
        });
      }

      const [payment] = await tx
        .select()
        .from(schema.payment)
        .where(eq(schema.payment.applicationId, applicationId))
        .orderBy(desc(schema.payment.createdAt))
        .limit(1);

      if (payment.provider === "ziina") {
        const intentId = payment.providerCheckoutId?.trim();
        if (!intentId) {
          return jsonError("VALIDATION_ERROR", "No Ziina payment intent id for this application", {
            status: 400,
            requestId,
          });
        }

        let ziinaCfg;
        try {
          ziinaCfg = getZiinaServerConfig();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Ziina is not configured";
          return jsonError("PAYMENT_PROVIDER_ERROR", msg, { status: 503, requestId });
        }

        try {
          const result = await initiateZiinaRefund({
            baseUrl: ziinaCfg.apiBaseUrl,
            accessToken: ziinaCfg.accessToken,
            refundClientId: randomUUID(),
            paymentIntentId: intentId,
            test: ziinaCfg.testMode,
            timeoutMs: 8000,
          });

          await tx
            .update(schema.application)
            .set({ paymentStatus: "refund_pending" })
            .where(eq(schema.application.id, applicationId));

          await writeAdminAudit(tx, {
            adminUserId,
            action: "application.refund.initiate",
            entityType: "application",
            entityId: applicationId,
            afterJson: JSON.stringify({
              reason,
              provider: "ziina",
              refundId: result.refundId,
              refundStatus: result.status,
            }),
          });

          return jsonOk(
            { refundId: result.refundId, status: result.status },
            { requestId },
          );
        } catch (err: unknown) {
          console.error("Ziina refund failed:", err instanceof Error ? err.message : err);
          if (err instanceof ZiinaProviderError) {
            return jsonError("ZIINA_UNAVAILABLE", err.message, {
              status: err.httpStatus,
              requestId,
            });
          }
          const message = err instanceof Error ? err.message : "Refund initiation failed";
          return jsonError("PAYMENT_PROVIDER_ERROR", message, { status: 502, requestId });
        }
      }

      if (!payment?.providerTransactionId) {
        return jsonError(
          "VALIDATION_ERROR",
          "No provider transaction found for this application",
          {
            status: 400,
            requestId,
          }
        );
      }

      try {
        const result = await paddleAdapter.initiateRefund(payment.providerTransactionId, reason);

        // Update application status to reflect refund pending
        await tx
          .update(schema.application)
          .set({ paymentStatus: "refund_pending" })
          .where(eq(schema.application.id, applicationId));

        // Write audit log
        await writeAdminAudit(tx, {
          adminUserId,
          action: "application.refund.initiate",
          entityType: "application",
          entityId: applicationId,
          afterJson: JSON.stringify({
            reason,
            refundId: result.refundId,
            refundStatus: result.status,
          }),
        });

        return jsonOk(result, { requestId });
      } catch (err: unknown) {
        console.error("Refund failed:", err);
        if (err instanceof PaddleProviderError) {
          return jsonError("INTERNAL_ERROR", err.message, {
            status: err.httpStatus,
            requestId,
            details: { paddleCode: err.paddleCode },
          });
        }
        const message = err instanceof Error ? err.message : "Refund initiation failed";
        return jsonError("INTERNAL_ERROR", message, {
          status: 502,
          requestId,
        });
      }

    }
  );
}
