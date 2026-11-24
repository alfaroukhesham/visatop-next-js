import { describe, expect, it } from "vitest";
import { toCheckoutExtraAdmin } from "@/lib/checkout-extras/map-extra";
import { planExtraPriceWrites } from "@/lib/checkout-extras/price-plan";
import { suggestMissingGlobalPrice } from "@/lib/checkout-extras/suggest-global-price";
import { travelDateSettingsFromRows } from "@/lib/checkout-extras/travel-date-settings";
import {
  checkoutExtraWriteBodySchema,
  prepareCheckoutExtraWrite,
  travelDateSettingsWriteSchema,
} from "@/lib/checkout-extras/validation";

const insuranceBody = {
  enabled: false,
  chargeBasis: "per_traveller" as const,
  baseCurrency: "AED",
  baseAmountMajor: "79",
  labels: { en: "Travel insurance", fr: "  " },
  descriptions: { en: "Cover for the trip" },
  promise: null,
  termsUrl: "https://example.com/policy",
  prices: [
    { currency: "AED", amountMajor: "79" },
    { currency: "USD", amountMajor: "" },
    { currency: "NGN", amountMajor: "" },
    { currency: "ZAR", amountMajor: "" },
  ],
};

describe("prepareCheckoutExtraWrite", () => {
  it("keeps the admin-entered AED price and drops blank currencies", () => {
    const parsed = checkoutExtraWriteBodySchema.parse(insuranceBody);
    const prepared = prepareCheckoutExtraWrite("travel_insurance", parsed);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.baseAmountMinor).toBe(7900);
    expect(prepared.value.prices).toEqual([{ currency: "AED", amountMinor: 7900 }]);
    expect(prepared.value.labelI18n).toEqual({ en: "Travel insurance" });
    expect(prepared.value.promiseI18n).toBeNull();
    expect(prepared.value.termsUrl).toBe("https://example.com/policy");
  });

  it("requires an English Fast Track promise and stores 100 USD", () => {
    const parsed = checkoutExtraWriteBodySchema.parse({
      ...insuranceBody,
      baseCurrency: "USD",
      baseAmountMajor: "100",
      labels: { en: "Fast Track" },
      descriptions: {},
      promise: { en: "within 24 hours", ar: "" },
      termsUrl: null,
      prices: [{ currency: "USD", amountMajor: "100.00" }],
    });
    const prepared = prepareCheckoutExtraWrite("fast_track", parsed);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.baseAmountMinor).toBe(10000);
    expect(prepared.value.promiseI18n).toEqual({ en: "within 24 hours" });
    expect(prepared.value.prices).toEqual([{ currency: "USD", amountMinor: 10000 }]);
  });

  it("rejects a missing English label, insurance promise text, and unknown currency", () => {
    const missingLabel = prepareCheckoutExtraWrite(
      "travel_insurance",
      checkoutExtraWriteBodySchema.parse({ ...insuranceBody, labels: { en: " " } }),
    );
    expect(missingLabel).toEqual({ ok: false, message: "English label is required." });

    const withPromise = prepareCheckoutExtraWrite(
      "travel_insurance",
      checkoutExtraWriteBodySchema.parse({ ...insuranceBody, promise: { en: "soon" } }),
    );
    expect(withPromise.ok).toBe(false);

    const badCurrency = prepareCheckoutExtraWrite(
      "travel_insurance",
      checkoutExtraWriteBodySchema.parse({
        ...insuranceBody,
        prices: [{ currency: "EUR", amountMajor: "10" }],
      }),
    );
    expect(badCurrency).toEqual({ ok: false, message: "EUR is not a checkout currency." });
  });

  it("ignores charge basis, a default-selected flag, and a require mode", () => {
    const parsed = checkoutExtraWriteBodySchema.parse({
      ...insuranceBody,
      chargeBasis: "per_order",
      defaultSelected: true,
      fastTrackMode: "require",
    });
    expect(parsed).not.toHaveProperty("chargeBasis");
    expect(parsed).not.toHaveProperty("defaultSelected");
    expect(parsed).not.toHaveProperty("fastTrackMode");
    const prepared = prepareCheckoutExtraWrite("travel_insurance", parsed);
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value).not.toHaveProperty("chargeBasis");
  });

  it("rejects a non-http terms link and a duplicate currency", () => {
    const terms = prepareCheckoutExtraWrite(
      "travel_insurance",
      checkoutExtraWriteBodySchema.parse({ ...insuranceBody, termsUrl: "javascript:alert(1)" }),
    );
    expect(terms.ok).toBe(false);

    const duplicate = prepareCheckoutExtraWrite(
      "travel_insurance",
      checkoutExtraWriteBodySchema.parse({
        ...insuranceBody,
        prices: [
          { currency: "AED", amountMajor: "79" },
          { currency: "aed", amountMajor: "80" },
        ],
      }),
    );
    expect(duplicate).toEqual({ ok: false, message: "Duplicate price for AED." });
  });
});

