import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { payment } from "@/lib/db/schema";
import { isFincraEnabled } from "@/lib/payments/resolve-payment-provider";
import {
  dueFincraReconcileSlots,
  hasFincraReconcileProbe,
  reconcileFincraPaymentRow,
  reconcileFincraPaymentRowsSequentially,
  type ReconcileFincraAttemptResult,
} from "@/lib/payments/reconcile-fincra-payments";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";
import { withSpan } from "@/lib/observability/tracing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) =>
  withSpan("reconcile.fincra", { provider: "fincra", operation: "reconcile" }, () =>
    postReconcileFincra(request),
  );

const postReconcileFincra = async (request: Request) => {
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
    return jsonError("UNAUTHORIZED", "Invalid internal secret.", { status: 401, requestId });
  }

  if (!isFincraEnabled()) {
    return jsonOk({ skipped: true, reason: "fincra_disabled" }, { requestId });
  }

  // Underpaid is never written by the Fincra paid path (mismatch is). Selecting it
  // and skipping hid rows without reconciling them. Do not select underpaid.
  // Mismatch / variance rows are held for admin (not auto-paid, not abandoned).
  const rows = await withSystemDbActor(async (tx) =>
    tx
      .select()
      .from(payment)
      .where(and(eq(payment.provider, "fincra"), eq(payment.status, "checkout_created")))
      .orderBy(desc(payment.createdAt))
      .limit(50),
  );

  const nowMs = Date.now();
  const attempts = await reconcileFincraPaymentRowsSequentially(rows, async (payRow) => {
    const createdAt =
      payRow.createdAt instanceof Date ? payRow.createdAt : new Date(payRow.createdAt);
    const dueSlots = dueFincraReconcileSlots(createdAt, nowMs);
    const slot = await withSystemDbActor(async (tx) => {
      for (const candidate of dueSlots) {
        if (!(await hasFincraReconcileProbe(tx, payRow.id, candidate))) return candidate;
      }
      return null;
    });
    if (!slot) {
      return {
        paymentId: payRow.id,
        applicationId: payRow.applicationId,
        slot: "5m",
        fincraStatus: null,
        outcome: "skipped_probe_already_ran",
      } satisfies ReconcileFincraAttemptResult;
    }
    return reconcileFincraPaymentRow(payRow, slot, requestId);
  });

  const paidApplicationIds = attempts
    .map((attempt) => attempt.process?.firstPaidApplicationId)
    .filter((id): id is string => Boolean(id));

  for (const appId of paidApplicationIds) {
    scheduleFincraPaidSideEffects(appId, requestId);
  }

  return jsonOk(
    {
      checked: attempts.filter((attempt) => attempt.outcome !== "skipped_probe_already_ran").length,
      attempts,
      markedPaid: paidApplicationIds.length,
    },
    { requestId },
  );
};
