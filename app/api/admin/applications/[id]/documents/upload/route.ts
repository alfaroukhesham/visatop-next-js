import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import {
  ADMIN_UPLOAD_DOCUMENT_TYPES,
  isAdminUploadDocumentType,
  persistAdminUploadedDocument,
} from "@/lib/applications/admin-document-upload";
import { toPublicDocument, UPLOAD_MAX_BYTES, UPLOAD_MIME_ALLOWLIST } from "@/lib/applications/document-upload";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import { CorruptImageError } from "@/lib/documents/normalize-image";
import { normalizeSupportingUpload } from "@/lib/documents/normalize-supporting-upload";
import { CorruptPdfError } from "@/lib/documents/passport-pdf";
import * as schema from "@/lib/db/schema";
import { ADMIN_WORKFLOW_APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applications/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId } = await ctx.params;

  const declared = Number.parseInt(req.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > UPLOAD_MAX_BYTES + 2 * 1024) {
    return jsonError("FILE_TOO_LARGE", "File exceeds 8MB limit.", { status: 413, requestId });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("VALIDATION_ERROR", "Request must be multipart/form-data.", { status: 400, requestId });
  }

  const rawType = form.get("documentType");
  if (typeof rawType !== "string" || !isAdminUploadDocumentType(rawType)) {
    return jsonError("VALIDATION_ERROR", "documentType must be an admin upload type.", {
      status: 400,
      requestId,
      details: { allowed: [...ADMIN_UPLOAD_DOCUMENT_TYPES] },
    });
  }
  const documentType = rawType;

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof Blob)) {
    return jsonError("VALIDATION_ERROR", "file is required.", { status: 400, requestId });
  }
  if (fileEntry.size === 0) {
    return jsonError("VALIDATION_ERROR", "Uploaded file is empty.", { status: 400, requestId });
  }
  if (fileEntry.size > UPLOAD_MAX_BYTES) {
    return jsonError("FILE_TOO_LARGE", "File exceeds 8MB limit.", { status: 413, requestId });
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
    fileEntry instanceof File && typeof fileEntry.name === "string" ? fileEntry.name.slice(0, 255) : null;

  let normalized: { bytes: Buffer; sha256: string; contentType: string; byteLength: number };
  try {
    const n = await normalizeSupportingUpload({ bytes, contentType: mime });
    normalized = {
      bytes: n.bytes,
      sha256: n.sha256,
      contentType: n.contentType,
      byteLength: n.byteLength,
    };
  } catch (err) {
    if (err instanceof CorruptPdfError || err instanceof CorruptImageError) {
      return jsonError("CORRUPT_IMAGE", "Unable to read the uploaded file.", { status: 400, requestId });
    }
    throw err;
  }

  return runAdminDbJson(requestId, ["applications.write", "audit.write"], async ({ tx, adminUserId }) => {
    const [app] = await tx
      .select({
        id: schema.application.id,
        paymentStatus: schema.application.paymentStatus,
        applicationStatus: schema.application.applicationStatus,
      })
      .from(schema.application)
      .where(eq(schema.application.id, applicationId))
      .limit(1);

    if (!app) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }

    if (app.paymentStatus !== "paid") {
      return jsonError("INVALID_OPS_STATE", "Admin uploads require a paid application.", {
        status: 400,
        requestId,
      });
    }

    const st = app.applicationStatus as ApplicationStatus;
    const outcomeTypes =
      documentType === "outcome_approval" || documentType === "outcome_authority_rejection";
    if (outcomeTypes) {
      if (!ADMIN_WORKFLOW_APPLICATION_STATUSES.has(st)) {
        return jsonError(
          "INVALID_OPS_STATE",
          "Outcome documents can only be uploaded while status is in_progress or awaiting_authority.",
          { status: 400, requestId },
        );
      }
    } else if (!ADMIN_WORKFLOW_APPLICATION_STATUSES.has(st)) {
      return jsonError(
        "INVALID_OPS_STATE",
        "Step attachments can only be uploaded while status is in_progress or awaiting_authority.",
        { status: 400, requestId },
      );
    }

    const result = await persistAdminUploadedDocument(tx, {
      applicationId,
      documentType,
      sha256: normalized.sha256,
      contentType: normalized.contentType,
      byteLength: normalized.byteLength,
      bytes: normalized.bytes,
      originalFilename,
    });

    if (!result.ok) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }

    await writeAdminAudit(tx, {
      adminUserId,
      action: "application_document.admin_upload",
      entityType: "application_document",
      entityId: result.document.id,
      beforeJson: null,
      afterJson: JSON.stringify({
        applicationId,
        documentType,
        replacedPriorId: result.replacedPriorId,
        idempotent: result.wasIdempotent,
      }),
    });

    return jsonOk(
      {
        document: toPublicDocument(result.document),
        replaced: result.replacedPriorId !== null,
        idempotent: result.wasIdempotent,
      },
      { status: result.wasIdempotent ? 200 : 201, requestId },
    );
  });
}
