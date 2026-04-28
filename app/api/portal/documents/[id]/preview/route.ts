import { headers } from "next/headers";

import { eq } from "drizzle-orm";

import { jsonError } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { userDocument, userDocumentBlob } from "@/lib/db/schema/user-document";
import { asciiFilename } from "@/lib/applications/document-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const { id } = await ctx.params;

  const doc = await withClientDbActor(session.user.id, async (tx) => {
    const rows = await tx
      .select({
        id: userDocument.id,
        contentType: userDocument.contentType,
        originalFilename: userDocument.originalFilename,
        bytes: userDocumentBlob.bytes,
      })
      .from(userDocument)
      .innerJoin(userDocumentBlob, eq(userDocumentBlob.documentId, userDocument.id))
      .where(eq(userDocument.id, id))
      .limit(1);
    return rows[0] ?? null;
  });

  if (!doc) return jsonError("NOT_FOUND", "Document not found", { status: 404, requestId });

  const contentType = doc.contentType ?? "application/octet-stream";
  const filename = asciiFilename(doc.originalFilename, "document");
  return new Response(new Uint8Array(doc.bytes), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(doc.bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "x-request-id": requestId ?? "",
    },
  });
}

