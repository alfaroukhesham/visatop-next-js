import { inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type OrphanCatalogCleanupResult = {
  eligibilityRemoved: number;
  duplicateServicesRemoved: number;
  unusedServicesRemoved: number;
};

/**
 * Remove catalog rows that confuse admin pricing UI:
 * - Eligibility without any customer price for that nationality×service
 * - Duplicate visa_service rows (same name) with no prices while another row has prices
 * - visa_service with no prices, eligibility, applications, or pending import rows
 */
export async function cleanupOrphanCatalogData(
  tx: DbTransaction,
): Promise<OrphanCatalogCleanupResult> {
  const eligibilityRemoved = await removeEligibilityWithoutPrices(tx);
  const duplicateServicesRemoved = await removeDuplicateEmptyServices(tx);
  const unusedServicesRemoved = await removeUnusedEmptyServices(tx);

  return {
    eligibilityRemoved,
    duplicateServicesRemoved,
    unusedServicesRemoved,
  };
}

async function removeEligibilityWithoutPrices(tx: DbTransaction): Promise<number> {
  const deleted = await tx
    .delete(schema.visaServiceEligibility)
    .where(
      sql`NOT EXISTS (
        SELECT 1 FROM catalog_customer_price AS c
        WHERE c.service_id = ${schema.visaServiceEligibility.serviceId}
          AND c.nationality_code = ${schema.visaServiceEligibility.nationalityCode}
      )`,
    )
    .returning({ serviceId: schema.visaServiceEligibility.serviceId });
  return deleted.length;
}

async function removeDuplicateEmptyServices(tx: DbTransaction): Promise<number> {
  const candidates = await tx.execute(sql`
    SELECT v.id
    FROM visa_service AS v
    WHERE NOT EXISTS (
      SELECT 1 FROM catalog_customer_price AS c WHERE c.service_id = v.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM application AS a WHERE a.service_id = v.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM catalog_customer_price_pending AS p WHERE p.service_id = v.id
    )
    AND EXISTS (
      SELECT 1
      FROM visa_service AS v2
      INNER JOIN catalog_customer_price AS c2 ON c2.service_id = v2.id
      WHERE lower(trim(v2.name)) = lower(trim(v.name))
        AND v2.id <> v.id
    )
  `);

  const ids = rowsFromExecute(candidates).map((r) => String(r.id));
  if (!ids.length) return 0;

  const deleted = await tx
    .delete(schema.visaService)
    .where(inArray(schema.visaService.id, ids))
    .returning({ id: schema.visaService.id });
  return deleted.length;
}

async function removeUnusedEmptyServices(tx: DbTransaction): Promise<number> {
  const deleted = await tx
    .delete(schema.visaService)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM catalog_customer_price AS c WHERE c.service_id = ${schema.visaService.id})
      AND NOT EXISTS (SELECT 1 FROM visa_service_eligibility AS e WHERE e.service_id = ${schema.visaService.id})
      AND NOT EXISTS (SELECT 1 FROM application AS a WHERE a.service_id = ${schema.visaService.id})
      AND NOT EXISTS (SELECT 1 FROM catalog_customer_price_pending AS p WHERE p.service_id = ${schema.visaService.id})`,
    )
    .returning({ id: schema.visaService.id });
  return deleted.length;
}

function rowsFromExecute(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}
