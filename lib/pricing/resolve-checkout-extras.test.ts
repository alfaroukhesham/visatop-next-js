import { describe, expect, it } from "vitest";
import type { TCheckoutExtraCatalogItem } from "./resolve-checkout-extras";
import { buildCheckoutCharge, resolveCheckoutExtras } from "./resolve-checkout-extras";

const members = [{ applicationId: "app-a" }, { applicationId: "app-b" }];

const insurance = (
  prices: TCheckoutExtraCatalogItem["prices"],
  enabled = true,
): TCheckoutExtraCatalogItem => ({
  id: "travel_insurance",
  key: "travel_insurance",
  enabled,
  chargeBasis: "per_traveller",
  prices,
});

const fastTrack = (
  prices: TCheckoutExtraCatalogItem["prices"],
  enabled = true,
): TCheckoutExtraCatalogItem => ({
  id: "fast_track",
  key: "fast_track",
  enabled,
  chargeBasis: "per_traveller",
  prices,
});

const visaLines = [
  { applicationId: "app-a", serviceId: "svc-1", amountMinor: BigInt(35000), currency: "AED" },
  { applicationId: "app-b", serviceId: "svc-1", amountMinor: BigInt(35000), currency: "AED" },
];

describe("resolveCheckoutExtras", () => {
  it("adds each selected extra once per traveller in the checkout currency", () => {
    const quote = resolveCheckoutExtras({
      currency: "AED",
      members,
      catalog: [insurance([{ currency: "AED", amountMinor: 7900 }]), fastTrack([{ currency: "AED", amountMinor: 36725 }])],
      insuranceSelectedByApplicationId: { "app-a": true, "app-b": true },
      processingSpeed: "fast_track",
    });

    expect(quote.extrasTotalMinor).toBe(BigInt(7900 * 2 + 36725 * 2));
    expect(quote.lines).toHaveLength(4);
    expect(quote.dropped).toEqual([]);
    expect(quote.availability.find((item) => item.key === "travel_insurance")?.unitAmountMinor).toBe(BigInt(7900));
    expect(quote.availability.find((item) => item.key === "fast_track")?.available).toBe(true);
  });

  it("keeps an unselected extra available with a unit price and out of the total", () => {
    const quote = resolveCheckoutExtras({
      currency: "AED",
      members,
      catalog: [insurance([{ currency: "AED", amountMinor: 7900 }]), fastTrack([{ currency: "AED", amountMinor: 36725 }])],
      insuranceSelectedByApplicationId: {},
      processingSpeed: "standard",
    });

    expect(quote.lines).toEqual([]);
    expect(quote.extrasTotalMinor).toBe(BigInt(0));
    expect(quote.availability.filter((item) => item.available).map((item) => item.key)).toEqual([
      "travel_insurance",
      "fast_track",
    ]);
  });

  it("drops a selected extra that has no price in the checkout currency", () => {
    const quote = resolveCheckoutExtras({
      currency: "NGN",
      members,
      catalog: [
        insurance([
          { currency: "AED", amountMinor: 7900 },
          { currency: "NGN", amountMinor: 1500000 },
        ]),
        fastTrack([{ currency: "USD", amountMinor: 10000 }]),
      ],
      insuranceSelectedByApplicationId: { "app-a": true, "app-b": true },
      processingSpeed: "fast_track",
    });

    expect(quote.dropped).toEqual([{ key: "fast_track", reason: "missing_currency_price" }]);
    expect(quote.lines.map((line) => line.key)).toEqual(["travel_insurance", "travel_insurance"]);
    expect(quote.extrasTotalMinor).toBe(BigInt(1500000 * 2));
    expect(quote.availability.find((item) => item.key === "fast_track")).toMatchObject({
      available: false,
      reason: "missing_currency_price",
      unitAmountMinor: null,
    });
  });

  it("drops a disabled extra even when a price row exists", () => {
    const quote = resolveCheckoutExtras({
      currency: "AED",
      members,
      catalog: [insurance([{ currency: "AED", amountMinor: 7900 }], false)],
      insuranceSelectedByApplicationId: { "app-a": true },
      processingSpeed: "standard",
    });

    expect(quote.lines).toEqual([]);
    expect(quote.dropped).toEqual([{ key: "travel_insurance", reason: "disabled" }]);
  });
});

describe("checkout totals", () => {
  it("charges Ziina and Fincra the visa total plus the extras lines", () => {
    const extras = resolveCheckoutExtras({
      currency: "AED",
      members,
      catalog: [insurance([{ currency: "AED", amountMinor: 7900 }]), fastTrack([{ currency: "AED", amountMinor: 36725 }])],
      insuranceSelectedByApplicationId: { "app-a": true, "app-b": true },
      processingSpeed: "fast_track",
    });
    const charge = buildCheckoutCharge({
      visaLines,
      extraLines: extras.lines,
      currency: "AED",
      fxSource: null,
      travelDate: "2026-11-27",
      processingSpeed: "fast_track",
    });

    const expected = BigInt(35000 * 2 + 7900 * 2 + 36725 * 2);
    expect(charge.totalMinor).toBe(expected);
    expect(charge.ziinaAmountMinor).toBe(charge.totalMinor);
    expect(charge.fincraAmountMinor).toBe(charge.totalMinor);
    const breakdown = JSON.parse(charge.breakdownJson) as {
      version: number;
      amountMinor: string;
      extras: Array<{ key: string; amountMinor: string }>;
      lines: Array<{ amountMinor: string }>;
    };
    expect(breakdown.version).toBe(2);
    expect(breakdown.amountMinor).toBe(expected.toString());
    expect(breakdown.extras).toHaveLength(4);
    const extrasSum = breakdown.extras.reduce((sum, line) => sum + BigInt(line.amountMinor), BigInt(0));
    const visaSum = breakdown.lines.reduce((sum, line) => sum + BigInt(line.amountMinor), BigInt(0));
    expect(visaSum + extrasSum).toBe(expected);
  });

  it("leaves the provider total at the visa price when the extra currency is missing", () => {
    const extras = resolveCheckoutExtras({
      currency: "ZAR",
      members: [{ applicationId: "app-a" }],
      catalog: [fastTrack([{ currency: "USD", amountMinor: 10000 }])],
      insuranceSelectedByApplicationId: {},
      processingSpeed: "fast_track",
    });
    const charge = buildCheckoutCharge({
      visaLines: [{ applicationId: "app-a", serviceId: "svc-1", amountMinor: BigInt(120000), currency: "ZAR" }],
      extraLines: extras.lines,
      currency: "ZAR",
      fxSource: "fixed_list",
      travelDate: "2026-11-27",
      processingSpeed: "fast_track",
    });

    expect(extras.dropped).toEqual([{ key: "fast_track", reason: "missing_currency_price" }]);
    expect(charge.totalMinor).toBe(BigInt(120000));
    expect(charge.ziinaAmountMinor).toBe(charge.fincraAmountMinor);
    expect(JSON.parse(charge.breakdownJson).extras).toEqual([]);
  });
});
