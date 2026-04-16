import { headers } from "next/headers";
import { adminAuth } from "@/lib/admin-auth";
import { withAdminDbActor } from "@/lib/db/actor-context";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  const requestId = hdrs.get("x-request-id");

  if (!session) {
    return jsonError("UNAUTHORIZED", "Unauthorized", {
      status: 401,
      requestId,
    });
  }

  const adminUserId = session.user.id;

  const permissions = await withAdminDbActor(adminUserId, async ({ permissions: p }) => p);

  return jsonOk({ adminUserId, permissions }, { requestId });
}
