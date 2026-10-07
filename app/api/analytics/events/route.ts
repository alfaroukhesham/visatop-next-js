import { headers } from "next/headers";
import { jsonError, jsonOk } from "@/lib/api/response";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { withAnalyticsBeaconDbActor } from "@/lib/db/actor-context";
import { consumeBeaconRateLimit } from "@/lib/analytics/beacon-rate-limit";
import { parseBeaconPayload } from "@/lib/analytics/funnel-event-names";
import { recordFunnelEvent } from "@/lib/analytics/record-funnel-event";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.unknown();

const clientIp = (hdrs: Headers): string => {
  const forwarded = hdrs.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim() || "unknown";
  return hdrs.get("x-real-ip")?.trim() || "unknown";
};

export async function POST(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const parsed = await parseJsonBody(req, bodySchema, requestId);
  if (!parsed.ok) return parsed.response;

  const payload = parseBeaconPayload(parsed.data);
  if (!payload.ok) {
    return jsonError("VALIDATION_ERROR", payload.message, { status: 400, requestId });
  }

  const limited = consumeBeaconRateLimit(clientIp(hdrs), payload.data.sessionId);
  if (!limited.ok) {
    return jsonError("RATE_LIMITED", "Too many analytics events.", {
      status: 429,
      requestId,
      details: { retryAfterMs: limited.retryAfterMs },
    });
  }

  try {
    await withAnalyticsBeaconDbActor(async (tx) => {
      await recordFunnelEvent(tx, {
        ...payload.data,
        source: "client",
      });
    });
  } catch {
    // Best-effort ingest: never crash (nginx 502). Duplicates are already swallowed
    // inside recordFunnelEvent; this covers actor/DB blips.
    return jsonOk({ accepted: false }, { requestId });
  }

  return jsonOk({ accepted: true }, { requestId });
}
