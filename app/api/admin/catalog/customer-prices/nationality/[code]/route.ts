import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import * as schema from "@/lib/db/schema";

import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { applyNationalityPriceUiUpdates } from "@/lib/admin/catalog/apply-nationality-price-ui-updates";
import { listNationalityPricingRows } from "@/lib/admin/catalog/list-nationality-pricing-rows";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNationalityCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  return code;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code: rawCode } = await ctx.params;
  const nationalityCode = parseNationalityCode(rawCode);
  if (!nationalityCode) {
    return jsonError("VALIDATION_ERROR", "Invalid nationality code", {
      status: 400,
      requestId,
    });
  }

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const natRows = await tx
      .select({ code: schema.nationality.code, name: schema.nationality.name })
      .from(schema.nationality)
      .where(eq(schema.nationality.code, nationalityCode))
      .limit(1);
    const nat = natRows[0];
    if (!nat) {
      return jsonError("NOT_FOUND", "Nationality not found", {
        status: 404,
        requestId,
      });
    }

    const rows = await listNationalityPricingRows(tx, nationalityCode);
    return jsonOk(
      {
        nationalityCode: nat.code,
        nationalityName: nat.name,
        services: rows,
      },
      { requestId },
    );
  });
}

const patchBody = z.object({
  currency: z.enum(["USD", "AED"]),
  updates: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        amountMajor: z.string(),
      }),
    )
    .min(1)
    .max(500),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code: rawCode } = await ctx.params;
  const nationalityCode = parseNationalityCode(rawCode);
  if (!nationalityCode) {
    return jsonError("VALIDATION_ERROR", "Invalid nationality code", {
      status: 400,
      requestId,
    });
  }

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, patchBody, requestId);
      if (!parsed.ok) return parsed.response;

      const natRows = await tx
        .select({ code: schema.nationality.code })
        .from(schema.nationality)
        .where(eq(schema.nationality.code, nationalityCode))
        .limit(1);
      if (!natRows[0]) {
        return jsonError("NOT_FOUND", "Nationality not found", {
          status: 404,
          requestId,
        });
      }

      let result;
      try {
        result = await applyNationalityPriceUiUpdates(tx, {
          nationalityCode,
          currency: parsed.data.currency,
          updates: parsed.data.updates,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Price update failed";
        return jsonError("VALIDATION_ERROR", message, {
          status: 400,
          requestId,
        });
      }

      if (result.updated === 0) {
        return jsonError("VALIDATION_ERROR", "No valid price updates to apply", {
          status: 400,
          requestId,
        });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.customer_price.nationality_ui_update",
        entityType: "nationality",
        entityId: nationalityCode,
        afterJson: JSON.stringify({
          currency: parsed.data.currency,
          ...result,
        }),
      });

      return jsonOk({ nationalityCode, ...result }, { requestId });
    },
  );
}
