import { describe, expect, it } from "vitest";
import { buildQuotePreview } from "./party-checkout-quote";
import type { TCheckoutExtraCatalog } from "./party-checkout-quote";
import { checkoutTravelDateError, planTripUpdate, planTripWrite, tripEditsLocked } from "./trip-rules";
import { buildCheckoutCharge, resolveCheckoutExtras } from "@/lib/pricing/resolve-checkout-extras";

const NOW = new Date("2026-11-23T20:00:00.000Z");
const TODAY = "2026-11-24";

const catalog: TCheckoutExtraCatalog[] = [
  {
    id: "travel_insurance",
    key: "travel_insurance",
    enabled: true,
    chargeBasis: "per_traveller",
    prices: [{ currency: "AED", amountMinor: 7900 }],
    labelI18n: { en: "Travel insurance" },
    descriptionI18n: {},
    promiseI18n: null,
    termsUrl: "https://example.com/policy",
  },
  {
    id: "fast_track",
    key: "fast_track",
    enabled: true,
    chargeBasis: "per_traveller",
    prices: [{ currency: "AED", amountMinor: 36725 }],
    labelI18n: { en: "Fast Track" },
    descriptionI18n: {},
    promiseI18n: { en: "within 24 hours" },
    termsUrl: null,
  },
];

const members = [
  {
    applicationId: "app-a",
    serviceId: "svc-1",
    nationalityCode: "GB",
    paymentStatus: "unpaid",
    checkoutState: "none",
  },
  {
    applicationId: "app-b",
    serviceId: "svc-1",
    nationalityCode: "GB",
    paymentStatus: "unpaid",
    checkoutState: "none",
  },
];

const basePlan = {
  locked: false,
  memberIds: ["app-a", "app-b"],
  todayUae: TODAY,
  maxTravelDate: "2027-05-23",
  travelDateRequired: true,
  thresholdDays: 4,
  fastTrackAvailable: true,
  insuranceAvailable: true,
  now: NOW,
};

describe("trip locking", () => {
  it("rejects changes while a payment attempt is open and does not abandon checkout", () => {
    expect(tripEditsLocked([{ paymentStatus: "checkout_created", checkoutState: "pending" }])).toBe(true);
    expect(tripEditsLocked([{ paymentStatus: "unpaid", checkoutState: "pending" }])).toBe(true);
    expect(tripEditsLocked([{ paymentStatus: "paid", checkoutState: "none" }])).toBe(true);
    expect(tripEditsLocked([{ paymentStatus: "unpaid", checkoutState: "none" }])).toBe(false);
    expect(tripEditsLocked([{ paymentStatus: "failed", checkoutState: "none" }])).toBe(false);

    expect(planTripWrite(true)).toEqual({ allow: false, abandonCheckout: false, code: "EXTRAS_LOCKED" });
    expect(planTripWrite(false).abandonCheckout).toBe(false);

    const planned = planTripUpdate({
      ...basePlan,
      locked: true,
      stored: {
        travelDate: "2026-12-20",
        processingSpeed: "standard",
        processingSpeedSource: "customer",
        insuranceSelectedByApplicationId: {},
      },
      patch: { processingSpeed: "fast_track", travelInsurance: true },
    });
    expect(planned).toMatchObject({
      ok: false,
      abandonCheckout: false,
      code: "EXTRAS_LOCKED",
      reason: "extras_locked",
    });
  });
});

