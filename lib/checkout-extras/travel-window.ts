import { travelDateWindow } from "@/lib/checkout-extras/dubai-calendar";

/** An extra is active only when ops enabled it and stored at least one currency price. */
export const anyCheckoutExtraActive = (
  catalog: readonly { enabled: boolean; prices: readonly unknown[] }[],
): boolean => catalog.some((extra) => extra.enabled && extra.prices.length > 0);

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
  catalog: readonly { enabled: boolean; prices: readonly unknown[] }[];
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
