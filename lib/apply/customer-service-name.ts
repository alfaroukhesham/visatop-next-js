type TServiceNameTranslate = (key: string, vars?: Record<string, string | number>) => string;

interface ICustomerServiceNameHints {
  durationDays?: number | null;
  entries?: string | null;
  travelerKind?: string | null;
}

const GENERIC_VISA_WORDS = /\b(?:day|days|single|multiple|entry|entries|adult|child|visa)\b/gi;

const entryKind = (entries: string | null | undefined, name: string): "single" | "multiple" | null => {
  const source = `${entries ?? ""} ${name}`.toLowerCase();
  if (source.includes("multi")) return "multiple";
  if (source.includes("single")) return "single";
  return null;
};

/**
 * Catalog rows store an English product name. When that name is only duration and
 * entry ("14 Days - Single Entry"), show the translated chooser facts instead.
 * A name with any other word stays as the catalog wrote it.
 */
export const customerFacingServiceName = (
  name: string,
  locale: string,
  t: TServiceNameTranslate,
  hints: ICustomerServiceNameHints = {},
): string => {
  const trimmed = name.trim();
  if (!trimmed || locale.trim().toLowerCase().startsWith("en")) return trimmed;
  const durationFromName = trimmed.match(/(\d+)\s*-?\s*days?/i);
  const durationDays =
    hints.durationDays ?? (durationFromName ? Number(durationFromName[1]) : null);
  const entry = entryKind(hints.entries, trimmed);
  const child = hints.travelerKind === "child" || /\bchild\b/i.test(trimmed);
  const parts: string[] = [];
  if (durationDays != null && Number.isFinite(durationDays)) {
    parts.push(t("chooser.durationDays", { count: durationDays }));
  }
  if (entry === "multiple") parts.push(t("chooser.entryLabels.multiple"));
  if (entry === "single") parts.push(t("chooser.entryLabels.single"));
  if (child) parts.push(t("chooser.child"));
  if (parts.length === 0) return trimmed;
  const residual = trimmed.replace(/\d+/g, " ").replace(GENERIC_VISA_WORDS, " ").replace(/[^A-Za-z]+/g, " ").trim();
  if (residual.length > 0) return trimmed;
  return parts.join(" · ");
};
