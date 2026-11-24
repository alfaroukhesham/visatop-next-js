import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { previewPartyQuote } from "@/lib/checkout-extras/party-checkout-quote";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { FxRateInvalidError, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;
  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });

  try {
    const result = await withSystemDbActor((tx) => previewPartyQuote(tx, id));
    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 400;
      return jsonError(status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", result.message, {
        status,
        requestId,
        details: { reason: result.reason },
      });
    }
    return jsonOk(result.preview, { requestId });
  } catch (error) {
    if (error instanceof FxRateMissingError) {
      return jsonError("SERVICE_UNAVAILABLE", error.message, { status: 503, requestId });
    }
    if (error instanceof FxRateInvalidError) {
      return jsonError("INTERNAL_ERROR", error.message, { status: 500, requestId });
    }
    throw error;
  }
}
