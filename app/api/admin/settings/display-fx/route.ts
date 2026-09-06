import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonOk } from "@/lib/api/response";
import * as schema from "@/lib/db/schema";
import {
  parseFxAedPerUsdFromStored,
  peekResolvedFxRateFromTx,
  PLATFORM_KEY_FX_AED_PER_USD,
} from "@/lib/pricing/fx-usd-aed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putBody = z.object({
  fxAedPerUsd: z
    .string()
    .transform((s) => s.trim())
    .refine((s) => parseFxAedPerUsdFromStored(s) !== null, {
      message: "Must be a valid positive number",
    }),
});

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["settings.read"], async ({ tx }) => {
    const resolved = await peekResolvedFxRateFromTx(tx);
    return jsonOk(
      { fxAedPerUsd: resolved.fxAedPerUsd, source: resolved.source },
      { requestId },
    );
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

      const fxAedPerUsd = parseFxAedPerUsdFromStored(parsed.data.fxAedPerUsd);
      if (fxAedPerUsd === null) {
        return jsonError("VALIDATION_ERROR", "Must be a valid positive number", {
          status: 400,
          requestId,
        });
      }

      const beforeRows = await tx
        .select({ value: schema.platformSetting.value })
        .from(schema.platformSetting)
        .where(eq(schema.platformSetting.key, PLATFORM_KEY_FX_AED_PER_USD))
        .limit(1);
      const beforeVal = beforeRows[0]?.value ?? null;

      const upserted = await tx
        .insert(schema.platformSetting)
        .values({ key: PLATFORM_KEY_FX_AED_PER_USD, value: fxAedPerUsd })
        .onConflictDoUpdate({
          target: schema.platformSetting.key,
          set: { value: fxAedPerUsd },
        })
        .returning();
      const row = upserted[0];
      if (!row) {
        return jsonError("INTERNAL_ERROR", "FX setting upsert failed.", {
          status: 500,
          requestId,
        });
      }

      await writeAdminAudit(tx, {
        adminUserId,
        action: "settings.display_fx.update",
        entityType: "platform_setting",
        entityId: PLATFORM_KEY_FX_AED_PER_USD,
        beforeJson: JSON.stringify({
          key: PLATFORM_KEY_FX_AED_PER_USD,
          fxAedPerUsd: parseFxAedPerUsdFromStored(beforeVal),
        }),
        afterJson: JSON.stringify({
          key: PLATFORM_KEY_FX_AED_PER_USD,
          fxAedPerUsd,
        }),
      });

      return jsonOk({ fxAedPerUsd, source: "setting" as const }, { requestId });
    },
  );
}
