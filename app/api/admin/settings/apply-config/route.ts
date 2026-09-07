import { headers } from "next/headers";
import { z } from "zod";
import { runAdminDbJson } from "@/lib/admin-api/require-admin-db";
import { writeAdminAudit } from "@/lib/admin-api/write-admin-audit";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonOk } from "@/lib/api/response";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  DEFAULT_APPLY_PRICE_BADGES,
  getApplyConfigFromTx,
  PLATFORM_KEY_APPLY_PRICE_BADGES,
  PLATFORM_KEY_PARTY_ENABLED,
  PLATFORM_KEY_PARTY_MAX_TRAVELERS,
} from "@/lib/apply/apply-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const putBody = z
  .object({
    partyEnabled: z.boolean().optional(),
    partyMaxTravelers: z.number().int().min(1).max(20).optional(),
    badges: z
      .object({
        allFeesIncluded: z.string().max(80).optional(),
        noHiddenCharges: z.string().max(80).optional(),
      })
      .optional(),
  })
  .refine(
    (v) => v.partyEnabled !== undefined || v.partyMaxTravelers !== undefined || v.badges !== undefined,
    { message: "At least one of partyEnabled, partyMaxTravelers, or badges is required" },
  );

const upsertSetting = async (tx: DbTransaction, key: string, value: string) => {
  await tx
    .insert(schema.platformSetting)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.platformSetting.key,
      set: { value },
    });
};

export async function GET() {
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  return runAdminDbJson(requestId, ["settings.read"], async ({ tx }) => {
    const config = await getApplyConfigFromTx(tx);
    return jsonOk(
      {
        partyEnabled: config.partyEnabled,
        partyMaxTravelers: config.partyMaxTravelers,
        badges: config.badges,
      },
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

      const before = await getApplyConfigFromTx(tx);

      if (parsed.data.partyEnabled !== undefined) {
        await upsertSetting(tx, PLATFORM_KEY_PARTY_ENABLED, parsed.data.partyEnabled ? "true" : "false");
      }
      if (parsed.data.partyMaxTravelers !== undefined) {
        await upsertSetting(tx, PLATFORM_KEY_PARTY_MAX_TRAVELERS, String(parsed.data.partyMaxTravelers));
      }
      if (parsed.data.badges !== undefined) {
        const merged = {
          allFeesIncluded:
            parsed.data.badges.allFeesIncluded !== undefined
              ? parsed.data.badges.allFeesIncluded.trim() || DEFAULT_APPLY_PRICE_BADGES.allFeesIncluded
              : before.badges.allFeesIncluded,
          noHiddenCharges:
            parsed.data.badges.noHiddenCharges !== undefined
              ? parsed.data.badges.noHiddenCharges.trim() || DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges
              : before.badges.noHiddenCharges,
        };
        await upsertSetting(tx, PLATFORM_KEY_APPLY_PRICE_BADGES, JSON.stringify(merged));
      }

      const after = await getApplyConfigFromTx(tx);

      await writeAdminAudit(tx, {
        adminUserId,
        action: "settings.apply_config.update",
        entityType: "platform_setting",
        entityId: PLATFORM_KEY_APPLY_PRICE_BADGES,
        beforeJson: JSON.stringify(before),
        afterJson: JSON.stringify(after),
      });

      return jsonOk(
        {
          partyEnabled: after.partyEnabled,
          partyMaxTravelers: after.partyMaxTravelers,
          badges: after.badges,
        },
        { requestId },
      );
    },
  );
}
