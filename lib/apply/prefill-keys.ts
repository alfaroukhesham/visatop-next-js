const isNonEmptyPrefillValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
};

/** Keys whose OCR prefill value is actually present (null/blank do not count). */
export const nonEmptyPrefillKeys = (
  prefill: Record<string, unknown> | null | undefined,
): Set<string> => {
  const keys = new Set<string>();
  if (!prefill) return keys;
  for (const [key, value] of Object.entries(prefill)) {
    if (isNonEmptyPrefillValue(value)) keys.add(key);
  }
  return keys;
};
