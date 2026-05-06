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

const ENV_KEY = "NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD";
const ENV_KEY_SERVER = "FX_AED_PER_USD"; // optional server-side mirror

export class FxRateMissingError extends Error {
  constructor() {
    super(
      `FX rate not configured. Set ${ENV_KEY} (or ${ENV_KEY_SERVER}) in environment.`,
    );
    this.name = "FxRateMissingError";
  }
}

export class FxRateInvalidError extends Error {
  constructor(raw: string) {
    super(
      `FX rate "${raw}" is not a valid positive number. Check ${ENV_KEY} / ${ENV_KEY_SERVER}.`,
    );
    this.name = "FxRateInvalidError";
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
  // denominator must be > 0
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

/**
 * Given a stored USD minor amount, derive the AED amount.
 * Returns both minor values + the fxLeg used.
 */
export function deriveAedFromUsd(
  usdMinor: bigint,
  rate: number,
): { aedMinor: bigint; fxLeg: FxLeg } {
  return { aedMinor: fxUsdToAed(usdMinor, rate), fxLeg: "aed_from_usd" };
}

/**
 * Given a stored AED minor amount, derive the USD amount.
 */
export function deriveUsdFromAed(
  aedMinor: bigint,
  rate: number,
): { usdMinor: bigint; fxLeg: FxLeg } {
  return { usdMinor: fxAedToUsd(aedMinor, rate), fxLeg: "usd_from_aed" };
}
