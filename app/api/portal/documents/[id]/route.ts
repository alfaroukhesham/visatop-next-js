import { headers } from "next/headers";

import { and, eq } from "drizzle-orm";

import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { userDocument } from "@/lib/db/schema/user-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const { id } = await ctx.params;

  const deleted = await withClientDbActor(session.user.id, async (tx) => {
    const rows = await tx
      .delete(userDocument)
      .where(and(eq(userDocument.id, id), eq(userDocument.userId, session.user.id)))
      .returning({ id: userDocument.id });
    return rows[0]?.id ?? null;
  });

  if (!deleted) {
    return jsonError("NOT_FOUND", "Document not found", { status: 404, requestId });
  }

  return jsonOk({ deleted: true }, { requestId });
}

