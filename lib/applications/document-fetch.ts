/**
 * Shared helpers for document byte-streaming routes (preview + download).
 */
import { and, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import {
  applicationDocument,
  applicationDocumentBlob,
  DOCUMENT_STATUS,
  type DocumentStatus,
} from "@/lib/db/schema";

export type DocumentForStream = {
  id: string;
  documentType: string | null;
  status: DocumentStatus | null;
  contentType: string | null;
  byteLength: number | null;
  originalFilename: string | null;
  bytes: Buffer;
};

/**
 * Load a document + its blob bytes for streaming. Returns `null` if the row
 * is missing, deleted, or belongs to another application. Caller must wrap
 * this in the appropriate actor-scoped transaction so RLS filters rows the
 * requester cannot see.
 */
export async function loadDocumentForStream(
  tx: DbTransaction,
  applicationId: string,
  documentId: string,
  allowedStatuses: readonly DocumentStatus[],
): Promise<DocumentForStream | null> {
  const rows = await tx
    .select({
      id: applicationDocument.id,
      documentType: applicationDocument.documentType,
      status: applicationDocument.status,
      contentType: applicationDocument.contentType,
      byteLength: applicationDocument.byteLength,
      originalFilename: applicationDocument.originalFilename,
      bytes: applicationDocumentBlob.bytes,
    })
    .from(applicationDocument)
    .leftJoin(
      applicationDocumentBlob,
      eq(applicationDocumentBlob.documentId, applicationDocument.id),
    )
    .where(
      and(
        eq(applicationDocument.id, documentId),
        eq(applicationDocument.applicationId, applicationId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row?.bytes) return null;
  const status = (row.status ?? null) as DocumentStatus | null;
  if (!status || status === DOCUMENT_STATUS.DELETED) return null;
  if (!allowedStatuses.includes(status)) return null;
  return {
    id: row.id,
    documentType: row.documentType,
    status,
    contentType: row.contentType,
    byteLength: row.byteLength,
    originalFilename: row.originalFilename,
    bytes: Buffer.isBuffer(row.bytes) ? row.bytes : Buffer.from(row.bytes),
  };
}

/** Safe ASCII fallback for `Content-Disposition`. */
export function asciiFilename(s: string | null | undefined, fallback: string): string {
  if (!s) return fallback;
  return (
    s
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\\r\n/]/g, "_")
      .slice(0, 120) || fallback
  );
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/pdf": ".pdf",
  "image/heic": ".heic",
  "image/heif": ".heic",
};

/**
 * Filename whose extension matches the bytes we actually stored.
 * Passport PDFs are persisted as JPEG, so an upload named `passport.pdf`
 * must download as `passport.jpg` or Preview treats the file as damaged.
 */
export const filenameForStoredDocument = (
  originalFilename: string | null | undefined,
  contentType: string | null | undefined,
  fallback: string,
): string => {
  const mime = contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
  const storedExt = EXTENSION_BY_CONTENT_TYPE[mime] ?? "";
  const raw = originalFilename?.trim() || fallback;
  if (!storedExt) return asciiFilename(raw, fallback);
  const stemSource = raw.replace(/\.[^.\\/]+$/, "");
  const stem = (asciiFilename(stemSource, fallback).replace(/\.+$/, "") || fallback).slice(
    0,
    120 - storedExt.length,
  );
  return `${stem}${storedExt}`;
};
