import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { CatalogNationality, CatalogService } from "@/lib/admin/catalog/catalog-types";

export type CatalogPickerCandidates =
  | { kind: "nationality"; nationality: CatalogNationality; services: CatalogService[] }
  | { kind: "service"; service: CatalogService; nationalities: CatalogNationality[] };

/**
 * SSR loader for the eligibility picker pages. Returns the parent entity plus
 * the full list of candidate items that are NOT already linked to it.
 */
export async function loadCatalogPickerCandidates(
  tx: DbTransaction,
  input: { nationalityCode?: string; serviceId?: string },
): Promise<CatalogPickerCandidates | null> {
  if (input.nationalityCode) {
    const code = input.nationalityCode.trim().toUpperCase();
    const [nationality] = await tx
      .select({
        code: schema.nationality.code,
        name: schema.nationality.name,
        enabled: schema.nationality.enabled,
      })
      .from(schema.nationality)
      .where(eq(schema.nationality.code, code))
      .limit(1);
    if (!nationality) return null;

    const [services, linkedRows] = await Promise.all([
      tx
        .select({
          id: schema.visaService.id,
          name: schema.visaService.name,
          enabled: schema.visaService.enabled,
          durationDays: schema.visaService.durationDays,
          entries: schema.visaService.entries,
        })
        .from(schema.visaService)
        .orderBy(asc(schema.visaService.name)),
      tx
        .select({ serviceId: schema.visaServiceEligibility.serviceId })
        .from(schema.visaServiceEligibility)
        .where(eq(schema.visaServiceEligibility.nationalityCode, code)),
    ]);
    const linked = new Set(linkedRows.map((r) => r.serviceId));
    return {
      kind: "nationality",
      nationality,
      services: services.filter((s) => !linked.has(s.id)),
    };
  }

  if (input.serviceId) {
    const id = input.serviceId.trim();
    const [service] = await tx
      .select({
        id: schema.visaService.id,
        name: schema.visaService.name,
        enabled: schema.visaService.enabled,
        durationDays: schema.visaService.durationDays,
        entries: schema.visaService.entries,
      })
      .from(schema.visaService)
      .where(eq(schema.visaService.id, id))
      .limit(1);
    if (!service) return null;

    const [nationalities, linkedRows] = await Promise.all([
      tx
        .select({
          code: schema.nationality.code,
          name: schema.nationality.name,
          enabled: schema.nationality.enabled,
        })
        .from(schema.nationality)
        .orderBy(asc(schema.nationality.name)),
      tx
        .select({ nationalityCode: schema.visaServiceEligibility.nationalityCode })
        .from(schema.visaServiceEligibility)
        .where(eq(schema.visaServiceEligibility.serviceId, id)),
    ]);
    const linked = new Set(linkedRows.map((r) => r.nationalityCode));
    return {
      kind: "service",
      service,
      nationalities: nationalities.filter((n) => !linked.has(n.code)),
    };
  }

  return null;
}
