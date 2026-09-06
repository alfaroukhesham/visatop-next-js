import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { applyChunksInParallel } from "@/lib/async/apply-chunks-in-parallel";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { syncEligibilityForTouchedPairs } from "@/lib/admin/catalog/apply-customer-price-import";
import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/apply-nationality-price-ui-updates";
import {
  fxUsdToAed,
  fxAedToUsd,
  peekResolvedFxRateFromTx,
} from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToJsonSafeNumber } from "@/lib/pricing/minor-units-json";

const UPSERT_CHUNK = 100;

export class ServicePriceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServicePriceValidationError";
  }
}

export class ServicePriceFxMissingError extends Error {
  constructor() {
    super("FX is not configured. Open Settings, set AED per 1 USD, then come back.");
    this.name = "ServicePriceFxMissingError";
  }
}

export const FX_SETTINGS_HREF = "/admin/settings#display-fx";

export type ApplyServicePriceUiResult = {
  updated: number;
  removed: number;
  eligibilityAdded: number;
  eligibilityRemoved: number;
  mode: "all" | "groups";
};

type TServicePriceGroupInput = {
  aedMajor?: string;
  usdMajor?: string;
  nationalityCodes: string[];
};

export type ApplyServicePriceUiInput =
  | { mode: "all"; serviceId: string; aedMajor?: string; usdMajor?: string }
  | { mode: "groups"; serviceId: string; groups: TServicePriceGroupInput[] };

type TUpsertRow = {
  nationalityCode: string;
  serviceId: string;
  currency: "USD" | "AED";
  amountMinor: bigint;
  source: string;
};

/** Must match `syncEligibilityForTouchedPairs` (`\\x1f`). Colon keys are ignored. */
const natSvcIdKey = (nationalityCode: string, serviceId: string): string =>
  `${nationalityCode}\x1f${serviceId}`;

const parsePairAmounts = (
  aedMajor?: string,
  usdMajor?: string,
): { aedMinor: bigint | null; usdMinor: bigint | null } => ({
  aedMinor: aedMajor !== undefined ? parseAdminPriceMajorInput(aedMajor) : null,
  usdMinor: usdMajor !== undefined ? parseAdminPriceMajorInput(usdMajor) : null,
});

const resolveFxRateString = async (tx: DbTransaction): Promise<string> => {
  const peeked = await peekResolvedFxRateFromTx(tx);
  if (!peeked.fxAedPerUsd) {
    throw new ServicePriceFxMissingError();
  }
  return peeked.fxAedPerUsd;
};

const buildUpsertRowsForNationality = (
  nationalityCode: string,
  serviceId: string,
  aedMinor: bigint | null,
  usdMinor: bigint | null,
  fxRate: string | null,
): TUpsertRow[] => {
  const rows: TUpsertRow[] = [];
  const hasAed = aedMinor !== null;
  const hasUsd = usdMinor !== null;

  if (!hasAed && !hasUsd) return rows;

  if (hasAed && hasUsd) {
    rows.push(
      {
        nationalityCode,
        serviceId,
        currency: "AED",
        amountMinor: aedMinor,
        source: "admin_ui",
      },
      {
        nationalityCode,
        serviceId,
        currency: "USD",
        amountMinor: usdMinor,
        source: "admin_ui",
      },
    );
    return rows;
  }

  if (!fxRate) {
    throw new ServicePriceFxMissingError();
  }

  if (hasUsd) {
    rows.push({
      nationalityCode,
      serviceId,
      currency: "USD",
      amountMinor: usdMinor,
      source: "admin_ui",
    });
    rows.push({
      nationalityCode,
      serviceId,
      currency: "AED",
      amountMinor: fxUsdToAed(usdMinor, fxRate),
      source: "fx_derived_aed_from_usd",
    });
    return rows;
  }

  rows.push({
    nationalityCode,
    serviceId,
    currency: "AED",
    amountMinor: aedMinor!,
    source: "admin_ui",
  });
  rows.push({
    nationalityCode,
    serviceId,
    currency: "USD",
    amountMinor: fxAedToUsd(aedMinor!, fxRate),
    source: "fx_derived_usd_from_aed",
  });
  return rows;
};

