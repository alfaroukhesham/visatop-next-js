import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  createAdminLocalCurrency,
  listAdminLocalCurrencies,
  LocalCurrencyAdminError,
} from "@/lib/admin/catalog/local-currency-admin";
import { zIso4217Alpha3 } from "@/lib/validation/currency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const postBody = z.object({
  code: zIso4217Alpha3,
  nationalityCodes: z.array(z.string().length(2).regex(/^[A-Za-z]{2}$/)).min(1),
  enabled: z.boolean().optional(),
});

export const GET = async () => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const localCurrencies = await listAdminLocalCurrencies(tx);
    return jsonOk({ localCurrencies }, { requestId });
  });
};

export const POST = async (req: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, postBody, requestId);
      if (!parsed.ok) return parsed.response;
      try {
        const currency = await createAdminLocalCurrency(tx, {
          code: parsed.data.code,
          nationalityCodes: parsed.data.nationalityCodes,
          enabled: parsed.data.enabled,
        });
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.local_currency.create",
          entityType: "catalog_currency",
          entityId: currency.code,
          afterJson: JSON.stringify({
            code: currency.code,
            enabled: currency.enabled,
            nationalityCodes: currency.nationalityCodes,
          }),
        });
        return jsonOk({ localCurrency: currency }, { status: 201, requestId });
      } catch (e) {
        if (e instanceof LocalCurrencyAdminError) {
          const status = e.code === "NOT_FOUND" ? 404 : e.code === "CONFLICT" ? 409 : 400;
          return jsonError(
            e.code === "NOT_FOUND" ? "NOT_FOUND" : e.code === "CONFLICT" ? "CONFLICT" : "VALIDATION_ERROR",
            e.message,
            { status, requestId },
          );
        }
        throw e;
      }
    },
  );
};
