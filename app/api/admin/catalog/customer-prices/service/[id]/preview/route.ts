import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import {
  listServicePricing,
  previewServicePricing,
} from "@/lib/admin/catalog/list-service-pricing";
import { jsonError, jsonOk } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id: serviceId } = await ctx.params;
  const url = new URL(req.url);
  const aedMajor = url.searchParams.get("aedMajor") ?? undefined;
  const usdMajor = url.searchParams.get("usdMajor") ?? undefined;

  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const existing = await listServicePricing(tx, serviceId);
    if (!existing) {
      return jsonError("NOT_FOUND", "Service not found", {
        status: 404,
        requestId,
      });
    }

    const preview = await previewServicePricing(tx, serviceId, {
      aedMajor,
      usdMajor,
    });

    return jsonOk(preview, { requestId });
  });
}
