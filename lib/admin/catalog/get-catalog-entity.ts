import { eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const getCatalogNationality = async (tx: DbTransaction, code: string) => {
  const rows = await tx
    .select({
      code: schema.nationality.code,
      name: schema.nationality.name,
      enabled: schema.nationality.enabled,
    })
    .from(schema.nationality)
    .where(eq(schema.nationality.code, code.trim().toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
};

export const getCatalogVisaService = async (tx: DbTransaction, id: string) => {
  const rows = await tx
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
  return rows[0] ?? null;
};
