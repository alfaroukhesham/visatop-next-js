import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { payment } from "@/lib/db/schema";
import { getActivePaymentProvider } from "@/lib/payments/resolve-payment-provider";
import {
  dueZiinaReconcileSlots,
  hasZiinaReconcileProbe,
  reconcileZiinaPaymentRow,
  type ReconcileZiinaAttemptResult,
} from "@/lib/payments/reconcile-ziina-payments";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const expected = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!expected) {
    return jsonError("INTERNAL_ERROR", "INTERNAL_CRON_SECRET is not configured.", {
      status: 500,
      requestId,
    });
  }
  const secret = request.headers.get("x-internal-secret")?.trim();
  if (secret !== expected) {
    return jsonError("UNAUTHORIZED", "Invalid internal secret.", {
      status: 401,
      requestId,
    });
  }

  if (getActivePaymentProvider() !== "ziina") {
    return jsonOk({ skipped: true, reason: "not_ziina_provider" }, { requestId });
  }

  const paidApplicationIds: string[] = [];
  const attempts: ReconcileZiinaAttemptResult[] = [];

  await withSystemDbActor(async (tx) => {
    const rows = await tx
      .select()
      .from(payment)
      .where(and(eq(payment.provider, "ziina"), eq(payment.status, "checkout_created")))
      .orderBy(desc(payment.createdAt))
      .limit(50);

    const nowMs = Date.now();

    await Promise.all(
      rows.map(async (payRow) => {
        const createdAt =
          payRow.createdAt instanceof Date ? payRow.createdAt : new Date(payRow.createdAt);
        const dueSlots = dueZiinaReconcileSlots(createdAt, nowMs);
        const probed = await Promise.all(
          dueSlots.map((slot) => hasZiinaReconcileProbe(tx, payRow.id, slot)),
        );
        const slotIndex = probed.findIndex((alreadyProbed) => !alreadyProbed);
        if (slotIndex < 0) return;

        const slot = dueSlots[slotIndex]!;
        const attempt = await reconcileZiinaPaymentRow(tx, payRow, slot, requestId);
        attempts.push(attempt);

        if (attempt.process?.firstPaidApplicationId) {
          paidApplicationIds.push(attempt.process.firstPaidApplicationId);
        }
      }),
    );
  });

  for (const appId of paidApplicationIds) {
    scheduleZiinaPaidSideEffects(appId, requestId);
  }

  const critical = attempts.filter(
    (a) =>
      a.slot === "15m" &&
      a.ziinaStatus === "completed" &&
      a.outcome !== "applied" &&
      !a.outcome.startsWith("skipped"),
  );
  if (critical.length > 0) {
    console.error("[ziina-reconcile/cron] CRITICAL reconcile failures after 15m probe", {
      requestId,
      count: critical.length,
      paymentIds: critical.map((c) => c.paymentId),
    });
  }

  return jsonOk(
    {
      checked: attempts.length,
      attempts,
      markedPaid: paidApplicationIds.length,
    },
    { requestId },
  );
}
