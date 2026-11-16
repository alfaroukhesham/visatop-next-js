import type { CheckoutPaymentProvider } from "@/lib/payments/resolve-payment-provider";

export const FINCRA_INLINE_PAYMENT_METHODS = ["card", "bank_transfer"] as const;

export type TFincraCheckoutPaymentMethod = (typeof FINCRA_INLINE_PAYMENT_METHODS)[number];

export type TLocalCheckoutConfigEntry = {
  /** ISO 3166-1 alpha-2 nationality linked to this local checkout currency. */
  nationality: string;
  /** ISO 4217 currency stored in catalog_customer_price (minor units, no FX). */
  currency: string;
  provider: Extract<CheckoutPaymentProvider, "fincra">;
  paymentMethods: readonly TFincraCheckoutPaymentMethod[];
  /** Code-level gate; `FINCRA_ENABLED` must still be on for Fincra checkout. */
  enabled: boolean;
};

/**
 * Code-level list of nationalities offered Fincra local-currency checkout.
 * Stored prices and admin Local currencies tab rows must exist per currency/nationality.
 */
export const LOCAL_CHECKOUT_CONFIG: readonly TLocalCheckoutConfigEntry[] = [
  {
    nationality: "NG",
    currency: "NGN",
    provider: "fincra",
    paymentMethods: FINCRA_INLINE_PAYMENT_METHODS,
    enabled: true,
  },
  {
    nationality: "ZA",
    currency: "ZAR",
    provider: "fincra",
    paymentMethods: FINCRA_INLINE_PAYMENT_METHODS,
    enabled: true,
  },
] as const;

export const ENABLED_LOCAL_CHECKOUT_ENTRIES = LOCAL_CHECKOUT_CONFIG.filter((e) => e.enabled);

export const CONFIGURED_LOCAL_CHECKOUT_CURRENCIES = [
  ...new Set(LOCAL_CHECKOUT_CONFIG.map((e) => e.currency.trim().toUpperCase())),
] as const;

export type TConfiguredLocalCheckoutCurrency = (typeof CONFIGURED_LOCAL_CHECKOUT_CURRENCIES)[number];

export const ADMIN_IMPORT_CURRENCIES = ["USD", "AED", ...CONFIGURED_LOCAL_CHECKOUT_CURRENCIES] as const;

export type TAdminImportCurrency = (typeof ADMIN_IMPORT_CURRENCIES)[number];

const normNat = (code: string): string => code.trim().toUpperCase();

const normCur = (code: string): string => code.trim().toUpperCase();

export const isConfiguredLocalCheckoutCurrency = (currency: string): boolean =>
  CONFIGURED_LOCAL_CHECKOUT_CURRENCIES.includes(normCur(currency) as TConfiguredLocalCheckoutCurrency);

/** Local catalog currencies stored as-is (never FX-derived from USD/AED). */
export const isStoredLocalCheckoutCurrency = (currency: string): boolean =>
  isConfiguredLocalCheckoutCurrency(currency);

export const isAdminImportCurrency = (value: string): value is TAdminImportCurrency =>
  (ADMIN_IMPORT_CURRENCIES as readonly string[]).includes(normCur(value));

export const getLocalCheckoutByNationality = (
  nationalityCode: string,
): TLocalCheckoutConfigEntry | null => {
  const nat = normNat(nationalityCode);
  return ENABLED_LOCAL_CHECKOUT_ENTRIES.find((e) => normNat(e.nationality) === nat) ?? null;
};

export const getLocalCheckoutByCurrency = (
  currency: string,
): TLocalCheckoutConfigEntry | null => {
  const cur = normCur(currency);
  return ENABLED_LOCAL_CHECKOUT_ENTRIES.find((e) => normCur(e.currency) === cur) ?? null;
};

export const getLocalCheckoutForSelection = (
  nationalityCode: string,
  selectedCurrency: string,
): TLocalCheckoutConfigEntry | null => {
  const entry = getLocalCheckoutByNationality(nationalityCode);
  if (!entry) return null;
  if (normCur(selectedCurrency) !== normCur(entry.currency)) return null;
  return entry;
};

export const formatLocalCheckoutCurrencyName = (currencyCode: string, locale = "en"): string => {
  const code = normCur(currencyCode);
  try {
    const dn = new Intl.DisplayNames([locale], { type: "currency" });
    const name = dn.of(code);
    if (name && name.toUpperCase() !== code) return name;
  } catch {
    /* Intl unavailable */
  }
  return code;
};

export const configuredLocalCheckoutCountrySummary = (): string =>
  ENABLED_LOCAL_CHECKOUT_ENTRIES.map((e) => `${e.nationality}/${e.currency}`).join(", ");