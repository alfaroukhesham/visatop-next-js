import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";
import {
  listUnsentPaidCapiPurchaseIds,
  sendMetaCapiPurchase,
} from "@/lib/payments/meta-capi";
import { createRequestLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const expected = process.env.INTERNAL_CRON_SECRET?.trim();
  if (!expected) {
    return jsonError("INTERNAL_ERROR", "INTERNAL_CRON_SECRET is not configured.", {
      status: 500,
      requestId,
    });
  }
  const secret = request.headers.get("x-internal-secret")?.trim();
  if (secret !== expected) {
    return jsonError("UNAUTHORIZED", "Invalid internal secret.", {
      status: 401,
      requestId,
    });
  }

  const applicationIds = await withSystemDbActor((tx) => listUnsentPaidCapiPurchaseIds(tx));
  const log = createRequestLogger(requestId);
  let sent = 0;
  let skipped = 0;
  for (const applicationId of applicationIds) {
    const result = await sendMetaCapiPurchase(applicationId, requestId);
    if (result.ok) sent += 1;
    else skipped += 1;
    if (!result.ok && result.reason === "graph_error") {
      log.warn({ applicationId, reason: result.reason }, "[meta-capi] retry Purchase not sent");
    }
  }

  return jsonOk(
    {
      checked: applicationIds.length,
      sent,
      skipped,
    },
    { requestId },
  );
};
