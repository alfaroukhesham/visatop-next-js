const ISO2_RE = /^[A-Z]{2}$/;
const REGIONAL_INDICATOR_A = 0x1f1e6;
const UNKNOWN_NATIONALITY_LABEL = "that nationality";

/** Catalog codes that are not ISO 3166-1 alpha-2 but still need a real flag. */
export const FLAG_ISO2_ALIASES: Record<string, string> = {
  AB: "AG",
};

const englishRegionNames = new Intl.DisplayNames(["en"], { type: "region" });

export const iso2FlagEmoji = (code: string): string => {
  const upper = code.trim().toUpperCase();
  const iso = FLAG_ISO2_ALIASES[upper] ?? upper;
  if (!ISO2_RE.test(iso)) return "";
  return String.fromCodePoint(
    ...[...iso].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65),
  );
};

const regionNameFromIntl = (code: string): string | null => {
  try {
    const name = englishRegionNames.of(code);
    if (!name || name.toUpperCase() === code) return null;
    return name;
  } catch {
    return null;
  }
};

const regionNameForLocale = (code: string, locale: string): string | null => {
  const iso = FLAG_ISO2_ALIASES[code] ?? code;
  if (!ISO2_RE.test(iso)) return null;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(iso);
    if (!name || name.toUpperCase() === iso) return null;
    return name;
  } catch {
    return null;
  }
};

export const nationalityDisplayName = (
  code: string,
  catalog: Array<{ code: string; name: string }>,
  locale = "en",
): string => {
  const upper = code.trim().toUpperCase();
  const fromCatalog = catalog.find((n) => n.code.toUpperCase() === upper)?.name?.trim();
  const language = locale.trim().toLowerCase();
  if (language && !language.startsWith("en")) {
    const localized = regionNameForLocale(upper, locale);
    if (localized) return localized;
  }
  if (fromCatalog) return fromCatalog;
  return regionNameFromIntl(upper) ?? UNKNOWN_NATIONALITY_LABEL;
};

export const nationalityLabelWithFlag = (code: string, name: string): string => {
  const flag = iso2FlagEmoji(code);
  return flag ? `${flag} ${name}` : name;
};

export const serviceDisplayName = (
  serviceId: string,
  catalog: Array<{ id: string; name: string }>,
): string | null => {
  const hit = catalog.find((s) => s.id === serviceId);
  return hit?.name ?? null;
};
