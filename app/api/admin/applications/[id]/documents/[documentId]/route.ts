/**
 * Admin DELETE of a single application document (spec §12A).
 *
 * Deletes the document row; its `application_document_blob` is removed via
 * FK `ON DELETE CASCADE`. We write an audit row first with the pre-delete
 * snapshot. If the document does not belong to the given application (or is
 * already gone) we return 404 without writing an audit row.
 */
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId, documentId } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["applications.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const rows = await tx
        .select({
          id: schema.applicationDocument.id,
          applicationId: schema.applicationDocument.applicationId,
          documentType: schema.applicationDocument.documentType,
          status: schema.applicationDocument.status,
          contentType: schema.applicationDocument.contentType,
          byteLength: schema.applicationDocument.byteLength,
          sha256: schema.applicationDocument.sha256,
          originalFilename: schema.applicationDocument.originalFilename,
          createdAt: schema.applicationDocument.createdAt,
        })
        .from(schema.applicationDocument)
        .where(
          and(
            eq(schema.applicationDocument.id, documentId),
            eq(schema.applicationDocument.applicationId, applicationId),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Document not found", {
          status: 404,
          requestId,
        });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "application_document.delete",
        entityType: "application_document",
        entityId: row.id,
        beforeJson: JSON.stringify(row),
      });

      const deleted = await tx
        .delete(schema.applicationDocument)
        .where(
          and(
            eq(schema.applicationDocument.id, documentId),
            eq(schema.applicationDocument.applicationId, applicationId),
          ),
        )
        .returning({ id: schema.applicationDocument.id });
      if (deleted.length === 0) {
        return jsonError("NOT_FOUND", "Document not found", {
          status: 404,
          requestId,
        });
      }

      return jsonOk(
        { deletedId: deleted[0].id, applicationId },
        { requestId },
      );
    },
  );
}
