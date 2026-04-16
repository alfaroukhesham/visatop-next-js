import { headers } from "next/headers";
import type { DbTransaction } from "@/lib/db";
import { adminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api/response";
import { isForeignKeyViolation } from "@/lib/db/pg-errors";
import { withAdminDbActor } from "@/lib/db/actor-context";

export type AdminDbTx = DbTransaction;

/**
 * One Neon transaction: admin session, permissions resolved once inside
 * `withAdminDbActor` (same tx as GUCs + handler). Maps FK violations to 400.
 */
export async function runAdminDbJson(
  requestId: string | null,
  requiredPermissions: string[],
  fn: (ctx: { tx: AdminDbTx; adminUserId: string }) => Promise<Response>,
): Promise<Response> {
  const hdrs = await headers();
  const session = await adminAuth.api.getSession({ headers: hdrs });
  if (!session) {
    return jsonError("UNAUTHORIZED", "Unauthorized", {
      status: 401,
      requestId,
    });
  }

  return withAdminDbActor(session.user.id, async ({ tx, permissions }) => {
    for (const key of requiredPermissions) {
      if (!permissions.includes(key)) {
        return jsonError(
          "FORBIDDEN",
          `Missing required permission: ${key}`,
          {
            status: 403,
            requestId,
            details: { missing: key },
          },
        );
      }
    }
    try {
      return await fn({
        tx,
        adminUserId: session.user.id,
      });
    } catch (e) {
      if (isForeignKeyViolation(e)) {
        return jsonError("VALIDATION_ERROR", "Referenced record does not exist.", {
          status: 400,
          requestId,
        });
      }
      throw e;
    }
  });
}
