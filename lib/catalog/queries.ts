import { and, eq, exists } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { computeDisplayPriceMinor } from "@/lib/pricing/compute-display-price";
import {
  batchAddonLinesForServices,
  batchLatestReferencesForServices,
  batchMarginPoliciesForServices,
  pickEffectiveMarginPolicy,
  resolveCanonicalAffiliateSiteId,
} from "@/lib/pricing/resolve-catalog-pricing";

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
            .select({ x: schema.visaServiceEligibility.serviceId })
            .from(schema.visaServiceEligibility)
            .innerJoin(
              schema.visaService,
              eq(schema.visaService.id, schema.visaServiceEligibility.serviceId),
            )
            .where(
              and(
                eq(
                  schema.visaServiceEligibility.nationalityCode,
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

export async function listPublicServicesForNationality(
  tx: SchemaDb,
  nationalityCode: string,
  catalogCurrency: string = "USD",
): Promise<PublicServiceRow[]> {
  const services = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      durationDays: schema.visaService.durationDays,
      entries: schema.visaService.entries,
    })
    .from(schema.visaService)
    .innerJoin(
      schema.visaServiceEligibility,
      eq(schema.visaServiceEligibility.serviceId, schema.visaService.id),
    )
    .where(
      and(
        eq(schema.visaServiceEligibility.nationalityCode, nationalityCode),
        eq(schema.visaService.enabled, true),
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

  const siteId = await resolveCanonicalAffiliateSiteId(tx);
  if (!siteId) {
    return services.map((s) => ({
      id: s.id,
      name: s.name,
      durationDays: s.durationDays,
      entries: s.entries,
      displayPriceMinor: null,
      currency: null,
    }));
  }

  const serviceIds = services.map((s) => s.id);
  const currency = catalogCurrency.trim().toUpperCase() || "USD";
  const [refMap, marginRows, addonRows] = await Promise.all([
    batchLatestReferencesForServices(tx, siteId, serviceIds, currency),
    batchMarginPoliciesForServices(tx, serviceIds),
    batchAddonLinesForServices(tx, serviceIds),
  ]);

  const addonsByService = new Map<string, bigint[]>();
  for (const line of addonRows) {
    const ref = refMap.get(line.serviceId);
    if (!ref || line.currency !== ref.currency) continue;
    const arr = addonsByService.get(line.serviceId) ?? [];
    arr.push(line.amount);
    addonsByService.set(line.serviceId, arr);
  }

  return services.map((s) => {
    const latest = refMap.get(s.id);
    if (!latest) {
      return {
        id: s.id,
        name: s.name,
        durationDays: s.durationDays,
        entries: s.entries,
        displayPriceMinor: null,
        currency: null,
      };
    }
    const margin = pickEffectiveMarginPolicy(s.id, marginRows, currency);
    if (!margin || (margin.mode !== "percent" && margin.mode !== "fixed")) {
      return {
        id: s.id,
        name: s.name,
        durationDays: s.durationDays,
        entries: s.entries,
        displayPriceMinor: null,
        currency: null,
      };
    }
    if (margin.currency !== latest.currency) {
      return {
        id: s.id,
        name: s.name,
        durationDays: s.durationDays,
        entries: s.entries,
        displayPriceMinor: null,
        currency: null,
      };
    }
    const addonMinorUnits = addonsByService.get(s.id) ?? [];
    const { totalMinor } = computeDisplayPriceMinor({
      referenceMinor: latest.amountMinor,
      marginMode: margin.mode,
      marginValue: margin.value,
      addonMinorUnits,
      discountMinor: BigInt(0),
    });
    return {
      id: s.id,
      name: s.name,
      durationDays: s.durationDays,
      entries: s.entries,
      displayPriceMinor: totalMinor.toString(),
      currency: latest.currency,
    };
  });
}
