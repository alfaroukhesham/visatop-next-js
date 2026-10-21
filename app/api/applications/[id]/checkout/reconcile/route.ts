import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { toPublicApplication } from "@/lib/applications/public-application";
import { readCustomerLocaleFromCookieHeader } from "@/lib/i18n/customer-locale";
import { createCustomerT } from "@/lib/i18n/load-customer-catalog";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application as applicationTable } from "@/lib/db/schema";
import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";
import { reconcileZiinaPaymentFromReturn } from "@/lib/payments/reconcile-ziina-payments";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";
import { findOpenZiinaPaymentForApplication } from "@/lib/payments/ziina-checkout-session";
import { reconcileFincraPaymentFromReturn } from "@/lib/payments/reconcile-fincra-payments";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";
import { findOpenFincraPaymentForApplication } from "@/lib/payments/fincra-checkout-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const [hdrs, { id: applicationId }] = await Promise.all([headers(), ctx.params]);
  const requestId = hdrs.get("x-request-id");
  const t = createCustomerT(readCustomerLocaleFromCookieHeader(hdrs.get("cookie")));

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

    const fincraPay = await findOpenFincraPaymentForApplication(tx, applicationId);
    if (fincraPay) {
      const attempt = await reconcileFincraPaymentFromReturn(tx, fincraPay, requestId);
      const [updatedApp] = await tx
        .select()
        .from(applicationTable)
        .where(eq(applicationTable.id, applicationId))
        .limit(1);
      return {
        kind: "done" as const,
        provider: "fincra" as const,
        application: updatedApp ?? appRow,
        attempt: { outcome: attempt.outcome, status: attempt.fincraStatus },
        firstPaidApplicationId: attempt.process?.firstPaidApplicationId ?? null,
      };
    }

    if (getActivePaymentProvider() !== "ziina") {
      return { kind: "no_checkout" as const, application: appRow };
    }

    const ziinaPay = await findOpenZiinaPaymentForApplication(tx, applicationId);
    if (!ziinaPay) {
      return { kind: "no_checkout" as const, application: appRow };
    }

    const attempt = await reconcileZiinaPaymentFromReturn(tx, ziinaPay, requestId);
    const [updatedApp] = await tx
      .select()
      .from(applicationTable)
      .where(eq(applicationTable.id, applicationId))
      .limit(1);
    return {
      kind: "done" as const,
      provider: "ziina" as const,
      application: updatedApp ?? appRow,
      attempt: { outcome: attempt.outcome, status: attempt.ziinaStatus },
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
        application: toPublicApplication(result.application, undefined, t),
      },
      { requestId },
    );
  }

  if (result.kind === "no_checkout") {
    return jsonOk(
      {
        reconciled: false,
        reason: "no_open_checkout",
        application: toPublicApplication(result.application, undefined, t),
      },
      { requestId },
    );
  }

  if (result.firstPaidApplicationId) {
    if (result.provider === "fincra") {
      scheduleFincraPaidSideEffects(result.firstPaidApplicationId, requestId);
    } else {
      scheduleZiinaPaidSideEffects(result.firstPaidApplicationId, requestId);
    }
  }

  return jsonOk(
    {
      reconciled: result.attempt.outcome === "applied" && Boolean(result.firstPaidApplicationId),
      attempt: {
        outcome: result.attempt.outcome,
        providerStatus: result.attempt.status,
      },
      application: toPublicApplication(result.application, undefined, t),
    },
    { requestId },
  );
}
