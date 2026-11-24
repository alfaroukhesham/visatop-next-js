import { travelDateWindow } from "@/lib/checkout-extras/dubai-calendar";
import { extraIsPriced } from "@/lib/pricing/resolve-checkout-extras";

/** The start form shows the date when any extra is enabled and has a stored price. */
export const anyCheckoutExtraActive = (
  catalog: readonly { enabled: boolean; prices: readonly { currency: string }[] }[],
): boolean => catalog.some((extra) => extraIsPriced(extra));

/**
 * The date step can show while extras are off. `showTravelDateStep` hides it.
 * A missing date is allowed either way: the step is skippable, and the required
 * flag does not block checkout.
 */
export const travelWindowPayload = (input: {
  now: Date;
  maxDaysAhead: number;
  settingRequired: boolean;
  showTravelDateStep?: boolean;
  fastTrackThresholdDays: number;
  catalog: readonly { enabled: boolean; prices: readonly { currency: string }[] }[];
}): {
  todayUae: string;
  maxTravelDate: string;
  extrasActive: boolean;
  showTravelDateStep: boolean;
  travelDateRequired: boolean;
  fastTrackThresholdDays: number;
} => {
  const window = travelDateWindow(input.now, input.maxDaysAhead);
  const extrasActive = anyCheckoutExtraActive(input.catalog);
  // `settingRequired` stays on the admin row. The customer step is skippable either way.
  void input.settingRequired;
  return {
    todayUae: window.todayUae,
    maxTravelDate: window.maxTravelDate,
    extrasActive,
    showTravelDateStep: input.showTravelDateStep !== false,
    travelDateRequired: false,
    fastTrackThresholdDays: input.fastTrackThresholdDays,
  };
};
