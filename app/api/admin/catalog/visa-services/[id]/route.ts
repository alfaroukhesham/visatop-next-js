import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { ENTRY_KINDS, STAY_BUCKETS, TRAVELER_KINDS } from "@/lib/catalog/guided-choice";
import {
  CatalogDeleteBlockedError,
  CatalogEntityNotFoundError,
  deleteCatalogVisaService,
} from "@/lib/admin/catalog/delete-catalog-entity";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z
  .object({
    name: z.string().min(1).max(256).optional(),
    enabled: z.boolean().optional(),
    durationDays: z.number().int().positive().nullable().optional(),
    entries: z.string().max(64).nullable().optional(),
    stayBucket: z.enum(STAY_BUCKETS).nullable().optional(),
    entryKind: z.enum(ENTRY_KINDS).optional(),
    travelerKind: z.enum(TRAVELER_KINDS).optional(),
    showInGuidedChooser: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.enabled !== undefined ||
      v.durationDays !== undefined ||
      v.entries !== undefined ||
      v.stayBucket !== undefined ||
      v.entryKind !== undefined ||
      v.travelerKind !== undefined ||
      v.showInGuidedChooser !== undefined,
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
          ...(parsed.data.stayBucket !== undefined ? { stayBucket: parsed.data.stayBucket } : {}),
          ...(parsed.data.entryKind !== undefined ? { entryKind: parsed.data.entryKind } : {}),
          ...(parsed.data.travelerKind !== undefined
            ? { travelerKind: parsed.data.travelerKind }
            : {}),
          ...(parsed.data.showInGuidedChooser !== undefined
            ? { showInGuidedChooser: parsed.data.showInGuidedChooser }
            : {}),
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
          stayBucket: row.stayBucket,
          entryKind: row.entryKind,
          travelerKind: row.travelerKind,
          showInGuidedChooser: row.showInGuidedChooser,
        }),
      });
      return jsonOk({ service: row }, { requestId });
    },
  );
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      try {
        const row = await deleteCatalogVisaService(tx, id);
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.visa_service.delete",
          entityType: "visa_service",
          entityId: row.id,
          beforeJson: JSON.stringify({ id: row.id, name: row.name, enabled: row.enabled }),
        });
        return jsonOk({ deleted: { id: row.id } }, { requestId });
      } catch (e) {
        if (e instanceof CatalogEntityNotFoundError) {
          return jsonError("NOT_FOUND", e.message, { status: 404, requestId });
        }
        if (e instanceof CatalogDeleteBlockedError) {
          return jsonError("CONFLICT", e.message, { status: 409, requestId });
        }
        throw e;
      }
    },
  );
}
