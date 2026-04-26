import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  application,
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  DOCUMENT_TYPE,
} from "@/lib/db/schema";

export const ADMIN_UPLOAD_DOCUMENT_TYPES = [
  DOCUMENT_TYPE.ADMIN_STEP_ATTACHMENT,
  DOCUMENT_TYPE.OUTCOME_APPROVAL,
  DOCUMENT_TYPE.OUTCOME_AUTHORITY_REJECTION,
] as const;

export type AdminUploadDocumentType = (typeof ADMIN_UPLOAD_DOCUMENT_TYPES)[number];

export function isAdminUploadDocumentType(t: string): t is AdminUploadDocumentType {
  return (ADMIN_UPLOAD_DOCUMENT_TYPES as readonly string[]).includes(t);
}

export type PersistAdminDocumentInput = {
  applicationId: string;
  documentType: AdminUploadDocumentType;
  sha256: string;
  contentType: string;
  byteLength: number;
  bytes: Buffer;
  originalFilename: string | null;
};

export type PersistAdminDocumentResult =
  | { ok: true; document: typeof applicationDocument.$inferSelect; replacedPriorId: string | null; wasIdempotent: boolean }
  | { ok: false; error: { code: "NOT_FOUND" } };

/**
 * Admin-only uploads: retained immediately, no checkout freeze, no applicant readiness side-effects.
 */
export async function persistAdminUploadedDocument(
  tx: DbTransaction,
  input: PersistAdminDocumentInput,
): Promise<PersistAdminDocumentResult> {
  const apps = await tx
    .select({ id: application.id })
    .from(application)
    .where(eq(application.id, input.applicationId))
    .limit(1);
  if (!apps[0]) return { ok: false, error: { code: "NOT_FOUND" } };

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

  const now = new Date();

  if (prior && prior.sha256 === input.sha256) {
    await tx
      .update(applicationDocumentBlob)
      .set({ retainedAt: now, tempExpiresAt: null })
      .where(eq(applicationDocumentBlob.documentId, prior.id));
    return {
      ok: true,
      document: prior,
      replacedPriorId: null,
      wasIdempotent: true,
    };
  }

  let replacedPriorId: string | null = null;
  if (prior) {
    await tx.delete(applicationDocumentBlob).where(eq(applicationDocumentBlob.documentId, prior.id));
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
      status: DOCUMENT_STATUS.RETAINED,
      contentType: input.contentType,
      byteLength: input.byteLength,
      originalFilename: input.originalFilename,
      sha256: input.sha256,
    })
    .returning();
  const newDoc = insertedDoc[0];
  if (!newDoc) {
    throw new Error("persistAdminUploadedDocument: insert returned no row");
  }

  await tx.insert(applicationDocumentBlob).values({
    documentId: newDoc.id,
    bytes: input.bytes,
    tempExpiresAt: null,
    retainedAt: now,
  });

  return { ok: true, document: newDoc, replacedPriorId, wasIdempotent: false };
}
