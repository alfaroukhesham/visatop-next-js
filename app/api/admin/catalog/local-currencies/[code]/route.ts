import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  deleteAdminLocalCurrency,
  LocalCurrencyAdminError,
  updateAdminLocalCurrency,
} from "@/lib/admin/catalog/local-currency-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchBody = z
  .object({
    nationalityCodes: z.array(z.string().length(2).regex(/^[A-Za-z]{2}$/)).min(1).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.nationalityCodes !== undefined || v.enabled !== undefined, {
    message: "At least one field is required",
  });

const mapAdminError = (e: LocalCurrencyAdminError, requestId: string | null) => {
  const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
  return jsonError(
    e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR",
    e.message,
    { status, requestId },
  );
};

export const PATCH = async (
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code } = await ctx.params;
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, patchBody, requestId);
      if (!parsed.ok) return parsed.response;
      try {
        const currency = await updateAdminLocalCurrency(tx, code, parsed.data);
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.local_currency.update",
          entityType: "catalog_currency",
          entityId: currency.code,
          afterJson: JSON.stringify({
            code: currency.code,
            enabled: currency.enabled,
            nationalityCodes: currency.nationalityCodes,
          }),
        });
        return jsonOk({ localCurrency: currency }, { requestId });
      } catch (e) {
        if (e instanceof LocalCurrencyAdminError) return mapAdminError(e, requestId);
        throw e;
      }
    },
  );
};

export const DELETE = async (
  _req: Request,
  ctx: { params: Promise<{ code: string }> },
) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code } = await ctx.params;
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      try {
        const deleted = await deleteAdminLocalCurrency(tx, code);
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.local_currency.delete",
          entityType: "catalog_currency",
          entityId: deleted.code,
          beforeJson: JSON.stringify({ code: deleted.code }),
        });
        return jsonOk({ deleted }, { requestId });
      } catch (e) {
        if (e instanceof LocalCurrencyAdminError) return mapAdminError(e, requestId);
        throw e;
      }
    },
  );
};
