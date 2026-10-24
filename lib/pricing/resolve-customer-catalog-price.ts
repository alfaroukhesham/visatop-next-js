/**
 * Resolver: customer catalog price + checkout total.
 *
 * Replaces the old resolveAdminPricingBreakdown / resolveClientDisplayPrice path.
 * Reads from catalog_customer_price + env FX; no affiliate/margin tables.
 *
 * Add-ons decision (spec open product check):
 *   Per spec §1, the customer price in the sheet IS the exact customer total.
 *   Add-ons are NOT applied on top of catalog_customer_price in this resolver.
 *   This matches the spec's intent: "checkout uses the locked quote amount."
 *   Documented here so future devs understand the deliberate choice.
 *
 * Local currencies (e.g. NGN) are stored-only: never FX-derived from USD/AED
 * and never used to derive USD/AED.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  fxUsdToAed,
  fxAedToUsd,
  readFxRateString,
  type FxLeg,
} from "./fx-usd-aed";
import { isUsdAedCurrency, type TCatalogCurrency, type TUsdAedCurrency } from "./catalog-currency";

type SchemaDb = DbTransaction;

export type CustomerCatalogPriceRow = {
  currency: string;
  amountMinor: bigint;
  source: string;
};

export type TStoredCustomerPrices = Record<string, CustomerCatalogPriceRow>;

const toStoredRow = (r: {
  currency: string;
  amountMinor: number;
  source: string;
}): CustomerCatalogPriceRow => {
  if (!Number.isInteger(r.amountMinor)) {
    throw new Error(`catalog_customer_price.amount_minor must be an integer (got ${r.amountMinor})`);
  }
  return {
    currency: r.currency,
    amountMinor: BigInt(r.amountMinor),
    source: r.source,
  };
};

/**
 * Load stored currency rows for a (nationality, service) pair.
 */
const loadStoredPrices = async (
  tx: SchemaDb,
  nationalityCode: string,
  serviceId: string,
): Promise<TStoredCustomerPrices> => {
  const rows = await tx
    .select({
      currency: schema.catalogCustomerPrice.currency,
      amountMinor: schema.catalogCustomerPrice.amountMinor,
      source: schema.catalogCustomerPrice.source,
    })
    .from(schema.catalogCustomerPrice)
    .where(
      and(
        eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
        eq(schema.catalogCustomerPrice.serviceId, serviceId),
      ),
    );

  const result: TStoredCustomerPrices = {};
  for (const r of rows) {
    result[r.currency] = toStoredRow(r);
  }
  return result;
};

export type CheckoutTotal = {
  /** Amount in minor units for the requested currency. */
  displayMinor: bigint;
  currency: TCatalogCurrency;
  /**
   * FX rate snapshot if this amount was derived via conversion at resolve time.
   * null if the amount came directly from a stored row.
   */
  fxRateUsed: string | null;
  /** Which direction the FX conversion was (if any). */
  fxLeg: FxLeg;
  /** Source of the primary stored row. */
  source: string;
  /** Whether this specific amount was FX-derived at resolve time (not stored). */
  wasFxDerived: boolean;
};

const storedOnlyTotal = (
  row: CustomerCatalogPriceRow,
  currency: TCatalogCurrency,
): CheckoutTotal => ({
  displayMinor: row.amountMinor,
  currency,
  fxRateUsed: null,
  fxLeg: null,
  source: row.source,
  wasFxDerived: false,
});

/**
 * Resolve checkout total for a given (nationality, service, currency).
 *
 * Currency resolution per spec §4 (USD/AED):
 *   Both stored  → use directly, no conversion
 *   USD only     → USD from row; AED = fx(USD → AED)
 *   AED only     → AED from row; USD = fx(AED → USD)
 *   Neither      → not offered; returns null
 *
 * Local currencies: stored row required; never FX-derived.
 *
 * Add-ons: NOT applied (see module JSDoc above).
 */
