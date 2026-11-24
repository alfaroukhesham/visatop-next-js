import { travelDateWindow } from "@/lib/checkout-extras/dubai-calendar";
import { extraIsPriced } from "@/lib/pricing/resolve-checkout-extras";

/** The start form shows the date when any extra is enabled and has a stored price. */
export const anyCheckoutExtraActive = (
  catalog: readonly { enabled: boolean; prices: readonly { currency: string }[] }[],
): boolean => catalog.some((extra) => extraIsPriced(extra));

/**
 * The start form asks for an arrival date only while an extra can be sold.
 * A missing settings row defaults the flag to required; that default must not
 * add the field while every extra is off.
 */
export const travelWindowPayload = (input: {
  now: Date;
  maxDaysAhead: number;
  settingRequired: boolean;
  fastTrackThresholdDays: number;
  catalog: readonly { enabled: boolean; prices: readonly { currency: string }[] }[];
}): {
  todayUae: string;
  maxTravelDate: string;
  extrasActive: boolean;
  travelDateRequired: boolean;
  fastTrackThresholdDays: number;
} => {
  const window = travelDateWindow(input.now, input.maxDaysAhead);
  const extrasActive = anyCheckoutExtraActive(input.catalog);
  return {
    todayUae: window.todayUae,
    maxTravelDate: window.maxTravelDate,
    extrasActive,
    travelDateRequired: input.settingRequired && extrasActive,
    fastTrackThresholdDays: input.fastTrackThresholdDays,
  };
};
