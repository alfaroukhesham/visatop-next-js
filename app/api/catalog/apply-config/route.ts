import { headers } from "next/headers";
import { getApplyConfigFromTx } from "@/lib/apply/apply-config";
import { jsonOk } from "@/lib/api/response";
import { withSystemDbActor } from "@/lib/db/actor-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const config = await withSystemDbActor(async (tx) => getApplyConfigFromTx(tx));
  return jsonOk(
    {
      partyEnabled: config.partyEnabled,
      partyMaxTravelers: config.partyMaxTravelers,
      badges: config.badges,
    },
    { requestId },
  );
}
