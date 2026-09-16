import { headers } from "next/headers";
import { jsonError } from "@/lib/api/response";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseAnalyticsRange } from "@/lib/analytics/analytics-range";
import {
  analyticsSummaryToCsv,
  applicantsToCsv,
  funnelEventsToCsv,
} from "@/lib/analytics/admin-analytics-csv";
import {
  ANALYTICS_EVENTS_EXPORT_LIMIT,
  loadAdminAnalytics,
  loadApplicantsForExport,
  loadFunnelEventsForExport,
} from "@/lib/analytics/admin-analytics-query";
import { ADMIN_ANALYTICS_READ_PERMISSIONS } from "@/lib/analytics/admin-analytics-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const url = new URL(req.url);
  const kindParam = url.searchParams.get("kind");
  const kind =
    kindParam === "events" ? "events" : kindParam === "applicants" ? "applicants" : "summary";
  const parsed = parseAnalyticsRange({
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });
  if (!parsed.ok) {
    return jsonError("VALIDATION_ERROR", parsed.message, { status: 400, requestId });
  }

  const requiredPermissions =
    kind === "applicants"
      ? [...ADMIN_ANALYTICS_READ_PERMISSIONS, "audit.write"]
      : [...ADMIN_ANALYTICS_READ_PERMISSIONS];

  return runAdminDbJson(requestId, requiredPermissions, async ({ tx, adminUserId }) => {
    if (kind === "events") {
      const exported = await loadFunnelEventsForExport(tx, parsed.range);
      const csv = funnelEventsToCsv(exported.rows, {
        truncated: exported.truncated,
        maxRows: ANALYTICS_EVENTS_EXPORT_LIMIT,
      });
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-events.csv"`,
          "Cache-Control": "private, no-store",
          "x-request-id": requestId ?? "",
          ...(exported.truncated ? { "X-Export-Truncated": "true" } : {}),
        },
      });
    }
    if (kind === "applicants") {
      const exported = await loadApplicantsForExport(tx, parsed.range);
      const csv = applicantsToCsv(exported.rows, {
        truncated: exported.truncated,
        maxRows: ANALYTICS_EVENTS_EXPORT_LIMIT,
      });
      await writeAdminAudit(tx, {
        adminUserId,
        action: "analytics.applicants_export",
        entityType: "analytics",
        entityId: null,
        afterJson: JSON.stringify({
          from: parsed.range.from.toISOString(),
          to: parsed.range.to.toISOString(),
          rowCount: exported.rows.length,
          truncated: exported.truncated,
        }),
      });
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-applicants.csv"`,
          "Cache-Control": "private, no-store",
          "x-request-id": requestId ?? "",
          ...(exported.truncated ? { "X-Export-Truncated": "true" } : {}),
        },
      });
    }
    const csv = analyticsSummaryToCsv(await loadAdminAnalytics(tx, parsed.range));
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="analytics-summary.csv"`,
        "Cache-Control": "private, no-store",
        "x-request-id": requestId ?? "",
      },
    });
  });
}
