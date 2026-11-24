import { headers } from "next/headers";
import { jsonOk } from "@/lib/api/response";
import { loadCheckoutExtraCatalog } from "@/lib/checkout-extras/party-checkout-quote";
import { getTravelDateSettingsFromTx } from "@/lib/checkout-extras/travel-date-settings";
import { travelWindowPayload } from "@/lib/checkout-extras/travel-window";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** UAE today and the latest arrival date /apply/start may offer. No client clock. */
export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const data = await withSystemDbActor(async (tx) => {
    const settings = await getTravelDateSettingsFromTx(tx);
    const catalog = await loadCheckoutExtraCatalog(tx);
    return travelWindowPayload({
      now: new Date(),
      maxDaysAhead: settings.travelDateMaxDaysAhead,
      settingRequired: settings.travelDateRequired,
      fastTrackThresholdDays: settings.fastTrackThresholdDays,
      catalog,
    });
  });
  return jsonOk(data, { requestId });
}
