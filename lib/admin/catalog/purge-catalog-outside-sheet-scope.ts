import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type ImportCatalogScope = "merge" | "replace";

function natSvcIdKey(nationalityCode: string, serviceId: string): string {
  return `${nationalityCode}\x1f${serviceId}`;
}

/**
 * Replace-mode purge: sheet is the catalog source of truth.
 * - Removes prices for nationalities not listed in the sheet
 * - For sheet nationalities, removes prices for services not in the sheet header
 * - Clears stale pending rows from prior imports
 *
 * Empty cells within the sheet matrix are handled separately (per-cell disable).
 */
export async function purgeCatalogOutsideSheetScope(
  tx: DbTransaction,
  input: {
    sheetNationalities: ReadonlySet<string>;
    sheetServiceIds: ReadonlySet<string>;
    clearStalePending: boolean;
  },
): Promise<{ deletedPrices: number; purgedPairKeys: string[] }> {
  const purgedPairKeys: string[] = [];
  let deletedPrices = 0;

  if (input.clearStalePending) {
    await tx.delete(schema.catalogCustomerPricePending);
  }

  const nats = [...input.sheetNationalities];
  if (!nats.length) {
    return { deletedPrices: 0, purgedPairKeys: [] };
  }

  const natIn = sql.join(nats.map((n) => sql`${n}`), sql`, `);

  const delOtherNationalities = await tx
    .delete(schema.catalogCustomerPrice)
    .where(sql`nationality_code NOT IN (${natIn})`)
    .returning({
      nationalityCode: schema.catalogCustomerPrice.nationalityCode,
      serviceId: schema.catalogCustomerPrice.serviceId,
    });
  deletedPrices += delOtherNationalities.length;
  for (const row of delOtherNationalities) {
    purgedPairKeys.push(natSvcIdKey(row.nationalityCode, row.serviceId));
  }

  const svcIds = [...input.sheetServiceIds];
  if (svcIds.length > 0) {
    const svcIn = sql.join(svcIds.map((id) => sql`${id}`), sql`, `);
    const delOtherServices = await tx
      .delete(schema.catalogCustomerPrice)
      .where(sql`nationality_code IN (${natIn}) AND service_id NOT IN (${svcIn})`)
      .returning({
        nationalityCode: schema.catalogCustomerPrice.nationalityCode,
        serviceId: schema.catalogCustomerPrice.serviceId,
      });
    deletedPrices += delOtherServices.length;
    for (const row of delOtherServices) {
      purgedPairKeys.push(natSvcIdKey(row.nationalityCode, row.serviceId));
    }
  }

  return { deletedPrices, purgedPairKeys };
}

export { natSvcIdKey as importNatSvcIdKey };
