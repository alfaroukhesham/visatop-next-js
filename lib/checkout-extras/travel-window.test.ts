import { describe, expect, it } from "vitest";
import { travelWindowPayload } from "@/lib/checkout-extras/travel-window";

const NOW = new Date("2026-06-01T08:00:00.000Z");

describe("travel window while extras are off", () => {
  it("still shows the date step when no extra is priced", () => {
    const window = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: true,
      fastTrackThresholdDays: 4,
      catalog: [],
    });
    expect(window.extrasActive).toBe(false);
    expect(window.showTravelDateStep).toBe(true);
    expect(window.travelDateRequired).toBe(false);
  });

  it("stays inactive when an extra is enabled without a price, or priced while disabled", () => {
    const disabled = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: true,
      fastTrackThresholdDays: 4,
      catalog: [
        { enabled: true, prices: [] },
        { enabled: false, prices: [{ currency: "USD" }] },
      ],
    });
    expect(disabled.extrasActive).toBe(false);
    expect(disabled.travelDateRequired).toBe(false);
  });

  it("keeps the date optional when an extra is priced", () => {
    const active = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: true,
      fastTrackThresholdDays: 4,
      catalog: [{ enabled: true, prices: [{ currency: "AED" }] }],
    });
    expect(active.extrasActive).toBe(true);
    expect(active.showTravelDateStep).toBe(true);
    expect(active.travelDateRequired).toBe(false);

    const optional = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: false,
      fastTrackThresholdDays: 4,
      catalog: [{ enabled: true, prices: [{ currency: "AED" }] }],
    });
    expect(optional.extrasActive).toBe(true);
    expect(optional.travelDateRequired).toBe(false);
    const hidden = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: false,
      showTravelDateStep: false,
      fastTrackThresholdDays: 4,
      catalog: [{ enabled: true, prices: [{ currency: "AED" }] }],
    });
    expect(hidden.showTravelDateStep).toBe(false);
  });
});
