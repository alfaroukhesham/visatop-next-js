import { normalizeCountryName } from "@/lib/admin/catalog/parse-price-sheet";

/**
 * Passport nationality line labels (demonyms) for ISO 3166-1 alpha-2 codes whose
 * catalog `nationality.name` is a country name rather than a demonym.
 */
const DEMONYM_BY_ISO2: Record<string, string> = {
  AE: "Emirati",
  AU: "Australian",
  BD: "Bangladeshi",
  BR: "Brazilian",
  CA: "Canadian",
  CN: "Chinese",
  DE: "German",
  EG: "Egyptian",
  ET: "Ethiopian",
  FR: "French",
  GB: "British",
  GH: "Ghanaian",
  ID: "Indonesian",
  IE: "Irish",
  IN: "Indian",
  IQ: "Iraqi",
  IR: "Iranian",
  IT: "Italian",
  JP: "Japanese",
  KE: "Kenyan",
  KR: "South Korean",
  KW: "Kuwaiti",
  LK: "Sri Lankan",
  MY: "Malaysian",
  NG: "Nigerian",
  NP: "Nepalese",
  OM: "Omani",
  PH: "Filipino",
  PK: "Pakistani",
  PL: "Polish",
  QA: "Qatari",
  RU: "Russian",
  SA: "Saudi",
  SG: "Singaporean",
  TH: "Thai",
  TR: "Turkish",
  TZ: "Tanzanian",
  UA: "Ukrainian",
  US: "American",
  UG: "Ugandan",
  VN: "Vietnamese",
  ZA: "South African",
  ZM: "Zambian",
  ZW: "Zimbabwean",
};

const regionNameForCode = (code: string): string | null => {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "region" }).of(code);
    return name?.trim() ?? null;
  } catch {
    return null;
  }
};

/** Value to prefill on the applicant Nationality field when the profile is empty. */
export const applicantNationalityPrefill = (nationalityCode: string, catalogName: string): string => {
  const code = nationalityCode.trim().toUpperCase();
  const catalog = catalogName.trim();
  if (!code && !catalog) return "";

  const demonym = code ? DEMONYM_BY_ISO2[code] : undefined;
  if (demonym) return demonym;

  if (catalog) {
    const region = code ? regionNameForCode(code) : null;
    if (region && normalizeCountryName(catalog) === normalizeCountryName(region)) {
      return catalog;
    }
    return catalog;
  }

  return code ? (DEMONYM_BY_ISO2[code] ?? regionNameForCode(code) ?? "") : "";
};

/** Accept demonym, catalog country name, or ISO region label for this passport code. */
export const isAcceptedApplicantNationality = (
  value: string | null | undefined,
  nationalityCode: string,
  catalogName: string,
): boolean => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return false;

  const norm = normalizeCountryName(trimmed);
  const accepted = new Set<string>();

  const code = nationalityCode.trim().toUpperCase();
  if (code) {
    const demonym = DEMONYM_BY_ISO2[code];
    if (demonym) accepted.add(normalizeCountryName(demonym));
    const region = regionNameForCode(code);
    if (region) accepted.add(normalizeCountryName(region));
  }

  if (catalogName.trim()) accepted.add(normalizeCountryName(catalogName));
  accepted.add(normalizeCountryName(applicantNationalityPrefill(nationalityCode, catalogName)));

  return accepted.has(norm);
};