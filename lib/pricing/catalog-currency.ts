import { isIso4217CurrencyCode } from "@/lib/catalog/local-currency";
import { isConfiguredLocalCheckoutCurrency } from "@/lib/payments/local-checkout-config";

export type TUsdAedCurrency = "USD" | "AED";
/** Any ISO 4217 catalog currency, including data-driven local codes. */
export type TCatalogCurrency = string;

export const USD_AED_CURRENCIES = ["USD", "AED"] as const;

export const isUsdAedCurrency = (value: string): value is TUsdAedCurrency =>
  value === "USD" || value === "AED";

export const isCatalogCurrency = (value: string): value is TCatalogCurrency =>
  isIso4217CurrencyCode(value);

/** USD/AED for globals; configured local checkout currencies pass through; otherwise USD. */
export const parseQuoteCurrency = (raw: string | null | undefined): string => {
  const upper = raw?.trim().toUpperCase() ?? "";
  if (isUsdAedCurrency(upper)) return upper;
  if (isConfiguredLocalCheckoutCurrency(upper)) return upper;
  return "USD";
};

/** @deprecated Use parseQuoteCurrency when local checkout currencies may be selected. */
export const parseUsdAedCurrency = (raw: string | null | undefined): TUsdAedCurrency => {
  const q = parseQuoteCurrency(raw);
  return q === "AED" ? "AED" : "USD";
};