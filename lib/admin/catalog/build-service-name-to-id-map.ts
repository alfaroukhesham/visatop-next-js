import { sql } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type ServiceNameCandidate = {
  id: string;
  name: string;
  priceCount: number;
  lastPriceUpdate: Date | null;
  createdAt: Date;
};

/** Prefer the row admins have actually priced; stable tie-break when counts match. */
export function compareServiceNameCandidates(
  a: ServiceNameCandidate,
  b: ServiceNameCandidate,
): number {
  const priceDiff = (b.priceCount ?? 0) - (a.priceCount ?? 0);
  if (priceDiff !== 0) return priceDiff;

  const aTime = a.lastPriceUpdate?.getTime() ?? 0;
  const bTime = b.lastPriceUpdate?.getTime() ?? 0;
  if (bTime !== aTime) return bTime - aTime;

  return a.createdAt.getTime() - b.createdAt.getTime();
}

async function loadServiceNameCandidates(tx: DbTransaction): Promise<ServiceNameCandidate[]> {
  const rows = await tx
    .select({
      id: schema.visaService.id,
      name: schema.visaService.name,
      createdAt: schema.visaService.createdAt,
      priceCount: sql<number>`(
        SELECT count(*)::int
        FROM catalog_customer_price AS c
        WHERE c.service_id = ${schema.visaService.id}
      )`,
      lastPriceUpdate: sql<Date | null>`(
        SELECT max(updated_at)
        FROM catalog_customer_price AS c
        WHERE c.service_id = ${schema.visaService.id}
      )`,
    })
    .from(schema.visaService);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    priceCount: r.priceCount ?? 0,
    lastPriceUpdate: r.lastPriceUpdate ?? null,
    createdAt: r.createdAt,
  }));
}

/**
 * Map normalized service name → canonical visa_service id.
 * When duplicate names exist (e.g. repeated imports), prefer the row with the most
 * catalog_customer_price rows, then most recently updated, then oldest created.
 */
export async function buildServiceNameToIdMap(tx: DbTransaction): Promise<Map<string, string>> {
  const rows = await loadServiceNameCandidates(tx);
  rows.sort(compareServiceNameCandidates);

  const map = new Map<string, string>();
  for (const s of rows) {
    const norm = s.name.trim().toLowerCase();
    if (!map.has(norm)) {
      map.set(norm, s.id);
    }
  }
  return map;
}

/** Resolve canonical id for a normalized name, or null if no service exists. */
export async function findCanonicalServiceIdByNorm(
  tx: DbTransaction,
  normalizedName: string,
): Promise<string | null> {
  const norm = normalizedName.trim().toLowerCase();
  if (!norm) return null;

  const candidates = (await loadServiceNameCandidates(tx)).filter(
    (s) => s.name.trim().toLowerCase() === norm,
  );
  if (!candidates.length) return null;

  candidates.sort(compareServiceNameCandidates);
  return candidates[0]!.id;
}
