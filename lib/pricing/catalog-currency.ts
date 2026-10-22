import { isIso4217CurrencyCode } from "@/lib/catalog/local-currency";

export type TUsdAedCurrency = "USD" | "AED";
/** Any ISO 4217 catalog currency, including data-driven local codes. */
export type TCatalogCurrency = string;

export const USD_AED_CURRENCIES = ["USD", "AED"] as const;
export const FINCRA_CURRENCY = "NGN";

export const isUsdAedCurrency = (value: string): value is TUsdAedCurrency =>
  value === "USD" || value === "AED";

export const isCatalogCurrency = (value: string): value is TCatalogCurrency =>
  isIso4217CurrencyCode(value);

export const parseUsdAedCurrency = (raw: string | null | undefined): TUsdAedCurrency =>
  raw?.trim().toUpperCase() === "AED" ? "AED" : "USD";
