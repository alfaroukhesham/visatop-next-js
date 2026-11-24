import type { TCheckoutChargeBasis, TCheckoutExtraKey, TProcessingSpeed } from "@/lib/db/schema/checkout-extra";

/**
 * Checkout extras priced from stored `checkout_extra_price` rows.
 * No FX call. A disabled extra, or one with no row in the quote currency, is unavailable.
 */

export type TCheckoutExtraPriceRow = {
  currency: string;
  amountMinor: number;
};

export type TCheckoutExtraCatalogItem = {
  id: string;
  key: TCheckoutExtraKey;
  enabled: boolean;
  chargeBasis: TCheckoutChargeBasis;
  prices: readonly TCheckoutExtraPriceRow[];
};

export type TCheckoutMember = {
  applicationId: string;
};

export type TExtraUnavailableReason = "disabled" | "missing_currency_price";

export type TExtraAvailability = {
  key: TCheckoutExtraKey;
  available: boolean;
  reason: "ok" | TExtraUnavailableReason;
  unitAmountMinor: bigint | null;
  chargeBasis: TCheckoutChargeBasis;
};

export type TExtraQuoteLine = {
  key: TCheckoutExtraKey;
  applicationId: string | null;
  amountMinor: bigint;
  currency: string;
};

export type TVisaChargeLine = {
  applicationId: string;
  serviceId: string;
  amountMinor: bigint;
  currency: string;
};

const chargeBasisOf = (value: TCheckoutChargeBasis): TCheckoutChargeBasis =>
  value === "per_order" ? "per_order" : "per_traveller";

export const availabilityForCurrency = (
  item: TCheckoutExtraCatalogItem,
  currency: string,
): TExtraAvailability => {
  const chargeBasis = chargeBasisOf(item.chargeBasis);
  if (!item.enabled) {
    return { key: item.key, available: false, reason: "disabled", unitAmountMinor: null, chargeBasis };
  }
  const price = item.prices.find((row) => row.currency === currency);
  if (!price) {
    return {
      key: item.key,
      available: false,
      reason: "missing_currency_price",
      unitAmountMinor: null,
      chargeBasis,
    };
  }
  return {
    key: item.key,
    available: true,
    reason: "ok",
    unitAmountMinor: BigInt(price.amountMinor),
    chargeBasis,
  };
};

/** Per-traveller extras multiply by the party size. Per-order extras are charged once. */
export const partySumMinor = (
  unitAmountMinor: bigint,
  chargeBasis: TCheckoutChargeBasis,
  travellerCount: number,
): bigint => {
  if (travellerCount < 1) return BigInt(0);
  if (chargeBasis === "per_order") return unitAmountMinor;
  return unitAmountMinor * BigInt(travellerCount);
};

export type TResolveCheckoutExtrasInput = {
  currency: string;
  members: readonly TCheckoutMember[];
  catalog: readonly TCheckoutExtraCatalogItem[];
  insuranceSelectedByApplicationId: Readonly<Record<string, boolean>>;
  processingSpeed: TProcessingSpeed | null;
};

export type TResolveCheckoutExtrasResult = {
  currency: string;
  travellerCount: number;
  availability: TExtraAvailability[];
  lines: TExtraQuoteLine[];
  extrasTotalMinor: bigint;
  dropped: Array<{ key: TCheckoutExtraKey; reason: TExtraUnavailableReason }>;
};

const pushLines = (
  lines: TExtraQuoteLine[],
  item: TExtraAvailability,
  members: readonly TCheckoutMember[],
  currency: string,
) => {
  if (!item.available || item.unitAmountMinor === null) return;
  if (item.chargeBasis === "per_order") {
    lines.push({
      key: item.key,
      applicationId: null,
      amountMinor: item.unitAmountMinor,
      currency,
    });
    return;
  }
  for (const member of members) {
    lines.push({
      key: item.key,
      applicationId: member.applicationId,
      amountMinor: item.unitAmountMinor,
      currency,
    });
  }
};

export const resolveCheckoutExtras = (input: TResolveCheckoutExtrasInput): TResolveCheckoutExtrasResult => {
  const availability = input.catalog.map((item) => availabilityForCurrency(item, input.currency));
  const byKey = new Map(availability.map((item) => [item.key, item]));
  const lines: TExtraQuoteLine[] = [];
  const dropped: TResolveCheckoutExtrasResult["dropped"] = [];

  const insurance = byKey.get("travel_insurance");
  const insuredMembers = input.members.filter(
    (member) => input.insuranceSelectedByApplicationId[member.applicationId] === true,
  );
  if (insuredMembers.length > 0) {
    if (!insurance || !insurance.available) {
      dropped.push({
        key: "travel_insurance",
        reason: insurance?.reason === "missing_currency_price" ? "missing_currency_price" : "disabled",
      });
    } else {
      pushLines(lines, insurance, insuredMembers, input.currency);
    }
  }

  if (input.processingSpeed === "fast_track") {
    const fastTrack = byKey.get("fast_track");
    if (!fastTrack || !fastTrack.available) {
      dropped.push({
        key: "fast_track",
        reason: fastTrack?.reason === "missing_currency_price" ? "missing_currency_price" : "disabled",
      });
    } else {
      pushLines(lines, fastTrack, input.members, input.currency);
    }
  }

  const extrasTotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, BigInt(0));
  return {
    currency: input.currency,
    travellerCount: input.members.length,
    availability,
    lines,
    extrasTotalMinor,
    dropped,
  };
};

export type TCheckoutCharge = {
  totalMinor: bigint;
  visaAmountMinor: bigint;
  extrasAmountMinor: bigint;
  /** Ziina and Fincra both charge this single total. */
  ziinaAmountMinor: bigint;
  fincraAmountMinor: bigint;
  breakdownJson: string;
};

export const buildCheckoutCharge = (input: {
  visaLines: readonly TVisaChargeLine[];
  extraLines: readonly TExtraQuoteLine[];
  currency: string;
  fxSource: string | null;
  travelDate: string | null;
  processingSpeed: TProcessingSpeed | null;
}): TCheckoutCharge => {
  const visaAmountMinor = input.visaLines.reduce((sum, line) => sum + line.amountMinor, BigInt(0));
  const extrasAmountMinor = input.extraLines.reduce((sum, line) => sum + line.amountMinor, BigInt(0));
  const totalMinor = visaAmountMinor + extrasAmountMinor;
  const breakdownJson = JSON.stringify({
    kind: "customer_catalog",
    version: 2,
    amountMinor: totalMinor.toString(),
    currency: input.currency,
    fxSource: input.fxSource,
    lines: input.visaLines.map((line) => ({
      applicationId: line.applicationId,
      serviceId: line.serviceId,
      amountMinor: line.amountMinor.toString(),
      currency: line.currency,
    })),
    extras: input.extraLines.map((line) => ({
      key: line.key,
      applicationId: line.applicationId,
      amountMinor: line.amountMinor.toString(),
      currency: line.currency,
    })),
    travelDate: input.travelDate,
    processingSpeed: input.processingSpeed,
  });
  return {
    totalMinor,
    visaAmountMinor,
    extrasAmountMinor,
    ziinaAmountMinor: totalMinor,
    fincraAmountMinor: totalMinor,
    breakdownJson,
  };
};
