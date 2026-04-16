import { headers } from "next/headers";

import { jsonError, jsonOk } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { extractClientIp } from "@/lib/applications/client-ip";
import { consume } from "@/lib/applications/document-rate-limit";
import {
  persistUploadedDocument,
  toPublicDocument,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_ALLOWLIST,
} from "@/lib/applications/document-upload";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import type { DocumentType } from "@/lib/db/schema";
import { DOCUMENT_TYPE } from "@/lib/db/schema";
import {
  CorruptImageError,
  NORMALIZED_CONTENT_TYPE,
} from "@/lib/documents/normalize-image";
import { normalizePassportUpload } from "@/lib/documents/normalize-passport-upload";
import { normalizeSupportingUpload } from "@/lib/documents/normalize-supporting-upload";
import { normalizeImageBuffer } from "@/lib/documents/normalize-image";
import {
  CorruptPdfError,
  PdfNotSinglePageError,
} from "@/lib/documents/passport-pdf";

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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const access = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!access.ok) {
    if (access.failure.kind === "not_found") {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
  }

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

  if (access.access.kind === "guest") {
    const ip = extractClientIp(hdrs);
    const decision = consume("UPLOAD_PREVIEW", { ip, applicationId });
    if (!decision.ok) {
      return jsonError("RATE_LIMITED", "Too many upload/preview requests.", {
        status: 429,
        requestId,
        headers: {
          "Retry-After": String(Math.ceil(decision.retryAfterMs / 1000)),
        },
      });
    }
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

  const persist = async (tx: Parameters<Parameters<typeof withSystemDbActor>[0]>[0]) =>
    persistUploadedDocument(tx, {
      applicationId,
      documentType,
      sha256: normalized.sha256,
      contentType: normalized.contentType,
      byteLength: normalized.byteLength,
      bytes: normalized.bytes,
      originalFilename,
    });

  const result =
    access.access.kind === "user"
      ? await withClientDbActor(access.access.userId, persist)
      : await withSystemDbActor(persist);

  if (!result.ok) {
    if (result.error.code === "CHECKOUT_FROZEN") {
      return jsonError(
        "CHECKOUT_FROZEN",
        "Required documents cannot be changed while checkout is pending.",
        { status: 409, requestId },
      );
    }
    return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
  }

  return jsonOk(
    {
      document: toPublicDocument(result.document),
      replaced: result.replacedPriorId !== null,
      idempotent: result.wasIdempotent,
    },
    { status: result.wasIdempotent ? 200 : 201, requestId },
  );
}
