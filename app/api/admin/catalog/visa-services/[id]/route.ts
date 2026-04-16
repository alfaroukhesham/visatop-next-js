import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z
  .object({
    name: z.string().min(1).max(256).optional(),
    enabled: z.boolean().optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    entries: z.string().max(64).nullable().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.enabled !== undefined ||
      v.durationDays !== undefined ||
      v.entries !== undefined,
    { message: "At least one field is required" },
  );

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, patchBody, requestId);
      if (!parsed.ok) return parsed.response;

      const updated = await tx
        .update(schema.visaService)
        .set({
          ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
          ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
          ...(parsed.data.durationDays !== undefined
            ? { durationDays: parsed.data.durationDays }
            : {}),
          ...(parsed.data.entries !== undefined ? { entries: parsed.data.entries } : {}),
        })
        .where(eq(schema.visaService.id, id))
        .returning();
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Service not found", { status: 404, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.visa_service.update",
        entityType: "visa_service",
        entityId: row.id,
        afterJson: JSON.stringify({
          id: row.id,
          name: row.name,
          enabled: row.enabled,
          durationDays: row.durationDays,
          entries: row.entries,
        }),
      });
      return jsonOk({ service: row }, { requestId });
    },
  );
}
