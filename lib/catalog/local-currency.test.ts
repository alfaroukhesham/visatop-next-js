import { describe, expect, it } from "vitest";
import {
  assertSelectedCatalogCurrency,
  isIso4217CurrencyCode,
  pickDefaultCatalogCurrency,
  resolvePublicCatalogCurrencyQuery,
  visibleCurrenciesForNationality,
  type TVisibleCatalogCurrency,
} from "./local-currency";

const globals: TVisibleCatalogCurrency[] = [
  { code: "USD", kind: "global" },
  { code: "AED", kind: "global" },
];

const ngn: TVisibleCatalogCurrency = { code: "NGN", kind: "local" };

describe("isIso4217CurrencyCode", () => {
  it("accepts uppercase 3-letter codes", () => {
    expect(isIso4217CurrencyCode("USD")).toBe(true);
    expect(isIso4217CurrencyCode("NGN")).toBe(true);
  });

  it("rejects non-ISO shapes", () => {
    expect(isIso4217CurrencyCode("usd")).toBe(false);
    expect(isIso4217CurrencyCode("EURO")).toBe(false);
    expect(isIso4217CurrencyCode("US")).toBe(false);
    expect(isIso4217CurrencyCode("")).toBe(false);
  });
});

describe("pickDefaultCatalogCurrency", () => {
  it("keeps a restored currency when it is still visible", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: [...globals, ngn],
        localPricedServiceIds: ["svc-1"],
        selectedServiceId: "svc-1",
        restored: "AED",
      }),
    ).toBe("AED");
  });

  it("defaults to the local currency when the selected service has a local price", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: [...globals, ngn],
        localPricedServiceIds: ["svc-ngn"],
        selectedServiceId: "svc-ngn",
      }),
    ).toBe("NGN");
  });

  it("defaults to USD when the selected service has no local price", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: [...globals, ngn],
        localPricedServiceIds: ["svc-ngn"],
        selectedServiceId: "svc-usd-only",
      }),
    ).toBe("USD");
  });

  it("defaults to the local currency when no service is selected but any local price exists", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: [...globals, ngn],
        localPricedServiceIds: ["svc-ngn"],
        selectedServiceId: null,
      }),
    ).toBe("NGN");
  });

  it("defaults to USD when a local currency is visible but no local prices exist", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: [...globals, ngn],
        localPricedServiceIds: [],
        selectedServiceId: null,
      }),
    ).toBe("USD");
  });

  it("ignores a restored currency that is not visible (e.g. another nationality's local)", () => {
    expect(
      pickDefaultCatalogCurrency({
        visible: globals,
        localPricedServiceIds: [],
        restored: "NGN",
      }),
    ).toBe("USD");
  });
});

describe("visibleCurrenciesForNationality", () => {
  const currencies = [
    { code: "USD", kind: "global", enabled: true },
    { code: "AED", kind: "global", enabled: true },
    { code: "NGN", kind: "local", enabled: true },
    { code: "KES", kind: "local", enabled: true },
    { code: "GHS", kind: "local", enabled: false },
  ];
  const links = [
    { currencyCode: "NGN", nationalityCode: "NG" },
    { currencyCode: "KES", nationalityCode: "KE" },
    { currencyCode: "GHS", nationalityCode: "GH" },
  ];

  it("shows globals to everyone and local currency only to linked nationality", () => {
    expect(visibleCurrenciesForNationality(currencies, links, "NG").map((c) => c.code)).toEqual([
      "USD",
      "AED",
      "NGN",
    ]);
    expect(visibleCurrenciesForNationality(currencies, links, "US").map((c) => c.code)).toEqual([
      "USD",
      "AED",
    ]);
    expect(visibleCurrenciesForNationality(currencies, links, "KE").map((c) => c.code)).toEqual([
      "USD",
      "AED",
      "KES",
    ]);
  });

  it("hides disabled local currencies even when linked", () => {
    expect(visibleCurrenciesForNationality(currencies, links, "GH").map((c) => c.code)).toEqual([
      "USD",
      "AED",
    ]);
  });
});

describe("resolvePublicCatalogCurrencyQuery", () => {
  const visible: TVisibleCatalogCurrency[] = [...globals, ngn];

  it("accepts NGN for a nationality that can see it", () => {
    expect(
      resolvePublicCatalogCurrencyQuery({
        requested: "ngn",
        visible,
        localPricedServiceIds: ["svc-1"],
      }),
    ).toEqual({ ok: true, currency: "NGN" });
  });

  it("rejects NGN when it is not visible", () => {
    expect(
      resolvePublicCatalogCurrencyQuery({
        requested: "NGN",
        visible: globals,
        localPricedServiceIds: [],
      }),
    ).toEqual({ ok: false, reason: "invalid" });
  });

  it("defaults to local currency when omitted and a local price exists", () => {
    expect(
      resolvePublicCatalogCurrencyQuery({
        requested: null,
        visible,
        localPricedServiceIds: ["svc-1"],
      }),
    ).toEqual({ ok: true, currency: "NGN" });
  });
});

describe("assertSelectedCatalogCurrency", () => {
  const visible: TVisibleCatalogCurrency[] = [
    { code: "USD", kind: "global" },
    { code: "AED", kind: "global" },
    { code: "NGN", kind: "local" },
  ];

  it("allows a linked local currency when a stored price exists", () => {
    expect(
      assertSelectedCatalogCurrency({
        selected: "ngn",
        visible,
        hasStoredPrice: true,
      }),
    ).toEqual({ ok: true, currency: "NGN", kind: "local" });
  });

  it("rejects a local currency with no stored price", () => {
    expect(
      assertSelectedCatalogCurrency({
        selected: "NGN",
        visible,
        hasStoredPrice: false,
      }),
    ).toEqual({ ok: false, reason: "missing_stored_price" });
  });

  it("rejects a local currency that is not linked to this nationality", () => {
    expect(
      assertSelectedCatalogCurrency({
        selected: "NGN",
        visible: [
          { code: "USD", kind: "global" },
          { code: "AED", kind: "global" },
        ],
        hasStoredPrice: true,
      }),
    ).toEqual({ ok: false, reason: "not_visible" });
  });

  it("allows global USD without a stored-row check (FX may fill it)", () => {
    expect(
      assertSelectedCatalogCurrency({
        selected: "USD",
        visible,
        hasStoredPrice: false,
      }),
    ).toEqual({ ok: true, currency: "USD", kind: "global" });
  });
});
