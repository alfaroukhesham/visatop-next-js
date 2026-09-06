import { asc, count, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export type TDocumentRequirementCountry = {
  code: string;
  name: string;
  serviceCount: number;
};

export const listCatalogDocumentRequirementCountries = async (
  tx: DbTransaction,
  documentType: string,
): Promise<TDocumentRequirementCountry[]> => {
  const rows = await tx
    .select({
      code: schema.nationality.code,
      name: schema.nationality.name,
      serviceCount: count(),
    })
    .from(schema.catalogDocumentRequirement)
    .innerJoin(
      schema.nationality,
      eq(schema.nationality.code, schema.catalogDocumentRequirement.nationalityCode),
    )
    .where(eq(schema.catalogDocumentRequirement.documentType, documentType))
    .groupBy(schema.nationality.code, schema.nationality.name)
    .orderBy(asc(schema.nationality.name));

  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    serviceCount: Number(row.serviceCount),
  }));
};
