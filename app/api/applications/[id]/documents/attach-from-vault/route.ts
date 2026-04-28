import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { jsonError, jsonOk } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";
import {
  applicationDocumentSource,
  userDocument,
  userDocumentBlob,
} from "@/lib/db/schema/user-document";
import { persistUploadedDocument, toPublicDocument } from "@/lib/applications/document-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userDocumentId: z.string().min(1).max(200),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const { id: applicationId } = await ctx.params;

  const parsed = await parseJsonBody(req, bodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const { userDocumentId } = parsed.data;

  const result = await withClientDbActor(session.user.id, async (tx) => {
    const [appRow] = await tx
      .select({ id: application.id })
      .from(application)
      .where(eq(application.id, applicationId))
      .limit(1);
    if (!appRow) return { ok: false as const, kind: "not_found" as const };

    const [ud] = await tx
      .select({
        id: userDocument.id,
        documentType: userDocument.documentType,
        supportingCategory: userDocument.supportingCategory,
        contentType: userDocument.contentType,
        byteLength: userDocument.byteLength,
        originalFilename: userDocument.originalFilename,
        sha256: userDocument.sha256,
        bytes: userDocumentBlob.bytes,
      })
      .from(userDocument)
      .innerJoin(userDocumentBlob, eq(userDocumentBlob.documentId, userDocument.id))
      .where(eq(userDocument.id, userDocumentId))
      .limit(1);
    if (!ud) return { ok: false as const, kind: "not_found" as const };

    const persisted = await persistUploadedDocument(tx, {
      applicationId,
      documentType: ud.documentType as never,
      sha256: ud.sha256,
      contentType: ud.contentType ?? "application/octet-stream",
      byteLength: Number(ud.byteLength ?? ud.bytes.byteLength),
      bytes: Buffer.from(ud.bytes),
      originalFilename: ud.originalFilename ?? null,
    });

    if (!persisted.ok) return { ok: false as const, kind: "not_found" as const };

    await tx
      .insert(applicationDocumentSource)
      .values({
        applicationDocumentId: persisted.document.id,
        userDocumentId: ud.id,
      })
      .onConflictDoNothing();

    return { ok: true as const, persisted };
  });

  if (!result.ok) return jsonError("NOT_FOUND", "Application or document not found", { status: 404, requestId });

  return jsonOk(
    { document: toPublicDocument(result.persisted.document), idempotent: result.persisted.wasIdempotent },
    { status: result.persisted.wasIdempotent ? 200 : 201, requestId },
  );
}

