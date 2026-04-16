/**
 * Retention-on-payment helper (spec §11.2).
 *
 * Intended to be invoked from the idempotent payment webhook inside the same
 * DB transaction that sets `paymentStatus = paid`. The caller must supply a
 * transaction (typically from `withSystemDbActor`) because webhooks arrive
 * without a user session.
 *
 * Behavior:
 * - Verifies the application has the **latest** `passport_copy` AND
 *   `personal_photo` rows in `uploaded_temp` with blob bytes still present.
 * - If the precondition fails, returns `{ ok: false, reason: ... }` and DOES
 *   NOT mutate any rows. The caller MUST abort the `paid` transition and emit
 *   an ops alert (spec §1 / §11.2 "no silent partial paid").
 * - On success, flips the latest rows to `retained`, sets `retainedAt = now()`
 *   and clears `tempExpiresAt` on their blobs.
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

export type RetentionFailure =
  | { ok: false; reason: "MISSING_REQUIRED_DOCUMENT"; missing: DocumentType[] }
  | { ok: false; reason: "BLOB_BYTES_MISSING"; missing: DocumentType[] };

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
 * Verify + flip required docs to `retained`. Idempotent: if a required doc is
 * already `retained`, it is treated as an invariant violation (payment must
 * have already been retained) and returns `MISSING_REQUIRED_DOCUMENT` for
 * that slot rather than silently "re-retaining".
 *
 * Callers that want idempotency on webhook retries should short-circuit via
 * `application.paymentStatus === 'paid'` before invoking this helper.
 */
export async function retainRequiredDocuments(
  tx: DbTransaction,
  applicationId: string,
  now: Date = new Date(),
): Promise<RetentionResult> {
  const missing: DocumentType[] = [];
  const missingBytes: DocumentType[] = [];
  const targetIds: string[] = [];

  for (const type of REQUIRED_RETENTION_TYPES) {
    const latest = await findLatestTempDocumentId(tx, applicationId, type);
    if (!latest) {
      missing.push(type);
      continue;
    }
    if (!latest.hasBytes) {
      missingBytes.push(type);
      continue;
    }
    targetIds.push(latest.id);
  }

  if (missing.length > 0) {
    return { ok: false, reason: "MISSING_REQUIRED_DOCUMENT", missing };
  }
  if (missingBytes.length > 0) {
    return { ok: false, reason: "BLOB_BYTES_MISSING", missing: missingBytes };
  }

  for (const id of targetIds) {
    await tx
      .update(applicationDocument)
      .set({ status: DOCUMENT_STATUS.RETAINED })
      .where(eq(applicationDocument.id, id));
    await tx
      .update(applicationDocumentBlob)
      .set({ retainedAt: now, tempExpiresAt: null })
      .where(eq(applicationDocumentBlob.documentId, id));
  }

  return { ok: true, retainedDocumentIds: targetIds, retainedAt: now };
}
