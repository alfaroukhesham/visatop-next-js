import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: applicationId } = await params;
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(
    requestId,
    ["applications.write"],
    async ({ tx, adminUserId }) => {
      const updated = await tx
        .update(schema.application)
        .set({ adminAttentionRequired: false })
        .where(eq(schema.application.id, applicationId))
        .returning();

      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "application.attention.cleared",
        entityType: "application",
        entityId: row.id,
        afterJson: JSON.stringify({ adminAttentionRequired: false }),
      });

      return jsonOk({ cleared: true }, { requestId });
    }
  );
}
