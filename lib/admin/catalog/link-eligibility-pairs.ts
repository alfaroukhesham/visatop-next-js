import { inArray } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export class LinkEligibilityValidationError extends Error {
  readonly code = "LINK_ELIGIBILITY_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "LinkEligibilityValidationError";
  }
}

export type TEligibilityPair = { serviceId: string; nationalityCode: string };

/**
 * Bulk-create eligibility pairs in one transaction. All-or-nothing:
 * every referenced service and nationality must exist, or the whole request
 * fails before any row is written. Duplicate pairs are a quiet success.
 */
export const linkEligibilityPairs = async (
  tx: DbTransaction,
  pairs: TEligibilityPair[],
  opts: {
    adminUserId: string;
    writeAudit: (row: TEligibilityPair) => Promise<void>;
  },
): Promise<{ created: TEligibilityPair[]; deduped: number }> => {
  if (pairs.length < 1 || pairs.length > 200) {
    throw new LinkEligibilityValidationError("Provide between 1 and 200 eligibility pairs.");
  }

  const normalized = pairs.map((raw) => ({
    serviceId: raw.serviceId.trim(),
    nationalityCode: raw.nationalityCode.trim().toUpperCase(),
  }));

  // Validate all parents exist up front so a missing service or nationality
  // fails the whole request with a clear message (no partial writes).
  const serviceIds = [...new Set(normalized.map((p) => p.serviceId))];
  const nationalityCodes = [...new Set(normalized.map((p) => p.nationalityCode))];
  const [services, nationalities] = await Promise.all([
    tx
      .select({ id: schema.visaService.id })
      .from(schema.visaService)
      .where(inArray(schema.visaService.id, serviceIds)),
    tx
      .select({ code: schema.nationality.code })
      .from(schema.nationality)
      .where(inArray(schema.nationality.code, nationalityCodes)),
  ]);
  const foundServices = new Set(services.map((s) => s.id));
  const foundNationalities = new Set(nationalities.map((n) => n.code));
  const missingService = serviceIds.find((id) => !foundServices.has(id));
  if (missingService) {
    throw new LinkEligibilityValidationError(`Service not found: ${missingService}`);
  }
  const missingNationality = nationalityCodes.find((code) => !foundNationalities.has(code));
  if (missingNationality) {
    throw new LinkEligibilityValidationError(`Nationality not found: ${missingNationality}`);
  }

  const created: TEligibilityPair[] = [];
  let deduped = 0;
  for (const pair of normalized) {
    const inserted = await tx
      .insert(schema.visaServiceEligibility)
      .values({ serviceId: pair.serviceId, nationalityCode: pair.nationalityCode })
      .onConflictDoNothing()
      .returning();
    const row = inserted[0];
    if (!row) {
      deduped += 1;
      continue;
    }
    const createdPair = { serviceId: row.serviceId, nationalityCode: row.nationalityCode };
    created.push(createdPair);
    await opts.writeAudit(createdPair);
  }
  return { created, deduped };
};
