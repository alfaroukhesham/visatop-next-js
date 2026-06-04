import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { toPublicApplication } from "@/lib/applications/public-application";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application as applicationTable, payment } from "@/lib/db/schema";
import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";
import { reconcileZiinaPaymentFromReturn } from "@/lib/payments/reconcile-ziina-payments";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";
import type { DbTransaction } from "@/lib/db";

async function loadApplicationRowAfterZiinaAttempt(
  tx: DbTransaction,
  applicationId: string,
  attempt: Awaited<ReturnType<typeof reconcileZiinaPaymentFromReturn>>,
) {
  void attempt;
  return tx
    .select()
    .from(applicationTable)
    .where(eq(applicationTable.id, applicationId))
    .limit(1);
}

async function reconcileReturnAndLoadApplication(
  tx: DbTransaction,
  payRow: typeof payment.$inferSelect,
  appRow: typeof applicationTable.$inferSelect,
  applicationId: string,
  requestId: string | null,
) {
  const attempt = await reconcileZiinaPaymentFromReturn(tx, payRow, requestId);
  const [updatedApp] = await loadApplicationRowAfterZiinaAttempt(tx, applicationId, attempt);
  return {
    attempt,
    application: updatedApp ?? appRow,
    firstPaidApplicationId: attempt.process?.firstPaidApplicationId ?? null,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const [hdrs, { id: applicationId }] = await Promise.all([headers(), ctx.params]);
  const requestId = hdrs.get("x-request-id");

  if (getActivePaymentProvider() !== "ziina") {
    return jsonOk({ reconciled: false, reason: "not_ziina_provider" }, { requestId });
  }

  const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!accessRes.ok) {
    const status = accessRes.failure.kind === "not_found" ? 404 : 403;
    return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
  }

  const result = await withSystemDbActor(async (tx) => {
    const [appRow] = await tx
      .select()
      .from(applicationTable)
      .where(eq(applicationTable.id, applicationId))
      .limit(1);
    if (!appRow) return { kind: "not_found" as const };

    if (appRow.paymentStatus === "paid") {
      return { kind: "already_paid" as const, application: appRow };
    }

    const payRows = await tx
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.applicationId, applicationId),
          eq(payment.provider, "ziina"),
          eq(payment.status, "checkout_created"),
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(1);

    const payRow = payRows[0];
    if (!payRow) {
      return { kind: "no_checkout" as const, application: appRow };
    }

    const { attempt, application: applicationRow, firstPaidApplicationId } = await reconcileReturnAndLoadApplication(
      tx,
      payRow,
      appRow,
      applicationId,
      requestId,
    );

    return {
      kind: "done" as const,
      application: applicationRow,
      attempt,
      firstPaidApplicationId,
    };
  });

  if (result.kind === "not_found") {
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  if (result.kind === "already_paid") {
    return jsonOk(
      {
        reconciled: true,
        alreadyPaid: true,
        application: toPublicApplication(result.application),
      },
      { requestId },
    );
  }

  if (result.kind === "no_checkout") {
    return jsonOk(
      {
        reconciled: false,
        reason: "no_open_checkout",
        application: toPublicApplication(result.application),
      },
      { requestId },
    );
  }

  if (result.firstPaidApplicationId) {
    scheduleZiinaPaidSideEffects(result.firstPaidApplicationId, requestId);
  }

  return jsonOk(
    {
      reconciled: result.attempt.outcome === "applied" && Boolean(result.firstPaidApplicationId),
      attempt: {
        outcome: result.attempt.outcome,
        ziinaStatus: result.attempt.ziinaStatus,
      },
      application: toPublicApplication(result.application),
    },
    { requestId },
  );
}
