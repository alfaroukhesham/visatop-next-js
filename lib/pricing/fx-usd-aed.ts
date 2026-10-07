/**
 * FX helpers for USD ↔ AED conversion using env-configured rate.
 *
 * Rate variable: NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD
 * Semantics: how many AED = 1 USD  (e.g. 3.6725)
 *
 * For server-side checkout / import: reads the same env var.
 * If build constraints inline NEXT_PUBLIC_* only in client bundles,
 * ops must also set FX_AED_PER_USD as a server-side mirror (see .env.example).
 */

import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import { platformSetting } from "@/lib/db/schema/platform-setting";
import { FxRateInvalidError } from "@/lib/pricing/fx-convert";

export {
  FxRateInvalidError,
  deriveAedFromUsd,
  deriveUsdFromAed,
  fxAedToUsd,
  fxUsdToAed,
} from "@/lib/pricing/fx-convert";
export type { FxLeg } from "@/lib/pricing/fx-convert";

const ENV_KEY = "NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD";
const ENV_KEY_SERVER = "FX_AED_PER_USD"; // optional server-side mirror

export const PLATFORM_KEY_FX_AED_PER_USD = "fx_aed_per_usd";

export type TFxRateSource = "setting" | "env" | "missing";

export type TPeekResolvedFxRate = {
  fxAedPerUsd: string | null;
  source: TFxRateSource;
};

export class FxRateMissingError extends Error {
  constructor() {
    super(
      `FX rate not configured. Set ${ENV_KEY} (or ${ENV_KEY_SERVER}) in environment.`,
    );
    this.name = "FxRateMissingError";
  }
}

/**
 * Reads AED-per-USD from environment.
 * Throws FxRateMissingError / FxRateInvalidError on bad config.
 */
export function readFxRate(): number {
  const raw =
    process.env[ENV_KEY_SERVER]?.trim() ||
    process.env[ENV_KEY]?.trim();

  if (!raw) throw new FxRateMissingError();

  const rate = parseFloat(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new FxRateInvalidError(raw);
  }
  return rate;
}

/**
 * Returns the configured FX rate string as stored in snapshots (e.g. "3.6725").
 * Guaranteed to be a valid positive number string if no error is thrown.
 */
export function readFxRateString(): string {
  const raw =
    process.env[ENV_KEY_SERVER]?.trim() ||
    process.env[ENV_KEY]?.trim();
  if (!raw) throw new FxRateMissingError();
  const rate = parseFloat(raw);
  if (!Number.isFinite(rate) || rate <= 0) throw new FxRateInvalidError(raw);
  return raw;
}

/** Normalize stored `platform_setting.value` for `fx_aed_per_usd`. */
export const parseFxAedPerUsdFromStored = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null || value === "") return null;
  const raw = value.trim();
  if (!raw) return null;
  const rate = parseFloat(raw);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return raw;
};

export const peekResolvedFxRateFromTx = async (
  tx: DbTransaction,
): Promise<TPeekResolvedFxRate> => {
  const rows = await tx
    .select({ value: platformSetting.value })
    .from(platformSetting)
    .where(eq(platformSetting.key, PLATFORM_KEY_FX_AED_PER_USD))
    .limit(1);
  const stored = parseFxAedPerUsdFromStored(rows[0]?.value);
  if (stored !== null) {
    return { fxAedPerUsd: stored, source: "setting" };
  }
  try {
    const envRate = readFxRateString();
    return { fxAedPerUsd: envRate, source: "env" };
  } catch (e) {
    if (e instanceof FxRateMissingError || e instanceof FxRateInvalidError) {
      return { fxAedPerUsd: null, source: "missing" };
    }
    throw e;
  }
};

export const getResolvedFxRateFromTx = async (tx: DbTransaction): Promise<string> => {
  const resolved = await peekResolvedFxRateFromTx(tx);
  if (resolved.fxAedPerUsd !== null) {
    return resolved.fxAedPerUsd;
  }
  return readFxRateString();
};

