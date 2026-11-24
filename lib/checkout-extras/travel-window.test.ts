import { describe, expect, it } from "vitest";
import { travelWindowPayload } from "@/lib/checkout-extras/travel-window";

const NOW = new Date("2026-06-01T08:00:00.000Z");

describe("travel window while extras are off", () => {
  it("does not require a date when the setting defaults on and no extra is priced", () => {
    const window = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: true,
      fastTrackThresholdDays: 4,
      catalog: [],
    });
    expect(window.extrasActive).toBe(false);
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

  it("requires the date only when the setting is on and an extra is priced", () => {
    const active = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: true,
      fastTrackThresholdDays: 4,
      catalog: [{ enabled: true, prices: [{ currency: "AED" }] }],
    });
    expect(active.extrasActive).toBe(true);
    expect(active.travelDateRequired).toBe(true);

    const optional = travelWindowPayload({
      now: NOW,
      maxDaysAhead: 180,
      settingRequired: false,
      fastTrackThresholdDays: 4,
      catalog: [{ enabled: true, prices: [{ currency: "AED" }] }],
    });
    expect(optional.extrasActive).toBe(true);
    expect(optional.travelDateRequired).toBe(false);
  });
});
