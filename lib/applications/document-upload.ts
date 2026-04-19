import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  type DocumentType,
  EXTRACTION_STATUS,
} from "@/lib/db/schema";
import { CHECKOUT_STATE } from "@/lib/applications/status";
import { PAYMENT_STATUS } from "@/lib/applications/status";

export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

export const UPLOAD_MIME_ALLOWLIST: Record<DocumentType, readonly string[]> = {
  passport_copy: ["image/jpeg", "image/png", "application/pdf"],
  personal_photo: ["image/jpeg", "image/png"],
  supporting: ["image/jpeg", "image/png", "application/pdf"],
};

export type FrozenCheckoutError = { code: "CHECKOUT_FROZEN" };
export type NotFoundError = { code: "NOT_FOUND" };

export type UploadedDocument = typeof applicationDocument.$inferSelect;

export type PersistDocumentInput = {
  applicationId: string;
  documentType: DocumentType;
  sha256: string;
  contentType: string;
  byteLength: number;
  bytes: Buffer;
  originalFilename: string | null;
};

export type PersistDocumentResult =
  | { ok: true; document: UploadedDocument; replacedPriorId: string | null; wasIdempotent: boolean }
  | { ok: false; error: FrozenCheckoutError | NotFoundError };

/**
 * Run the replace-then-insert flow for a document upload inside the caller's
 * DB transaction. Intended callers:
 *
 * - `withClientDbActor(userId, (tx) => persistUploadedDocument(tx, input))`
 * - `withSystemDbActor((tx) => persistUploadedDocument(tx, input))`
 *
 * Behavior (spec §5.2):
 *
 * - Loads the application; returns `NOT_FOUND` if RLS hides it.
 * - If `documentType ∈ { passport_copy, personal_photo }` and
 *   `application.checkoutState === 'pending'`, returns `CHECKOUT_FROZEN` — the
 *   user cannot replace required docs while checkout is in-flight.
 * - Idempotent: if a non-deleted row for `(application, type)` already exists
 *   with the same sha256, returns it without re-inserting. Blob `tempExpiresAt`
 *   is refreshed if the draft window changed.
 * - Replace: if an existing non-deleted row's sha256 differs, it is marked
 *   `deleted` (blob row removed via FK cascade) and a new row + blob inserted.
 *   When replacing `passport_copy`, the application's passport-extraction
 *   summary fields are reset and `passportExtractionRunId` is bumped to
 *   invalidate any in-flight lease (spec §9.4).
 */
export async function persistUploadedDocument(
  tx: DbTransaction,
  input: PersistDocumentInput,
): Promise<PersistDocumentResult> {
  const apps = await tx
    .select({
      id: application.id,
      draftExpiresAt: application.draftExpiresAt,
      paymentStatus: application.paymentStatus,
      checkoutState: application.checkoutState,
      passportExtractionRunId: application.passportExtractionRunId,
    })
    .from(application)
    .where(eq(application.id, input.applicationId))
    .limit(1);
  const app = apps[0];
  if (!app) return { ok: false, error: { code: "NOT_FOUND" } };

  const isRequired =
    input.documentType === "passport_copy" || input.documentType === "personal_photo";
  if (isRequired && app.checkoutState === CHECKOUT_STATE.PENDING) {
    return { ok: false, error: { code: "CHECKOUT_FROZEN" } };
  }

  const priorRows = await tx
    .select()
    .from(applicationDocument)
    .where(
      and(
        eq(applicationDocument.applicationId, input.applicationId),
        eq(applicationDocument.documentType, input.documentType),
        or(
          ne(applicationDocument.status, DOCUMENT_STATUS.DELETED),
          isNull(applicationDocument.status),
        ),
      ),
    )
    .orderBy(desc(applicationDocument.createdAt));
  const prior = priorRows[0] ?? null;

  const tempExpiresAt =
    app.paymentStatus === PAYMENT_STATUS.UNPAID ? app.draftExpiresAt ?? null : null;

  if (prior && prior.sha256 === input.sha256) {
    if (tempExpiresAt !== undefined) {
      await tx
        .update(applicationDocumentBlob)
        .set({ tempExpiresAt })
        .where(eq(applicationDocumentBlob.documentId, prior.id));
    }
    return {
      ok: true,
      document: prior,
      replacedPriorId: null,
      wasIdempotent: true,
    };
  }

  let replacedPriorId: string | null = null;
  if (prior) {
    await tx
      .delete(applicationDocumentBlob)
      .where(eq(applicationDocumentBlob.documentId, prior.id));
    await tx
      .update(applicationDocument)
      .set({ status: DOCUMENT_STATUS.DELETED })
      .where(eq(applicationDocument.id, prior.id));
    replacedPriorId = prior.id;
  }

  const insertedDoc = await tx
    .insert(applicationDocument)
    .values({
      applicationId: input.applicationId,
      documentType: input.documentType,
      status: DOCUMENT_STATUS.UPLOADED_TEMP,
      contentType: input.contentType,
      byteLength: input.byteLength,
      originalFilename: input.originalFilename,
      sha256: input.sha256,
    })
    .returning();
  const newDoc = insertedDoc[0];
  if (!newDoc) {
    throw new Error("persistUploadedDocument: insert returned no row");
  }

  await tx.insert(applicationDocumentBlob).values({
    documentId: newDoc.id,
    bytes: input.bytes,
    tempExpiresAt,
  });

  if (input.documentType === "passport_copy") {
    await tx
      .update(application)
      .set({
        passportExtractionStatus: EXTRACTION_STATUS.NOT_STARTED,
        passportExtractionUpdatedAt: null,
        passportExtractionStartedAt: null,
        passportExtractionLeaseExpiresAt: null,
        passportExtractionRunId: sql<number>`${application.passportExtractionRunId} + 1`,
        passportExtractionDocumentId: null,
        passportExtractionSha256: null,
      })
      .where(eq(application.id, input.applicationId));
  }

  return { ok: true, document: newDoc, replacedPriorId, wasIdempotent: false };
}

/** Shape returned to callers (upload response / list response). */
export function toPublicDocument(row: typeof applicationDocument.$inferSelect) {
  return {
    id: row.id,
    documentType: row.documentType,
    status: row.status,
    sha256: row.sha256,
    contentType: row.contentType,
    byteLength: row.byteLength,
    originalFilename: row.originalFilename,
    createdAt: row.createdAt.toISOString(),
  };
}
