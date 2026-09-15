import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { parseAnalyticsRange } from "@/lib/analytics/analytics-range";
import { loadAdminAnalytics } from "@/lib/analytics/admin-analytics-query";
import { ADMIN_ANALYTICS_READ_PERMISSIONS } from "@/lib/analytics/admin-analytics-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const parsed = parseAnalyticsRange({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.ok) {
    return jsonError("VALIDATION_ERROR", parsed.message, { status: 400, requestId });
  }

  return runAdminDbJson(requestId, [...ADMIN_ANALYTICS_READ_PERMISSIONS], async ({ tx }) => {
    const data = await loadAdminAnalytics(tx, parsed.range);
    return jsonOk(data, {
      requestId,
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
