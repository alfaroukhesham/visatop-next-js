export type TBankStatementRegion = "africa_asia" | "other";

/** VisaTop allowlist. TR in. RU and CY out until Francesco overrides. */
export const AFRICA_ASIA_NATIONALITY_CODES: readonly string[] = [
  // Africa
  "DZ", "AO", "BJ", "BW", "BF", "BI", "CV", "CM", "CF", "TD", "KM", "CG", "CD",
  "CI", "DJ", "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE",
  "LS", "LR", "LY", "MG", "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG",
  "RW", "ST", "SN", "SC", "SL", "SO", "ZA", "SS", "SD", "TZ", "TG", "TN", "UG",
  "EH", "ZM", "ZW",
  // Asia (TR included; RU and CY omitted)
  "AF", "AM", "AZ", "BH", "BD", "BT", "BN", "KH", "CN", "GE", "HK", "IN", "ID",
  "IR", "IQ", "IL", "JP", "JO", "KZ", "KW", "KG", "LA", "LB", "MO", "MY", "MV",
  "MN", "MM", "NP", "KP", "OM", "PK", "PS", "PH", "QA", "SA", "SG", "KR", "LK",
  "SY", "TW", "TJ", "TH", "TL", "TR", "TM", "AE", "UZ", "VN", "YE",
] as const;

const AFRICA_ASIA_SET = new Set<string>(AFRICA_ASIA_NATIONALITY_CODES);

export const requiresAfricaAsiaBankStatementNationality = (nationalityCode: string): boolean => {
  return AFRICA_ASIA_SET.has(nationalityCode.trim().toUpperCase());
};
