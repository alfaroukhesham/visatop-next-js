import { extractNumericValue, toMinorUnits } from "@/lib/admin/catalog/parse-price-sheet";

export function parseAdminPriceMajorInput(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numeric = extractNumericValue(trimmed);
  if (numeric === null || numeric <= 0) return null;
  return toMinorUnits(numeric);
}
