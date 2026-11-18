import { describe, expect, it } from "vitest";
import { resolveLocalCurrencyPriceNationality } from "./resolve-local-currency-price-nationality";

describe("resolveLocalCurrencyPriceNationality", () => {
  it("keeps the current selection when it is still linked", () => {
    expect(resolveLocalCurrencyPriceNationality(["NG", "GH"], "GH")).toBe("GH");
  });

  it("defaults to the first linked nationality when switching currencies", () => {
    expect(resolveLocalCurrencyPriceNationality(["ZA"], "NG")).toBe("ZA");
  });

  it("returns empty when the currency has no linked nationalities", () => {
    expect(resolveLocalCurrencyPriceNationality([], "NG")).toBe("");
  });
});