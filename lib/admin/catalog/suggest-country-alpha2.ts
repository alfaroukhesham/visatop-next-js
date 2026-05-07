import countries from "i18n-iso-countries";
import type { LocaleData } from "i18n-iso-countries";
import enLocale from "i18n-iso-countries/langs/en.json";
import { normalizeCountryName, type MissingNationalityEntry } from "./parse-price-sheet";

export type MissingNationalityWithSuggestion = MissingNationalityEntry & {
  suggestedAlpha2: string | null;
};

let localeRegistered = false;

function ensureEnLocale() {
  if (localeRegistered) return;
  countries.registerLocale(enLocale as LocaleData);
  localeRegistered = true;
}

/**
 * Extra sheet spellings / abbreviations → ISO 3166-1 alpha-2 (same codes as IBAN country prefix).
 * Keys must match {@link normalizeCountryName} output.
 */
const EXTRA_ALIASES: Record<string, string> = {
  uae: "AE",
  "u.a.e": "AE",
  "u.a.e.": "AE",
  emirates: "AE",
  uk: "GB",
  "great britain": "GB",
  britain: "GB",
  usa: "US",
  "united states of america": "US",
  "south korea": "KR",
  "north korea": "KP",
  "russian federation": "RU",
  "czech republic": "CZ",
  "ivory coast": "CI",
  "east timor": "TL",
};

/**
 * Best-effort ISO 3166-1 alpha-2 from a sheet country label (English / common abbreviations).
 * Admins should still verify before saving.
 */
export function suggestIso3166Alpha2FromCountryLabel(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  ensureEnLocale();

  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{2}$/.test(compact) && countries.isValid(compact)) {
    return compact;
  }

  if (/^[A-Z]{3}$/.test(compact) && countries.isValid(compact)) {
    const a2 = countries.alpha3ToAlpha2(compact);
    return a2 ?? null;
  }

  const nk = normalizeCountryName(trimmed);
  const alias = EXTRA_ALIASES[nk];
  if (alias) return alias;

  const fromSimple =
    countries.getSimpleAlpha2Code(trimmed, "en") ??
    countries.getSimpleAlpha2Code(trimmed.replace(/\s+/g, " "), "en");
  if (fromSimple) return fromSimple.toUpperCase();

  return null;
}

export function withSuggestedAlpha2(
  entries: MissingNationalityEntry[],
): MissingNationalityWithSuggestion[] {
  return entries.map((e) => ({
    ...e,
    suggestedAlpha2: suggestIso3166Alpha2FromCountryLabel(e.exampleRaw),
  }));
}
