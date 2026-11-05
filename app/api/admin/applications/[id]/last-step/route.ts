import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonError, jsonOk } from "@/lib/api/response";
import { loadApplicationLastStepView } from "@/lib/applications/load-application-last-step";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only last-step snapshot for the admin details poll. No writes. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const { id } = await ctx.params;

  return runAdminDbJson(requestId, ["applications.read"], async ({ tx }) => {
    const lastStep = await loadApplicationLastStepView(tx, id);
    if (!lastStep) {
      return jsonError("NOT_FOUND", "Application not found", { status: 404, requestId });
    }
    return jsonOk(lastStep, {
      requestId,
      headers: { "Cache-Control": "private, no-store" },
    });
  });
}
