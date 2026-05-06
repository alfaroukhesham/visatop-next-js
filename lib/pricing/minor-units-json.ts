/**
 * Payment provider APIs often use JSON numbers; keep minor-unit amounts as bigint
 * until the boundary and only coerce when the value fits Number.MAX_SAFE_INTEGER.
 */

export function minorUnitsToJsonSafeNumber(minor: bigint): number {
  if (minor < BigInt(0)) {
    throw new RangeError("minor units must be non-negative");
  }
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("amount exceeds JSON safe integer range");
  }
  return Number(minor);
}
