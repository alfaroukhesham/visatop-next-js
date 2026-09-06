import { asc, eq } from "drizzle-orm";
import type { DbTransaction } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/apply-nationality-price-ui-updates";
import {
  fxUsdToAed,
  fxAedToUsd,
  peekResolvedFxRateFromTx,
} from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToMajor } from "@/lib/pricing/format-minor-units";
import { FX_SETTINGS_HREF } from "@/lib/admin/catalog/apply-service-price-ui-updates";

export type TServicePricingGroup = {
  aedMajor: string;
  usdMajor: string;
  nationalityCodes: string[];
  coversAllEnabled: boolean;
};

export type TServicePricingList = {
  service: { id: string; name: string };
  fxConfigured: boolean;
  fxAedPerUsd: string | null;
  groups: TServicePricingGroup[];
  nationalities: Array<{ code: string; name: string; enabled: boolean }>;
};

export type TServicePricingPreview = {
  enabledNationalityCount: number;
  alreadyPricedCount: number;
  differentPriceCount: number;
  fxConfigured: boolean;
  settingsHref: string;
};

const formatMajorForInput = (minor: bigint): string => minorUnitsToMajor(minor).toFixed(2);

const peekFxRate = async (
  tx: DbTransaction,
): Promise<{ configured: boolean; rate: string | null }> => {
  const peeked = await peekResolvedFxRateFromTx(tx);
  return { configured: peeked.fxAedPerUsd !== null, rate: peeked.fxAedPerUsd };
};

type TStoredPair = {
  usdMinor: bigint | null;
  aedMinor: bigint | null;
};

const loadPricePairsByNationality = async (
  tx: DbTransaction,
  serviceId: string,
): Promise<Map<string, TStoredPair>> => {
  const rows = await tx
    .select({
      nationalityCode: schema.catalogCustomerPrice.nationalityCode,
      currency: schema.catalogCustomerPrice.currency,
      amountMinor: schema.catalogCustomerPrice.amountMinor,
    })
    .from(schema.catalogCustomerPrice)
    .where(eq(schema.catalogCustomerPrice.serviceId, serviceId));

  const byNat = new Map<string, TStoredPair>();
  for (const row of rows) {
    const entry = byNat.get(row.nationalityCode) ?? { usdMinor: null, aedMinor: null };
    const minor = BigInt(row.amountMinor);
    if (row.currency === "USD") entry.usdMinor = minor;
    if (row.currency === "AED") entry.aedMinor = minor;
    byNat.set(row.nationalityCode, entry);
  }
  return byNat;
};

const pairKey = (usdMinor: bigint | null, aedMinor: bigint | null): string =>
  `${usdMinor ?? "x"}:${aedMinor ?? "x"}`;

export const listServicePricing = async (
  tx: DbTransaction,
  serviceId: string,
): Promise<TServicePricingList | null> => {
  const svcRows = await tx
    .select({ id: schema.visaService.id, name: schema.visaService.name })
    .from(schema.visaService)
    .where(eq(schema.visaService.id, serviceId))
    .limit(1);
  const service = svcRows[0];
  if (!service) return null;

  const [nationalities, priceByNat, fx] = await Promise.all([
    tx
      .select({
        code: schema.nationality.code,
        name: schema.nationality.name,
        enabled: schema.nationality.enabled,
      })
      .from(schema.nationality)
      .orderBy(asc(schema.nationality.name)),
    loadPricePairsByNationality(tx, serviceId),
    peekFxRate(tx),
  ]);

  const groupMap = new Map<string, TServicePricingGroup>();
  for (const [code, pair] of priceByNat) {
    if (pair.usdMinor === null && pair.aedMinor === null) continue;
    const key = pairKey(pair.usdMinor, pair.aedMinor);
    const existing = groupMap.get(key);
    if (existing) {
      existing.nationalityCodes.push(code);
    } else {
      groupMap.set(key, {
        aedMajor: pair.aedMinor !== null ? formatMajorForInput(pair.aedMinor) : "",
        usdMajor: pair.usdMinor !== null ? formatMajorForInput(pair.usdMinor) : "",
        nationalityCodes: [code],
        coversAllEnabled: false,
      });
    }
  }

  const enabledCodes = nationalities.filter((n) => n.enabled).map((n) => n.code);
  const groups = [...groupMap.values()].map((g) => {
    const nationalityCodes = [...g.nationalityCodes].sort();
    const coversAllEnabled =
      enabledCodes.length > 0 && enabledCodes.every((code) => nationalityCodes.includes(code));
    return { ...g, nationalityCodes, coversAllEnabled };
  });

  return {
    service: { id: service.id, name: service.name },
    fxConfigured: fx.configured,
    fxAedPerUsd: fx.rate,
    groups,
    nationalities,
  };
};

const pairsMatch = (
  stored: TStoredPair,
  proposed: { usdMinor: bigint | null; aedMinor: bigint | null },
  compareUsd: boolean,
  compareAed: boolean,
): boolean => {
  if (compareUsd) {
    if (proposed.usdMinor === null) return true;
    if (stored.usdMinor === null || stored.usdMinor !== proposed.usdMinor) return false;
  }
  if (compareAed) {
    if (proposed.aedMinor === null) return true;
    if (stored.aedMinor === null || stored.aedMinor !== proposed.aedMinor) return false;
  }
  return true;
};

export const previewServicePricing = async (
  tx: DbTransaction,
  serviceId: string,
  input: { aedMajor?: string; usdMajor?: string },
): Promise<TServicePricingPreview> => {
  const fx = await peekFxRate(tx);
  const aedMinor =
    input.aedMajor !== undefined ? parseAdminPriceMajorInput(input.aedMajor) : null;
  const usdMinor =
    input.usdMajor !== undefined ? parseAdminPriceMajorInput(input.usdMajor) : null;

  let proposedUsd = usdMinor;
  let proposedAed = aedMinor;
  const needsFx = (aedMinor === null) !== (usdMinor === null);

  if (needsFx && fx.configured && fx.rate) {
    if (usdMinor !== null) {
      proposedAed = fxUsdToAed(usdMinor, fx.rate);
    } else if (aedMinor !== null) {
      proposedUsd = fxAedToUsd(aedMinor, fx.rate);
    }
  }

  const compareUsd = proposedUsd !== null;
  const compareAed = needsFx ? fx.configured && proposedAed !== null : proposedAed !== null;

  const [enabledRows, priceByNat] = await Promise.all([
    tx
      .select({ code: schema.nationality.code })
      .from(schema.nationality)
      .where(eq(schema.nationality.enabled, true)),
    loadPricePairsByNationality(tx, serviceId),
  ]);

  let alreadyPricedCount = 0;
  let differentPriceCount = 0;

  const fullPairCompare = compareUsd && compareAed;

  for (const nat of enabledRows) {
    const stored = priceByNat.get(nat.code) ?? { usdMinor: null, aedMinor: null };
    const hasPrice = stored.usdMinor !== null || stored.aedMinor !== null;
    if (hasPrice) alreadyPricedCount += 1;

    if (!hasPrice) {
      if (fullPairCompare) differentPriceCount += 1;
      continue;
    }

    const matches = pairsMatch(
      stored,
      { usdMinor: proposedUsd, aedMinor: proposedAed },
      compareUsd,
      compareAed,
    );
    if (!matches) differentPriceCount += 1;
  }

  return {
    enabledNationalityCount: enabledRows.length,
    alreadyPricedCount,
    differentPriceCount,
    fxConfigured: fx.configured,
    settingsHref: FX_SETTINGS_HREF,
  };
};
