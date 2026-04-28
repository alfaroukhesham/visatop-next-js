import { headers } from "next/headers";

import { and, desc, eq, isNull, lt, or, sql, inArray } from "drizzle-orm";

import { decodeCursor, encodeCursor, parseLimit } from "@/lib/api/cursor";
import { jsonError, jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema/applications";
import { computeClientApplicationTracking } from "@/lib/applications/user-facing-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRAFT_LIKE_APPLICATION_STATUSES = [
  "draft",
  "needs_docs",
  "extracting",
  "needs_review",
  "ready_for_payment",
] as const;

function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return e && e.includes("@") ? e : null;
}

/**
 * Signed-in tracking list:
 * - Includes rows linked to the userId
 * - Also includes legacy guest rows whose guest_email matches the signed-in email
 * - Excludes unpaid drafts (handled on /portal/drafts)
 *
 * Runs under system DB actor to allow reading guest rows; access is enforced by session email.
 */
export async function GET(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  const session = await auth.api.getSession({ headers: hdrs });
  if (!session) return jsonError("UNAUTHORIZED", "Unauthorized", { status: 401, requestId });

  type SessionUserShape = { email?: string | null };
  const user = session.user as unknown as SessionUserShape;
  const email = normalizeEmail(user.email);
  if (!email) {
    return jsonError("VALIDATION_ERROR", "Account email is required to track applications.", {
      status: 400,
      requestId,
    });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"), { defaultLimit: 5, max: 50 });
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  const rows = await withSystemDbActor(async (tx) => {
    const ownedOrEmailMatch = or(
      eq(application.userId, session.user.id),
      and(
        isNull(application.userId),
        sql`lower(trim(coalesce(${application.guestEmail}, ''))) = ${email}`,
      ),
    );

    const excludeUnpaidDrafts = and(
      eq(application.paymentStatus, "unpaid"),
      inArray(application.applicationStatus, [...DRAFT_LIKE_APPLICATION_STATUSES]),
    );

    const cursorWhere = cursor
      ? or(
          lt(application.createdAt, new Date(cursor.createdAt)),
          and(eq(application.createdAt, new Date(cursor.createdAt)), lt(application.id, cursor.id)),
        )
      : undefined;

    const where = and(ownedOrEmailMatch, sql`NOT (${excludeUnpaidDrafts})`);

    return tx
      .select({
        id: application.id,
        referenceNumber: application.referenceNumber,
        createdAt: application.createdAt,
        nationalityCode: application.nationalityCode,
        serviceId: application.serviceId,
        applicationStatus: application.applicationStatus,
        paymentStatus: application.paymentStatus,
        fulfillmentStatus: application.fulfillmentStatus,
        adminAttentionRequired: application.adminAttentionRequired,
      })
      .from(application)
      .where(cursorWhere ? and(where, cursorWhere) : where)
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
        applicationId: r.id,
        referenceDisplay: r.referenceNumber ?? r.id.slice(0, 8),
        nationalityCode: r.nationalityCode,
        serviceId: r.serviceId,
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