describe("planExtraPriceWrites", () => {
  it("upserts changed amounts and deletes currencies the admin cleared", () => {
    expect(
      planExtraPriceWrites(
        [
          { currency: "AED", amountMinor: 7900 },
          { currency: "USD", amountMinor: 2100 },
        ],
        [{ currency: "AED", amountMinor: 8000 }],
      ),
    ).toEqual({
      upserts: [{ currency: "AED", amountMinor: 8000 }],
      deleteCurrencies: ["USD"],
    });
  });
});

describe("suggestMissingGlobalPrice", () => {
  it("fills only the blank global currency and leaves locals alone", () => {
    expect(
      suggestMissingGlobalPrice({ usdMajor: "100", aedMajor: "", fxAedPerUsd: "3.6725" }),
    ).toEqual({ currency: "AED", amountMajor: "367.25" });
    expect(
      suggestMissingGlobalPrice({ usdMajor: "", aedMajor: "79", fxAedPerUsd: "3.6725" }),
    ).toEqual({ currency: "USD", amountMajor: "21.51" });
    expect(
      suggestMissingGlobalPrice({ usdMajor: "100", aedMajor: "367.25", fxAedPerUsd: "3.6725" }),
    ).toBeNull();
    expect(suggestMissingGlobalPrice({ usdMajor: "100", aedMajor: "", fxAedPerUsd: null })).toBeNull();
    expect(suggestMissingGlobalPrice({ usdMajor: "100", aedMajor: "", fxAedPerUsd: "nope" })).toBeNull();
  });
});

describe("travel date settings", () => {
  it("uses defaults when rows are missing or invalid", () => {
    expect(travelDateSettingsFromRows([])).toEqual({
      fastTrackThresholdDays: 4,
      travelDateRequired: true,
      travelDateMaxDaysAhead: 180,
    });
    expect(
      travelDateSettingsFromRows([
        { key: "fast_track_threshold_days", value: "0" },
        { key: "travel_date_required", value: "false" },
        { key: "travel_date_max_days_ahead", value: "365" },
      ]),
    ).toEqual({
      fastTrackThresholdDays: 4,
      travelDateRequired: false,
      travelDateMaxDaysAhead: 365,
    });
  });

  it("rejects a threshold beyond the maximum days ahead", () => {
    const parsed = travelDateSettingsWriteSchema.safeParse({
      fastTrackThresholdDays: 10,
      travelDateRequired: true,
      travelDateMaxDaysAhead: 5,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("toCheckoutExtraAdmin", () => {
  it("maps stored minor units to major amounts and ignores unknown keys", () => {
    const mapped = toCheckoutExtraAdmin(
      {
        key: "fast_track",
        enabled: false,
        chargeBasis: "per_traveller",
        baseCurrency: "USD",
        baseAmountMinor: 10000,
        labelI18n: { en: "Fast Track" },
        descriptionI18n: {},
        promiseI18n: { en: "within 24 hours" },
        termsUrl: null,
        sortOrder: 1,
      },
      [{ currency: "USD", amountMinor: 10000 }],
    );
    expect(mapped?.baseAmountMajor).toBe("100.00");
    expect(mapped?.prices).toEqual([{ currency: "USD", amountMinor: 10000, amountMajor: "100.00" }]);
    expect(mapped?.promise).toEqual({ en: "within 24 hours" });
    expect(
      toCheckoutExtraAdmin(
        {
          key: "legacy",
          enabled: true,
          chargeBasis: "per_order",
          baseCurrency: "USD",
          baseAmountMinor: 1,
          labelI18n: {},
          descriptionI18n: {},
          promiseI18n: null,
          termsUrl: null,
          sortOrder: 0,
        },
        [],
      ),
    ).toBeNull();
  });
});
