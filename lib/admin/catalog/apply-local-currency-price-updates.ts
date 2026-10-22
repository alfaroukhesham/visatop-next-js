import { inArray, sql } from "drizzle-orm";
import { applyChunksInParallel } from "@/lib/async/apply-chunks-in-parallel";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { syncEligibilityForTouchedPairs } from "@/lib/admin/catalog/apply-customer-price-import";
import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/parse-admin-price-input";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";

const UPSERT_CHUNK = 100;

export type TLocalCurrencyPriceUiUpdate = {
  serviceId: string;
  /** Major units string from admin input (e.g. "185000.00"). Empty = skip. */
  amountMajor: string;
};

export type TApplyLocalCurrencyPriceUiResult = {
  updated: number;
  skipped: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
};

const natSvcIdKey = (nationalityCode: string, serviceId: string): string =>
  `${nationalityCode}\x1f${serviceId}`;

/**
 * Upsert stored local prices only. Never FX-derives USD/AED from local or the reverse.
 */
export const applyLocalCurrencyPriceUiUpdates = async (
  tx: DbTransaction,
  input: {
    nationalityCode: string;
    currency: string;
    updates: TLocalCurrencyPriceUiUpdate[];
  },
): Promise<TApplyLocalCurrencyPriceUiResult> => {
  const { nationalityCode, currency } = input;
  let skipped = 0;

  const parsed: Array<{ serviceId: string; amountMinor: bigint }> = [];
  for (const row of input.updates) {
    const amountMinor = parseAdminPriceMajorInput(row.amountMajor);
    if (amountMinor === null) {
      skipped += 1;
      continue;
    }
    parsed.push({ serviceId: row.serviceId, amountMinor });
  }

  if (parsed.length === 0) {
    return { updated: 0, skipped, eligibilityAdded: 0, eligibilityRemoved: 0 };
  }

  const serviceIds = [...new Set(parsed.map((p) => p.serviceId))];
  const existingServices = await tx
    .select({ id: schema.visaService.id })
    .from(schema.visaService)
    .where(inArray(schema.visaService.id, serviceIds));
  const validServiceIds = new Set(existingServices.map((s) => s.id));

  const uniqueRows = parsed
    .filter((row) => {
      if (!validServiceIds.has(row.serviceId)) {
        skipped += 1;
        return false;
      }
      return true;
    })
    .map((row) => ({
      nationalityCode,
      serviceId: row.serviceId,
      currency,
      amountMinor: row.amountMinor,
      source: "admin_ui",
    }));

  if (uniqueRows.length === 0) {
    return { updated: 0, skipped, eligibilityAdded: 0, eligibilityRemoved: 0 };
  }

  await applyChunksInParallel(uniqueRows, UPSERT_CHUNK, async (chunk) => {
    await tx
      .insert(schema.catalogCustomerPrice)
      .values(
        chunk.map((u) => ({
          nationalityCode: u.nationalityCode,
          serviceId: u.serviceId,
          currency: u.currency,
          amountMinor: minorUnitsToJsonSafeNumber(u.amountMinor),
          source: u.source,
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.catalogCustomerPrice.nationalityCode,
          schema.catalogCustomerPrice.serviceId,
          schema.catalogCustomerPrice.currency,
        ],
        set: {
          amountMinor: sql`excluded.amount_minor`,
          source: sql`excluded.source`,
          updatedAt: new Date(),
        },
      });
  });

  const touchedKeys = [
    ...new Set(uniqueRows.map((r) => natSvcIdKey(r.nationalityCode, r.serviceId))),
  ];
  const elig = await syncEligibilityForTouchedPairs(tx, touchedKeys);

  return {
    updated: uniqueRows.length,
    skipped,
    eligibilityAdded: elig.added,
    eligibilityRemoved: elig.removed,
  };
};
