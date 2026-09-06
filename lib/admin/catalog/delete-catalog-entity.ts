import { count, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export class CatalogEntityNotFoundError extends Error {
  readonly code = "CATALOG_ENTITY_NOT_FOUND" as const;
  constructor(message = "Not found") {
    super(message);
    this.name = "CatalogEntityNotFoundError";
  }
}

export class CatalogDeleteBlockedError extends Error {
  readonly code = "CATALOG_DELETE_BLOCKED" as const;
  constructor(
    message = "This item is used on applications. Disable it instead of deleting.",
  ) {
    super(message);
    this.name = "CatalogDeleteBlockedError";
  }
}

const countApplications = async (
  tx: DbTransaction,
  where: ReturnType<typeof eq>,
): Promise<number> => {
  const rows = await tx.select({ n: count() }).from(schema.application).where(where);
  return Number(rows[0]?.n ?? 0);
};

export const deleteCatalogNationality = async (tx: DbTransaction, code: string) => {
  const codeUpper = code.trim().toUpperCase();
  const existing = await tx
    .select()
    .from(schema.nationality)
    .where(eq(schema.nationality.code, codeUpper))
    .limit(1);
  const row = existing[0];
  if (!row) throw new CatalogEntityNotFoundError("Nationality not found");
  const n = await countApplications(tx, eq(schema.application.nationalityCode, codeUpper));
  if (n > 0) {
    throw new CatalogDeleteBlockedError(
      "This nationality is used on applications. Disable it instead of deleting.",
    );
  }
  await tx.delete(schema.nationality).where(eq(schema.nationality.code, codeUpper));
  return row;
};

export const deleteCatalogVisaService = async (tx: DbTransaction, id: string) => {
  const existing = await tx
    .select()
    .from(schema.visaService)
    .where(eq(schema.visaService.id, id))
    .limit(1);
  const row = existing[0];
  if (!row) throw new CatalogEntityNotFoundError("Service not found");
  const n = await countApplications(tx, eq(schema.application.serviceId, id));
  if (n > 0) {
    throw new CatalogDeleteBlockedError(
      "This service is used on applications. Disable it instead of deleting.",
    );
  }
  await tx.delete(schema.visaService).where(eq(schema.visaService.id, id));
  return row;
};
