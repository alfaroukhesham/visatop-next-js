import { jsonError, jsonOk } from "@/lib/api/response";
import { shouldSkipStagingIdleDbWake } from "@/lib/env/staging-idle-db-wake";

export const requireInternalCronSecret = (
  request: Request,
  requestId: string | null,
): Response | null => {
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
  return null;
};

/** After auth: no-op staging crons so they cannot keep weathered-resonance awake. */
export const skipIfStagingIdleCron = (requestId: string | null): Response | null => {
  if (!shouldSkipStagingIdleDbWake()) return null;
  return jsonOk({ skipped: true, reason: "staging_idle_db_wake" }, { requestId });
};
