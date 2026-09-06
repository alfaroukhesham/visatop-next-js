import { parseAdminPriceMajorInput } from "@/lib/admin/catalog/apply-nationality-price-ui-updates";
import { fxAedToUsd, fxUsdToAed } from "@/lib/pricing/fx-usd-aed";
import { minorUnitsToMajor } from "@/lib/pricing/format-minor-units";

export type TFxFillDirty = {
  aed: boolean;
  usd: boolean;
};

export const formatMajorFromMinor = (minor: bigint): string =>
  minorUnitsToMajor(minor).toFixed(2);

export const convertUsdMajorToAedMajor = (
  usdMajor: string,
  fxAedPerUsd: string,
): string | null => {
  const usdMinor = parseAdminPriceMajorInput(usdMajor);
  if (usdMinor === null) return null;
  return formatMajorFromMinor(fxUsdToAed(usdMinor, fxAedPerUsd));
};

export const convertAedMajorToUsdMajor = (
  aedMajor: string,
  fxAedPerUsd: string,
): string | null => {
  const aedMinor = parseAdminPriceMajorInput(aedMajor);
  if (aedMinor === null) return null;
  return formatMajorFromMinor(fxAedToUsd(aedMinor, fxAedPerUsd));
};

export const applyManualAedChange = (
  aedValue: string,
  currentUsd: string,
  dirty: TFxFillDirty,
  fxConfigured: boolean,
  fxAedPerUsd: string | null,
): { aed: string; usd: string; dirty: TFxFillDirty } => {
  const nextDirty = { ...dirty, aed: true };
  if (aedValue.trim() === "") {
    nextDirty.aed = false;
    nextDirty.usd = false;
    return { aed: aedValue, usd: currentUsd, dirty: nextDirty };
  }

  let nextUsd = currentUsd;
  if (fxConfigured && fxAedPerUsd && !dirty.usd) {
    const converted = convertAedMajorToUsdMajor(aedValue, fxAedPerUsd);
    if (converted !== null) nextUsd = converted;
  }

  return { aed: aedValue, usd: nextUsd, dirty: nextDirty };
};

export const applyManualUsdChange = (
  usdValue: string,
  currentAed: string,
  dirty: TFxFillDirty,
  fxConfigured: boolean,
  fxAedPerUsd: string | null,
): { aed: string; usd: string; dirty: TFxFillDirty } => {
  const nextDirty = { ...dirty, usd: true };
  if (usdValue.trim() === "") {
    nextDirty.aed = false;
    nextDirty.usd = false;
    return { aed: currentAed, usd: usdValue, dirty: nextDirty };
  }

  let nextAed = currentAed;
  if (fxConfigured && fxAedPerUsd && !dirty.aed) {
    const converted = convertUsdMajorToAedMajor(usdValue, fxAedPerUsd);
    if (converted !== null) nextAed = converted;
  }

  return { aed: nextAed, usd: usdValue, dirty: nextDirty };
};

export const hasValidPriceAmount = (aedMajor: string, usdMajor: string): boolean =>
  parseAdminPriceMajorInput(aedMajor) !== null || parseAdminPriceMajorInput(usdMajor) !== null;

export const needsFxForPair = (aedMajor: string, usdMajor: string): boolean => {
  const hasAed = parseAdminPriceMajorInput(aedMajor) !== null;
  const hasUsd = parseAdminPriceMajorInput(usdMajor) !== null;
  return hasAed !== hasUsd;
};
