import { FLAG_ISO2_ALIASES } from "@/lib/apply/display-names";

const ARABIC_LOCALE_RE = /^ar(?:[-_]|$)/i;

export const isArabicCustomerLocale = (locale: string): boolean => ARABIC_LOCALE_RE.test(locale.trim());

const regionName = (code: string, locale: string): string | null => {
  const upper = code.trim().toUpperCase();
  const iso = FLAG_ISO2_ALIASES[upper] ?? upper;
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  try {
    const name = new Intl.DisplayNames([locale], { type: "region" }).of(iso);
    if (!name || name.toUpperCase() === iso) return null;
    return name;
  } catch {
    return null;
  }
};

export const normalizeNationalityQuery = (raw: string): string => {
  let s = raw.normalize("NFKC").toLowerCase().trim();
  s = s.replace(/[\uFEF5-\uFEFC]/g, "لا");
  s = s.normalize("NFKD").replace(/\p{M}/gu, "");
  s = s
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء/g, "")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
  return s;
};

export const nationalityLocalizedName = (code: string, catalogName: string, locale: string): string => {
  const catalog = catalogName.trim();
  if (!isArabicCustomerLocale(locale)) return catalog || code;
  return regionName(code, "ar") ?? (catalog || code);
};

const searchHaystack = (code: string, catalogName: string, locale: string): string => {
  const parts = [catalogName, code];
  if (isArabicCustomerLocale(locale)) {
    const localized = nationalityLocalizedName(code, catalogName, locale);
    if (localized) parts.push(localized);
    const en = regionName(code, "en");
    if (en) parts.push(en);
  }
  return parts.map(normalizeNationalityQuery).join("\n");
};

export const filterNationalityOptions = <T extends { code: string; name: string }>(
  options: T[],
  query: string,
  locale: string,
): T[] => {
  const q = normalizeNationalityQuery(query);
  if (!q) return options;
  return options.filter((n) => searchHaystack(n.code, n.name, locale).includes(q));
};
