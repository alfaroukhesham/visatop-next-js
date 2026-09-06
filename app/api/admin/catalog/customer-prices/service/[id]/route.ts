import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  applyServicePriceUiUpdates,
  FX_SETTINGS_HREF,
  ServicePriceFxMissingError,
  ServicePriceValidationError,
} from "@/lib/admin/catalog/apply-service-price-ui-updates";
import { listServicePricing } from "@/lib/admin/catalog/list-service-pricing";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: serviceId } = await ctx.params;

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const data = await listServicePricing(tx, serviceId);
    if (!data) {
      return jsonError("NOT_FOUND", "Service not found", {
        status: 404,
        requestId,
      });
    }
    return jsonOk(data, { requestId });
  });
}

const priceGroupSchema = z.object({
  aedMajor: z.string().optional(),
  usdMajor: z.string().optional(),
  nationalityCodes: z.array(z.string().min(1)).max(300),
});

const putBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("all"),
    aedMajor: z.string().optional(),
    usdMajor: z.string().optional(),
  }),
  z.object({
    mode: z.literal("groups"),
    groups: z.array(priceGroupSchema).max(50),
  }),
]);

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: serviceId } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, putBodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      const existing = await listServicePricing(tx, serviceId);
      if (!existing) {
        return jsonError("NOT_FOUND", "Service not found", {
          status: 404,
          requestId,
        });
      }

      let result;
      try {
        result = await applyServicePriceUiUpdates(tx, {
          ...parsed.data,
          serviceId,
        });
      } catch (e) {
        if (e instanceof ServicePriceFxMissingError) {
          return jsonError("VALIDATION_ERROR", e.message, {
            status: 400,
            requestId,
            details: { settingsHref: FX_SETTINGS_HREF },
          });
        }
        if (e instanceof ServicePriceValidationError) {
          return jsonError("VALIDATION_ERROR", e.message, {
            status: 400,
            requestId,
          });
        }
        const message = e instanceof Error ? e.message : "Price update failed";
        return jsonError("VALIDATION_ERROR", message, {
          status: 400,
          requestId,
        });
      }

      if (parsed.data.mode === "all") {
        const hasAmount =
          (parsed.data.aedMajor?.trim() ?? "") !== "" ||
          (parsed.data.usdMajor?.trim() ?? "") !== "";
        if (!hasAmount || result.updated === 0) {
          return jsonError("VALIDATION_ERROR", "No valid price updates to apply", {
            status: 400,
            requestId,
          });
        }
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "catalog.customer_price.apply",
        entityType: "visa_service",
        entityId: serviceId,
        afterJson: JSON.stringify({
          mode: result.mode,
          updated: result.updated,
          removed: result.removed,
          eligibilityAdded: result.eligibilityAdded,
          eligibilityRemoved: result.eligibilityRemoved,
        }),
      });

      return jsonOk({ serviceId, ...result }, { requestId });
    },
  );
}
