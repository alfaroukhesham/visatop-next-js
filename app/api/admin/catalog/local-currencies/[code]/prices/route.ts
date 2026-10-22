import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import { applyLocalCurrencyPriceUiUpdates } from "@/lib/admin/catalog/apply-local-currency-price-updates";
import {
  listAdminLocalCurrencies,
  listAdminLocalCurrencyPrices,
  LocalCurrencyAdminError,
} from "@/lib/admin/catalog/local-currency-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALPHA2 = /^[A-Z]{2}$/;

const putBody = z.object({
  nationalityCode: z
    .string()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((s) => s.toUpperCase()),
  updates: z
    .array(
      z.object({
        serviceId: z.string().min(1),
        amountMajor: z.string(),
      }),
    )
    .min(1),
});

const loadLocalCurrency = async (tx: Parameters<typeof listAdminLocalCurrencies>[0], code: string) => {
  const list = await listAdminLocalCurrencies(tx);
  return list.find((c) => c.code === code.trim().toUpperCase()) ?? null;
};

export const GET = async (
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const nationality = url.searchParams.get("nationality")?.trim().toUpperCase() ?? "";
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const currency = await loadLocalCurrency(tx, code);
    if (!currency) {
      return jsonError("NOT_FOUND", "Local currency not found.", { status: 404, requestId });
    }
    const nationalityCode = ALPHA2.test(nationality)
      ? nationality
      : (currency.nationalityCodes[0] ?? "");
    if (!nationalityCode || !currency.nationalityCodes.includes(nationalityCode)) {
      return jsonError("VALIDATION_ERROR", "Choose a nationality linked to this local currency.", {
        status: 400,
        requestId,
      });
    }
    const rows = await listAdminLocalCurrencyPrices(tx, currency.code, nationalityCode);
    return jsonOk({ currency: currency.code, nationalityCode, rows }, { requestId });
  });
};

export const PUT = async (
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
      const parsed = await parseJsonBody(req, putBody, requestId);
      if (!parsed.ok) return parsed.response;
      const currency = await loadLocalCurrency(tx, code);
      if (!currency) {
        return jsonError("NOT_FOUND", "Local currency not found.", { status: 404, requestId });
      }
      if (!currency.nationalityCodes.includes(parsed.data.nationalityCode)) {
        return jsonError("VALIDATION_ERROR", "Choose a nationality linked to this local currency.", {
          status: 400,
          requestId,
        });
      }
      try {
        const result = await applyLocalCurrencyPriceUiUpdates(tx, {
          nationalityCode: parsed.data.nationalityCode,
          currency: currency.code,
          updates: parsed.data.updates,
        });
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.local_currency.prices.update",
          entityType: "catalog_customer_price",
          entityId: `${parsed.data.nationalityCode}:${currency.code}`,
          afterJson: JSON.stringify({
            currency: currency.code,
            nationalityCode: parsed.data.nationalityCode,
            updated: result.updated,
            skipped: result.skipped,
          }),
        });
        const rows = await listAdminLocalCurrencyPrices(tx, currency.code, parsed.data.nationalityCode);
        return jsonOk(
          {
            currency: currency.code,
            nationalityCode: parsed.data.nationalityCode,
            result,
            rows,
          },
          { requestId },
        );
      } catch (e) {
        if (e instanceof LocalCurrencyAdminError) {
          return jsonError("VALIDATION_ERROR", e.message, { status: 400, requestId });
        }
        throw e;
      }
    },
  );
};
