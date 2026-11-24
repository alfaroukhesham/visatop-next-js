import { headers } from "next/headers";
import { jsonOk } from "@/lib/api/response";
import { travelDateWindow } from "@/lib/checkout-extras/dubai-calendar";
import { getTravelDateSettingsFromTx } from "@/lib/checkout-extras/travel-date-settings";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** UAE today and the latest arrival date /apply/start may offer. No client clock. */
export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const data = await withSystemDbActor(async (tx) => {
    const settings = await getTravelDateSettingsFromTx(tx);
    const window = travelDateWindow(new Date(), settings.travelDateMaxDaysAhead);
    return {
      todayUae: window.todayUae,
      maxTravelDate: window.maxTravelDate,
      travelDateRequired: settings.travelDateRequired,
      fastTrackThresholdDays: settings.fastTrackThresholdDays,
    };
  });
  return jsonOk(data, { requestId });
}
