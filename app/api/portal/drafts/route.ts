import { headers } from "next/headers";

import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";

import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";

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
  const now = new Date();

  const rows = await withClientDbActor(session.user.id, async (tx) => {
    const baseWhere = and(
      eq(application.userId, session.user.id),
      // Portal drafts = anything on the account not yet paid.
      eq(application.paymentStatus, "unpaid"),
      or(isNull(application.draftExpiresAt), gt(application.draftExpiresAt, now)),
    );

    const cursorWhere = cursor
      ? or(
          lt(application.createdAt, new Date(cursor.createdAt)),
          and(eq(application.createdAt, new Date(cursor.createdAt)), lt(application.id, cursor.id)),
        )
      : undefined;

    return tx
      .select({
        id: application.id,
        referenceNumber: application.referenceNumber,
        serviceId: application.serviceId,
        nationalityCode: application.nationalityCode,
        createdAt: application.createdAt,
        draftExpiresAt: application.draftExpiresAt,
      })
      .from(application)
      .where(cursorWhere ? and(baseWhere, cursorWhere) : baseWhere)
      .orderBy(desc(application.createdAt), desc(application.id))
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
        referenceDisplay: r.referenceNumber ?? r.id.slice(0, 8),
        serviceId: r.serviceId,
        nationalityCode: r.nationalityCode,
        createdAt: r.createdAt.toISOString(),
        draftExpiresAt: r.draftExpiresAt ? r.draftExpiresAt.toISOString() : null,
      })),
      nextCursor,
    },
    { requestId },
  );
}

