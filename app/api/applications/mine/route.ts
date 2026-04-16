import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { withClientDbActor } from "@/lib/db/actor-context";
import { application } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  const requestId = hdrs.get("x-request-id");

  if (!session) {
    return jsonError("UNAUTHORIZED", "Unauthorized", {
      status: 401,
      requestId,
    });
  }

  const userId = session.user.id;

  const applications = await withClientDbActor(userId, async (tx) => {
    const rows = await tx
      .select({
        id: application.id,
        referenceNumber: application.referenceNumber,
        applicationStatus: application.applicationStatus,
        paymentStatus: application.paymentStatus,
        fulfillmentStatus: application.fulfillmentStatus,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
      })
      .from(application)
      .where(eq(application.userId, userId))
      .orderBy(desc(application.createdAt))
      .limit(50);
    return rows;
  });

  return jsonOk({ applications }, { requestId });
}

