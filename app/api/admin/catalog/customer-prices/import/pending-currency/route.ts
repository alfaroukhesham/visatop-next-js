import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk, jsonError } from "@/lib/api/response";
import { assignPendingCurrency } from "@/lib/admin/catalog/apply-customer-price-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");

  return runAdminDbJson(requestId, ["catalog.write", "audit.write"], async ({ tx, adminUserId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError("VALIDATION_ERROR", "Invalid JSON body.", { status: 400, requestId });
    }

    if (!body || typeof body !== "object") {
      return jsonError("VALIDATION_ERROR", "Expected JSON object.", { status: 400, requestId });
    }

    const { currency, batchId, pendingIds } = body as Record<string, unknown>;

    if (currency !== "USD" && currency !== "AED") {
      return jsonError(
        "VALIDATION_ERROR",
        "Field 'currency' must be 'USD' or 'AED'.",
        { status: 400, requestId },
      );
    }

    if (!batchId && (!Array.isArray(pendingIds) || pendingIds.length === 0)) {
      return jsonError(
        "VALIDATION_ERROR",
        "Provide either 'batchId' (to assign currency to all pending rows of a batch) or 'pendingIds' array.",
        { status: 400, requestId },
      );
    }

    const result = await assignPendingCurrency(
      tx,
      {
        currency: currency as "USD" | "AED",
        batchId: typeof batchId === "string" ? batchId : undefined,
        pendingIds: Array.isArray(pendingIds)
          ? (pendingIds as string[])
          : undefined,
      },
      adminUserId,
    );

    return jsonOk(result, { requestId });
  });
}
