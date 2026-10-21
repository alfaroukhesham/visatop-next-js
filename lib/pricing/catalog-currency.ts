export type TUsdAedCurrency = "USD" | "AED";
export type TCatalogCurrency = TUsdAedCurrency | "NGN";

export const USD_AED_CURRENCIES = ["USD", "AED"] as const;
export const CATALOG_CURRENCIES = ["USD", "AED", "NGN"] as const;

export const isUsdAedCurrency = (value: string): value is TUsdAedCurrency =>
  value === "USD" || value === "AED";

export const isCatalogCurrency = (value: string): value is TCatalogCurrency =>
  value === "USD" || value === "AED" || value === "NGN";

export const parseUsdAedCurrency = (raw: string | null | undefined): TUsdAedCurrency =>
  raw?.trim().toUpperCase() === "AED" ? "AED" : "USD";
