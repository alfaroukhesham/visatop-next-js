/**
 * Pure USD ↔ AED conversion. Safe for client bundles (no Drizzle / schema).
 * Rate lookup and platform_setting reads stay in `fx-usd-aed.ts`.
 */

const ENV_KEY = "NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD";
const ENV_KEY_SERVER = "FX_AED_PER_USD";

export class FxRateInvalidError extends Error {
  constructor(raw: string) {
    super(
      `FX rate "${raw}" is not a valid positive number. Check ${ENV_KEY} / ${ENV_KEY_SERVER}.`,
    );
    this.name = "FxRateInvalidError";
  }
}

type FxRateFraction = { numerator: bigint; denominator: bigint; raw: string };

function parseFxRateFraction(rateRaw: string): FxRateFraction {
  const s = rateRaw.trim();
  // Accept digits with optional single dot; disallow signs/exponents for safety.
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new FxRateInvalidError(rateRaw);
  }
  const [intPart, fracPart = ""] = s.split(".");
  const denom = BigInt(10) ** BigInt(fracPart.length);
  const numer = BigInt(intPart + fracPart);
  if (numer <= BigInt(0)) throw new FxRateInvalidError(rateRaw);
  return { numerator: numer, denominator: denom, raw: rateRaw };
}

function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

/**
 * Convert USD minor units → AED minor units using env rate.
 * Rounds to nearest integer (banker-style half-up via Math.round).
 */
export function fxUsdToAed(usdMinor: bigint, rate: number | string): bigint {
  if (typeof rate === "number") {
    return BigInt(Math.round(Number(usdMinor) * rate));
  }
  const f = parseFxRateFraction(rate);
  return divRoundHalfUp(usdMinor * f.numerator, f.denominator);
}

/**
 * Convert AED minor units → USD minor units using inverse of env rate.
 */
export function fxAedToUsd(aedMinor: bigint, rate: number | string): bigint {
  if (typeof rate === "number") {
    return BigInt(Math.round(Number(aedMinor) / rate));
  }
  const f = parseFxRateFraction(rate);
  return divRoundHalfUp(aedMinor * f.denominator, f.numerator);
}

export type FxLeg = "aed_from_usd" | "usd_from_aed" | null;

export function deriveAedFromUsd(
  usdMinor: bigint,
  rate: number,
): { aedMinor: bigint; fxLeg: FxLeg } {
  return { aedMinor: fxUsdToAed(usdMinor, rate), fxLeg: "aed_from_usd" };
}

export function deriveUsdFromAed(
  aedMinor: bigint,
  rate: number,
): { usdMinor: bigint; fxLeg: FxLeg } {
  return { usdMinor: fxAedToUsd(aedMinor, rate), fxLeg: "usd_from_aed" };
}
