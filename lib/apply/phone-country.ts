export const composeE164 = (dialDigits: string, nationalDigits: string): string => {
  const d = dialDigits.replace(/\D/g, "");
  const n = nationalDigits.replace(/\D/g, "");
  if (!d || !n) return n ? `+${n}` : "";
  return `+${d}${n}`;
};

export const splitStoredPhone = (
  stored: string,
  defaultDial: string,
): { dial: string; national: string } => {
  const digits = stored.replace(/\D/g, "");
  const fallback = defaultDial.replace(/\D/g, "");
  if (stored.startsWith("+") && fallback && digits.startsWith(fallback)) {
    return { dial: fallback, national: digits.slice(fallback.length) };
  }
  return { dial: fallback, national: digits };
};
