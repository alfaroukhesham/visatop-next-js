import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { toPublicApplication } from "@/lib/applications/public-application";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application, payment } from "@/lib/db/schema";
import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";
import { reconcileZiinaPaymentFromReturn } from "@/lib/payments/reconcile-ziina-payments";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

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
      .from(application)
      .where(eq(application.id, applicationId))
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

    const attempt = await reconcileZiinaPaymentFromReturn(tx, payRow, requestId);

    const [updatedApp] = await tx
      .select()
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);

    return {
      kind: "done" as const,
      application: updatedApp ?? appRow,
      attempt,
      firstPaidApplicationId: attempt.process?.firstPaidApplicationId ?? null,
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
