import { and, asc, count, eq, type SQL } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type ListCatalogDocumentRequirementsParams = {
  limit: number;
  offset: number;
  nationalityCode?: string;
  serviceId?: string;
  documentType?: string;
};

export type CatalogDocumentRequirementItem = {
  id: string;
  nationalityCode: string;
  serviceId: string;
  serviceName: string;
  documentType: string;
  role: string;
};

export type ListCatalogDocumentRequirementsResult = {
  items: CatalogDocumentRequirementItem[];
  total: number;
};

function filters(params: ListCatalogDocumentRequirementsParams): SQL | undefined {
  const parts: SQL[] = [];
  if (params.nationalityCode) {
    parts.push(eq(schema.catalogDocumentRequirement.nationalityCode, params.nationalityCode));
  }
  if (params.serviceId) {
    parts.push(eq(schema.catalogDocumentRequirement.serviceId, params.serviceId));
  }
  if (params.documentType) {
    parts.push(eq(schema.catalogDocumentRequirement.documentType, params.documentType));
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return and(...parts);
}

export async function listCatalogDocumentRequirements(
  tx: DbTransaction,
  params: ListCatalogDocumentRequirementsParams,
): Promise<ListCatalogDocumentRequirementsResult> {
  const where = filters(params);

  let itemsQuery = tx
    .select({
      id: schema.catalogDocumentRequirement.id,
      nationalityCode: schema.catalogDocumentRequirement.nationalityCode,
      serviceId: schema.catalogDocumentRequirement.serviceId,
      serviceName: schema.visaService.name,
      documentType: schema.catalogDocumentRequirement.documentType,
      role: schema.catalogDocumentRequirement.role,
    })
    .from(schema.catalogDocumentRequirement)
    .innerJoin(
      schema.visaService,
      eq(schema.visaService.id, schema.catalogDocumentRequirement.serviceId),
    );
  if (where) itemsQuery = itemsQuery.where(where) as typeof itemsQuery;

  let countQuery = tx
    .select({ total: count() })
    .from(schema.catalogDocumentRequirement)
    .innerJoin(
      schema.visaService,
      eq(schema.visaService.id, schema.catalogDocumentRequirement.serviceId),
    );
  if (where) countQuery = countQuery.where(where) as typeof countQuery;

  const [items, countRows] = await Promise.all([
    itemsQuery
      .orderBy(
        asc(schema.catalogDocumentRequirement.nationalityCode),
        asc(schema.visaService.name),
        asc(schema.catalogDocumentRequirement.documentType),
      )
      .limit(params.limit)
      .offset(params.offset),
    countQuery,
  ]);

  return { items, total: Number(countRows[0]?.total ?? 0) };
}
