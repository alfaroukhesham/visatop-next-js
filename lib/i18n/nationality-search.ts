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

const searchNames = (code: string, catalogName: string, locale: string): string[] => {
  const parts = [catalogName];
  if (isArabicCustomerLocale(locale)) {
    const localized = nationalityLocalizedName(code, catalogName, locale);
    if (localized) parts.push(localized);
    const en = regionName(code, "en");
    if (en) parts.push(en);
  }
  return parts;
};

export const stripLeadingArabicArticle = (normalized: string): string => normalized.replace(/^ال/, "");

/** Lower is better: 0 = name/article-stripped name starts with q, 1 = a word does, 2 = mid-word. */
export const nationalityMatchRank = (normalizedName: string, q: string): number | null => {
  if (!q || !normalizedName) return null;
  const alFree = stripLeadingArabicArticle(normalizedName);
  if (normalizedName.startsWith(q) || (alFree !== normalizedName && alFree.startsWith(q))) return 0;
  const words = normalizedName.split(" ").filter(Boolean);
  for (const word of words) {
    if (word.startsWith(q) || stripLeadingArabicArticle(word).startsWith(q)) return 1;
  }
  if (normalizedName.includes(q) || alFree.includes(q)) return 2;
  return null;
};

const bestMatchRank = (code: string, catalogName: string, locale: string, q: string): number | null => {
  let best: number | null = null;
  const consider = (rank: number | null) => {
    if (rank === null) return;
    best = best === null ? rank : Math.min(best, rank);
  };
  for (const name of searchNames(code, catalogName, locale)) {
    consider(nationalityMatchRank(normalizeNationalityQuery(name), q));
  }
  const codeNorm = normalizeNationalityQuery(code);
  if (codeNorm.startsWith(q)) consider(0);
  else if (codeNorm.includes(q)) consider(2);
  return best;
};

export const filterNationalityOptions = <T extends { code: string; name: string }>(
  options: T[],
  query: string,
  locale: string,
): T[] => {
  const q = normalizeNationalityQuery(query);
  if (!q) return options;
  return options
    .map((n, index) => ({ n, index, rank: bestMatchRank(n.code, n.name, locale, q) }))
    .filter((row): row is { n: T; index: number; rank: number } => row.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.n);
};
