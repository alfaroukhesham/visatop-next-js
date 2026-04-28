import { headers } from "next/headers";

import { and, desc, eq, lt, or } from "drizzle-orm";

import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";
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

  const rows = await withClientDbActor(session.user.id, async (tx) => {
    const baseWhere = eq(application.userId, session.user.id);
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
        createdAt: application.createdAt,
        applicationStatus: application.applicationStatus,
        paymentStatus: application.paymentStatus,
        fulfillmentStatus: application.fulfillmentStatus,
        adminAttentionRequired: application.adminAttentionRequired,
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
        createdAt: r.createdAt.toISOString(),
        clientTracking: computeClientApplicationTracking({
          applicationStatus: r.applicationStatus,
          paymentStatus: r.paymentStatus,
          fulfillmentStatus: r.fulfillmentStatus,
          adminAttentionRequired: r.adminAttentionRequired,
        }),
      })),
      nextCursor,
    },
    { requestId },
  );
}

