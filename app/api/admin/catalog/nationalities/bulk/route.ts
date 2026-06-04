import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import { normalizeCountryName } from "@/lib/admin/catalog/parse-price-sheet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  code: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Nationality code must be two letters")
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1).max(256),
});

const postBody = z.object({
  items: z.array(itemSchema).min(1).max(200),
});

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, postBody, requestId);
      if (!parsed.ok) return parsed.response;

      const { items } = parsed.data;

      const seenCodes = new Set<string>();
      const seenNormNames = new Set<string>();
      for (const it of items) {
        if (seenCodes.has(it.code)) {
          return jsonError(
            "VALIDATION_ERROR",
            `Duplicate ISO code in request: ${it.code}`,
            { status: 400, requestId, details: { code: it.code } },
          );
        }
        seenCodes.add(it.code);
        const nk = normalizeCountryName(it.name);
        if (seenNormNames.has(nk)) {
          return jsonError(
            "VALIDATION_ERROR",
            `Duplicate display name (after normalisation) in request: "${it.name}"`,
            { status: 400, requestId },
          );
        }
        seenNormNames.add(nk);
      }

      const existingRows = await tx
        .select({ code: schema.nationality.code, name: schema.nationality.name })
        .from(schema.nationality);

      const normToExistingCode = new Map<string, string>();
      for (const r of existingRows) {
        normToExistingCode.set(normalizeCountryName(r.name), r.code);
      }

      for (const it of items) {
        const nk = normalizeCountryName(it.name);
        const other = normToExistingCode.get(nk);
        if (other !== undefined && other !== it.code) {
          return jsonError(
            "VALIDATION_ERROR",
            `Display name "${it.name}" already exists for nationality ${other}. Use that code or pick a distinct name.`,
            {
              status: 400,
              requestId,
              details: { conflictingCode: other, requestedCode: it.code, name: it.name },
            },
          );
        }
      }

      const upserted = await Promise.all(
        items.map(async (it) => {
          const inserted = await tx
            .insert(schema.nationality)
            .values({
              code: it.code,
              name: it.name,
              enabled: true,
            })
            .onConflictDoUpdate({
              target: schema.nationality.code,
              set: { name: it.name, enabled: true },
            })
            .returning();
          const row = inserted[0];
          if (!row) {
            throw new Error("Upsert failed");
          }
          normToExistingCode.set(normalizeCountryName(it.name), it.code);
          return row;
        }),
      ).catch(() => null);
      if (!upserted) {
        return jsonError("INTERNAL_ERROR", "Upsert failed", { status: 500, requestId });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.nationality.bulk_upsert",
        entityType: "nationality",
        entityId: "bulk",
        afterJson: JSON.stringify({
          count: upserted.length,
          codes: upserted.map((r) => r.code),
        }),
      });

      return jsonOk({ nationalities: upserted }, { status: 201, requestId });
    },
  );
}
