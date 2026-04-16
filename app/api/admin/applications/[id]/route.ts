/**
 * Admin DELETE of an application (spec §12A).
 *
 * Cascades to `application_document` → `application_document_blob` and
 * `application_document_extraction` via existing FK `ON DELETE CASCADE`,
 * so a single `DELETE` on `application` is sufficient to remove all bytes.
 * An audit row is written *before* the delete so the entity snapshot is
 * still visible in the same transaction.
 */
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["applications.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const existing = await tx
        .select({
          id: schema.application.id,
          userId: schema.application.userId,
          isGuest: schema.application.isGuest,
          applicationStatus: schema.application.applicationStatus,
          paymentStatus: schema.application.paymentStatus,
          fulfillmentStatus: schema.application.fulfillmentStatus,
          serviceId: schema.application.serviceId,
          nationalityCode: schema.application.nationalityCode,
        })
        .from(schema.application)
        .where(eq(schema.application.id, id))
        .limit(1);
      const row = existing[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Application not found", {
          status: 404,
          requestId,
        });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "application.delete",
        entityType: "application",
        entityId: row.id,
        beforeJson: JSON.stringify(row),
      });

      const deleted = await tx
        .delete(schema.application)
        .where(eq(schema.application.id, id))
        .returning({ id: schema.application.id });
      if (deleted.length === 0) {
        return jsonError("NOT_FOUND", "Application not found", {
          status: 404,
          requestId,
        });
      }

      return jsonOk({ deletedId: deleted[0].id }, { requestId });
    },
  );
}
