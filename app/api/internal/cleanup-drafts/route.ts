import { headers } from "next/headers";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
} from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
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

  const result = await withSystemDbActor(async (tx) => {
    // 1) Hard-delete expired unpaid drafts. FK `ON DELETE CASCADE` on
    //    application_document → application_document_blob removes their bytes.
    const deletedApplications = await tx
      .delete(application)
      .where(
        and(
          eq(application.paymentStatus, "unpaid"),
          eq(application.applicationStatus, "draft"),
          isNotNull(application.draftExpiresAt),
          lt(application.draftExpiresAt, sql`now()`),
        ),
      )
      .returning({ id: application.id });

    // 2) Safety net for orphaned TEMP blobs (spec §11.1) — covers partial
    //    failures where the application row still exists but the blob's
    //    `tempExpiresAt` has lapsed and payment never landed. We delete the
    //    blob row (bytes) and mark the document `deleted`; metadata is
    //    retained so the UI can render a "file removed" placeholder.
    const orphanRows = await tx
      .select({
        documentId: applicationDocumentBlob.documentId,
        applicationId: applicationDocument.applicationId,
      })
      .from(applicationDocumentBlob)
      .innerJoin(
        applicationDocument,
        eq(applicationDocument.id, applicationDocumentBlob.documentId),
      )
      .innerJoin(application, eq(application.id, applicationDocument.applicationId))
      .where(
        and(
          isNull(applicationDocumentBlob.retainedAt),
          isNotNull(applicationDocumentBlob.tempExpiresAt),
          lt(applicationDocumentBlob.tempExpiresAt, sql`now()`),
          eq(application.paymentStatus, "unpaid"),
          eq(applicationDocument.status, DOCUMENT_STATUS.UPLOADED_TEMP),
        ),
      );

    const orphanIds = orphanRows.map((r) => r.documentId);
    if (orphanIds.length > 0) {
      for (const id of orphanIds) {
        await tx
          .delete(applicationDocumentBlob)
          .where(eq(applicationDocumentBlob.documentId, id));
        await tx
          .update(applicationDocument)
          .set({ status: DOCUMENT_STATUS.DELETED })
          .where(eq(applicationDocument.id, id));
      }
    }

    return {
      deletedApplicationIds: deletedApplications.map((r) => r.id),
      deletedBlobDocumentIds: orphanIds,
    };
  });

  return jsonOk(
    {
      deletedCount: result.deletedApplicationIds.length,
      ids: result.deletedApplicationIds,
      deletedBlobCount: result.deletedBlobDocumentIds.length,
      deletedBlobDocumentIds: result.deletedBlobDocumentIds,
    },
    { requestId },
  );
}
