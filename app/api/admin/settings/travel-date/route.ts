import { headers } from "next/headers";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { jsonError, jsonOk } from "@/lib/api/response";
import {
  getTravelDateSettingsFromTx,
  saveTravelDateSettings,
} from "@/lib/checkout-extras/travel-date-settings";
import {
  PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS,
  travelDateSettingsErrorMessage,
  travelDateSettingsWriteSchema,
} from "@/lib/checkout-extras/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = async () => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["settings.read"], async ({ tx }) => {
    const settings = await getTravelDateSettingsFromTx(tx);
    return jsonOk(settings, { requestId });
  });
};

export const PUT = async (req: Request) => {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("VALIDATION_ERROR", "Malformed JSON body", { status: 400, requestId });
  }
  return runAdminDbJson(
    requestId,
    ["settings.read", "settings.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = travelDateSettingsWriteSchema.safeParse(raw);
      if (!parsed.success) {
        return jsonError("VALIDATION_ERROR", travelDateSettingsErrorMessage(parsed.error), {
          status: 400,
          requestId,
        });
      }

      const saved = await saveTravelDateSettings(tx, parsed.data);
      await writeAdminAudit(tx, {
        adminUserId,
        action: "settings.travel_date.update",
        entityType: "platform_setting",
        entityId: PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS,
        beforeJson: JSON.stringify(saved.before),
        afterJson: JSON.stringify(saved.after),
      });
      return jsonOk(saved.after, { requestId });
    },
  );
};
