import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { resolveZiinaCheckoutSession } from "@/lib/payments/ziina-checkout-session";
import { scheduleZiinaPaidSideEffects } from "@/lib/payments/ziina-payment-side-effects";
import { resolveFincraCheckoutSession } from "@/lib/payments/fincra-checkout-session";
import { scheduleFincraPaidSideEffects } from "@/lib/payments/fincra-payment-side-effects";

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

  const resolved = await withSystemDbActor(async (tx) => {
    const fincra = await resolveFincraCheckoutSession(tx, applicationId, requestId);
    if (fincra.session.kind !== "none") return { source: "fincra" as const, ...fincra };
    const ziina = await resolveZiinaCheckoutSession(tx, applicationId, requestId);
    return { source: "ziina" as const, ...ziina };
  });
  if (resolved.firstPaidApplicationId) {
    if (resolved.source === "fincra") {
      scheduleFincraPaidSideEffects(resolved.firstPaidApplicationId, requestId);
    } else {
      scheduleZiinaPaidSideEffects(resolved.firstPaidApplicationId, requestId);
    }
  }
  return jsonOk(resolved.session, { requestId });
};
