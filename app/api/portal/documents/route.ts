import { headers } from "next/headers";

import { and, desc, eq, lt, or } from "drizzle-orm";

import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { userDocument } from "@/lib/db/schema/user-document";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), { defaultLimit: 5, max: 50 });
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const typeFilter = url.searchParams.get("type")?.trim() || null;

  const rows = await withClientDbActor(session.user.id, async (tx) => {
    const baseWhere = and(
      eq(userDocument.userId, session.user.id),
      typeFilter ? eq(userDocument.documentType, typeFilter) : undefined,
    );

    const cursorWhere = cursor
      ? or(
          lt(userDocument.createdAt, new Date(cursor.createdAt)),
          and(eq(userDocument.createdAt, new Date(cursor.createdAt)), lt(userDocument.id, cursor.id)),
        )
      : undefined;

    return tx
      .select({
        id: userDocument.id,
        documentType: userDocument.documentType,
        supportingCategory: userDocument.supportingCategory,
        originalFilename: userDocument.originalFilename,
        byteLength: userDocument.byteLength,
        contentType: userDocument.contentType,
        sha256: userDocument.sha256,
        createdAt: userDocument.createdAt,
        expiresAt: userDocument.expiresAt,
      })
      .from(userDocument)
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(desc(userDocument.createdAt), desc(userDocument.id))
      .limit(limit + 1);
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null;

  return jsonOk(
    {
      items: slice.map((r) => ({
        id: r.id,
        documentType: r.documentType,
        supportingCategory: r.supportingCategory,
        originalFilename: r.originalFilename,
        byteLength: r.byteLength,
        contentType: r.contentType,
        sha256: r.sha256,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
      })),
      nextCursor,
    },
    { requestId },
  );
}

