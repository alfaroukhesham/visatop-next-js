import { headers } from "next/headers";

import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import {
  SUPPORTING_CATEGORY,
  userDocument,
  userDocumentBlob,
  type SupportingCategory,
} from "@/lib/db/schema/user-document";
import type { DocumentType } from "@/lib/db/schema";
import { DOCUMENT_TYPE } from "@/lib/db/schema";
import { UPLOAD_MAX_BYTES, UPLOAD_MIME_ALLOWLIST } from "@/lib/applications/document-upload";
import { normalizePassportUpload } from "@/lib/documents/normalize-passport-upload";
import { normalizeSupportingUpload } from "@/lib/documents/normalize-supporting-upload";
import { normalizeImageBuffer } from "@/lib/documents/normalize-image";
import { NORMALIZED_CONTENT_TYPE } from "@/lib/documents/normalize-image";
import { CorruptImageError } from "@/lib/documents/normalize-image";
import { CorruptPdfError, PdfNotSinglePageError } from "@/lib/documents/passport-pdf";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
  DOCUMENT_TYPE.SUPPORTING,
];

function isDocumentType(v: string): v is DocumentType {
  return (ALLOWED_TYPES as readonly string[]).includes(v);
}

function isSupportingCategory(v: string): v is SupportingCategory {
  return (Object.values(SUPPORTING_CATEGORY) as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  // Fast-fail on oversize before touching multipart parser.
  const declared = Number.parseInt(req.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > UPLOAD_MAX_BYTES + 2 * 1024) {
    return jsonError("FILE_TOO_LARGE", "File exceeds 8MB limit.", {
      status: 413,
      requestId,
    });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("VALIDATION_ERROR", "Request must be multipart/form-data.", {
      status: 400,
      requestId,
    });
  }

  const rawType = form.get("documentType");
  if (typeof rawType !== "string" || !isDocumentType(rawType)) {
    return jsonError("VALIDATION_ERROR", "documentType is required.", {
      status: 400,
      requestId,
    });
  }
  const documentType: DocumentType = rawType;

  const rawCategory = form.get("supportingCategory");
  const supportingCategory =
    typeof rawCategory === "string" && rawCategory.trim() ? rawCategory.trim() : null;
  if (supportingCategory && !isSupportingCategory(supportingCategory)) {
    return jsonError("VALIDATION_ERROR", "supportingCategory is invalid.", {
      status: 400,
      requestId,
      details: { allowed: Object.values(SUPPORTING_CATEGORY) },
    });
  }
  if (documentType !== DOCUMENT_TYPE.SUPPORTING && supportingCategory) {
    return jsonError("VALIDATION_ERROR", "supportingCategory is only allowed for supporting documents.", {
      status: 400,
      requestId,
    });
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof Blob)) {
    return jsonError("VALIDATION_ERROR", "file is required.", {
      status: 400,
      requestId,
    });
  }
  if (fileEntry.size === 0) {
    return jsonError("VALIDATION_ERROR", "Uploaded file is empty.", {
      status: 400,
      requestId,
    });
  }
  if (fileEntry.size > UPLOAD_MAX_BYTES) {
    return jsonError("FILE_TOO_LARGE", "File exceeds 8MB limit.", {
      status: 413,
      requestId,
    });
  }

  const mime = fileEntry.type || "";
  const mimeAllow = UPLOAD_MIME_ALLOWLIST[documentType];
  if (!mimeAllow.includes(mime)) {
    return jsonError("UNSUPPORTED_TYPE", "File type is not allowed for this document.", {
      status: 415,
      requestId,
      details: { documentType, accepted: mimeAllow },
    });
  }

  const bytes = Buffer.from(await fileEntry.arrayBuffer());
  const originalFilename =
    fileEntry instanceof File && typeof fileEntry.name === "string"
      ? fileEntry.name.slice(0, 255)
      : null;

  let normalized: {
    bytes: Buffer;
    sha256: string;
    contentType: string;
    byteLength: number;
  };

  try {
    if (documentType === DOCUMENT_TYPE.PASSPORT_COPY) {
      const n = await normalizePassportUpload({ bytes, contentType: mime });
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: n.contentType,
        byteLength: n.byteLength,
      };
    } else if (documentType === DOCUMENT_TYPE.PERSONAL_PHOTO) {
      const n = await normalizeImageBuffer(bytes);
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: NORMALIZED_CONTENT_TYPE,
        byteLength: n.byteLength,
      };
    } else {
      const n = await normalizeSupportingUpload({ bytes, contentType: mime });
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: n.contentType,
        byteLength: n.byteLength,
      };
    }
  } catch (err) {
    if (err instanceof PdfNotSinglePageError) {
      return jsonError("PDF_NOT_SINGLE_PAGE", "Passport PDF must be exactly one page.", {
        status: 400,
        requestId,
      });
    }
    if (err instanceof CorruptPdfError || err instanceof CorruptImageError) {
      return jsonError("CORRUPT_IMAGE", "Unable to read the uploaded file.", {
        status: 400,
        requestId,
      });
    }
    throw err;
  }

  const userId = session.user.id;

  const result = await withClientDbActor(userId, async (tx) => {
    const [inserted] =
      documentType === DOCUMENT_TYPE.SUPPORTING
        ? await tx
            .insert(userDocument)
            .values({
              userId,
              documentType,
              supportingCategory: supportingCategory ?? null,
              contentType: normalized.contentType,
              byteLength: normalized.byteLength,
              originalFilename,
              sha256: normalized.sha256,
            })
            .onConflictDoNothing({
              target: [
                userDocument.userId,
                userDocument.sha256,
                userDocument.documentType,
                userDocument.supportingCategory,
              ],
              where: sql`${userDocument.documentType} = 'supporting'`,
            })
            .returning()
        : await tx
            .insert(userDocument)
            .values({
              userId,
              documentType,
              supportingCategory: null,
              contentType: normalized.contentType,
              byteLength: normalized.byteLength,
              originalFilename,
              sha256: normalized.sha256,
            })
            .onConflictDoNothing({
              target: [userDocument.userId, userDocument.sha256, userDocument.documentType],
              where: sql`${userDocument.documentType} <> 'supporting'`,
            })
            .returning();

    const row =
      inserted ??
      (
        await tx
          .select()
          .from(userDocument)
          .where(
            and(
              eq(userDocument.userId, userId),
              eq(userDocument.sha256, normalized.sha256),
              eq(userDocument.documentType, documentType),
              documentType === DOCUMENT_TYPE.SUPPORTING
                ? supportingCategory
                  ? eq(userDocument.supportingCategory, supportingCategory)
                  : isNull(userDocument.supportingCategory)
                : isNull(userDocument.supportingCategory),
            ),
          )
          .limit(1)
      )[0];

    if (!row) {
      throw new Error("portal documents upload: unable to resolve vault row after conflict");
    }

    if (inserted) {
      await tx.insert(userDocumentBlob).values({ documentId: row.id, bytes: normalized.bytes });
    }

    return { row, wasIdempotent: !inserted };
  });

  return jsonOk(
    {
      document: {
        id: result.row.id,
        documentType: result.row.documentType,
        supportingCategory: result.row.supportingCategory,
        originalFilename: result.row.originalFilename,
        byteLength: result.row.byteLength,
        contentType: result.row.contentType,
        sha256: result.row.sha256,
        createdAt: result.row.createdAt.toISOString(),
        expiresAt: result.row.expiresAt ? result.row.expiresAt.toISOString() : null,
      },
      idempotent: result.wasIdempotent,
    },
    { status: result.wasIdempotent ? 200 : 201, requestId },
  );
}