export const resolveCheckoutTotal = async (
  tx: SchemaDb,
  params: {
    nationalityCode: string;
    serviceId: string;
    catalogCurrency: TCatalogCurrency;
  },
): Promise<CheckoutTotal | null> => {
  const { nationalityCode, serviceId, catalogCurrency } = params;
  const stored = await loadStoredPrices(tx, nationalityCode, serviceId);

  if (!isUsdAedCurrency(catalogCurrency)) {
    const row = stored[catalogCurrency];
    if (!row) return null;
    return storedOnlyTotal(row, catalogCurrency);
  }

  if (!stored.USD && !stored.AED) return null;

  if (stored[catalogCurrency]) {
    return storedOnlyTotal(stored[catalogCurrency]!, catalogCurrency);
  }

  const fxRate = readFxRateString();

  if (catalogCurrency === "AED" && stored.USD) {
    const aedMinor = fxUsdToAed(stored.USD.amountMinor, fxRate);
    return {
      displayMinor: aedMinor,
      currency: "AED",
      fxRateUsed: fxRate,
      fxLeg: "aed_from_usd",
      source: stored.USD.source,
      wasFxDerived: true,
    };
  }

  if (catalogCurrency === "USD" && stored.AED) {
    const usdMinor = fxAedToUsd(stored.AED.amountMinor, fxRate);
    return {
      displayMinor: usdMinor,
      currency: "USD",
      fxRateUsed: fxRate,
      fxLeg: "usd_from_aed",
      source: stored.AED.source,
      wasFxDerived: true,
    };
  }

  return null;
};

/**
 * Batch load customer prices for multiple services for a given nationality.
 * Used by the catalog listing query.
 */
export const batchCustomerPricesForServices = async (
  tx: SchemaDb,
  nationalityCode: string,
  serviceIds: string[],
): Promise<Map<string, TStoredCustomerPrices>> => {
  const map = new Map<string, TStoredCustomerPrices>();

  if (!serviceIds.length) return map;

  const rows = await tx
    .select({
      serviceId: schema.catalogCustomerPrice.serviceId,
      currency: schema.catalogCustomerPrice.currency,
      amountMinor: schema.catalogCustomerPrice.amountMinor,
      source: schema.catalogCustomerPrice.source,
    })
    .from(schema.catalogCustomerPrice)
    .where(
      and(
        eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
        inArray(schema.catalogCustomerPrice.serviceId, serviceIds),
      ),
    );

  for (const r of rows) {
    const existing = map.get(r.serviceId) ?? {};
    existing[r.currency] = toStoredRow(r);
    map.set(r.serviceId, existing);
  }

  return map;
};

/**
 * Resolve catalog display price for a service given stored prices + FX rules.
 * Pure function (no DB call — takes pre-loaded price map entry).
 *
 * Local currencies are stored-only (never FX).
 */
export const resolveDisplayPrice = (
  priceEntry: TStoredCustomerPrices | undefined,
  catalogCurrency: string,
  fxRate: string | null,
): { displayMinor: bigint; currency: string; wasFxDerived: boolean } | null => {
  if (!priceEntry) return null;

  if (!isUsdAedCurrency(catalogCurrency)) {
    const row = priceEntry[catalogCurrency];
    if (!row) return null;
    return {
      displayMinor: row.amountMinor,
      currency: catalogCurrency,
      wasFxDerived: false,
    };
  }

  if (!priceEntry.USD && !priceEntry.AED) return null;

  if (priceEntry[catalogCurrency]) {
    return {
      displayMinor: priceEntry[catalogCurrency]!.amountMinor,
      currency: catalogCurrency,
      wasFxDerived: false,
    };
  }

  if (!fxRate) return null;

  if (catalogCurrency === "AED" && priceEntry.USD) {
    return {
      displayMinor: fxUsdToAed(priceEntry.USD.amountMinor, fxRate),
      currency: "AED",
      wasFxDerived: true,
    };
  }

  if (catalogCurrency === "USD" && priceEntry.AED) {
    return {
      displayMinor: fxAedToUsd(priceEntry.AED.amountMinor, fxRate),
      currency: "USD",
      wasFxDerived: true,
    };
  }

  return null;
};

export type { TUsdAedCurrency };
