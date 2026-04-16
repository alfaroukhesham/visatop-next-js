import { headers } from "next/headers";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postBody = z.object({
  name: z.string().min(1).max(256),
  enabled: z.boolean().optional(),
  durationDays: z.number().int().positive().nullable().optional(),
  entries: z.string().max(64).nullable().optional(),
});

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const rows = await tx
      .select()
      .from(schema.visaService)
      .orderBy(desc(schema.visaService.createdAt));
    return jsonOk({ services: rows }, { requestId });
  });
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, postBody, requestId);
      if (!parsed.ok) return parsed.response;

      const inserted = await tx
        .insert(schema.visaService)
        .values({
          name: parsed.data.name,
          enabled: parsed.data.enabled ?? true,
          durationDays: parsed.data.durationDays ?? null,
          entries: parsed.data.entries ?? null,
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Insert failed", { status: 500, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.visa_service.create",
        entityType: "visa_service",
        entityId: row.id,
        afterJson: JSON.stringify({
          id: row.id,
          name: row.name,
          enabled: row.enabled,
        }),
      });
      return jsonOk({ service: row }, { status: 201, requestId });
    },
  );
}
