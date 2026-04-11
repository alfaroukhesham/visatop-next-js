import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const postBody = z.object({
  code: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(256),
  enabled: z.boolean().optional(),
});

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const rows = await tx.select().from(schema.nationality).orderBy(schema.nationality.name);
    return jsonOk({ nationalities: rows }, { requestId });
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
        .insert(schema.nationality)
        .values({
          code: parsed.data.code,
          name: parsed.data.name,
          enabled: parsed.data.enabled ?? true,
        })
        .onConflictDoUpdate({
          target: schema.nationality.code,
          set: { name: parsed.data.name, enabled: parsed.data.enabled ?? true },
        })
        .returning();
      const row = inserted[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "Upsert failed", { status: 500, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.nationality.upsert",
        entityType: "nationality",
        entityId: row.code,
        afterJson: JSON.stringify({
          code: row.code,
          name: row.name,
          enabled: row.enabled,
        }),
      });
      return jsonOk({ nationality: row }, { status: 201, requestId });
    },
  );
}
