/**
 * Payment provider APIs often use JSON numbers; keep minor-unit amounts as bigint
 * until the boundary and only coerce when the value fits Number.MAX_SAFE_INTEGER.
 */

const MINOR_UNITS_ZERO = BigInt(0);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export function minorUnitsToJsonSafeNumber(minor: bigint): number {
  if (minor < MINOR_UNITS_ZERO) {
    throw new RangeError("minor units must be non-negative");
  }
  if (minor > MAX_SAFE_BIGINT) {
    throw new RangeError("amount exceeds JSON safe integer range");
  }
  return Number(minor);
}
