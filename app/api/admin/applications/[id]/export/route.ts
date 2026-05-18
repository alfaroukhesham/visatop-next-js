/**
 * Admin export of customer-provided application data (step 3 profile + uploads).
 * Returns a ZIP: `application-data.csv` plus document files under `documents/`.
 */
import { headers } from "next/headers";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  buildCustomerExportZip,
  customerExportZipBasename,
  loadCustomerExportPayload,
} from "@/lib/applications/customer-export";
import { jsonError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseIncludePriceParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;
  const includePrice = parseIncludePriceParam(new URL(req.url).searchParams.get("includePrice"));

  return runAdminDbJson(
    requestId,
    ["applications.read", "audit.write"],
    async ({ tx, adminUserId }) => {
      const payload = await loadCustomerExportPayload(tx, applicationId, { includePrice });
      if (!payload) {
        return jsonError("NOT_FOUND", "Application not found", {
          status: 404,
          requestId,
        });
      }

      const zipBuffer = await buildCustomerExportZip(payload);
      const basename = customerExportZipBasename(payload.referenceNumber, payload.applicationId);

      await writeAdminAudit(tx, {
        adminUserId,
        action: "application.customer_export",
        entityType: "application",
        entityId: applicationId,
        afterJson: JSON.stringify({
          documentCount: payload.documents.length,
          profileFieldCount: payload.profileRows.length,
          includePrice,
        }),
      });

      return new Response(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Length": String(zipBuffer.byteLength),
          "Cache-Control": "private, no-store",
          "Content-Disposition": `attachment; filename="${basename}.zip"`,
          "x-request-id": requestId ?? "",
        },
      });
    },
  );
}
