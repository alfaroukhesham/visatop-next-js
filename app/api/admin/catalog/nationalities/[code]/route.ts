import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const patchBody = z
  .object({
    name: z.string().min(1).max(256).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.enabled !== undefined, {
    message: "At least one field is required",
  });

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code } = await ctx.params;
  const codeUpper = code.trim().toUpperCase();

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, patchBody, requestId);
      if (!parsed.ok) return parsed.response;

      const updated = await tx
        .update(schema.nationality)
        .set({
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        })
        .where(eq(schema.nationality.code, codeUpper))
        .returning();
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Nationality not found", { status: 404, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.nationality.update",
        entityType: "nationality",
        entityId: row.code,
        afterJson: JSON.stringify({
          code: row.code,
          name: row.name,
          enabled: row.enabled,
        }),
      });
      return jsonOk({ nationality: row }, { requestId });
    },
  );
}
