import { and, asc, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { CatalogEligibility } from "@/lib/admin/catalog/catalog-types";

export type ListCatalogEligibilityParams = {
  limit: number;
  offset: number;
  serviceId?: string;
  nationalityCode?: string;
  /** Case-insensitive match on service name, service id, or nationality code. */
  q?: string;
};

export type ListCatalogEligibilityResult = {
  items: CatalogEligibility[];
  total: number;
};

function eligibilityFilters(params: ListCatalogEligibilityParams): SQL | undefined {
  const parts: SQL[] = [];
  if (params.serviceId) {
    parts.push(eq(schema.visaServiceEligibility.serviceId, params.serviceId));
  }
  if (params.nationalityCode) {
    parts.push(eq(schema.visaServiceEligibility.nationalityCode, params.nationalityCode));
  }
  const q = params.q?.trim();
  if (q) {
    const term = `%${q}%`;
    parts.push(
      or(
        ilike(schema.visaService.name, term),
        ilike(schema.visaServiceEligibility.nationalityCode, term),
        ilike(schema.visaService.id, term),
      )!,
    );
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listCatalogEligibility(
  tx: DbTransaction,
  params: ListCatalogEligibilityParams,
): Promise<ListCatalogEligibilityResult> {
  const where = eligibilityFilters(params);

  let itemsQuery = tx
    .select({
      serviceId: schema.visaServiceEligibility.serviceId,
      nationalityCode: schema.visaServiceEligibility.nationalityCode,
      serviceName: schema.visaService.name,
    })
    .from(schema.visaServiceEligibility)
    .innerJoin(
      schema.visaService,
      eq(schema.visaService.id, schema.visaServiceEligibility.serviceId),
    );
  if (where) itemsQuery = itemsQuery.where(where) as typeof itemsQuery;

  let countQuery = tx
    .select({ total: count() })
    .from(schema.visaServiceEligibility)
    .innerJoin(
      schema.visaService,
      eq(schema.visaService.id, schema.visaServiceEligibility.serviceId),
    );
  if (where) countQuery = countQuery.where(where) as typeof countQuery;

  const [items, countRows] = await Promise.all([
    itemsQuery
      .orderBy(asc(schema.visaService.name), asc(schema.visaServiceEligibility.nationalityCode))
      .limit(params.limit)
      .offset(params.offset),
    countQuery,
  ]);

  return { items, total: Number(countRows[0]?.total ?? 0) };
}
