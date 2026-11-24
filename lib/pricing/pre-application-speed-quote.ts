import type { TCheckoutChargeBasis, TCheckoutExtraKey } from "@/lib/db/schema/checkout-extra";
import {
  availabilityForCurrency,
  extraIsPriced,
  partySumMinor,
  type TCheckoutExtraCatalogItem,
} from "@/lib/pricing/resolve-checkout-extras";

export type TPreApplicationSpeedQuote = {
  serviceId: string;
  nationalityCode: string;
  currency: string;
  /** Null until the traveller count is known. The unit price is still returned. */
  travellerCount: number | null;
  fastTrackAvailable: boolean;
  fastTrack: {
    unitAmountMinor: string;
    sumAmountMinor: string | null;
    chargeBasis: TCheckoutChargeBasis;
  } | null;
};

const fastTrackItem = (
  catalog: readonly TCheckoutExtraCatalogItem[],
): TCheckoutExtraCatalogItem | null => catalog.find((extra) => extra.key === ("fast_track" as TCheckoutExtraKey)) ?? null;

/**
 * Fast Track price before an application exists.
 * Uses the stored per-currency extra price (`extraIsPriced`). No FX call.
 * Nationality and service id identify the request; Fast Track applies to every service.
 */
export const buildPreApplicationSpeedQuote = (input: {
  serviceId: string;
  nationalityCode: string;
  currency: string;
  travellerCount: number | null;
  catalog: readonly TCheckoutExtraCatalogItem[];
}): TPreApplicationSpeedQuote => {
  const currency = input.currency.trim().toUpperCase();
  const item = fastTrackItem(input.catalog);
  const priced = item ? extraIsPriced(item, currency) : false;
  const availability = item && priced ? availabilityForCurrency(item, currency) : null;
  const countKnown = input.travellerCount !== null && input.travellerCount >= 1;
  const base: TPreApplicationSpeedQuote = {
    serviceId: input.serviceId,
    nationalityCode: input.nationalityCode.trim().toUpperCase(),
    currency,
    travellerCount: countKnown ? input.travellerCount : null,
    fastTrackAvailable: false,
    fastTrack: null,
  };
  if (!availability?.available || availability.unitAmountMinor === null) return base;
  return {
    ...base,
    fastTrackAvailable: true,
    fastTrack: {
      unitAmountMinor: availability.unitAmountMinor.toString(),
      sumAmountMinor: countKnown
        ? partySumMinor(availability.unitAmountMinor, availability.chargeBasis, input.travellerCount!).toString()
        : null,
      chargeBasis: availability.chargeBasis,
    },
  };
};
