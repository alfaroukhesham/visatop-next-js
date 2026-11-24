import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor, withClientDbActor } from "@/lib/db/actor-context";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { cancelPartyCheckout } from "@/lib/payments/cancel-party-checkout";
import type { DbTransaction } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const [{ id: applicationId }, hdrs] = await Promise.all([params, headers()]);
  const requestId = hdrs.get("x-request-id");

  const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!accessRes.ok) {
    const status = accessRes.failure.kind === "not_found" ? 404 : 403;
    return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
  }

  const runTx = async (tx: DbTransaction) => {
    const cancelled = await cancelPartyCheckout(tx, applicationId);
    if (!cancelled.ok) {
      return jsonError("CONFLICT", "Checkout not in a cancellable state", { status: 409, requestId });
    }
    return jsonOk({ cancelled: true }, { requestId });
  };

  if (accessRes.access.kind === "user") {
    return await withClientDbActor(accessRes.access.userId, runTx);
  }
  return await withSystemDbActor(runTx);
}
