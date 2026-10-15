import { headers } from "next/headers";
import { after } from "next/server";

import { jsonError, jsonOk, type ApiErrorCode } from "@/lib/api/response";
import { isUniqueViolation } from "@/lib/db/pg-errors";
import { logger } from "@/lib/logger";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { extractClientIp } from "@/lib/applications/client-ip";
import { consume } from "@/lib/applications/document-rate-limit";
import {
  isMimeAllowedForDocument,
  persistUploadedDocument,
  toPublicDocument,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_ALLOWLIST,
} from "@/lib/applications/document-upload";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import type { DocumentType } from "@/lib/db/schema";
import { DOCUMENT_TYPE } from "@/lib/db/schema";
import {
  DOCUMENT_TYPE_KEY_RE,
  getCatalogDocumentType,
  isReservedDocumentTypeKey,
} from "@/lib/admin/catalog/document-type";
import {
  CorruptImageError,
  NORMALIZED_CONTENT_TYPE,
} from "@/lib/documents/normalize-image";
import { convertHeicToJpegBuffer } from "@/lib/documents/heic-convert-server";
import { looksLikeHeic } from "@/lib/documents/heic-detect";
import { normalizePassportUpload } from "@/lib/documents/normalize-passport-upload";
import { normalizeSupportingUpload } from "@/lib/documents/normalize-supporting-upload";
import { normalizeImageBuffer } from "@/lib/documents/normalize-image";
import { resolveUploadContentType } from "@/lib/documents/upload-content-type";
import {
  CorruptPdfError,
  PdfNotSinglePageError,
} from "@/lib/documents/passport-pdf";
import { readCustomerLocaleFromCookieHeader } from "@/lib/i18n/customer-locale";
import {
  sendDocumentUploadFailureEmails,
  sendDocumentUploadResolvedEmails,
} from "@/lib/email/send-document-upload-outcome-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES: readonly DocumentType[] = [
  DOCUMENT_TYPE.PASSPORT_COPY,
  DOCUMENT_TYPE.PERSONAL_PHOTO,
  DOCUMENT_TYPE.SUPPORTING,
  DOCUMENT_TYPE.BANK_STATEMENT_6M,
];

const isBuiltInUploadType = (v: string): v is DocumentType =>
  (ALLOWED_TYPES as readonly string[]).includes(v);

type TUploadNotify = {
  applicationId: string;
  documentType: string | null;
  fileName: string | null;
  fileSize: number | null;
  fileMime: string | null;
  locale: string;
  requestId: string | null;
};

const queueFailureEmails = (notify: TUploadNotify, errorCode: string, httpStatus: number) => {
  after(() => {
    void sendDocumentUploadFailureEmails({
      applicationId: notify.applicationId,
      documentType: notify.documentType,
      errorCode,
      httpStatus,
      fileName: notify.fileName,
      fileSize: notify.fileSize,
      fileMime: notify.fileMime,
      locale: notify.locale,
      requestId: notify.requestId,
    }).catch((err) => {
      logger.error(
        { err, applicationId: notify.applicationId, requestId: notify.requestId },
        "document upload failure email failed",
      );
    });
  });
};

const queueResolvedEmails = (notify: TUploadNotify) => {
  const documentType = notify.documentType;
  if (!documentType) return;
  after(() => {
    void sendDocumentUploadResolvedEmails({
      applicationId: notify.applicationId,
      documentType,
      locale: notify.locale,
      requestId: notify.requestId,
    }).catch((err) => {
      logger.error(
        { err, applicationId: notify.applicationId, requestId: notify.requestId },
        "document upload resolved email failed",
      );
    });
  });
};

