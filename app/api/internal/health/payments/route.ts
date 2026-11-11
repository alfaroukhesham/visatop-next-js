import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  requireInternalCronSecret,
  skipIfStagingIdleCron,
} from "@/lib/api/internal-cron-auth";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { collectPaymentsHealth } from "@/lib/payments/payments-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async (request: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const unauthorized = requireInternalCronSecret(request, requestId);
  if (unauthorized) return unauthorized;
  const idleSkip = skipIfStagingIdleCron(requestId);
  if (idleSkip) return idleSkip;

  const health = await withSystemDbActor((tx) => collectPaymentsHealth(tx));
  if (!health.ok) {
    return jsonError("SERVICE_UNAVAILABLE", health.alerts.map((a) => a.message).join(" "), {
      status: 503,
      requestId,
      details: {
        alerts: health.alerts,
        webhook: health.webhook,
      },
    });
  }
  return jsonOk(health, { requestId });
};
