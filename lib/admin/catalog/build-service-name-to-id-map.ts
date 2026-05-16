import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * Map normalized service name → visa_service id.
 * When duplicate names exist (e.g. repeated imports), prefer the row with the most
 * catalog_customer_price rows so new writes attach to the canonical service.
 */
export async function buildServiceNameToIdMap(tx: DbTransaction): Promise<Map<string, string>> {
  const rows = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      priceCount: sql<number>`(
        SELECT count(*)::int
        FROM catalog_customer_price AS c
        WHERE c.service_id = ${schema.visaService.id}
      )`,
    })
    .from(schema.visaService);

  rows.sort((a, b) => (b.priceCount ?? 0) - (a.priceCount ?? 0));

  const map = new Map<string, string>();
  for (const s of rows) {
    const norm = s.name.trim().toLowerCase();
    if (!map.has(norm)) {
      map.set(norm, s.id);
    }
  }
  return map;
}