const fillNotifyFromForm = (notify: TUploadNotify, form: FormData) => {
  const rawType = form.get("documentType");
  if (typeof rawType === "string" && rawType.trim()) {
    notify.documentType = rawType.trim();
  }
  const fileEntry = form.get("file");
  if (fileEntry instanceof Blob) {
    notify.fileSize = fileEntry.size;
    notify.fileMime = fileEntry.type || null;
    if (fileEntry instanceof File && typeof fileEntry.name === "string") {
      notify.fileName = fileEntry.name.slice(0, 255);
    }
  }
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;
  const notify: TUploadNotify = {
    applicationId,
    documentType: null,
    fileName: null,
    fileSize: null,
    fileMime: null,
    locale: readCustomerLocaleFromCookieHeader(hdrs.get("cookie")),
    requestId,
  };

  const fail = (
    code: ApiErrorCode,
    message: string,
    opts: {
      status: number;
      details?: unknown;
      headers?: HeadersInit;
    },
  ) => {
    queueFailureEmails(notify, code, opts.status);
    return jsonError(code, message, { ...opts, requestId });
  };

  // Fast-fail on oversize before touching multipart parser.
  const declared = Number.parseInt(req.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > UPLOAD_MAX_BYTES + 2 * 1024) {
    return fail("FILE_TOO_LARGE", "File exceeds 8MB limit.", { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("VALIDATION_ERROR", "Request must be multipart/form-data.", { status: 400 });
  }
  fillNotifyFromForm(notify, form);

  const access = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!access.ok) {
    if (access.failure.kind === "not_found") {
      return fail("NOT_FOUND", "Application not found", { status: 404 });
    }
    return fail("FORBIDDEN", "Missing resume session", { status: 403 });
  }

  const rawType = form.get("documentType");
  if (typeof rawType !== "string" || rawType.length === 0) {
    return fail("VALIDATION_ERROR", "documentType is required.", { status: 400 });
  }
  let documentType: DocumentType | string = rawType;
  if (!isBuiltInUploadType(rawType)) {
    if (isReservedDocumentTypeKey(rawType) || !DOCUMENT_TYPE_KEY_RE.test(rawType)) {
      return fail("VALIDATION_ERROR", "documentType is required.", { status: 400 });
    }
    const registered = await withSystemDbActor(async (tx) => {
      try {
        return await getCatalogDocumentType(tx, rawType);
      } catch {
        return null;
      }
    });
    if (!registered) {
      return fail("VALIDATION_ERROR", "documentType is required.", { status: 400 });
    }
    documentType = rawType;
  }
  notify.documentType = documentType;

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof Blob)) {
    return fail("VALIDATION_ERROR", "file is required.", { status: 400 });
  }

  if (fileEntry.size === 0) {
    return fail("VALIDATION_ERROR", "Uploaded file is empty.", { status: 400 });
  }
  if (fileEntry.size > UPLOAD_MAX_BYTES) {
    return fail("FILE_TOO_LARGE", "File exceeds 8MB limit.", { status: 413 });
  }

  const declaredMime = fileEntry.type || "";
  const originalFilename =
    fileEntry instanceof File && typeof fileEntry.name === "string"
      ? fileEntry.name.slice(0, 255)
      : null;

  const bytes = Buffer.from(await fileEntry.arrayBuffer());
  const mime =
    resolveUploadContentType(bytes, declaredMime, originalFilename) ?? declaredMime;
  notify.fileMime = mime || notify.fileMime;
  const mimeAllow =
    documentType in UPLOAD_MIME_ALLOWLIST
      ? UPLOAD_MIME_ALLOWLIST[documentType as DocumentType]
      : (["image/jpeg", "image/png", "application/pdf"] as const);
  if (!isMimeAllowedForDocument(mimeAllow, mime)) {
    return fail("UNSUPPORTED_TYPE", "File type is not allowed for this document.", {
      status: 415,
      details: { documentType, accepted: mimeAllow },
    });
  }

  if (access.access.kind === "guest") {
    const ip = extractClientIp(hdrs);
    const decision = consume("UPLOAD_PREVIEW", { ip, applicationId });
    if (!decision.ok) {
      const retryAfterSeconds = Math.max(1, Math.ceil(decision.retryAfterMs / 1000));
      return fail("RATE_LIMITED", "Too many uploads. Try again later.", {
        status: 429,
        details: {
          retryAfterSeconds,
          retryAfterMs: decision.retryAfterMs,
        },
        headers: {
          "Retry-After": String(retryAfterSeconds),
        },
      });
    }
  }

  let normalized: {
    bytes: Buffer;
    sha256: string;
    contentType: string;
    byteLength: number;
  };
  try {
    let workingBytes: Buffer = bytes;
    let workingType = mime;
    if (looksLikeHeic(bytes, mime, originalFilename)) {
      workingBytes = await convertHeicToJpegBuffer(bytes);
      workingType = "image/jpeg";
    }
    if (documentType === DOCUMENT_TYPE.PASSPORT_COPY) {
      const n = await normalizePassportUpload({ bytes: workingBytes, contentType: workingType });
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: n.contentType,
        byteLength: n.byteLength,
      };
    } else if (documentType === DOCUMENT_TYPE.PERSONAL_PHOTO) {
      const n = await normalizeImageBuffer(workingBytes);
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: NORMALIZED_CONTENT_TYPE,
        byteLength: n.byteLength,
      };
    } else {
      const n = await normalizeSupportingUpload({ bytes: workingBytes, contentType: workingType });
      normalized = {
        bytes: n.bytes,
        sha256: n.sha256,
        contentType: n.contentType,
        byteLength: n.byteLength,
      };
    }
  } catch (err) {
    if (err instanceof PdfNotSinglePageError) {
      return fail("PDF_NOT_SINGLE_PAGE", "Passport PDF must be exactly one page.", {
        status: 400,
      });
    }
    if (err instanceof CorruptPdfError || err instanceof CorruptImageError) {
      return fail("CORRUPT_IMAGE", "Unable to read the uploaded file.", { status: 400 });
    }
    throw err;
  }

  const persist = async (tx: Parameters<Parameters<typeof withSystemDbActor>[0]>[0]) =>
    persistUploadedDocument(tx, {
      applicationId,
      documentType: documentType as DocumentType,
      sha256: normalized.sha256,
      contentType: normalized.contentType,
      byteLength: normalized.byteLength,
      bytes: normalized.bytes,
      originalFilename,
    });

  let result: Awaited<ReturnType<typeof persistUploadedDocument>>;
  try {
    result =
      access.access.kind === "user"
        ? await withClientDbActor(access.access.userId, persist)
        : await withSystemDbActor(persist);
  } catch (err) {
    if (isUniqueViolation(err)) {
      return fail("CONFLICT", "This file is already on the application.", { status: 409 });
    }
    logger.error({ err, requestId }, "document upload persist failed");
    return fail("INTERNAL_ERROR", "Upload failed unexpectedly.", { status: 500 });
  }

  if (!result.ok) {
    if (result.error.code === "CHECKOUT_FROZEN") {
      return fail(
        "CHECKOUT_FROZEN",
        "Required documents cannot be changed while checkout is pending.",
        { status: 409 },
      );
    }
    return fail("NOT_FOUND", "Application not found", { status: 404 });
  }

  queueResolvedEmails(notify);
  return jsonOk(
    {
      document: toPublicDocument(result.document),
      replaced: result.replacedPriorId !== null,
      idempotent: result.wasIdempotent,
    },
    { status: result.wasIdempotent ? 200 : 201, requestId },
  );
}
