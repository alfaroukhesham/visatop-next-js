/** Fincra checkout amounts are major units (naira); we store NGN as kobo. */

export const FINCRA_MINOR_PER_MAJOR = 100;

export const fincraMajorToMinor = (major: number | string): bigint => {
  const n = typeof major === "number" ? major : Number(String(major).trim());
  if (!Number.isFinite(n)) {
    throw new Error(`Fincra amount is not a finite number: ${String(major)}`);
  }
  return BigInt(Math.round(n * FINCRA_MINOR_PER_MAJOR));
};

export const fincraMinorToMajorNumber = (minor: bigint): number => Number(minor) / FINCRA_MINOR_PER_MAJOR;

export const tryFincraMajorToMinor = (major: unknown): bigint | null => {
  if (typeof major === "number" || typeof major === "string") {
    try {
      return fincraMajorToMinor(major);
    } catch {
      return null;
    }
  }
  return null;
};
