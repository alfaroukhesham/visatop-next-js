import { describe, expect, it } from "vitest";
import {
  buildPreApplicationSpeedQuote,
  preApplicationCheckoutTotalMinor,
} from "@/lib/pricing/pre-application-speed-quote";
import type { TCheckoutExtraCatalogItem } from "@/lib/pricing/resolve-checkout-extras";

const fastTrack: TCheckoutExtraCatalogItem = {
  id: "fast_track",
  key: "fast_track",
  enabled: true,
  chargeBasis: "per_traveller",
  prices: [{ currency: "AED", amountMinor: 36800 }],
};

describe("pre-application speed quote", () => {
  it("returns the per-traveller price before the party size is known", () => {
    const quote = buildPreApplicationSpeedQuote({
      serviceId: "svc-1",
      nationalityCode: "gb",
      currency: "aed",
      travellerCount: null,
      catalog: [fastTrack],
    });
    expect(quote).toMatchObject({
      serviceId: "svc-1",
      nationalityCode: "GB",
      currency: "AED",
      travellerCount: null,
      fastTrackAvailable: true,
      fastTrack: {
        unitAmountMinor: "36800",
        sumAmountMinor: null,
        chargeBasis: "per_traveller",
      },
    });
  });

  it("multiplies once the traveller count is known", () => {
    const quote = buildPreApplicationSpeedQuote({
      serviceId: "svc-1",
      nationalityCode: "GB",
      currency: "AED",
      travellerCount: 2,
      catalog: [fastTrack],
    });
    expect(quote.travellerCount).toBe(2);
    expect(quote.fastTrack?.sumAmountMinor).toBe(String(36800 * 2));
  });

  it("adds the chosen Fast Track sum to the visa total and leaves Standard unchanged", () => {
    expect(preApplicationCheckoutTotalMinor(81400, "fast_track", String(36800 * 2))).toBe(81400 + 73600);
    expect(preApplicationCheckoutTotalMinor(81400, "standard", String(36800 * 2))).toBe(81400);
    expect(preApplicationCheckoutTotalMinor(81400, "fast_track", null)).toBe(81400);
    expect(preApplicationCheckoutTotalMinor(null, "fast_track", "73600")).toBeNull();
  });

  it("hides Fast Track when the extra is off or has no price in the currency", () => {
    expect(
      buildPreApplicationSpeedQuote({
        serviceId: "svc-1",
        nationalityCode: "NG",
        currency: "NGN",
        travellerCount: 2,
        catalog: [fastTrack],
      }).fastTrackAvailable,
    ).toBe(false);
    expect(
      buildPreApplicationSpeedQuote({
        serviceId: "svc-1",
        nationalityCode: "GB",
        currency: "AED",
        travellerCount: 1,
        catalog: [{ ...fastTrack, enabled: false }],
      }).fastTrack,
    ).toBeNull();
  });
});
