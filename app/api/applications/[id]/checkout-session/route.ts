import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { resolveZiinaCheckoutSession } from "@/lib/payments/ziina-checkout-session";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const [hdrs, { id: applicationId }] = await Promise.all([headers(), ctx.params]);
  const requestId = hdrs.get("x-request-id");

  const accessRes = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!accessRes.ok) {
    const status = accessRes.failure.kind === "not_found" ? 404 : 403;
    return jsonError("UNAUTHORIZED", "Cannot access application", { status, requestId });
  }

  const resolved = await withSystemDbActor((tx) =>
    resolveZiinaCheckoutSession(tx, applicationId, requestId),
  );
  if (resolved.firstPaidApplicationId) {
    scheduleZiinaPaidSideEffects(resolved.firstPaidApplicationId, requestId);
  }
  return jsonOk(resolved.session, { requestId });
};
