import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  CheckoutExtraAdminError,
  saveCheckoutExtra,
} from "@/lib/checkout-extras/checkout-extra-admin";
import {
  checkoutExtraWriteBodySchema,
  isCheckoutExtraKey,
  prepareCheckoutExtraWrite,
} from "@/lib/checkout-extras/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { key } = await ctx.params;

  return runAdminDbJson(
    requestId,
    ["catalog.read", "catalog.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      if (!isCheckoutExtraKey(key)) {
        return jsonError("NOT_FOUND", "Checkout extra was not found.", { status: 404, requestId });
      }
      const parsed = await parseJsonBody(req, checkoutExtraWriteBodySchema, requestId);
      if (!parsed.ok) return parsed.response;

      const prepared = prepareCheckoutExtraWrite(key, parsed.data);
      if (!prepared.ok) {
        return jsonError("VALIDATION_ERROR", prepared.message, { status: 400, requestId });
      }

      try {
        const saved = await saveCheckoutExtra(tx, key, prepared.value);
        await writeAdminAudit(tx, {
          adminUserId,
          action: "catalog.checkout_extra.update",
          entityType: "checkout_extra",
          entityId: key,
          beforeJson: JSON.stringify(saved.before),
          afterJson: JSON.stringify(saved.after),
        });
        return jsonOk({ extra: saved.after }, { requestId });
      } catch (error) {
        if (error instanceof CheckoutExtraAdminError) {
          return jsonError("NOT_FOUND", error.message, { status: 404, requestId });
        }
        throw error;
      }
    },
  );
};
