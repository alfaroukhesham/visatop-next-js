/**
 * Retention-on-payment helper (post–optional-docs checkout).
 *
 * Invoked from the idempotent payment webhook in the same DB transaction that
 * sets `paymentStatus = paid`. Callers use `withSystemDbActor` (no user session).
 *
 * **Partial retain:** For each of `passport_copy` and `personal_photo`, if the
 * latest row is `uploaded_temp` **with** blob bytes, flip it to `retained` and
 * set `retainedAt` / clear `tempExpiresAt`. Missing types are skipped (paid
 * with no uploads yet is success with zero ids). If a type has `uploaded_temp`
 * **without** bytes, retain **all good types first**, then return
 * `BLOB_BYTES_MISSING` so the webhook can flag `adminAttentionRequired`.
 */
import { and, desc, eq } from "drizzle-orm";

import type { DbTransaction } from "@/lib/db";
import {
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
  type DocumentType,
} from "@/lib/db/schema";

export type RetentionFailure = { ok: false; reason: "BLOB_BYTES_MISSING"; missing: DocumentType[] };

export type RetentionSuccess = {
  ok: true;
  retainedDocumentIds: string[];
  retainedAt: Date;
};

export type RetentionResult = RetentionSuccess | RetentionFailure;

export const REQUIRED_RETENTION_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
] as const;

async function findLatestTempDocumentId(
  tx: DbTransaction,
  applicationId: string,
  documentType: DocumentType,
): Promise<{ id: string; hasBytes: boolean } | null> {
  const rows = await tx
    .select({
      id: applicationDocument.id,
      status: applicationDocument.status,
      hasBytes: applicationDocumentBlob.documentId,
    })
    .from(applicationDocument)
    .leftJoin(
      applicationDocumentBlob,
      eq(applicationDocumentBlob.documentId, applicationDocument.id),
    )
    .where(
      and(
        eq(applicationDocument.applicationId, applicationId),
        eq(applicationDocument.documentType, documentType),
      ),
    )
    .orderBy(desc(applicationDocument.createdAt))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.status !== DOCUMENT_STATUS.UPLOADED_TEMP) return null;
  return { id: row.id, hasBytes: row.hasBytes !== null };
}

/**
 * Retain each required document type that has a valid temp blob. Idempotent
 * on webhook retries: caller should skip when `paymentStatus` is already `paid`
 * before invoking again.
 */
export async function retainRequiredDocuments(
  tx: DbTransaction,
  applicationId: string,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const retainedDocumentIds: string[] = [];
  const missingBytes: DocumentType[] = [];

  for (const type of REQUIRED_RETENTION_TYPES) {
    const latest = await findLatestTempDocumentId(tx, applicationId, type);
    if (!latest) continue;
    if (!latest.hasBytes) {
      missingBytes.push(type);
      continue;
    }
    await tx
      .update(applicationDocument)
      .set({ status: DOCUMENT_STATUS.RETAINED })
      .where(eq(applicationDocument.id, latest.id));
    await tx
      .update(applicationDocumentBlob)
      .set({ retainedAt: now, tempExpiresAt: null })
      .where(eq(applicationDocumentBlob.documentId, latest.id));
    retainedDocumentIds.push(latest.id);
  }

  if (missingBytes.length > 0) {
    return { ok: false, reason: "BLOB_BYTES_MISSING", missing: missingBytes };
  }

  return { ok: true, retainedDocumentIds, retainedAt: now };
}
