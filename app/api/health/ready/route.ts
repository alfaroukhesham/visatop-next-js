/**
 * Readiness for uptime monitors (Uptime Kuma). Checks DB + config presence.
 * Do not replace `/api/health` — blue-green deploy uses that liveness probe.
 */
import { headers } from "next/headers";
import { jsonOk } from "@/lib/api/response";
import { getReadinessChecks } from "@/lib/observability/health-ready";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const checks = await getReadinessChecks();
  const ready = checks.database && checks.payment && checks.ocr;
  return jsonOk({ ready, checks }, { status: ready ? 200 : 503, requestId });
};
