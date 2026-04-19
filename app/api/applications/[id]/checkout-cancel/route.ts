import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor, withClientDbActor } from "@/lib/db/actor-context";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import * as schema from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params;
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!accessRes.ok) {
    const status = accessRes.failure.kind === "not_found" ? 404 : 403;
    return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
  }

  const runTx = async (tx: DbTransaction) => {
    // Only allow cancellation if in checkout_created status and pending lock
    const [updated] = await tx
      .update(schema.application)
      .set({ 
        checkoutState: "none",
        paymentStatus: "unpaid" 
      })
      .where(and(
        eq(schema.application.id, applicationId),
        eq(schema.application.checkoutState, "pending")
      ))
      .returning();

    if (!updated) {
      return jsonError("CONFLICT", "Checkout not in a cancellable state", { status: 409, requestId });
    }

    // Also update any pending payment rows
    await tx
      .update(schema.payment)
      .set({ status: "failed" })
      .where(and(
        eq(schema.payment.applicationId, applicationId),
        eq(schema.payment.status, "checkout_created")
      ));

    return jsonOk({ cancelled: true }, { requestId });
  };

  if (accessRes.access.kind === "user") {
    return await withClientDbActor(accessRes.access.userId, runTx);
  } else {
    return await withSystemDbActor(runTx);
  }
}
