import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { jsonOk } from "@/lib/api/response";
import { listCheckoutExtras } from "@/lib/checkout-extras/checkout-extra-admin";
import { peekResolvedFxRateFromTx } from "@/lib/pricing/fx-usd-aed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["catalog.read"], async ({ tx }) => {
    const [extras, fx] = await Promise.all([listCheckoutExtras(tx), peekResolvedFxRateFromTx(tx)]);
    return jsonOk({ extras, fxAedPerUsd: fx.fxAedPerUsd }, { requestId });
  });
};
