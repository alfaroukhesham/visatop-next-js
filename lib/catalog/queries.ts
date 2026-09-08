import { and, eq, exists, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  batchCustomerPricesForServices,
  resolveDisplayPrice,
} from "@/lib/pricing/resolve-customer-catalog-price";
import { readFxRateString, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";
import {
  ENTRY_KINDS,
  STAY_BUCKETS,
  TRAVELER_KINDS,
  type TEntryKind,
  type TStayBucket,
  type TTravelerKind,
} from "@/lib/catalog/guided-choice";

/** Matches `withSystemDbActor` / `withAdminDbActor` transaction handle typing. */
type SchemaDb = DbTransaction;

export type PublicNationalityRow = {
  code: string;
  name: string;
  dialCode: string | null;
};

export async function listPublicNationalities(
  tx: SchemaDb,
): Promise<PublicNationalityRow[]> {
  return tx
    .select({
      code: schema.nationality.code,
      name: schema.nationality.name,
      dialCode: schema.nationality.dialCode,
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
  documentTypes: Array<{ key: string; role: "required" | "additional" }>;
  stayBucket: TStayBucket | null;
  entryKind: TEntryKind;
  travelerKind: TTravelerKind;
  showInGuidedChooser: boolean;
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
      stayBucket: schema.visaService.stayBucket,
      entryKind: schema.visaService.entryKind,
      travelerKind: schema.visaService.travelerKind,
      showInGuidedChooser: schema.visaService.showInGuidedChooser,
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

  const requirementRows = await tx
    .select({
      serviceId: schema.catalogDocumentRequirement.serviceId,
      documentType: schema.catalogDocumentRequirement.documentType,
      role: schema.catalogDocumentRequirement.role,
    })
    .from(schema.catalogDocumentRequirement)
    .where(
      and(
        eq(schema.catalogDocumentRequirement.nationalityCode, nationalityCode),
        inArray(schema.catalogDocumentRequirement.serviceId, serviceIds),
      ),
    );
  const requirementsByService = new Map<string, Array<{ key: string; role: "required" | "additional" }>>();
  for (const row of requirementRows) {
    const list = requirementsByService.get(row.serviceId) ?? [];
    list.push({ key: row.documentType, role: row.role as "required" | "additional" });
    requirementsByService.set(row.serviceId, list);
  }

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

    const stayBucket = STAY_BUCKETS.includes(s.stayBucket as TStayBucket)
      ? (s.stayBucket as TStayBucket)
      : null;
    const entryKind = ENTRY_KINDS.includes(s.entryKind as TEntryKind)
      ? (s.entryKind as TEntryKind)
      : "either";
    const travelerKind = TRAVELER_KINDS.includes(s.travelerKind as TTravelerKind)
      ? (s.travelerKind as TTravelerKind)
      : "adult";
    const showInGuidedChooser = s.showInGuidedChooser ?? true;

    return {
      id: s.id,
      name: s.name,
      durationDays: s.durationDays,
      entries: s.entries,
      displayPriceMinor: resolved ? resolved.displayMinor.toString() : null,
      currency: resolved ? resolved.currency : null,
      documentTypes: requirementsByService.get(s.id) ?? [],
      stayBucket,
      entryKind,
      travelerKind,
      showInGuidedChooser,
    };
  });
}