const upsertPriceRows = async (tx: DbTransaction, rows: TUpsertRow[]): Promise<void> => {
  if (rows.length === 0) return;

  const deduped = new Map<string, TUpsertRow>();
  for (const row of rows) {
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
};

const loadExistingPricedNationalities = async (
  tx: DbTransaction,
  serviceId: string,
): Promise<string[]> => {
  const rows = await tx
    .selectDistinct({ nationalityCode: schema.catalogCustomerPrice.nationalityCode })
    .from(schema.catalogCustomerPrice)
    .where(eq(schema.catalogCustomerPrice.serviceId, serviceId));
  return rows.map((r) => r.nationalityCode);
};

export const applyServicePriceUiUpdates = async (
  tx: DbTransaction,
  input: ApplyServicePriceUiInput,
): Promise<ApplyServicePriceUiResult> => {
  const { serviceId } = input;

  if (input.mode === "all") {
    const { aedMinor, usdMinor } = parsePairAmounts(input.aedMajor, input.usdMajor);
    if (aedMinor === null && usdMinor === null) {
      throw new ServicePriceValidationError("At least one valid price amount is required");
    }

    const needsFx = (aedMinor === null) !== (usdMinor === null);
    const fxRate = needsFx ? await resolveFxRateString(tx) : null;

    const enabledRows = await tx
      .select({ code: schema.nationality.code })
      .from(schema.nationality)
      .where(eq(schema.nationality.enabled, true));

    const upsertRows: TUpsertRow[] = [];
    for (const nat of enabledRows) {
      upsertRows.push(
        ...buildUpsertRowsForNationality(
          nat.code,
          serviceId,
          aedMinor,
          usdMinor,
          fxRate,
        ),
      );
    }

    await upsertPriceRows(tx, upsertRows);

    const touchedKeys = enabledRows.map((n) => natSvcIdKey(n.code, serviceId));
    const elig = await syncEligibilityForTouchedPairs(tx, touchedKeys);

    return {
      updated: enabledRows.length,
      removed: 0,
      eligibilityAdded: elig.added,
      eligibilityRemoved: elig.removed,
      mode: "all",
    };
  }

  const seenCodes = new Set<string>();
  for (const group of input.groups) {
    for (const code of group.nationalityCodes) {
      const normalized = code.trim().toUpperCase();
      if (seenCodes.has(normalized)) {
        throw new ServicePriceValidationError(
          `Nationality ${normalized} appears in more than one group`,
        );
      }
      seenCodes.add(normalized);
    }
  }

  const upsertRows: TUpsertRow[] = [];
  const savedCodes = new Set<string>();

  for (const group of input.groups) {
    const codes = group.nationalityCodes.map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length === 0) continue;

    const { aedMinor, usdMinor } = parsePairAmounts(group.aedMajor, group.usdMajor);
    if (aedMinor === null && usdMinor === null) {
      throw new ServicePriceValidationError(
        "Each group with nationalities must include at least one valid price amount",
      );
    }

    const needsFx = (aedMinor === null) !== (usdMinor === null);
    const fxRate = needsFx ? await resolveFxRateString(tx) : null;

    for (const code of codes) {
      savedCodes.add(code);
      upsertRows.push(
        ...buildUpsertRowsForNationality(code, serviceId, aedMinor, usdMinor, fxRate),
      );
    }
  }

  const allRequestedCodes = [...savedCodes];
  if (allRequestedCodes.length > 0) {
    const knownRows = await tx
      .select({ code: schema.nationality.code })
      .from(schema.nationality)
      .where(inArray(schema.nationality.code, allRequestedCodes));
    const knownSet = new Set(knownRows.map((r) => r.code));
    for (const code of allRequestedCodes) {
      if (!knownSet.has(code)) {
        savedCodes.delete(code);
      }
    }
  }

  const filteredUpsertRows = upsertRows.filter((r) => savedCodes.has(r.nationalityCode));
  const existingPriced = await loadExistingPricedNationalities(tx, serviceId);
  const savedList = [...savedCodes];

  await upsertPriceRows(tx, filteredUpsertRows);

  if (savedList.length > 0) {
    await tx
      .delete(schema.catalogCustomerPrice)
      .where(
        and(
          eq(schema.catalogCustomerPrice.serviceId, serviceId),
          notInArray(schema.catalogCustomerPrice.nationalityCode, savedList),
        ),
      );
  } else {
    await tx
      .delete(schema.catalogCustomerPrice)
      .where(eq(schema.catalogCustomerPrice.serviceId, serviceId));
  }

  const removed = existingPriced.filter((code) => !savedCodes.has(code)).length;
  const touchedKeys = [
    ...new Set([
      ...savedList.map((code) => natSvcIdKey(code, serviceId)),
      ...existingPriced.map((code) => natSvcIdKey(code, serviceId)),
    ]),
  ];
  const elig = await syncEligibilityForTouchedPairs(tx, touchedKeys);

  return {
    updated: savedList.length,
    removed,
    eligibilityAdded: elig.added,
    eligibilityRemoved: elig.removed,
    mode: "groups",
  };
};
