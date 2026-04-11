/**
 * Pure pricing math (minor units). DB adapters pass `margin_policy.mode` + `value` as strings.
 */

const Z = BigInt(0);
const BPS_SCALE = BigInt(10000);
const PCT_WHOLE_TO_BPS = BigInt(100);

/** Convert a stored percent string (e.g. "10.5") to basis points (1050 = 10.5%). */
export function parsePercentToBasisPoints(value: string): bigint {
  const trimmed = value.trim();
  if (!trimmed) return Z;
  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  const wholePart =
    wholeRaw === "" ? Z : BigInt(wholeRaw.replace(/^\+/, "")) * PCT_WHOLE_TO_BPS;
  const fracPadded = (fracRaw.replace(/\D/g, "") + "00").slice(0, 2);
  const fracPart = fracPadded === "" ? Z : BigInt(fracPadded);
  return wholePart + fracPart;
}

export function marginAdditionMinor(
  referenceMinor: bigint,
  marginMode: "percent" | "fixed",
  marginValue: string,
): bigint {
  if (marginMode === "percent") {
    const bps = parsePercentToBasisPoints(marginValue);
    if (bps === Z) return Z;
    return (referenceMinor * bps) / BPS_SCALE;
  }
  const n = Number(marginValue);
  if (!Number.isFinite(n)) return Z;
  return BigInt(Math.round(n));
}

export type ComputeDisplayPriceInput = {
  referenceMinor: bigint;
  marginMode: "percent" | "fixed";
  marginValue: string;
  addonMinorUnits: bigint[];
  /** Subtracted after margin and add-ons; default 0. */
  discountMinor?: bigint;
};

export type ComputeDisplayPriceResult = {
  totalMinor: bigint;
  marginMinor: bigint;
  addonsMinor: bigint;
};

export function computeDisplayPriceMinor(
  input: ComputeDisplayPriceInput,
): ComputeDisplayPriceResult {
  const { referenceMinor, marginMode, marginValue, addonMinorUnits } = input;
  const discountMinor = input.discountMinor ?? Z;

  const marginMinor = marginAdditionMinor(
    referenceMinor,
    marginMode,
    marginValue,
  );
  const addonsMinor = addonMinorUnits.reduce((a, b) => a + b, Z);
  const raw =
    referenceMinor + marginMinor + addonsMinor - discountMinor;
  const totalMinor = raw < Z ? Z : raw;
  return { totalMinor, marginMinor, addonsMinor };
}
