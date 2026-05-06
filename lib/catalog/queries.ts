import { and, eq, exists } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  batchCustomerPricesForServices,
  resolveDisplayPrice,
} from "@/lib/pricing/resolve-customer-catalog-price";
import { readFxRateString, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";

/** Matches `withSystemDbActor` / `withAdminDbActor` transaction handle typing. */
type SchemaDb = DbTransaction;

export type PublicNationalityRow = {
  code: string;
  name: string;
};

export async function listPublicNationalities(
  tx: SchemaDb,
): Promise<PublicNationalityRow[]> {
  return tx
    .select({
      code: schema.nationality.code,
      name: schema.nationality.name,
    })
    .from(schema.nationality)
    .where(
      and(
        eq(schema.nationality.enabled, true),
        exists(
          tx
            .select({ x: schema.catalogCustomerPrice.serviceId })
            .from(schema.catalogCustomerPrice)
            .innerJoin(
              schema.visaService,
              eq(schema.visaService.id, schema.catalogCustomerPrice.serviceId),
            )
            .where(
              and(
                eq(
                  schema.catalogCustomerPrice.nationalityCode,
                  schema.nationality.code,
                ),
                eq(schema.visaService.enabled, true),
              ),
            ),
        ),
      ),
    )
    .orderBy(schema.nationality.name);
}

export type PublicServiceRow = {
  id: string;
  name: string;
  durationDays: number | null;
  entries: string | null;
  displayPriceMinor: string | null;
  currency: string | null;
};

/**
 * List services offered to a nationality, with customer prices resolved via
 * catalog_customer_price + env FX (§4 rules).
 *
 * NOTE: Add-ons are NOT applied here per spec §1 decision:
 *   "checkout uses the locked quote amount [from the sheet]."
 *   The catalog_customer_price IS the exact customer total.
 */
export async function listPublicServicesForNationality(
  tx: SchemaDb,
  nationalityCode: string,
  catalogCurrency: string = "USD",
): Promise<PublicServiceRow[]> {
  const currency =
    catalogCurrency.trim().toUpperCase() === "AED" ? "AED" : "USD";

  // Services offered to this nationality: those with ≥1 published price row
  const services = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      durationDays: schema.visaService.durationDays,
      entries: schema.visaService.entries,
    })
    .from(schema.visaService)
    .where(
      and(
        eq(schema.visaService.enabled, true),
        exists(
          tx
            .select({ x: schema.catalogCustomerPrice.serviceId })
            .from(schema.catalogCustomerPrice)
            .where(
              and(
                eq(schema.catalogCustomerPrice.serviceId, schema.visaService.id),
                eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode),
              ),
            ),
        ),
        exists(
          tx
            .select({ x: schema.nationality.code })
            .from(schema.nationality)
            .where(
              and(
                eq(schema.nationality.code, nationalityCode),
                eq(schema.nationality.enabled, true),
              ),
            ),
        ),
      ),
    )
    .orderBy(schema.visaService.name);

  if (!services.length) return [];

  const serviceIds = services.map((s) => s.id);
  const priceMap = await batchCustomerPricesForServices(
    tx,
    nationalityCode,
    serviceIds,
  );

  // Read FX rate; if missing, still return direct-currency prices.
  let fxRate: string | null = null;
  try {
    fxRate = readFxRateString();
  } catch (e) {
    if (!(e instanceof FxRateMissingError)) throw e;
    // FX missing — only prices that need conversion will show null
  }

  return services.map((s) => {
    const priceEntry = priceMap.get(s.id);
    const resolved = resolveDisplayPrice(priceEntry, currency, fxRate);

    return {
      id: s.id,
      name: s.name,
      durationDays: s.durationDays,
      entries: s.entries,
      displayPriceMinor: resolved ? resolved.displayMinor.toString() : null,
      currency: resolved ? resolved.currency : null,
    };
  });
}
