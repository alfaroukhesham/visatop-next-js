import { inArray, sql } from "drizzle-orm";
import { applyChunksInParallel } from "@/lib/async/apply-chunks-in-parallel";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { syncEligibilityForTouchedPairs } from "@/lib/admin/catalog/apply-customer-price-import";
import { extractNumericValue, toMinorUnits } from "@/lib/admin/catalog/parse-price-sheet";
import { fxUsdToAed, fxAedToUsd, readFxRateString, FxRateMissingError } from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";

const UPSERT_CHUNK = 100;

export type NationalityPriceUiUpdate = {
  serviceId: string;
  /** Major units string from admin input (e.g. "419.00"). Empty = skip. */
  amountMajor: string;
};

export type ApplyNationalityPriceUiResult = {
  updated: number;
  skipped: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
};

/** Must match `syncEligibilityForTouchedPairs` (`\\x1f`). Colon keys are ignored. */
function natSvcIdKey(nationalityCode: string, serviceId: string): string {
  return `${nationalityCode}\x1f${serviceId}`;
}

export function parseAdminPriceMajorInput(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numeric = extractNumericValue(trimmed);
  if (numeric === null || numeric <= 0) return null;
  return toMinorUnits(numeric);
}

export async function applyNationalityPriceUiUpdates(
  tx: DbTransaction,
  input: {
    nationalityCode: string;
    currency: "USD" | "AED";
    updates: NationalityPriceUiUpdate[];
  },
): Promise<ApplyNationalityPriceUiResult> {
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

  const upsertRows: Array<{
    nationalityCode: string;
    serviceId: string;
    currency: "USD" | "AED";
    amountMinor: bigint;
    source: string;
  }> = [];

  let fxRate: string;
  try {
    fxRate = readFxRateString();
  } catch (e) {
    if (e instanceof FxRateMissingError) {
      throw new Error(
        "FX rate is not configured. Set NEXT_PUBLIC_DISPLAY_FX_AED_PER_USD before saving prices.",
      );
    }
    throw e;
  }

  for (const row of parsed) {
    if (!validServiceIds.has(row.serviceId)) {
      skipped += 1;
      continue;
    }
    upsertRows.push({
      nationalityCode,
      serviceId: row.serviceId,
      currency,
      amountMinor: row.amountMinor,
      source: "admin_ui",
    });
    const siblingCurrency: "USD" | "AED" = currency === "USD" ? "AED" : "USD";
    const siblingAmount =
      currency === "USD"
        ? fxUsdToAed(row.amountMinor, fxRate)
        : fxAedToUsd(row.amountMinor, fxRate);
    upsertRows.push({
      nationalityCode,
      serviceId: row.serviceId,
      currency: siblingCurrency,
      amountMinor: siblingAmount,
      source: currency === "USD" ? "fx_derived_aed_from_usd" : "fx_derived_usd_from_aed",
    });
  }

  const deduped = new Map<string, (typeof upsertRows)[number]>();
  for (const row of upsertRows) {
    deduped.set(`${row.nationalityCode}:${row.serviceId}:${row.currency}`, row);
  }
  const uniqueRows = [...deduped.values()];

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
    ...new Set(
      uniqueRows.map((r) => natSvcIdKey(r.nationalityCode, r.serviceId)),
    ),
  ];
  const elig = await syncEligibilityForTouchedPairs(tx, touchedKeys);

  return {
    updated: parsed.filter((p) => validServiceIds.has(p.serviceId)).length,
    skipped,
    eligibilityAdded: elig.added,
    eligibilityRemoved: elig.removed,
  };
}
