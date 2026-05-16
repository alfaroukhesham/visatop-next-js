import { asc, eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  batchCustomerPricesForServices,
  resolveDisplayPrice,
} from "@/lib/pricing/resolve-customer-catalog-price";
import { readFxRateString, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";

export type NationalityPricingRow = {
  serviceId: string;
  serviceName: string;
  enabled: boolean;
  durationDays: number | null;
  entries: string | null;
  storedUsdMinor: string | null;
  storedAedMinor: string | null;
  displayUsdMinor: string | null;
  displayAedMinor: string | null;
  displayUsdFxDerived: boolean;
  displayAedFxDerived: boolean;
  hasEligibility: boolean;
};

export async function listNationalityPricingRows(
  tx: DbTransaction,
  nationalityCode: string,
): Promise<NationalityPricingRow[]> {
  const natRows = await tx
    .select({ code: schema.nationality.code })
    .from(schema.nationality)
    .where(eq(schema.nationality.code, nationalityCode))
    .limit(1);
  if (!natRows[0]) return [];

  const pricedServiceIds = await tx
    .selectDistinct({ serviceId: schema.catalogCustomerPrice.serviceId })
    .from(schema.catalogCustomerPrice)
    .where(eq(schema.catalogCustomerPrice.nationalityCode, nationalityCode));

  const serviceIds = pricedServiceIds.map((r) => r.serviceId);
  if (!serviceIds.length) return [];

  const services = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      enabled: schema.visaService.enabled,
      durationDays: schema.visaService.durationDays,
      entries: schema.visaService.entries,
    })
    .from(schema.visaService)
    .where(inArray(schema.visaService.id, serviceIds))
    .orderBy(asc(schema.visaService.name));

  const priceMap = await batchCustomerPricesForServices(tx, nationalityCode, serviceIds);

  const eligibilityRows = await tx
    .select({ serviceId: schema.visaServiceEligibility.serviceId })
    .from(schema.visaServiceEligibility)
    .where(eq(schema.visaServiceEligibility.nationalityCode, nationalityCode));
  const eligibleIds = new Set(eligibilityRows.map((r) => r.serviceId));

  let fxRate: string | null = null;
  try {
    fxRate = readFxRateString();
  } catch (e) {
    if (!(e instanceof FxRateMissingError)) throw e;
  }

  return services
    .map((s) => {
      const entry = priceMap.get(s.id);
      const usdResolved = resolveDisplayPrice(entry, "USD", fxRate);
      const aedResolved = resolveDisplayPrice(entry, "AED", fxRate);
      if (!usdResolved && !aedResolved) return null;

      return {
        serviceId: s.id,
        serviceName: s.name,
        enabled: s.enabled,
        durationDays: s.durationDays,
        entries: s.entries,
        storedUsdMinor: entry?.USD ? entry.USD.amountMinor.toString() : null,
        storedAedMinor: entry?.AED ? entry.AED.amountMinor.toString() : null,
        displayUsdMinor: usdResolved ? usdResolved.displayMinor.toString() : null,
        displayAedMinor: aedResolved ? aedResolved.displayMinor.toString() : null,
        displayUsdFxDerived: usdResolved?.wasFxDerived ?? false,
        displayAedFxDerived: aedResolved?.wasFxDerived ?? false,
        hasEligibility: eligibleIds.has(s.id),
      };
    })
    .filter((row): row is NationalityPricingRow => row !== null);
}
