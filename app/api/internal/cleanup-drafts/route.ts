import { headers } from "next/headers";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";
import {
  APPLICATION_STATUS,
  PAYMENT_STATUS,
} from "@/lib/applications/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const expected = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!expected) {
    return jsonError("INTERNAL_ERROR", "INTERNAL_CRON_SECRET is not configured.", {
      status: 500,
      requestId,
    });
  }
  const secret = request.headers.get("x-internal-secret")?.trim();
  if (secret !== expected) {
    return jsonError("UNAUTHORIZED", "Invalid internal secret.", {
      status: 401,
      requestId,
    });
  }

  const deleted = await withSystemDbActor(async (tx) => {
    return tx
      .delete(application)
      .where(
        and(
          eq(application.paymentStatus, PAYMENT_STATUS.UNPAID),
          eq(application.applicationStatus, APPLICATION_STATUS.DRAFT),
          isNotNull(application.draftExpiresAt),
          lt(application.draftExpiresAt, sql`now()`),
        ),
      )
      .returning({ id: application.id });
  });

  return jsonOk({ deletedCount: deleted.length, ids: deleted.map((r) => r.id) }, { requestId });
}
