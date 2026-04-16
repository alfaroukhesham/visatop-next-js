/**
 * Streams a document blob for inline preview. Allowed when the requester has
 * access to the application AND the blob is `uploaded_temp` or `retained`
 * (spec §10.4). Guest requests share the UPLOAD_PREVIEW rate-limit bucket
 * with uploads.
 */
import { headers } from "next/headers";

import { jsonError } from "@/lib/api/response";
import { resolveApplicationAccess } from "@/lib/applications/application-access";
import { extractClientIp } from "@/lib/applications/client-ip";
import { consume } from "@/lib/applications/document-rate-limit";
import {
  asciiFilename,
  loadDocumentForStream,
} from "@/lib/applications/document-fetch";
import { withClientDbActor, withSystemDbActor } from "@/lib/db/actor-context";
import { DOCUMENT_STATUS } from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_STATUSES = [
  DOCUMENT_STATUS.UPLOADED_TEMP,
  DOCUMENT_STATUS.RETAINED,
] as const;

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string; documentId: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: applicationId, documentId } = await ctx.params;

  const access = await resolveApplicationAccess(req, hdrs, applicationId);
  if (!access.ok) {
    if (access.failure.kind === "not_found") {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonError("FORBIDDEN", "Missing resume session", { status: 403, requestId });
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

  const loader = async (tx: Parameters<Parameters<typeof withSystemDbActor>[0]>[0]) =>
    loadDocumentForStream(tx, applicationId, documentId, PREVIEW_STATUSES);

  const doc =
    access.access.kind === "user"
      ? await withClientDbActor(access.access.userId, loader)
      : await withSystemDbActor(loader);

  if (!doc) {
    return jsonError("NOT_FOUND", "Document not found", { status: 404, requestId });
  }

  const contentType = doc.contentType ?? "application/octet-stream";
  const filename = asciiFilename(doc.originalFilename, "document");
  return new Response(new Uint8Array(doc.bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(doc.bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "x-request-id": requestId ?? "",
    },
  });
}
