import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK_CUSTOMER_LOCALE_SLUGS } from "@/lib/i18n/customer-locale";
import { lookupCustomerMessage } from "@/lib/i18n/customer-messages";
import {
  didSwitchBackToStandard,
  extrasSectionVisible,
  outcomeFromTripSave,
  pluralMessage,
  relativeArrivalLabel,
  speedUi,
  type TClientQuotePreview,
  type TTranslate,
} from "@/lib/apply/checkout-extras-ui";

const catalog: Record<string, string> = {
  "relative.today": "today",
  "relative.tomorrow": "tomorrow",
  "relative.inDays_other": "in {n} days",
  "relative.inDays_two": "بعد يومين",
  "extras.travellers_few": "مسافرين",
};

const t: TTranslate = (key, vars) => {
  const raw = catalog[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    raw,
  );
};

const preview = (patch: Partial<TClientQuotePreview> = {}): TClientQuotePreview => ({
  currency: "AED",
  todayUae: "2026-11-24",
  maxTravelDate: "2027-05-23",
  travelDateRequired: true,
  thresholdDays: 4,
  travelDate: "2026-11-26",
  daysUntilTravel: 2,
  recommendFastTrack: true,
  processingSpeed: "fast_track",
  processingSpeedSource: "system",
  locked: false,
  travellerCount: 1,
  visaLines: [],
  extraLines: [],
  availableExtras: [],
  visaAmountMinor: "35000",
  extrasAmountMinor: "0",
  totalAmountMinor: "35000",
  ...patch,
});

describe("extras section visibility", () => {
  it("renders nothing when the quote offers no extras", () => {
    expect(extrasSectionVisible(preview())).toBe(false);
  });

  it("renders when fast track or insurance is available", () => {
    expect(
      extrasSectionVisible(
        preview({
          availableExtras: [
            {
              key: "fast_track",
              unitAmountMinor: "36725",
              travellerCount: 1,
              sumAmountMinor: "36725",
              selected: true,
              chargeBasis: "per_traveller",
              labelI18n: {},
              descriptionI18n: {},
              promiseI18n: null,
              termsUrl: null,
            },
          ],
        }),
      ),
    ).toBe(true);
  });
});

describe("speed recommendation", () => {
  it("preselects fast track and shows the badge when the preview recommends it", () => {
    expect(
      speedUi({
        preview: preview(),
        fastTrackAvailable: true,
        switchedBack: false,
      }),
    ).toEqual({
      showRadios: true,
      selected: "fast_track",
      badge: true,
      note: "n1",
    });
  });

  it("keeps a customer Standard choice and warns without blocking", () => {
    expect(
      speedUi({
        preview: preview({
          processingSpeed: "standard",
          processingSpeedSource: "customer",
        }),
        fastTrackAvailable: true,
        switchedBack: false,
      }),
    ).toEqual({
      showRadios: true,
      selected: "standard",
      badge: true,
      note: "n2",
    });
  });

  it("hides the speed cards when fast track is not available", () => {
    expect(
      speedUi({
        preview: preview({ processingSpeed: "standard", processingSpeedSource: "system" }),
        fastTrackAvailable: false,
        switchedBack: false,
      }).showRadios,
    ).toBe(false);
  });

  it("uses a same-day caution instead of the recommendation note", () => {
    expect(
      speedUi({
        preview: preview({ daysUntilTravel: 0 }),
        fastTrackAvailable: true,
        switchedBack: false,
      }).note,
    ).toBe("n3");
  });
});

describe("409 lock handling", () => {
  it("treats a frozen checkout as locked and leaves the previous quote in place", () => {
    expect(
      outcomeFromTripSave({
        aborted: false,
        ok: false,
        status: 409,
        code: "CHECKOUT_FROZEN",
      }),
    ).toEqual({ kind: "locked" });
  });

  it("keeps a failed update distinct from a lock", () => {
    expect(
      outcomeFromTripSave({
        aborted: false,
        ok: false,
        status: 400,
        code: "VALIDATION_ERROR",
        reason: "travel_date_past",
      }),
    ).toEqual({ kind: "failed", messageKey: "start.travelDate.errorPast" });
  });

  it("ignores an aborted save so the latest change wins", () => {
    expect(outcomeFromTripSave({ aborted: true, ok: false, status: 0 })).toEqual({ kind: "ignored" });
  });
});

describe("customer copy", () => {
  it("includes the extras strings in every locale", () => {
    const keys = [
      "start.travelDate.label",
      "start.travelDate.hint",
      "relative.inDays_one",
      "relative.inDays_two",
      "relative.inDays_few",
      "relative.inDays_many",
      "relative.inDays_other",
      "extras.sectionTitle",
      "extras.speed.badge",
      "extras.notes.n1",
      "extras.locked",
      "extras.error.fastTrackUnavailable",
      "extras.error.insuranceUnavailable",
      "extras.travellers_other",
      "common.opensNewTab",
    ];
    for (const slug of FALLBACK_CUSTOMER_LOCALE_SLUGS) {
      const messages = JSON.parse(
        readFileSync(new URL(`../../messages/customer/${slug}.json`, import.meta.url), "utf8"),
      ) as unknown;
      for (const key of keys) {
        expect(lookupCustomerMessage(messages, key), `${slug} ${key}`).toEqual(expect.any(String));
      }
    }
  });
});

describe("date change copy helpers", () => {
  it("notices when the server returns a system choice to Standard", () => {
    const before = preview();
    const after = preview({
      travelDate: "2026-12-20",
      daysUntilTravel: 26,
      recommendFastTrack: false,
      processingSpeed: "standard",
      processingSpeedSource: "system",
    });
    expect(didSwitchBackToStandard(before, after)).toBe(true);
  });

  it("uses Arabic plural forms for the read-back", () => {
    expect(relativeArrivalLabel("en", 2, t)).toBe("in 2 days");
    expect(relativeArrivalLabel("ar", 2, t)).toBe("بعد يومين");
    expect(pluralMessage(t, "extras.travellers", "ar", 3)).toBe("مسافرين");
    expect(relativeArrivalLabel("en", 0, t)).toBe("today");
    expect(relativeArrivalLabel("en", 1, t)).toBe("tomorrow");
  });
});
