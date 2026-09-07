import { inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema";

export const PLATFORM_KEY_PARTY_ENABLED = "party_enabled";
export const DEFAULT_PARTY_ENABLED = true;

export const PLATFORM_KEY_PARTY_MAX_TRAVELERS = "party_max_travelers";
export const DEFAULT_PARTY_MAX_TRAVELERS = 8;

export const PLATFORM_KEY_APPLY_PRICE_BADGES = "apply_price_badges";
export type TApplyPriceBadges = {
  allFeesIncluded: string;
  noHiddenCharges: string;
};
export const DEFAULT_APPLY_PRICE_BADGES: TApplyPriceBadges = {
  allFeesIncluded: "All fees included",
  noHiddenCharges: "No hidden charges",
};

export const parsePartyEnabled = (value: string | null | undefined): boolean => {
  if (value === undefined || value === null || value === "") return DEFAULT_PARTY_ENABLED;
  return value === "true" || value === "1";
};

export const parsePartyMaxTravelers = (value: string | null | undefined): number => {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 20) return DEFAULT_PARTY_MAX_TRAVELERS;
  return n;
};

export const parseApplyPriceBadges = (value: string | null | undefined): TApplyPriceBadges => {
  if (value === undefined || value === null || value === "") return DEFAULT_APPLY_PRICE_BADGES;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return DEFAULT_APPLY_PRICE_BADGES;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_APPLY_PRICE_BADGES;
  }
  const record = parsed as Record<string, unknown>;
  const allFeesIncluded =
    typeof record.allFeesIncluded === "string" && record.allFeesIncluded.trim() !== ""
      ? record.allFeesIncluded.trim()
      : DEFAULT_APPLY_PRICE_BADGES.allFeesIncluded;
  const noHiddenCharges =
    typeof record.noHiddenCharges === "string" && record.noHiddenCharges.trim() !== ""
      ? record.noHiddenCharges.trim()
      : DEFAULT_APPLY_PRICE_BADGES.noHiddenCharges;
  return { allFeesIncluded, noHiddenCharges };
};

export type TApplyConfig = {
  partyEnabled: boolean;
  partyMaxTravelers: number;
  badges: TApplyPriceBadges;
};

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
