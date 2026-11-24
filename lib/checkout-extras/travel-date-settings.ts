import { inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema/platform-setting";
import type { TTravelDateSettings } from "@/lib/checkout-extras/types";
import {
  PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS,
  PLATFORM_KEY_TRAVEL_DATE_MAX_DAYS_AHEAD,
  PLATFORM_KEY_TRAVEL_DATE_REQUIRED,
  PLATFORM_KEY_TRAVEL_DATE_STEP_ENABLED,
  parseFastTrackThresholdDays,
  parseTravelDateMaxDaysAhead,
  parseTravelDateRequired,
  parseTravelDateStepEnabled,
} from "@/lib/checkout-extras/validation";

const SETTING_KEYS = [
  PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS,
  PLATFORM_KEY_TRAVEL_DATE_REQUIRED,
  PLATFORM_KEY_TRAVEL_DATE_STEP_ENABLED,
  PLATFORM_KEY_TRAVEL_DATE_MAX_DAYS_AHEAD,
] as const;

export const travelDateSettingsFromRows = (
  rows: readonly { key: string; value: string }[],
): TTravelDateSettings => {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    fastTrackThresholdDays: parseFastTrackThresholdDays(byKey.get(PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS)),
    travelDateRequired: parseTravelDateRequired(byKey.get(PLATFORM_KEY_TRAVEL_DATE_REQUIRED)),
    travelDateStepEnabled: parseTravelDateStepEnabled(byKey.get(PLATFORM_KEY_TRAVEL_DATE_STEP_ENABLED)),
    travelDateMaxDaysAhead: parseTravelDateMaxDaysAhead(byKey.get(PLATFORM_KEY_TRAVEL_DATE_MAX_DAYS_AHEAD)),
  };
};

export const getTravelDateSettingsFromTx = async (tx: DbTransaction): Promise<TTravelDateSettings> => {
  const rows = await tx
    .select({ key: platformSetting.key, value: platformSetting.value })
    .from(platformSetting)
    .where(inArray(platformSetting.key, [...SETTING_KEYS]));
  return travelDateSettingsFromRows(rows);
};

const upsertSetting = async (tx: DbTransaction, key: string, value: string) => {
  await tx
    .insert(platformSetting)
    .values({ key, value })
    .onConflictDoUpdate({
      target: platformSetting.key,
      set: { value, updatedAt: new Date() },
    });
};

export const saveTravelDateSettings = async (
  tx: DbTransaction,
  next: TTravelDateSettings,
): Promise<{ before: TTravelDateSettings; after: TTravelDateSettings }> => {
  const before = await getTravelDateSettingsFromTx(tx);
  await upsertSetting(tx, PLATFORM_KEY_FAST_TRACK_THRESHOLD_DAYS, String(next.fastTrackThresholdDays));
  await upsertSetting(tx, PLATFORM_KEY_TRAVEL_DATE_REQUIRED, next.travelDateRequired ? "true" : "false");
  await upsertSetting(tx, PLATFORM_KEY_TRAVEL_DATE_STEP_ENABLED, next.travelDateStepEnabled ? "true" : "false");
  await upsertSetting(tx, PLATFORM_KEY_TRAVEL_DATE_MAX_DAYS_AHEAD, String(next.travelDateMaxDaysAhead));
  const after = await getTravelDateSettingsFromTx(tx);
  return { before, after };
};
