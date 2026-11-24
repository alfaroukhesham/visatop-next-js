import { headers } from "next/headers";
import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadApplicationRowForRequest } from "@/lib/applications/load-application-row-for-request";
import { savePartyTrip } from "@/lib/checkout-extras/party-checkout-quote";
import { withSystemDbActor } from "@/lib/db/actor-context";
import { FxRateInvalidError, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    travelDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
    processingSpeed: z.enum(["standard", "fast_track"]).optional(),
    travelInsurance: z.boolean().optional(),
  })
  .refine(
    (body) =>
      body.travelDate !== undefined ||
      body.processingSpeed !== undefined ||
      body.travelInsurance !== undefined,
    { message: "Nothing to update." },
  );

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const [{ id }, parsed] = await Promise.all([ctx.params, parseJsonBody(req, bodySchema, requestId)]);
  if (!parsed.ok) return parsed.response;

  const row = await loadApplicationRowForRequest(id, hdrs.get("cookie"));
  if (!row) return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });

  try {
    const saved = await withSystemDbActor((tx) => savePartyTrip(tx, id, parsed.data));
    if (!saved.ok) {
      return jsonError(saved.code, saved.message, {
        status: saved.status,
        requestId,
        details: { reason: saved.reason },
      });
    }
    return jsonOk(saved.preview, { requestId });
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
