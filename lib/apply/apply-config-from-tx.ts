import { inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema";
import {
  PLATFORM_KEY_APPLY_PRICE_BADGES,
  PLATFORM_KEY_PARTY_ENABLED,
  PLATFORM_KEY_PARTY_MAX_TRAVELERS,
  parseApplyPriceBadges,
  parsePartyEnabled,
  parsePartyMaxTravelers,
  type TApplyConfig,
} from "@/lib/apply/apply-config";

export const getApplyConfigFromTx = async (tx: DbTransaction): Promise<TApplyConfig> => {
  const rows = await tx
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(
      inArray(platformSetting.key, [
        PLATFORM_KEY_PARTY_ENABLED,
        PLATFORM_KEY_PARTY_MAX_TRAVELERS,
        PLATFORM_KEY_APPLY_PRICE_BADGES,
      ]),
    );
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    partyEnabled: parsePartyEnabled(byKey.get(PLATFORM_KEY_PARTY_ENABLED)),
    partyMaxTravelers: parsePartyMaxTravelers(byKey.get(PLATFORM_KEY_PARTY_MAX_TRAVELERS)),
    badges: parseApplyPriceBadges(byKey.get(PLATFORM_KEY_APPLY_PRICE_BADGES)),
  };
};
