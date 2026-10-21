import { headers } from "next/headers";
import { and, desc, eq, or } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { payment } from "@/lib/db/schema";
import { isFincraEnabled } from "@/lib/payments/resolve-payment-provider";
import {
  dueFincraReconcileSlots,
  hasFincraReconcileProbe,
  reconcileFincraPaymentRow,
  type ReconcileFincraAttemptResult,
} from "@/lib/payments/reconcile-fincra-payments";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";

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
    return jsonError("UNAUTHORIZED", "Invalid internal secret.", { status: 401, requestId });
  }

  if (!isFincraEnabled()) {
    return jsonOk({ skipped: true, reason: "fincra_disabled" }, { requestId });
  }

  const paidApplicationIds: string[] = [];
  const attempts: ReconcileFincraAttemptResult[] = [];

  await withSystemDbActor(async (tx) => {
    const rows = await tx
      .select()
      .from(payment)
      .where(
        and(
          eq(payment.provider, "fincra"),
          or(eq(payment.status, "checkout_created"), eq(payment.status, "underpaid")),
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(50);

    const nowMs = Date.now();

    await Promise.all(
      rows.map(async (payRow) => {
        if (payRow.status === "underpaid") return;
        const createdAt =
          payRow.createdAt instanceof Date ? payRow.createdAt : new Date(payRow.createdAt);
        const dueSlots = dueFincraReconcileSlots(createdAt, nowMs);
        const probed = await Promise.all(
          dueSlots.map((slot) => hasFincraReconcileProbe(tx, payRow.id, slot)),
        );
        const slotIndex = probed.findIndex((alreadyProbed) => !alreadyProbed);
        if (slotIndex < 0) return;

        const slot = dueSlots[slotIndex]!;
        const attempt = await reconcileFincraPaymentRow(tx, payRow, slot, requestId);
        attempts.push(attempt);

        if (attempt.process?.firstPaidApplicationId) {
          paidApplicationIds.push(attempt.process.firstPaidApplicationId);
        }
      }),
    );
  });

  for (const appId of paidApplicationIds) {
    scheduleFincraPaidSideEffects(appId, requestId);
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
