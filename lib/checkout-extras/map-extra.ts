import { formatMajorFromMinor } from "@/lib/admin/catalog/service-price-fx-fill";
import {
  CHECKOUT_CHARGE_BASIS,
  CHECKOUT_EXTRA_KEYS,
  type TCheckoutChargeBasis,
  type TCheckoutExtraKey,
} from "@/lib/db/schema/checkout-extra";
import type { TCheckoutExtraAdmin, TCheckoutExtraPriceAdmin } from "@/lib/checkout-extras/types";

export type TCheckoutExtraRow = {
  key: string;
  enabled: boolean;
  chargeBasis: string;
  baseCurrency: string;
  baseAmountMinor: number;
  labelI18n: unknown;
  descriptionI18n: unknown;
  promiseI18n: unknown;
  termsUrl: string | null;
  sortOrder: number;
};

const readLocaleMap = (value: unknown): Record<string, string> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw !== "string") continue;
    const text = raw.trim();
    if (!text) continue;
    out[key] = text;
  }
  return out;
};

const asChargeBasis = (value: string): TCheckoutChargeBasis =>
  (CHECKOUT_CHARGE_BASIS as readonly string[]).includes(value) ? (value as TCheckoutChargeBasis) : "per_traveller";

const asExtraKey = (value: string): TCheckoutExtraKey | null =>
  (CHECKOUT_EXTRA_KEYS as readonly string[]).includes(value) ? (value as TCheckoutExtraKey) : null;

const majorFromMinor = (amountMinor: number): string => formatMajorFromMinor(BigInt(amountMinor));

export const toCheckoutExtraAdmin = (
  row: TCheckoutExtraRow,
  prices: readonly { currency: string; amountMinor: number }[],
): TCheckoutExtraAdmin | null => {
  const key = asExtraKey(row.key);
  if (!key) return null;
  const mappedPrices: TCheckoutExtraPriceAdmin[] = [...prices]
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((price) => ({
      currency: price.currency,
      amountMinor: price.amountMinor,
      amountMajor: majorFromMinor(price.amountMinor),
    }));
  return {
    key,
    enabled: row.enabled,
    chargeBasis: asChargeBasis(row.chargeBasis),
    baseCurrency: row.baseCurrency,
    baseAmountMinor: row.baseAmountMinor,
    baseAmountMajor: majorFromMinor(row.baseAmountMinor),
    labels: readLocaleMap(row.labelI18n),
    descriptions: readLocaleMap(row.descriptionI18n),
    promise: key === "fast_track" ? readLocaleMap(row.promiseI18n) : null,
    termsUrl: row.termsUrl,
    sortOrder: row.sortOrder,
    prices: mappedPrices,
  };
};
