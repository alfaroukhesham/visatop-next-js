import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  serviceId: z.string().min(1),
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
});

function eligibilityEntityId(serviceId: string, nationalityCode: string) {
  return `${serviceId}:${nationalityCode}`;
}

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, bodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      const inserted = await tx
        .insert(schema.visaServiceEligibility)
        .values({
          serviceId: parsed.data.serviceId,
          nationalityCode: parsed.data.nationalityCode,
        })
        .onConflictDoNothing()
        .returning();
      const row = inserted[0];
      if (!row) {
        return jsonOk({ eligibility: null, deduped: true }, { status: 200, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.eligibility.create",
        entityType: "visa_service_eligibility",
        entityId: eligibilityEntityId(row.serviceId, row.nationalityCode),
        afterJson: JSON.stringify({
          serviceId: row.serviceId,
          nationalityCode: row.nationalityCode,
        }),
      });
      return jsonOk({ eligibility: row }, { status: 201, requestId });
    },
  );
}

export async function DELETE(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, bodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      const eid = eligibilityEntityId(parsed.data.serviceId, parsed.data.nationalityCode);
      const deleted = await tx
        .delete(schema.visaServiceEligibility)
        .where(
          and(
            eq(schema.visaServiceEligibility.serviceId, parsed.data.serviceId),
            eq(schema.visaServiceEligibility.nationalityCode, parsed.data.nationalityCode),
          ),
        )
        .returning();
      if (!deleted.length) {
        return jsonError("NOT_FOUND", "Eligibility row not found", { status: 404, requestId });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.eligibility.delete",
        entityType: "visa_service_eligibility",
        entityId: eid,
        beforeJson: JSON.stringify({
          serviceId: deleted[0].serviceId,
          nationalityCode: deleted[0].nationalityCode,
        }),
      });
      return jsonOk({ deleted: deleted[0] }, { requestId });
    },
  );
}
