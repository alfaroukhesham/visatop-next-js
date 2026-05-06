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

type SchemaDb = DbTransaction;

export type CustomerCatalogPriceRow = {
  currency: string;
  amountMinor: bigint;
  source: string;
};

/**
 * Load both stored currency rows for a (nationality, service) pair.
 * Returns a map: { USD?: row, AED?: row }
 */
async function loadStoredPrices(
  tx: SchemaDb,
  nationalityCode: string,
  serviceId: string,
): Promise<{ USD?: CustomerCatalogPriceRow; AED?: CustomerCatalogPriceRow }> {
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

  const result: { USD?: CustomerCatalogPriceRow; AED?: CustomerCatalogPriceRow } = {};
  for (const r of rows) {
    if (r.currency === "USD" || r.currency === "AED") {
      result[r.currency] = {
        currency: r.currency,
        amountMinor: r.amountMinor,
        source: r.source,
      };
    }
  }
  return result;
}

export type CheckoutTotal = {
  /** Amount in minor units for the requested currency. */
  displayMinor: bigint;
  currency: "USD" | "AED";
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

/**
 * Resolve checkout total for a given (nationality, service, currency).
 *
 * Currency resolution per spec §4:
 *   Both stored  → use directly, no conversion
 *   USD only     → USD from row; AED = fx(USD → AED)
 *   AED only     → AED from row; USD = fx(AED → USD)
 *   Neither      → not offered; returns null
 *
 * Add-ons: NOT applied (see module JSDoc above).
 */
export async function resolveCheckoutTotal(
  tx: SchemaDb,
  params: {
    nationalityCode: string;
    serviceId: string;
    catalogCurrency: "USD" | "AED";
  },
): Promise<CheckoutTotal | null> {
  const { nationalityCode, serviceId, catalogCurrency } = params;
  const stored = await loadStoredPrices(tx, nationalityCode, serviceId);

  // Neither currency stored → not offered
  if (!stored.USD && !stored.AED) return null;

  // Direct row exists for requested currency
  if (stored[catalogCurrency]) {
    const row = stored[catalogCurrency]!;
    return {
      displayMinor: row.amountMinor,
      currency: catalogCurrency,
      fxRateUsed: null,
      fxLeg: null,
      source: row.source,
      wasFxDerived: false,
    };
  }

  // Need FX conversion
  // FX is read lazily only when conversion is needed.
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
}

/**
 * Batch load customer prices for multiple services for a given nationality.
 * Used by the catalog listing query.
 *
 * Returns a map: serviceId → { USD?, AED? }
 */
export async function batchCustomerPricesForServices(
  tx: SchemaDb,
  nationalityCode: string,
  serviceIds: string[],
): Promise<
  Map<string, { USD?: CustomerCatalogPriceRow; AED?: CustomerCatalogPriceRow }>
> {
  const map = new Map<
    string,
    { USD?: CustomerCatalogPriceRow; AED?: CustomerCatalogPriceRow }
  >();

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
    if (r.currency === "USD" || r.currency === "AED") {
      existing[r.currency] = {
        currency: r.currency,
        amountMinor: r.amountMinor,
        source: r.source,
      };
    }
    map.set(r.serviceId, existing);
  }

  return map;
}

/**
 * Resolve catalog display price for a service given stored prices + FX rules.
 * Pure function (no DB call — takes pre-loaded price map entry).
 */
export function resolveDisplayPrice(
  priceEntry: { USD?: CustomerCatalogPriceRow; AED?: CustomerCatalogPriceRow } | undefined,
  catalogCurrency: "USD" | "AED",
  fxRate: string | null,
): { displayMinor: bigint; currency: "USD" | "AED"; wasFxDerived: boolean } | null {
  if (!priceEntry) return null;
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
}
