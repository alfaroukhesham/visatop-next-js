/**
 * Optional display conversion between USD and AED for catalog cards only.
 * Checkout still locks quotes from server pricing rules.
 */
const USD = "USD";
const AED = "AED";

export function parsePublicDisplayFxAedPerUsd(): number | null {
  const raw = process.env.NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function convertMinorBetweenUsdAed(
  minor: bigint,
  from: string,
  to: string,
  aedPerUsd: number,
): bigint | null {
  if (from === to) return minor;
  if ((from !== USD || to !== AED) && (from !== AED || to !== USD)) return null;
  const n = Number(minor);
  if (!Number.isFinite(n) || n < 0) return null;
  if (from === USD && to === AED) {
    return BigInt(Math.round(n * aedPerUsd));
  }
  return BigInt(Math.max(0, Math.round(n / aedPerUsd)));
}
