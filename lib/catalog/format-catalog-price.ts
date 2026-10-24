import { convertMinorBetweenUsdAed, parsePublicDisplayFxAedPerUsd } from "@/lib/catalog/display-price";

export type TCatalogPricedService = {
  id: string;
  displayPriceMinor: string | null;
  currency: string | null;
};

const displayCurrencyFormatters = new Map<string, Intl.NumberFormat>();

const displayCurrencyFormatter = (currency: string): Intl.NumberFormat => {
  let fmt = displayCurrencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    });
    displayCurrencyFormatters.set(currency, fmt);
  }
  return fmt;
};

export const catalogCurrencyTab = (currency: string | null | undefined): string =>
  currency?.trim().toUpperCase() || "USD";

export const formatDisplayMinor = (minor: string | null, currency: string | null): string | null => {
  if (minor === null || currency === null) return null;
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  try {
    return displayCurrencyFormatter(currency).format(n / 100);
  } catch {
    return `${(n / 100).toFixed(2)} ${currency}`;
  }
};

export const priceMinorForDisplay = (s: TCatalogPricedService, tab: string): bigint | null => {
  const minorStr = s.displayPriceMinor;
  const cur = s.currency;
  if (minorStr === null || cur === null) return null;
  const n = Number(minorStr);
  if (!Number.isFinite(n)) return null;
  const minor = BigInt(Math.trunc(n));
  if (cur === tab) return minor;
  if ((cur !== "USD" && cur !== "AED") || (tab !== "USD" && tab !== "AED")) return null;
  const fx = parsePublicDisplayFxAedPerUsd();
  if (!fx) return null;
  return convertMinorBetweenUsdAed(minor, cur, tab, fx);
};

export const formatPriceForDisplay = (
  s: TCatalogPricedService,
  tab: string,
): { text: string; isEstimate: boolean } | null => {
  const minor = priceMinorForDisplay(s, tab);
  if (minor === null) return null;
  const text = formatDisplayMinor(minor.toString(), tab);
  return text ? { text, isEstimate: s.currency !== tab } : null;
};

export const sumCatalogServicesTotalMinor = (
  services: TCatalogPricedService[],
  serviceIds: string[],
  tab: string,
): bigint | null => {
  let sum = BigInt(0);
  for (const id of serviceIds) {
    const service = services.find((row) => row.id === id);
    if (!service) return null;
    const minor = priceMinorForDisplay(service, tab);
    if (minor === null) return null;
    sum += minor;
  }
  return sum;
};
