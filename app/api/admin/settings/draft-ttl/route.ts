import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import {
  DEFAULT_DRAFT_TTL_HOURS,
  getDraftTtlHoursFromTx,
  parseDraftTtlHoursFromStored,
  PLATFORM_KEY_DRAFT_TTL_HOURS,
} from "@/lib/applications/draft-ttl";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putBody = z.object({
  draftTtlHours: z.coerce.number().int().min(1).max(24 * 365),
});

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["settings.read"], async ({ tx }) => {
    const hours = await getDraftTtlHoursFromTx(tx);
    return jsonOk({ draftTtlHours: hours }, { requestId });
  });
}

export async function PUT(req: Request) {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(
    requestId,
    ["settings.read", "settings.write", "audit.write"],
    async ({ tx, adminUserId }) => {
      const parsed = await parseJsonBody(req, putBody, requestId);
      if (!parsed.ok) return parsed.response;

      const beforeRows = await tx
        .select({ value: schema.platformSetting.value })
        .from(schema.platformSetting)
        .where(eq(schema.platformSetting.key, PLATFORM_KEY_DRAFT_TTL_HOURS))
        .limit(1);
      const beforeVal = beforeRows[0]?.value ?? String(DEFAULT_DRAFT_TTL_HOURS);

      const updated = await tx
        .update(schema.platformSetting)
        .set({ value: String(parsed.data.draftTtlHours) })
        .where(eq(schema.platformSetting.key, PLATFORM_KEY_DRAFT_TTL_HOURS))
        .returning();
      const row = updated[0];
      if (!row) {
        return jsonError("NOT_FOUND", "Draft TTL setting row is missing.", {
          status: 500,
          requestId,
        });
      }
      await writeAdminAudit(tx, {
        adminUserId,
        action: "settings.draft_ttl.update",
        entityType: "platform_setting",
        entityId: PLATFORM_KEY_DRAFT_TTL_HOURS,
        beforeJson: JSON.stringify({
          key: PLATFORM_KEY_DRAFT_TTL_HOURS,
          draftTtlHours: parseDraftTtlHoursFromStored(beforeVal),
        }),
        afterJson: JSON.stringify({
          key: PLATFORM_KEY_DRAFT_TTL_HOURS,
          draftTtlHours: parsed.data.draftTtlHours,
        }),
      });
      return jsonOk({ draftTtlHours: parsed.data.draftTtlHours }, { requestId });
    },
  );
}