describe("system preselect", () => {
  const stored = {
    travelDate: null,
    processingSpeed: null,
    processingSpeedSource: null,
    insuranceSelectedByApplicationId: {},
  };

  it("preselects Fast Track under 4 days and Standard at 4 and 5", () => {
    const soon = planTripUpdate({ ...basePlan, stored, patch: { travelDate: "2026-11-27" } });
    const onThreshold = planTripUpdate({ ...basePlan, stored, patch: { travelDate: "2026-11-28" } });
    const later = planTripUpdate({ ...basePlan, stored, patch: { travelDate: "2026-11-29" } });
    expect(soon.ok && soon.next.processingSpeed).toBe("fast_track");
    expect(soon.ok && soon.next.processingSpeedSource).toBe("system");
    expect(onThreshold.ok && onThreshold.next.processingSpeed).toBe("standard");
    expect(later.ok && later.next.processingSpeed).toBe("standard");
  });

  it("does not overwrite a customer choice when the date moves under the threshold", () => {
    const planned = planTripUpdate({
      ...basePlan,
      stored: {
        travelDate: "2026-12-20",
        processingSpeed: "standard",
        processingSpeedSource: "customer",
        insuranceSelectedByApplicationId: { "app-a": false, "app-b": false },
      },
      patch: { travelDate: "2026-11-27" },
    });
    expect(planned.ok && planned.next).toMatchObject({
      travelDate: "2026-11-27",
      processingSpeed: "standard",
      processingSpeedSource: "customer",
    });
    expect(planned.ok && planned.abandonCheckout).toBe(false);
  });

  it("keeps Fast Track out of the checkout total when the customer chose Standard", () => {
    const extras = resolveCheckoutExtras({
      currency: "AED",
      members,
      catalog,
      insuranceSelectedByApplicationId: {},
      processingSpeed: "standard",
    });
    const charge = buildCheckoutCharge({
      visaLines: members.map((member) => ({
        applicationId: member.applicationId,
        serviceId: member.serviceId,
        amountMinor: BigInt(35000),
        currency: "AED",
      })),
      extraLines: extras.lines,
      currency: "AED",
      fxSource: null,
      travelDate: "2026-11-27",
      processingSpeed: "standard",
    });
    expect(charge.totalMinor).toBe(BigInt(70000));
    expect(charge.ziinaAmountMinor).toBe(charge.fincraAmountMinor);
  });
});

describe("checkout travel date gate", () => {
  it("requires an arrival date only once an extra is enabled", () => {
    expect(
      checkoutTravelDateError({
        travelDate: null,
        required: true,
        todayUae: TODAY,
        maxTravelDate: "2027-05-23",
        anyExtraEnabled: false,
      }),
    ).toBeNull();
    expect(
      checkoutTravelDateError({
        travelDate: null,
        required: true,
        todayUae: TODAY,
        maxTravelDate: "2027-05-23",
        anyExtraEnabled: true,
      }),
    ).toBe("required");
    expect(
      checkoutTravelDateError({
        travelDate: "2026-11-23",
        required: true,
        todayUae: TODAY,
        maxTravelDate: "2027-05-23",
        anyExtraEnabled: false,
      }),
    ).toBe("past");
  });
});

describe("quote preview", () => {
  it("returns a unit price for every available extra, including ones that are not selected", () => {
    const preview = buildQuotePreview({
      currency: "AED",
      now: NOW,
      travelDateRequired: true,
      thresholdDays: 4,
      maxDaysAhead: 180,
      travelDate: "2026-11-29",
      storedSpeed: null,
      storedSource: null,
      members,
      visaAmounts: { "app-a": BigInt(35000), "app-b": BigInt(35000) },
      catalog,
      insuranceSelectedByApplicationId: {},
    });

    expect(preview.daysUntilTravel).toBe(5);
    expect(preview.recommendFastTrack).toBe(false);
    expect(preview.processingSpeed).toBe("standard");
    expect(preview.availableExtras.map((extra) => extra.key)).toEqual(["travel_insurance", "fast_track"]);
    expect(preview.availableExtras.find((extra) => extra.key === "fast_track")).toMatchObject({
      unitAmountMinor: "36725",
      travellerCount: 2,
      sumAmountMinor: String(36725 * 2),
      selected: false,
    });
    expect(preview.extraLines).toEqual([]);
    expect(preview.totalAmountMinor).toBe("70000");
    expect(preview.todayUae).toBe(TODAY);
    expect(preview.maxTravelDate).toBe("2027-05-23");
  });

  it("includes the system Fast Track preselect in the total when arrival is in 3 days", () => {
    const preview = buildQuotePreview({
      currency: "AED",
      now: NOW,
      travelDateRequired: true,
      thresholdDays: 4,
      maxDaysAhead: 180,
      travelDate: "2026-11-27",
      storedSpeed: null,
      storedSource: null,
      members,
      visaAmounts: { "app-a": BigInt(35000), "app-b": BigInt(35000) },
      catalog,
      insuranceSelectedByApplicationId: { "app-a": true, "app-b": true },
    });

    expect(preview.recommendFastTrack).toBe(true);
    expect(preview.processingSpeed).toBe("fast_track");
    expect(preview.processingSpeedSource).toBe("system");
    expect(preview.extrasAmountMinor).toBe(String(7900 * 2 + 36725 * 2));
    expect(preview.totalAmountMinor).toBe(String(35000 * 2 + 7900 * 2 + 36725 * 2));
    expect(preview.availableExtras.find((extra) => extra.key === "travel_insurance")?.selected).toBe(true);
  });
});
