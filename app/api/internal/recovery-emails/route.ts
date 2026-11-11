import { headers } from "next/headers";
import {
  requireInternalCronSecret,
  skipIfStagingIdleCron,
} from "@/lib/api/internal-cron-auth";
import { jsonOk } from "@/lib/api/response";
import { runCheckoutRecoveryEmailJob } from "@/lib/email/recovery/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const unauthorized = requireInternalCronSecret(request, requestId);
  if (unauthorized) return unauthorized;
  const idleSkip = skipIfStagingIdleCron(requestId);
  if (idleSkip) return idleSkip;

  const result = await runCheckoutRecoveryEmailJob({ requestId });
  return jsonOk(result, { requestId });
};
